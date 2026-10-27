const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const uri = process.env.ANNUAL_BUDGET_TEST_MONGODB_URI;
test('annual budget HTTP workflow and real transaction races', { skip: !uri, timeout: 90000 }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/chainshield_annual_test_[a-zA-Z0-9_]+(?:\?|$)/);
  process.env.BUDGET_EXPENDITURES_ENABLED = 'true';
  process.env.JWT_SECRET = crypto.randomUUID();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  assert.ok((await mongoose.connection.db.admin().command({ hello: 1 })).setName);
  const User = require('../models/User'), Proposal = require('../models/BudgetProposal'), Pool = require('../models/AnnualBudget');
  const app = express(); app.use(express.json());
  app.use('/api/annual-budgets', require('../routes/annualBudgets'));
  app.use('/api/approved-budgets', require('../routes/budgetExpenditures'));
  app.use('/api/budget-proposals', require('../routes/budgetProposals'));
  app.use((e, req, res, next) => res.status(e.status || 500).json({ error: e.message }));
  const server = require('node:http').createServer(app);
  try {
    await Promise.all([User.init(), Proposal.init(), Pool.init()]);
    const users = {};
    for (const [name, role, position] of [['admin', 'administrator', ''], ['captain', 'barangay_official', 'Barangay Captain'], ['treasurer', 'barangay_official', 'Barangay Treasurer'], ['auditor', 'auditor', ''], ['other', 'barangay_official', 'Barangay Secretary']]) {
      users[name] = new User({ firstName: name, lastName: 'Fixture', email: `${name}@test.invalid`, role, position, isActive: true, isApproved: true, isVerified: true, twoFactorEnabled: role === 'administrator', submitBudgetProposals: name === 'captain', budgetProposalAccessManaged: true });
      users[name]._allowAdminChange = true; await users[name].save();
    }
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    async function request(path, method = 'GET', body, name = 'admin') {
      const token = jwt.sign({ id: String(users[name]._id), sessionVersion: users[name].sessionVersion }, process.env.JWT_SECRET);
      const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, body: body instanceof FormData ? body : body && JSON.stringify(body) });
      return { status: r.status, body: await r.json() };
    }
    const pool = y => request(`/annual-budgets/${y}`);
    const create = (y, n) => request(`/annual-budgets/${y}`, 'POST', { totalCentavos: n });
    const reconcile = async y => request(`/annual-budgets/${y}/reconcile`, 'POST', { revision: (await pool(y)).body.pool.revision });
    const proposal = (n, y = 2026, status = 'SUBMITTED') => Proposal.create({ proposalNumber: crypto.randomUUID(), barangayId: 'historical-label', createdBy: users.captain._id, fiscalYear: y, totalAmountCentavos: n, status, items: [{ itemId: 'materials', name: 'Materials', estimatedAmountCentavos: n }] });
    const approve = p => request(`/budget-proposals/${p._id}/approve`, 'POST', { revision: p.revision });
    await t.test('permissions, duplicate pools, missing pool and unreconciled pool', async () => {
      for (const who of ['captain', 'treasurer', 'auditor', 'other']) assert.equal((await request('/annual-budgets/2026', 'POST', { totalCentavos: 100, reference: 'basis' }, who)).status, 403);
      const p = await proposal(70000000);
      assert.equal((await approve(p)).status, 409);
      assert.equal((await create(2026, 100000000)).status, 201);
      assert.equal((await create(2026, 100000000)).status, 409);
      assert.equal((await approve(p)).status, 409);
      assert.equal((await reconcile(2026)).body.pool.reconciled, true);
      for (const who of ['captain', 'treasurer', 'auditor']) assert.equal((await request('/annual-budgets/2026', 'GET', null, who)).status, 200);
      assert.equal((await request('/annual-budgets/2026', 'GET', null, 'other')).status, 403);
      assert.equal((await approve(p)).status, 200);
      assert.equal((await pool(2026)).body.availableCentavos, 30000000);
      assert.equal((await approve(p)).status, 409);
      const tooMuch = await proposal(40000000);
      const blocked = await approve(tooMuch); assert.equal(blocked.status, 409); assert.match(blocked.body.error, /300000.00/);
      assert.equal((await approve(await proposal(30000000))).status, 200);
      assert.equal((await pool(2026)).body.availableCentavos, 0);
      const rejected = await request(`/budget-proposals/${tooMuch._id}/reject`, 'POST', { revision: 1, remarks: 'Over budget' });
      assert.equal(rejected.status, 200); assert.equal((await pool(2026)).body.availableCentavos, 0);
      assert.equal((await request(`/budget-proposals/${p._id}`, 'PATCH', { revision: 2, fiscalYear: 2027, items: [] }, 'captain')).status, 409);
    });
    await t.test('submitted edits preserve history and attachments and approval uses revised funds', async () => {
      await create(2035, 90000); await reconcile(2035);
      const p = await Proposal.create({ proposalNumber: crypto.randomUUID(), barangayId: 'historical-label', createdBy: users.captain._id, fiscalYear: 2035, title: 'Repair', proposalType: 'annual', sector: 'infrastructure', justification: 'Road repairs', items: [{ itemId: 'materials', name: 'Materials', description: 'Repair road', expectedTimeline: 'January–March 2035', estimatedAmountCentavos: 100000 }], totalAmountCentavos: 100000, status: 'SUBMITTED', history: [{ action: 'submitted', snapshot: { totalAmountCentavos: 100000 } }], documents: [{ originalName: 'estimate.pdf', mimeType: 'application/pdf', bytes: 4, data: Buffer.from('%PDF') }] });
      const path = `/budget-proposals/${p._id}`;
      const body = { ...p.toObject(), revision: 1, reason: 'Supplier revised estimate', items: [{ ...p.items[0], estimatedAmountCentavos: 85000 }] };
      for (const who of ['captain', 'treasurer', 'auditor']) assert.equal((await request(`${path}/review`, 'PATCH', body, who)).status, 403);
      assert.equal((await approve(p)).status, 409);
      const edits = await Promise.all([request(`${path}/review`, 'PATCH', body), request(`${path}/review`, 'PATCH', body)]);
      assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]);
      assert.equal((await pool(2035)).body.availableCentavos, 90000);
      const revised = (await request(path, 'GET', null, 'captain')).body;
      assert.equal(revised.totalAmountCentavos, 85000); assert.equal(revised.status, 'SUBMITTED');
      assert.equal(revised.documents.length, 1); assert.equal(revised.history[0].snapshot.totalAmountCentavos, 100000);
      assert.equal(revised.history[1].snapshot.after.totalAmountCentavos, 85000); assert.equal(revised.history[1].actor.firstName, 'admin');
      assert.equal((await approve(p)).status, 409);
      assert.equal((await approve(revised)).status, 200);
      assert.equal((await pool(2035)).body.availableCentavos, 5000);
      assert.equal((await request(`${path}/review`, 'PATCH', { ...body, revision: 3 })).status, 409);
    });
    await t.test('recording and auditing expenditures do not reserve annual funds twice', async () => {
      const p = await Proposal.findOne({ fiscalYear: 2026, status: 'ADMIN_APPROVED' });
      const before = (await pool(2026)).body.pool.reservedCentavos;
      const data = new FormData();
      for (const [key, value] of Object.entries({ allocationId: 'materials', amount: '30', timestamp: '2026-10-20T00:00:00Z', fromAddress: 'Office', toAddress: 'Supplier', agency: 'LGU', programName: 'Materials', description: 'Materials', transactionType: 'Procurement', submissionKey: crypto.randomUUID(), categories: JSON.stringify([['receipt', 'supporting_document']]) })) data.append(key, value);
      data.append('evidence', new Blob(['%PDF-1.4\nfixture\n%%EOF'], { type: 'application/pdf' }), 'receipt.pdf');
      const pipeline = require('../services/multiStageFraudPipeline'), original = pipeline.processBatch;
      try {
        pipeline.processBatch = async () => { throw new Error('Isolated fixture: analysis unavailable'); };
        const result = await request(`/approved-budgets/${p._id}/expenditures`, 'POST', data, 'treasurer');
        assert.equal(result.status, 201, JSON.stringify(result));
        assert.equal((await pool(2026)).body.pool.reservedCentavos, before);
        const reviewed = await request(`/approved-budgets/${p._id}/expenditures/${result.body._id}/review`, 'POST', { status: 'verified', reason: 'Evidence checked' }, 'auditor');
        assert.equal(reviewed.status, 200, JSON.stringify(reviewed));
        assert.equal((await pool(2026)).body.pool.reservedCentavos, before);
      } finally { pipeline.processBatch = original; }
    });
    await t.test('concurrent approvals and retries cannot overcommit or double reserve', async () => {
      await create(2027, 10000); await reconcile(2027);
      const a = await proposal(7000, 2027), b = await proposal(7000, 2027);
      const results = await Promise.all([approve(a), approve(a), approve(b)]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409, 409], JSON.stringify(results));
      assert.equal((await pool(2027)).body.pool.reservedCentavos, 7000);
      assert.equal((await pool(2026)).body.pool.reservedCentavos, 100000000);
    });
    await t.test('adjustments race safely with approvals and require reasons and revisions', async () => {
      await create(2028, 10000); await reconcile(2028);
      const p = await proposal(7000, 2028), revision = (await pool(2028)).body.pool.revision;
      const body = { totalCentavos: 5000, reason: 'Corrected ceiling', revision };
      const responses = await Promise.all([approve(p), request('/annual-budgets/2028', 'PATCH', body)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409], JSON.stringify(responses));
      const after = (await pool(2028)).body.pool;
      assert.ok(after.reservedCentavos <= after.totalCentavos);
      assert.equal((await request('/annual-budgets/2028', 'PATCH', { ...body, reason: '' })).status, 422);
      for (const who of ['captain', 'treasurer', 'auditor']) assert.equal((await request('/annual-budgets/2028', 'PATCH', body, who)).status, 403);
      assert.equal((await request('/annual-budgets/2027', 'PATCH', { ...body, totalCentavos: 6000, revision: (await pool(2027)).body.pool.revision })).status, 409);
    });
    await t.test('historical archived approvals count; backup retains bytes and reconciliation fails closed', async () => {
      const p = await proposal(11000, 2029, 'ADMIN_APPROVED');
      await Proposal.collection.updateOne({ _id: p._id }, { $set: { archived: true, documents: [{ data: Buffer.from('original attachment') }] } });
      await create(2029, 10000);
      const first = await reconcile(2029); assert.equal(first.status, 200); assert.equal(first.body.pool.reconciled, false); assert.equal(first.body.pool.reservedCentavos, 11000);
      const backup = await mongoose.connection.collection('annualbudgetbackups').findOne({ backupId: new mongoose.Types.ObjectId(first.body.backupId), sourceId: p._id });
      assert.equal(backup.document.archived, true); assert.equal(backup.document.documents[0].data.toString(), 'original attachment');
      const targetName = `chainshield_annual_restore_${crypto.randomBytes(6).toString('hex')}`;
      const targetUri = uri.replace(/chainshield_annual_test_[a-zA-Z0-9_]+/, targetName);
      const restore = new mongoose.mongo.MongoClient(targetUri);
      try {
        await require('node:util').promisify(require('node:child_process').execFile)(process.execPath, [require('node:path').resolve(__dirname, '../scripts/restore-annual-budget-snapshot.js'), first.body.backupId], { env: { ...process.env, ANNUAL_BACKUP_SOURCE_URI: uri, ANNUAL_BACKUP_RESTORE_URI: targetUri } });
        await restore.connect();
        const restored = await restore.db().collection(Proposal.collection.name).findOne({ _id: p._id });
        assert.equal(restored.documents[0].data.toString(), 'original attachment');
        assert.equal(restored.archived, true);
        assert.equal((await restore.db().collection(Pool.collection.name).findOne({ fiscalYear: 2029 })).reservedCentavos, 0);
        assert.equal((await pool(2029)).body.pool.reservedCentavos, 11000);
      } finally { await restore.db().dropDatabase(); await restore.close(); }
      const update = await request('/annual-budgets/2029', 'PATCH', { totalCentavos: 12000, reason: 'Correct ceiling', revision: first.body.pool.revision }); assert.equal(update.status, 200);
      assert.equal((await reconcile(2029)).body.pool.reconciled, true);
      // Existing expenditure reservation mutations must never alter annual reservations.
      await Proposal.updateOne({ _id: p._id }, { $set: { expenditureReserved: { materials: 3000 } } });
      assert.equal((await pool(2029)).body.pool.reservedCentavos, 11000);
      assert.equal((await approve(await proposal(1000, 2029))).status, 200);
      const invalid = await proposal(100, 2030, 'ADMIN_APPROVED'); await Proposal.collection.updateOne({ _id: invalid._id }, { $unset: { fiscalYear: '' } });
      const bad = await reconcile(2029); assert.equal(bad.body.pool.reconciled, false); assert.match(bad.body.discrepancies[0], /fiscal year/);
      assert.equal((await approve(await proposal(1, 2029))).status, 409);
    });
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
