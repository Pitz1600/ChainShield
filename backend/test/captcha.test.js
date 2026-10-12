const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const AuditLog = require('../models/AuditLog');
const { verifyCaptcha, validateCaptchaConfig } = require('../middleware/captcha');
const originalPost = axios.post;
const originalLog = AuditLog.logAction;
const originalEnv = { ...process.env };
let logs;
let calls;
beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.CAPTCHA_ENABLED = 'true';
    process.env.TURNSTILE_SECRET_KEY = 'mock-secret';
    process.env.TURNSTILE_EXPECTED_HOSTNAME = 'app.example.com';
    logs = []; calls = [];
    AuditLog.logAction = async entry => logs.push(entry);
    axios.post = async (...args) => {
        calls.push(args);
        return { data: { success: true, action: 'login', hostname: 'app.example.com' } };
    };
});
afterEach(() => {
    axios.post = originalPost; AuditLog.logAction = originalLog;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
});
async function invoke(body = { captchaToken: 'mock-token' }, action = 'login') {
    const req = { body, ip: '192.0.2.10', originalUrl: `/api/auth/${action}`, get: () => 'mock-browser' };
    const result = { next: false };
    const res = { status(code) { result.status = code; return this; }, json(data) { result.data = data; return this; } };
    await verifyCaptcha(action)(req, res, () => { result.next = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal('captchaToken' in body, false);
    return result;
}
async function rejected(body, action) {
    const result = await invoke(body, action);
    assert.equal(result.next, false);
    assert.equal(result.status, 400);
    assert.equal(result.data.code, 'CAPTCHA_FAILED');
    assert.equal(logs.at(-1).action, 'captcha_failed');
    assert.equal(logs.at(-1).ipAddress, '192.0.2.10');
    assert.ok(!JSON.stringify(logs).includes('mock-token'));
    assert.ok(!JSON.stringify(logs).includes('mock-secret'));
}
test('missing, malformed, and oversized tokens fail without contacting provider', async () => {
    for (const token of [undefined, null, '', ' ', {}, [], 12, 'x'.repeat(2049)]) await rejected({ captchaToken: token });
    assert.equal(calls.length, 0);
});
test('valid token passes and sends trusted request IP with a timeout', async () => {
    assert.equal((await invoke()).next, true);
    assert.equal(calls[0][1].remoteip, '192.0.2.10');
    assert.equal(calls[0][1].secret, 'mock-secret');
    assert.equal(calls[0][2].timeout, 5000);
    assert.equal(logs.length, 0);
});
test('disabled development passes and strips token', async () => {
    process.env.CAPTCHA_ENABLED = 'false';
    assert.equal((await invoke()).next, true);
    assert.equal(calls.length, 0);
});
test('provider rejection is audited', async () => {
    axios.post = async () => ({ data: { success: false, 'error-codes': ['invalid-input-response'] } });
    await rejected();
    assert.ok(logs[0].details.providerErrorCodes.includes('invalid-input-response'));
});
test('timeouts and network errors fail closed', async () => {
    for (const code of ['ECONNABORTED', 'ENOTFOUND']) {
        axios.post = async () => { throw Object.assign(new Error('contains mock-secret mock-token'), { code }); };
        await rejected();
    }
});
test('wrong action including login token on registration fails', async () => { await rejected({ captchaToken: 'mock-token' }, 'register'); });
test('wrong hostname fails', async () => {
    axios.post = async () => ({ data: { success: true, action: 'login', hostname: 'evil.example.com' } });
    await rejected();
});
test('malformed provider responses fail', async () => {
    for (const data of [null, {}, { success: 'true', action: 'login', hostname: 'app.example.com' }]) {
        axios.post = async () => ({ data }); await rejected();
    }
});
test('production rejects disabled CAPTCHA, missing config, and test secrets', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CAPTCHA_ENABLED = 'false';
    assert.throws(validateCaptchaConfig);
    axios.post = async () => ({ data: { success: false } });
    await rejected(); // Runtime cannot bypass production enforcement either.
    process.env.CAPTCHA_ENABLED = 'true';
    delete process.env.TURNSTILE_SECRET_KEY;
    assert.throws(validateCaptchaConfig);
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    assert.throws(validateCaptchaConfig);
    process.env.TURNSTILE_SECRET_KEY = 'mock-secret';
    assert.doesNotThrow(validateCaptchaConfig);
});
test('hostname defaults to configured frontend URL, never client headers', async () => {
    delete process.env.TURNSTILE_EXPECTED_HOSTNAME;
    process.env.FRONTEND_URL = 'https://app.example.com:8443/path';
    assert.doesNotThrow(validateCaptchaConfig);
    assert.equal((await invoke()).next, true);
    process.env.FRONTEND_URL = 'invalid';
    assert.throws(validateCaptchaConfig);
    await rejected();
});
test('audit exceptions cannot turn rejection into acceptance', async () => {
    AuditLog.logAction = async () => { throw new Error('storage unavailable'); };
    const result = await invoke({});
    assert.equal(result.status, 400);
});
test('actual auth route ordering protects login, TOTP login and register before validation/controllers', async () => {
    const express = require('express');
    const ratePath = require.resolve('../middleware/rateLimiter');
    const controllerPath = require.resolve('../controllers/authController');
    const uploadPath = require.resolve('../middleware/upload');
    const cached = [ratePath, controllerPath, uploadPath].map(path => require.cache[path]);
    const pass = (req, res, next) => next();
    require.cache[ratePath] = { exports: { loginLimiter: pass, registrationLimiter: pass, otpVerificationLimiter: pass, otpResendLimiter: pass } };
    require.cache[controllerPath] = { exports: new Proxy({}, { get: () => () => { throw new Error('Controller reached'); } }) };
    require.cache[uploadPath] = { exports: { uploadProfile: { single: () => pass } } };
    const app = express(); app.use(express.json());
    const routePath = require.resolve('../routes/auth');
    try {
        delete require.cache[routePath];
        app.use('/api/auth', require(routePath));
        const server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        try {
            const base = `http://127.0.0.1:${server.address().port}/api/auth`;
            for (const [route, body] of [['login', {}], ['login', { totpCode: '000000' }], ['register', {}]]) {
                const response = await fetch(`${base}/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                assert.equal(response.status, 400);
                assert.equal((await response.json()).code, 'CAPTCHA_FAILED');
            }
            assert.equal((await fetch(`${base}/hack-reset`)).status, 404);
            assert.equal(calls.length, 0);
        } finally { await new Promise(resolve => server.close(resolve)); }
    } finally {
        [ratePath, controllerPath, uploadPath].forEach((path, index) => {
            if (cached[index]) require.cache[path] = cached[index]; else delete require.cache[path];
        });
        delete require.cache[routePath];
    }
});
