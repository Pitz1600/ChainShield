const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { generateSecret, generateSync } = require('otplib');
const QRCode = require('qrcode');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const BlacklistedToken = require('../models/BlacklistedToken');
const auth = require('../middleware/auth');
const controller = require('../controllers/authController');
const saved = { find: User.findById, log: AuditLog.logAction, exists: BlacklistedToken.exists, qr: QRCode.toDataURL };
const env = { ...process.env };
let user, logs;
function response() {
  return { statusCode: 200, cookies: {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(name, value, options) { this.cookies[name] = { value, options }; return this; }, clearCookie() {} };
}
function request(body = {}) { return { body, user, ip: '192.0.2.1', get: () => 'test' }; }
async function authorize(token, path) {
  const res = response(); let accepted = false;
  await auth({ cookies: { token }, originalUrl: path }, res, () => { accepted = true; });
  return { res, accepted };
}
beforeEach(() => {
  process.env.JWT_SECRET = 'test-two-factor-secret';
  process.env.TOTP_ENCRYPTION_KEY = '11'.repeat(32);
  process.env.NODE_ENV = 'test';
  user = new User({ firstName: 'Test', lastName: 'User', email: 'test@example.com', role: 'auditor',
    isVerified: true, isApproved: true, isActive: true, sessionVersion: 7, twoFactorEnabled: true,
    otp: '123456', otpExpires: new Date(Date.now() + 600000), otpAttempts: 0, lastSeenAt: new Date() });
  user.setTwoFactorSecret(generateSecret()); user.recoveryCodes = ['old-code'];
  user.save = async () => user;
  user.comparePassword = async password => password === 'correct-password';
  user.generateRecoveryCodes = async () => { user.recoveryCodes = ['new-hash']; return ['NEWCODE']; };
  User.findById = () => Object.assign(Promise.resolve(user), { select: async () => user });
  logs = [];
  AuditLog.logAction = async entry => { logs.push(entry); assert.equal(new AuditLog(entry).validateSync(), undefined); };
  BlacklistedToken.exists = async () => false;
});
afterEach(() => {
  User.findById = saved.find; AuditLog.logAction = saved.log; BlacklistedToken.exists = saved.exists; QRCode.toDataURL = saved.qr;
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
});
test('change 2FA replaces revoked session with setup cookie and completes with full session', async () => {
  const oldToken = jwt.sign({ id: user.id, sessionVersion: user.sessionVersion }, process.env.JWT_SECRET);
  const oldSecret = user.getTwoFactorSecret();
  const res = response();
  await controller.reset2FA(request({ password: 'correct-password', otp: '123456' }), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body.qrCode, /^data:image\/png;base64,/);
  assert.notEqual(res.body.secret, oldSecret);
  assert.equal(user.sessionVersion, 8); assert.equal(user.twoFactorEnabled, false);
  assert.equal(user.mustSetup2FA, true); assert.equal(user.otp, undefined); assert.equal(user.recoveryCodes.length, 0);
  const cookie = res.cookies.token;
  assert.ok(cookie, 'reset must replace invalidated session cookie');
  assert.equal(cookie.options.httpOnly, true); assert.equal(cookie.options.path, '/');
  assert.equal(cookie.options.maxAge, 3600000);
  assert.equal(jwt.verify(cookie.value, process.env.JWT_SECRET).scope, 'setup_2fa');
  assert.equal((await authorize(oldToken, '/api/auth/2fa/verify-setup')).res.statusCode, 401);
  assert.equal((await authorize(cookie.value, '/api/transactions')).res.statusCode, 403);
  assert.equal((await authorize(cookie.value, '/api/auth/2fa/verify-setup')).accepted, true);
  const invalid = response(); await controller.verifySetup2FA(request({ totpCode: 'invalid' }), invalid);
  assert.equal(invalid.statusCode, 400); assert.equal(user.twoFactorEnabled, false);
  const verified = response();
  await controller.verifySetup2FA(request({ totpCode: generateSync({ secret: res.body.secret }) }), verified);
  assert.equal(verified.statusCode, 200); assert.equal(user.twoFactorEnabled, true); assert.equal(user.mustSetup2FA, false);
  assert.deepEqual(verified.body.recoveryCodes, ['NEWCODE']);
  assert.equal(jwt.verify(verified.cookies.token.value, process.env.JWT_SECRET).scope, undefined);
  assert.equal((await authorize(verified.cookies.token.value, '/api/transactions')).accepted, true);
  assert.equal(logs[0].action, 'totp_reset_initiated');
});
test('wrong password and invalid or expired OTP preserve existing 2FA and session', async () => {
  const secret = user.getTwoFactorSecret();
  for (const body of [{ password: 'wrong', otp: '123456' }, { password: 'correct-password', otp: '999999' }]) {
    const res = response(); await controller.reset2FA(request(body), res);
    assert.equal(res.statusCode, 400); assert.deepEqual(res.cookies, {});
    assert.equal(user.sessionVersion, 7); assert.equal(user.twoFactorEnabled, true); assert.equal(user.getTwoFactorSecret(), secret);
  }
  user.otpExpires = new Date(Date.now() - 1000);
  const res = response(); await controller.reset2FA(request({ password: 'correct-password', otp: '123456' }), res);
  assert.equal(res.statusCode, 400); assert.equal(user.sessionVersion, 7);
});
test('OTP attempt limit rejects reset without issuing a session', async () => {
  user.otpAttempts = 10;
  const res = response(); await controller.reset2FA(request({ password: 'correct-password', otp: '123456' }), res);
  assert.equal(res.statusCode, 429); assert.deepEqual(res.cookies, {}); assert.equal(user.twoFactorEnabled, true);
});
test('QR generation failure preserves authentication and OTP', async () => {
  QRCode.toDataURL = async () => { throw new Error('test QR failure'); };
  const secret = user.getTwoFactorSecret();
  const res = response(); await controller.reset2FA(request({ password: 'correct-password', otp: '123456' }), res);
  assert.equal(res.statusCode, 500); assert.deepEqual(res.cookies, {});
  assert.equal(user.sessionVersion, 7); assert.equal(user.getTwoFactorSecret(), secret); assert.equal(user.otp, '123456');
});
test('setup sessions can regenerate QR codes and verify the replacement', async () => {
  user.twoFactorEnabled = false; user.mustSetup2FA = true;
  const token = jwt.sign({ id: user.id, sessionVersion: user.sessionVersion, scope: 'setup_2fa' }, process.env.JWT_SECRET);
  assert.equal((await authorize(token, '/api/auth/2fa/restart-setup')).accepted, true);
  const oldSecret = user.getTwoFactorSecret();
  const res = response(); await controller.restart2FASetup(request(), res);
  assert.equal(res.statusCode, 200); assert.notEqual(res.body.secret, oldSecret);
  assert.equal(user.getTwoFactorSecret(), res.body.secret); assert.equal(logs[0].action, 'totp_setup_restarted');
  const verified = response();
  await controller.verifySetup2FA(request({ totpCode: generateSync({ secret: res.body.secret }) }), verified);
  assert.equal(verified.statusCode, 200);
});
test('setup and regenerate cannot overwrite an enabled authenticator', async () => {
  const secret = user.getTwoFactorSecret();
  for (const handler of [controller.setup2FA, controller.restart2FASetup]) {
    const res = response(); await handler(request(), res);
    assert.equal(res.statusCode, 400); assert.equal(user.getTwoFactorSecret(), secret);
  }
});
