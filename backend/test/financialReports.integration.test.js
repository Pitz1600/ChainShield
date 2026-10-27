const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const uri = process.env.EXPENDITURE_TEST_MONGODB_URI;
test('financial report snapshot HTTP, authorization, allowlist and audit event', { skip: !uri, timeout: 60000 }, async () => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/chainshield_expenditure_test_[a-zA-Z0-9_]+(?:\?|$)/);
  process.env.JWT_SECRET = crypto.randomUUID(); process.env.BUDGET_EXPENDITURES_ENABLED = 'true';
  await mongoose.connect(uri);
  assert.ok((await mongoose.connection.db.admin().command({ hello: 1 })).setName);
  const User = require('../models/User'), Proposal = require('../models/BudgetProposal'), Expenditure = require('../models/BudgetExpenditure'), AuditLog = require('../models/AuditLog');
  const app = require('express')(); app.use(require('express').json()); app.use('/api/reports', require('../routes/reports'));
  const server = require('node:http').createServer(app);
  try {
    const users = {};
    for (const role of ['auditor', 'barangay_official', 'administrator']) {
      const u = new User({ firstName: role, lastName: 'Fixture', email: `${role}@test.invalid`, role, position: 'Barangay Treasurer', isActive: true, isVerified: true, isApproved: true, twoFactorEnabled: true }); u._allowAdminChange = true; users[role] = await u.save();
    }
    const p = await Proposal.create({ proposalNumber: crypto.randomUUID(), barangayId: require('../services/budgetProposalPolicy').barangay(), createdBy: users.administrator._id, status: 'ADMIN_APPROVED', fiscalYear: 2026, items: [{ itemId: 'a', name: 'Allocation', estimatedAmountCentavos: 10000000 }], totalAmountCentavos: 10000000 });
    await Expenditure.create(['verified', 'submitted', 'correction_required', 'rejected'].map((reviewStatus, i) => ({ budgetProposalId: p._id, allocationId: 'a', submittedBy: users.barangay_official._id, submissionKey: crypto.randomUUID(), amountCentavos: [2000000,1000000,500000,700000][i], input: { timestamp: '2026-10-25T16:00:00Z', description: 'Fixture', toAddress: 'Private payee' }, reviewStatus, evidence: [{ originalName: 'receipt.pdf', data: Buffer.from('secret'), categories: ['receipt'], version: 1 }] })));
    const AuditorEvidence = require('../models/AuditorEvidence');
    const first = await Expenditure.findOne();
    await AuditorEvidence.create({ expenditureId: first._id, budgetProposalId: p._id, originalName: 'inspection.pdf', mimeType: 'application/pdf', bytes: 6, sha256: 'fixture-checksum', uploadedBy: users.auditor._id, uploaderName: 'Auditor Fixture', uploadedAt: new Date(), explanation: 'Completed work inspection', data: Buffer.from('secret') });
    const before = JSON.stringify(await Expenditure.find().lean());
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    async function request(role, path, body) {
      const token = role && require('jsonwebtoken').sign({ id: String(users[role]._id), sessionVersion: users[role].sessionVersion }, process.env.JWT_SECRET);
      const r = await fetch(`http://127.0.0.1:${server.address().port}/api/reports${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, ...(body && { body: JSON.stringify(body) }) }); return { status: r.status, data: await r.json(), cache: r.headers.get('cache-control') };
    }
    assert.equal((await request(null, '/access')).status, 401);
    assert.equal((await request('barangay_official', '/preview', { type: 'audit', fiscalYear: 2026 })).status, 403);
    const r = await request('auditor', '/preview', { type: 'summary', fiscalYear: 2026 });
    assert.equal(r.status, 200); assert.equal(r.data.summary.available, 6500000); assert.equal(r.cache, 'private, no-store');
    const event = await AuditLog.findOne({ action: 'financial_report_generated' }); assert.equal(event.details.reportId, r.data.reportId); assert.ok(!JSON.stringify(event).includes('Private payee'));
    const audit = await request('auditor', '/preview', { type: 'audit', fiscalYear: 2026 }); assert.equal(audit.status, 200); assert.ok(!JSON.stringify(audit.data).includes('secret'));
    const inventory = audit.data.rows.find(row => row.id === String(first._id)).auditorEvidence;
    assert.equal(inventory.length, 1); assert.equal(inventory[0].explanation, 'Completed work inspection'); assert.equal(inventory[0].uploader, 'Auditor Fixture'); assert.equal(inventory[0].checksum, 'fixture-checksum'); assert.equal(inventory[0].data, undefined);
    assert.equal(JSON.stringify(await Expenditure.find().lean()), before);
    assert.equal((await request('auditor', '/preview', { type: 'summary', fiscalYear: 2025, proposalId: String(p._id) })).status, 404);
    await Proposal.updateOne({ _id: p._id }, { $set: { status: 'REJECTED' } });
    assert.equal((await request('auditor', '/preview', { type: 'summary', fiscalYear: 2026, proposalId: String(p._id) })).status, 404);
    process.env.BUDGET_EXPENDITURES_ENABLED = 'false'; assert.equal((await request('auditor', '/options')).status, 503);
  } finally { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); await new Promise(resolve => server.close(resolve)); }
});
