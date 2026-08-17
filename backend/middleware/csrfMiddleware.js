/**
 * CSRF Protection — Double-Submit Cookie Pattern
 *
 * Why not csurf? It was deprecated and removed from npm in 2023.
 * This implements the OWASP-recommended Double-Submit Cookie pattern:
 *
 *   1. Server issues a signed CSRF token via GET /api/auth/csrf-token
 *   2. Token is stored in a non-HttpOnly cookie (readable by JS) AND returned in JSON
 *   3. Frontend must send the token as X-CSRF-Token header on every mutating request
 *   4. Middleware validates header === cookie value (cross-origin requests can't read cookies)
 *
 * Security properties:
 *   - Signed with JWT_SECRET to prevent forgery
 *   - SameSite=Strict on auth cookie provides additional defense-in-depth
 *   - Safe methods (GET, HEAD, OPTIONS) are exempt
 */

const crypto = require('crypto');

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generate a cryptographically secure CSRF token.
 * Signed with a portion of JWT_SECRET to prevent token forgery.
 */
const generateCsrfToken = () => {
    const random = crypto.randomBytes(32).toString('hex');
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const hmac = crypto.createHmac('sha256', secret).update(random).digest('hex');
    return `${random}.${hmac}`;
};

/**
 * Validate a CSRF token (verify the HMAC signature).
 */
const validateCsrfToken = (token) => {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [random, providedHmac] = parts;
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const expectedHmac = crypto.createHmac('sha256', secret).update(random).digest('hex');
    // Constant-time comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(providedHmac, 'hex'),
            Buffer.from(expectedHmac, 'hex')
        );
    } catch {
        return false;
    }
};

/**
 * Middleware: issue a CSRF token cookie + JSON response.
 * Mount at: GET /api/auth/csrf-token
 */
const issueCsrfToken = (req, res) => {
    const token = generateCsrfToken();

    // Non-HttpOnly so JavaScript can read it and send as header
    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({ csrfToken: token });
};

/**
 * Middleware: validate CSRF token on mutating requests.
 * Skips safe methods (GET, HEAD, OPTIONS).
 * Skips OAuth callback routes (server-to-server, no browser cookie).
 */
const csrfProtection = (req, res, next) => {
    // Skip safe methods
    if (SAFE_METHODS.has(req.method)) return next();

    // Skip health check
    if (req.path === '/health') return next();

    // Skip public auth routes — these are unauthenticated so there's no session
    // to hijack. They're already protected by rate limiting.
    const PUBLIC_AUTH_PATHS = new Set([
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/verify-login-otp',
        '/api/auth/resend-login-otp',
        '/api/auth/verify-email',
        '/api/auth/resend-otp',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
        '/api/auth/csrf-token',
    ]);
    const reqPath = req.originalUrl.split('?')[0];
    if (PUBLIC_AUTH_PATHS.has(reqPath)) return next();

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];

    if (!cookieToken || !headerToken) {
        return res.status(403).json({
            error: 'CSRF token missing. Please refresh the page and try again.',
        });
    }

    if (cookieToken !== headerToken) {
        console.log('[CSRF-DEBUG] Blocked: Token mismatch');
        console.log(`[CSRF-DEBUG] Cookie: ${cookieToken}`);
        console.log(`[CSRF-DEBUG] Header: ${headerToken}`);
        return res.status(403).json({
            error: 'CSRF token mismatch. Please refresh the page and try again.',
        });
    }

    if (!validateCsrfToken(cookieToken)) {
        console.log('[CSRF-DEBUG] Blocked: Invalid signature');
        return res.status(403).json({
            error: 'Invalid CSRF token. Please refresh the page and try again.',
        });
    }

    next();
};

module.exports = { issueCsrfToken, csrfProtection, generateCsrfToken };
