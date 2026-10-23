const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const root = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'chainshield-receipts-'));
process.env.RECEIPT_STORAGE_DIR = root;
const store = require('../services/localImportReceiptStore');
after(() => fs.rm(root, { recursive: true, force: true }));
const pdf = (name = 'receipt.pdf') => ({ originalname: name, mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test'), size: 13 });
test('same-named imports isolate receipts and concurrent additions survive restart reads', async () => {
  const a = await store.createImport('same.csv', 'user', ['A', 'A2']);
  const b = await store.createImport('same.csv', 'user', ['B']);
  assert.notEqual(a.importId, b.importId);
  await Promise.all([store.add(a.importId, [pdf()], 'user'), store.add(a.importId, [pdf('second.pdf')], 'other')]);
  const saved = await store.read(a.importId);
  assert.equal(saved.receipts.length, 2);
  assert.equal((await store.read(b.importId)).receipts.length, 0);
  assert.deepEqual(saved.transactionIds, ['A', 'A2']);
  assert.equal(store.publicGroup(saved).receipts[0].storedName, undefined);
  assert.ok((await fs.stat(store.filePath(a.importId, saved.receipts[0]))).isFile());
});
test('reject traversal, signatures, mismatched types, count and aggregate size without partial additions', async () => {
  await assert.rejects(store.read('../escape'));
  const a = await store.createImport('../../safe.csv', 'user', ['C']);
  assert.equal(a.sourceCsvName, 'safe.csv');
  for (const files of [[], Array(11).fill(pdf()), [pdf('bad.svg')], [{ ...pdf(), buffer: Buffer.from('<html>') }], [{ ...pdf(), mimetype: 'text/html' }], Array(4).fill({ ...pdf(), size: 9 * 1024 * 1024 })]) {
    await assert.rejects(store.add(a.importId, files, 'user'));
  }
  assert.equal((await store.read(a.importId)).receipts.length, 0);
  assert.deepEqual(await fs.readdir(path.join(root, 'imports', a.importId, 'files')), []);
});
test('receipt auth retains security checks while suppressing presence writes', async () => {
  const User = require('../models/User');
  const BlacklistedToken = require('../models/BlacklistedToken');
  const auth = require('../middleware/auth');
  const original = { find: User.findById, update: User.updateOne, exists: BlacklistedToken.exists };
  const user = { _id: 'user', role: 'auditor', isActive: true, isVerified: true, isApproved: true, sessionVersion: 0, lastSeenAt: null };
  const before = JSON.stringify(user);
  let writes = 0;
  process.env.JWT_SECRET = 'receipt-test-only';
  User.findById = async () => user;
  User.updateOne = () => { writes++; return Promise.resolve(); };
  BlacklistedToken.exists = async () => false;
  const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  try {
    const req = { receiptReadOnly: true, originalUrl: '/api/receipt-imports', cookies: { token: jwt.sign({ id: 'user' }, process.env.JWT_SECRET) } };
    let passed = false;
    await auth(req, response(), () => { passed = true; });
    assert.equal(passed, true); assert.equal(writes, 0); assert.equal(JSON.stringify(user), before);
    const res = response();
    await auth({ ...req, cookies: { token: jwt.sign({ id: 'user', scope: 'setup_2fa' }, process.env.JWT_SECRET) } }, res, () => assert.fail('onboarding bypass'));
    assert.equal(res.code, 403); assert.equal(writes, 0);
    const { requireOfficial } = require('../middleware/roleMiddleware');
    const denied = response(); requireOfficial(req, denied, () => assert.fail('auditor upload allowed'));
    assert.equal(denied.code, 403);
  } finally { User.findById = original.find; User.updateOne = original.update; BlacklistedToken.exists = original.exists; }
});
test('HTTP routes isolate groups and suppress middleware mutations', async () => {
  const express = require('express');
  const User = require('../models/User');
  const Transaction = require('../models/Transaction');
  const BlacklistedToken = require('../models/BlacklistedToken');
  const AuditLog = require('../models/AuditLog');
  const originals = [User.findById, User.updateOne, Transaction.findById, Transaction.countDocuments, BlacklistedToken.exists, AuditLog.logAction];
  const user = { _id: 'staff', role: 'barangay_official', isActive: true, isVerified: true, isApproved: true, sessionVersion: 0 };
  let writes = 0;
  User.findById = async () => user;
  User.updateOne = () => { writes++; return Promise.resolve(); };
  BlacklistedToken.exists = async () => false;
  AuditLog.logAction = async () => { writes++; };
  Transaction.findById = id => ({ select: () => ({ lean: async () => ({ transactionId: id === '111111111111111111111111' ? 'http-A' : 'http-B' }) }) });
  Transaction.countDocuments = async () => 1;
  const a = await store.createImport('same.csv', 'staff', ['http-A']);
  const b = await store.createImport('same.csv', 'staff', ['http-B']);
  const app = express(); app.use(require('../middleware/auditLog')); app.use('/api', require('../routes/receiptImports'));
  const server = require('node:http').createServer(app);
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const headers = { Authorization: `Bearer ${jwt.sign({ id: 'staff' }, process.env.JWT_SECRET)}` };
    const call = (url, options = {}) => fetch(base + url, { ...options, headers });
    assert.equal((await fetch(base + '/receipt-imports')).status, 401);
    const form = new FormData(); form.append('receipts', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'receipt.pdf');
    const uploaded = await call(`/receipt-imports/${a.importId}/receipts`, { method: 'POST', body: form });
    assert.equal(uploaded.status, 200);
    const receipt = (await uploaded.json()).receipts[0];
    const forA = await (await call('/transactions/111111111111111111111111/import-receipts')).json();
    const forB = await (await call('/transactions/222222222222222222222222/import-receipts')).json();
    assert.equal(forA.group.receipts.length, 1); assert.equal(forB.group.receipts.length, 0);
    assert.equal((await call(`/receipt-imports/${b.importId}/receipts/${receipt.receiptId}/file`)).status, 404);
    const downloaded = await call(`/receipt-imports/${a.importId}/receipts/${receipt.receiptId}/file`);
    assert.equal(downloaded.status, 200); assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff'); assert.equal(await downloaded.text(), '%PDF-1.4 test');
    assert.equal((await call('/receipt-imports')).status, 200);
    assert.equal(user.lastSeenAt, undefined); assert.equal(writes, 0);
    user.role = 'auditor';
    assert.equal((await call(`/receipt-imports/${a.importId}/receipts`, { method: 'POST', body: form })).status, 403);
    assert.equal((await call(`/receipt-imports/${a.importId}/receipts/${receipt.receiptId}/file`)).status, 200);
    assert.equal(writes, 0);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    [User.findById, User.updateOne, Transaction.findById, Transaction.countDocuments, BlacklistedToken.exists, AuditLog.logAction] = originals;
  }
});
