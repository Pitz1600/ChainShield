const axios = require('axios');
const AuditLog = require('../models/AuditLog');

function expectedHostname() {
    if (process.env.TURNSTILE_EXPECTED_HOSTNAME) return process.env.TURNSTILE_EXPECTED_HOSTNAME;
    try { return new URL(process.env.FRONTEND_URL).hostname; } catch { return ''; }
}

function validateCaptchaConfig() {
    const enabled = process.env.CAPTCHA_ENABLED === 'true';
    if (process.env.NODE_ENV === 'production' && !enabled) {
        throw new Error('CAPTCHA_ENABLED must be true in production');
    }
    if (enabled && (!process.env.TURNSTILE_SECRET_KEY || !expectedHostname())) {
        throw new Error('CAPTCHA requires TURNSTILE_SECRET_KEY and TURNSTILE_EXPECTED_HOSTNAME or FRONTEND_URL');
    }
    if (process.env.NODE_ENV === 'production' && /^([123])x0{10}/.test(process.env.TURNSTILE_SECRET_KEY || '')) {
        throw new Error('Turnstile test secrets cannot be used in production');
    }
}

function verifyCaptcha(expectedAction) {
    return async (req, res, next) => {
        const token = req.body?.captchaToken;
        if (req.body) delete req.body.captchaToken;
        if (process.env.CAPTCHA_ENABLED !== 'true' && process.env.NODE_ENV !== 'production') return next();

        let errors = [];
        if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
            errors = ['invalid-token'];
        } else if (!process.env.TURNSTILE_SECRET_KEY || !expectedHostname()) {
            errors = ['configuration-error'];
        } else {
            try {
                const { data } = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                    secret: process.env.TURNSTILE_SECRET_KEY,
                    response: token,
                    remoteip: req.ip
                }, { timeout: 5000 });
                if (data?.success === true && data.action === expectedAction && data.hostname === expectedHostname()) return next();
                errors = Array.isArray(data?.['error-codes'])
                    ? data['error-codes'].filter(code => typeof code === 'string' && /^[a-z-]{1,80}$/.test(code)) : [];
                if (data?.action !== expectedAction) errors.push('action-mismatch');
                if (data?.hostname !== expectedHostname()) errors.push('hostname-mismatch');
            } catch {
                // Axios errors contain the request body, including credentials; never log them.
                errors = ['provider-unavailable'];
            }
        }
        req.captchaFailed = true;
        // Keep audit storage failures from delaying or changing the fail-closed response.
        Promise.resolve().then(() => AuditLog.logAction({
            action: 'captcha_failed',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: { route: req.originalUrl?.split('?')[0], action: expectedAction, providerErrorCodes: errors },
            isSuspicious: true,
            suspiciousReason: 'CAPTCHA verification failed'
        })).catch(() => console.warn('CAPTCHA audit logging failed'));
        return res.status(400).json({ error: 'Captcha verification failed. Please try again.', code: 'CAPTCHA_FAILED' });
    };
}

module.exports = { verifyCaptcha, validateCaptchaConfig };
