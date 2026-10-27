const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const BlacklistedToken = require('../models/BlacklistedToken');
const auth = require('../middleware/auth');
const admin = require('../controllers/adminController');
const originals = { find: User.findById, exists: BlacklistedToken.exists, update: User.updateOne };
afterEach(() => { User.findById = originals.find; BlacklistedToken.exists = originals.exists; User.updateOne = originals.update; });
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
test('approval defaults preserve existing accounts and retired role is invalid', async () => {
  const user = new User({ firstName: 'A', lastName: 'B', email: 'a@example.com', role: 'auditor' });
  assert.equal(user.isApproved, true);
  user.role = 'resident';
  assert.ok(user.validateSync().errors.role);
});
test('pending accounts cannot bypass approval with full or scoped tokens', async () => {
  const user = { _id: '507f1f77bcf86cd799439011', role: 'auditor', isActive: true, isVerified: true, isApproved: false, sessionVersion: 0, lastSeenAt: new Date() };
  User.findById = async () => user; BlacklistedToken.exists = async () => false;
  process.env.JWT_SECRET = 'test-approval-secret';
  for (const scope of [undefined, 'setup_2fa']) {
    for (const path of ['/api/transactions', '/api/complaints', '/api/feedbacks', '/api/admin/users', '/api/auth/2fa/setup']) {
      const res = response(); let next = false;
      await auth({ cookies: { token: jwt.sign({ id: user._id, scope }, process.env.JWT_SECRET) }, originalUrl: path }, res, () => { next = true; });
      assert.equal(next, false); assert.equal(res.statusCode, 403); assert.equal(res.body.pendingApproval, true);
    }
    for (const path of ['/api/auth/profile', '/api/auth/logout']) {
      let next = false;
      await auth({ cookies: { token: jwt.sign({ id: user._id, scope }, process.env.JWT_SECRET) }, originalUrl: path }, response(), () => { next = true; });
      assert.equal(next, true);
    }
  }
});
test('deactivated and revoked sessions fail authentication', async () => {
  process.env.JWT_SECRET = 'test-approval-secret'; BlacklistedToken.exists = async () => false;
  for (const user of [{ isActive: false, sessionVersion: 0 }, { isActive: true, sessionVersion: 1 }]) {
    User.findById = async () => ({ ...user, role: 'auditor' });
    const res = response();
    await auth({ cookies: { token: jwt.sign({ id: 'test' }, process.env.JWT_SECRET) } }, res, () => assert.fail('revoked session accepted'));
    assert.equal(res.statusCode, 401);
  }
});
test('approval requires email verification, rejects self approval, and forces 2FA', async () => {
  const user = { _id: 'staff', isActive: true, isVerified: false, isApproved: false, role: 'auditor', save: async () => {} };
  User.findById = async () => user;
  const req = { params: { userId: 'staff' }, user: { _id: 'admin' } };
  let res = response(); await admin.approveUser(req, res); assert.equal(res.statusCode, 400);
  user.isVerified = true; res = response(); await admin.approveUser(req, res);
  assert.equal(user.isApproved, true); assert.equal(user.mustSetup2FA, true); assert.equal(user.approvedBy, 'admin'); assert.ok(user.approvedAt);
  res = response(); await admin.approveUser({ ...req, user: { _id: 'staff' } }, res); assert.equal(res.statusCode, 400);
});
test('public registration rejects all roles without creating accounts', async () => {
  const controller = require('../controllers/authController');
  const emailService = require('../services/emailService');
  const AuditLog = require('../models/AuditLog');
  const saved = { save: User.prototype.save, findOne: User.findOne, email: emailService.sendOTPEmail, log: AuditLog.logAction };
  const users = [];
  try {
    User.findOne = async () => null;
    User.prototype.save = async function () { users.push(this); return this; };
    emailService.sendOTPEmail = async () => {}; AuditLog.logAction = async () => {};
    process.env.JWT_SECRET = 'test-approval-secret';
    for (const role of ['barangay_official', 'auditor', 'administrator']) {
      const res = response(); res.cookie = () => res;
      await controller.register({ body: { firstName: 'A', lastName: 'B', email: 'a@example.com', password: 'Strong1!', position: 'Staff', role, isApproved: true, isVerified: true, isActive: false }, get: () => 'test' }, res);
      assert.equal(res.statusCode, 403);
      assert.match(res.body.error, /administrator/);
    }
    assert.equal(users.length, 0);
  } finally { User.prototype.save = saved.save; User.findOne = saved.findOne; emailService.sendOTPEmail = saved.email; AuditLog.logAction = saved.log; }
});
test('admin creation emails a server-generated credential and forces both onboarding steps', async () => {
  const emailService = require('../services/emailService'); const AuditLog = require('../models/AuditLog');
  const saved = { save: User.prototype.save, findOne: User.findOne, email: emailService.sendTempPasswordEmail, log: AuditLog.create };
  let created, delivered;
  try {
    User.findOne = async () => null;
    User.prototype.save = async function () { created = this; return this; };
    emailService.sendTempPasswordEmail = async (...args) => { delivered = args; }; AuditLog.create = async () => {};
    const res = response();
    await admin.createUser({ body: { firstName: 'A', lastName: 'B', email: 'a@example.com', role: 'auditor', position: 'Auditor', password: 'ChosenPassword1!' }, user: { _id: '507f1f77bcf86cd799439011', role: 'administrator' }, headers: {} }, res);
    assert.equal(res.statusCode, 201); assert.equal(created.isApproved, true); assert.equal(created.mustChangePassword, true); assert.equal(created.mustSetup2FA, true);
    assert.equal(delivered[1], created.password); assert.notEqual(created.password, 'ChosenPassword1!'); assert.ok(!JSON.stringify(res.body).includes(created.password));
  } finally { User.prototype.save = saved.save; User.findOne = saved.findOne; emailService.sendTempPasswordEmail = saved.email; AuditLog.create = saved.log; }
});
test('non-administrators cannot access administrative approval routes', () => {
  const { requireAdmin } = require('../middleware/roleMiddleware');
  for (const role of ['auditor', 'barangay_official']) {
    const res = response();
    requireAdmin({ user: { role } }, res, () => assert.fail('non-admin accepted'));
    assert.equal(res.statusCode, 403);
  }
});
test('access-granting actions require fresh authenticator proof', async () => {
  User.findById = () => ({ select: async () => ({ twoFactorEnabled: true }) });
  const res = response();
  await admin.requireStepUp({ path: '/users/staff/approve', body: {}, user: { _id: 'admin' } }, res, () => assert.fail('missing proof accepted'));
  assert.equal(res.statusCode, 403); assert.equal(res.body.stepUpRequired, true);
});
test('password login never self-verifies a publicly registered official', async () => {
  const controller = require('../controllers/authController');
  const TrustedDevice = require('../models/TrustedDevice');
  const emailService = require('../services/emailService'); const AuditLog = require('../models/AuditLog');
  const saved = { findOne: User.findOne, trust: TrustedDevice.isDeviceTrusted, email: emailService.sendOTPEmail, log: AuditLog.logAction };
  const user = { _id: '507f1f77bcf86cd799439011', email: 'staff@example.com', role: 'barangay_official', isActive: true, isVerified: false, isApproved: false, failedLoginAttempts: 0, comparePassword: async () => true, save: async () => {} };
  try {
    User.findOne = () => ({ select: async () => user }); TrustedDevice.isDeviceTrusted = async () => false;
    emailService.sendOTPEmail = async () => {}; AuditLog.logAction = async () => {};
    const res = response(); res.cookie = () => res;
    await controller.login({ body: { email: user.email, password: 'Strong1!' }, get: () => 'test', ip: '127.0.0.1' }, res);
    assert.equal(user.isVerified, false); assert.equal(res.body.otpRequired, true);
  } finally { User.findOne = saved.findOne; TrustedDevice.isDeviceTrusted = saved.trust; emailService.sendOTPEmail = saved.email; AuditLog.logAction = saved.log; }
});

test('failed credential delivery rolls back only the new account and explains how to retry', async () => {
  const email = require('../services/emailService');
  const saved = { save: User.prototype.save, find: User.findOne, remove: User.findByIdAndDelete, email: email.sendTempPasswordEmail };
  let created, removed;
  try {
    User.findOne = async () => null;
    User.prototype.save = async function () { created = this; return this; };
    User.findByIdAndDelete = async id => { removed = id; };
    email.sendTempPasswordEmail = async () => { throw new Error('SMTP unavailable'); };
    const res = response();
    await admin.createUser({ body: { firstName: 'Captain', lastName: 'Fixture', email: 'captain@example.com', role: 'barangay_official', position: 'Barangay Captain' }, user: { _id: '507f1f77bcf86cd799439011', role: 'administrator' }, headers: {} }, res);
    assert.equal(res.statusCode, 502); assert.equal(removed, created._id);
    assert.match(res.body.error, /rolled back.*retry Create User/);
    assert.equal(created.submitBudgetProposals, true); assert.equal(String(created.invitedBy), '507f1f77bcf86cd799439011');
    assert.ok(!JSON.stringify(res.body).includes(created.password));
  } finally { User.prototype.save = saved.save; User.findOne = saved.find; User.findByIdAndDelete = saved.remove; email.sendTempPasswordEmail = saved.email; }
});
