const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const uri = process.env.EXPENDITURE_TEST_MONGODB_URI;
// Never use MONGODB_URI, .env, an existing application DB or a remote deployment.
const safeUri = uri && /^mongodb:\/\/127\.0\.0\.1:\d+\/chainshield_expenditure_test_[a-zA-Z0-9_]+(?:\?|$)/.test(uri);
test('expenditure HTTP workflow with real MongoDB replica-set transactions', { skip: !uri, timeout: 90000 }, async t => {
  assert.ok(safeUri, 'Use a localhost URI with a dedicated chainshield_expenditure_test_ database');
  process.env.JWT_SECRET = crypto.randomUUID();
  process.env.BUDGET_EXPENDITURES_ENABLED = 'true';
  process.env.INTEGRITY_USE_ML = 'false';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.ok(hello.setName, 'Replica set required');
  const User = require('../models/User');
  const Proposal = require('../models/BudgetProposal');
  const Expenditure = require('../models/BudgetExpenditure');
  const Transaction = require('../models/Transaction');
  const AuditorEvidence = require('../models/AuditorEvidence');
  const pipeline = require('../services/multiStageFraudPipeline');
  const originalPipeline = pipeline.processBatch;
  const app = express(); app.use(express.json());
  const mlRequests = [];
  app.post('/predict-batch', (req, res) => { mlRequests.push(req.body); res.json({ results: req.body.transactions.map(() => ({ final_probability: 0.1 })) }); });
  app.use('/api/approved-budgets', require('../routes/budgetExpenditures'));
  app.use('/api/transactions', require('../middleware/auth'), require('../middleware/protectBudgetExpenditures'));
  app.delete('/api/transactions/:id', (req, res) => res.sendStatus(204));
  app.use((error, req, res, next) => { res.status(500).json({ error: error.message }); });
  const server = require('node:http').createServer(app);
  try {
    await Promise.all([User.init(), Proposal.init(), Expenditure.init(), Transaction.init()]);
    const users = {};
    for (const [name, role, barangayId] of [['treasurer', 'barangay_official', undefined], ['colleague', 'barangay_official', 'historical-label'], ['auditor', 'auditor', undefined], ['official', 'barangay_official', undefined], ['admin', 'administrator', undefined]]) {
      users[name] = new User({ firstName: name, lastName: 'Fixture', email: `${name}@test.invalid`, role, barangayId, position: name === 'official' ? 'Barangay Secretary' : 'Barangay Treasurer', isActive: true, isVerified: true, isApproved: true, twoFactorEnabled: role === 'administrator' });
      users[name]._allowAdminChange = true; await users[name].save();
    }
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    process.env.ML_SERVICE_URL = base;
    const token = name => jwt.sign({ id: String(users[name]._id), sessionVersion: users[name].sessionVersion }, process.env.JWT_SECRET);
    async function request(name, url, options = {}) {
      const response = await fetch(base + '/api' + url, { ...options, headers: { Authorization: `Bearer ${token(name)}`, ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
      const body = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
      return { status: response.status, headers: response.headers, body };
    }
    async function budget(amount = 10000, status = 'ADMIN_APPROVED') {
      return Proposal.create({ proposalNumber: crypto.randomUUID(), barangayId: 'a', createdBy: users.admin._id, title: 'Fixture budget', status, items: [{ itemId: 'materials', name: 'Materials', estimatedAmountCentavos: amount }], totalAmountCentavos: amount });
    }
    const pdf = '%PDF-1.4\nfixture receipt\n%%EOF';
    function form(amount = '60', key = crypto.randomUUID(), categories = [['receipt', 'supporting_document']]) {
      const data = new FormData();
      for (const [k, v] of Object.entries({ amount, timestamp: '2026-10-20T10:00:00Z', fromAddress: 'Barangay fixture', toAddress: 'Supplier fixture', agency: 'LGU', programName: 'Repairs', description: 'Materials', transactionType: 'Procurement', submissionKey: key, categories: JSON.stringify(categories) })) data.append(k, v);
      data.append('evidence', new Blob([pdf], { type: 'application/pdf' }), 'receipt.pdf');
      return data;
    }
    const submit = (p, data, name = 'treasurer') => request(name, `/approved-budgets/${p._id}/expenditures`, { method: 'POST', body: data });
    const review = (p, e, status, reason, name = 'auditor') => request(name, `/approved-budgets/${p._id}/expenditures/${e._id}/review`, { method: 'POST', body: JSON.stringify({ status, reason }) });
    let calls = 0;
    pipeline.processBatch = async function (...args) { calls++; return originalPipeline.apply(this, args); };
    let p, e;
    await t.test('whole-budget spending includes existing allocation reservations', async () => {
      const mixed = await budget(10000);
      mixed.items = [{ itemId: 'materials', name: 'Materials', estimatedAmountCentavos: 5000 }, { itemId: 'labor', name: 'Labor', estimatedAmountCentavos: 5000 }];
      await mixed.save();
      const legacy = form('30'); legacy.append('allocationId', 'materials');
      assert.equal((await submit(mixed, legacy)).status, 201);
      const whole = await submit(mixed, form('60'));
      assert.equal(whole.status, 201);
      assert.equal(whole.body.allocationId, '__whole_budget__');
      assert.equal(whole.body.input.approvedBudget, 100);
      assert.equal(whole.body.input.remainingBudget, 10);
      assert.equal((await submit(mixed, form('11'))).status, 409);
      assert.equal((await review(mixed, whole.body, 'rejected', 'Invalid spending')).status, 200);
      assert.equal((await submit(mixed, form('70'))).status, 201);
      calls = 0;
    });
    await t.test('concurrent submissions cannot oversubscribe the whole approved budget', async () => {
      p = await budget();
      const responses = await Promise.all([submit(p, form()), submit(p, form())]);
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 409], JSON.stringify(responses));
      e = responses.find(r => r.status === 201).body;
      assert.equal(await Expenditure.countDocuments({ budgetProposalId: p._id }), 1);
      assert.equal(e.assessmentStatus, 'complete');
      assert.deepEqual(e.assessment, JSON.parse(JSON.stringify((await Expenditure.findById(e._id)).assessment)));
      assert.equal(e.evidence[0].data, undefined);
      const tx = await Transaction.findById(e.transactionId); assert.equal(tx.amount, 60); assert.equal(tx.verificationStatus, 'Pending');
      assert.equal(calls, 1);
      const page = await request('treasurer', `/approved-budgets/${p._id}`);
      assert.deepEqual(page.body.totals, { approved: 10000, recorded: 6000, verified: 0, pending: 6000, available: 4000 });
    });
    await t.test('idempotent retries do not reserve or analyze again', async () => {
      const retry = await submit(p, form('60', e.submissionKey)); assert.equal(retry.status, 200); assert.equal(retry.body._id, e._id); assert.equal(calls, 1);
    });
    await t.test('staff share one barangay without assignment; mismatched budget evidence remains denied', async () => {
      assert.equal((await request('colleague', `/approved-budgets/${p._id}`)).status, 200);
      const url = `/approved-budgets/${p._id}/expenditures/${e._id}/evidence/${e.evidence[0]._id}`;
      assert.equal((await request('auditor', url)).status, 200);
      assert.equal((await request('official', url)).status, 403);
      assert.equal((await request('auditor', url + '?preview=true')).status, 200);
      assert.equal((await Expenditure.findById(e._id)).history.at(-1).action, 'evidence_viewed');
      assert.equal((await request('official', url + '?preview=true')).status, 403);
      const other = await budget();
      assert.equal((await request('auditor', `/approved-budgets/${other._id}/expenditures/${e._id}`)).status, 404);
      const download = await request('auditor', url); assert.equal(download.status, 200); assert.equal(download.body, pdf); assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
    });
    await t.test('unapproved budgets and missing required evidence leave no partial reservation', async () => {
      const draft = await budget(10000, 'SUBMITTED'); assert.equal((await submit(draft, form('1'))).status, 404);
      const other = await budget(); assert.equal((await submit(other, form('1', crypto.randomUUID(), [['receipt']]))).status, 422);
      assert.equal(await Expenditure.countDocuments({ budgetProposalId: other._id }), 0);
      assert.equal((await Proposal.findById(other._id)).expenditureReserved.size, 0);
    });
    await t.test('legacy transaction mutations and self verification are blocked', async () => {
      assert.equal((await request('treasurer', `/transactions/${e.transactionId}`, { method: 'DELETE' })).status, 409);
      assert.equal((await review(p, e, 'verified', '', 'treasurer')).status, 403);
      assert.equal((await review(p, e, 'verified', '', 'official')).status, 403);
      assert.equal((await review(p, e, 'rejected', '')).status, 422);
    });
    await t.test('corrections preserve original bytes, versions and reserved funds', async () => {
      assert.equal((await review(p, e, 'correction_required', 'Attach delivery record')).status, 200);
      const corrected = form(); corrected.append('reason', 'Delivery record supplied');
      const response = await request('treasurer', `/approved-budgets/${p._id}/expenditures/${e._id}/evidence`, { method: 'POST', body: corrected });
      assert.equal(response.status, 200, JSON.stringify(response)); assert.equal(response.body.evidence.length, 2); assert.equal(response.body.evidence[1].version, 2);
      const stored = await Expenditure.findById(e._id).select('+evidence.data'); assert.equal(stored.evidence[0].data.toString(), pdf); assert.equal(stored.evidence[1].data.toString(), pdf);
      const page = await request('auditor', `/approved-budgets/${p._id}`); assert.equal(page.body.totals.available, 4000);
    });
    await t.test('concurrent rejection releases reserved funds exactly once', async () => {
      const decisions = await Promise.all([review(p, e, 'rejected', 'Invalid spending'), review(p, e, 'rejected', 'Invalid spending')]);
      assert.deepEqual(decisions.map(r => r.status).sort(), [200, 409]);
      const page = await request('auditor', `/approved-budgets/${p._id}`); assert.equal(page.body.totals.available, 10000); assert.equal(page.body.totals.verified, 0);
      assert.equal((await Transaction.findById(e.transactionId)).verificationStatus, 'Rejected');
      const stored = await Expenditure.findById(e._id); assert.equal(String(stored.reviewerId), String(users.auditor._id)); assert.ok(stored.reviewedAt);
    });
    function auditForm(reason = 'Inspection confirms completed work', count = 1) {
      const data = new FormData(); data.append('explanation', reason);
      for (let i = 0; i < count; i++) data.append('evidence', new Blob([pdf], { type: 'application/pdf' }), `inspection-${i}.pdf`);
      return data;
    }
    const auditUrl = (b = p, x = e) => `/approved-budgets/${b._id}/expenditures/${x._id}/audit-evidence`;
    await t.test('Auditor upload on a rejected expenditure preserves finances, assessment and Treasurer files', async () => {
      const before = (await Expenditure.findById(e._id)).toObject();
      const budgetBefore = (await Proposal.findById(p._id)).toObject(); const beforeCalls = calls;
      const response = await request('auditor', auditUrl(), { method: 'POST', body: auditForm() });
      assert.equal(response.status, 201, JSON.stringify(response));
      const f = response.body.auditorEvidence[0]; assert.equal(f.data, undefined);
      assert.equal(f.sha256, crypto.createHash('sha256').update(pdf).digest('hex'));
      const after = (await Expenditure.findById(e._id)).toObject();
      for (const key of ['reviewStatus', 'reviewerId', 'reviewedAt', 'reviewReason', 'amountCentavos', 'assessment', 'assessmentStatus', 'evidence', 'input']) assert.deepEqual(after[key], before[key], key);
      assert.deepEqual((await Proposal.findById(p._id)).toObject(), budgetBefore); assert.equal(calls, beforeCalls);
      assert.equal(after.history.at(-1).action, 'audit_evidence_uploaded'); assert.equal(String(after.history.at(-1).evidenceReferences[0]), f._id);
      for (const reader of ['treasurer', 'auditor', 'admin']) {
        const r = await request(reader, `${auditUrl()}/${f._id}`); assert.equal(r.status, 200); assert.equal(r.body, pdf); assert.equal(r.headers.get('cache-control'), 'private, no-store');
      }
      const page = await request('auditor', `/approved-budgets/${p._id}`); assert.equal(page.body.expenditures[0].auditorEvidence[0].data, undefined);
      const other = await budget();
      assert.equal((await request('auditor', `${auditUrl(other)}/${f._id}`)).status, 404);
      const another = await Expenditure.create({ budgetProposalId: p._id, allocationId: 'materials', submissionKey: crypto.randomUUID(), submittedBy: users.treasurer._id, amountCentavos: 1, input: {} });
      assert.equal((await request('auditor', `${auditUrl(p, another)}/${f._id}`)).status, 404);
      for (const role of ['treasurer', 'official', 'admin']) assert.equal((await request(role, auditUrl(), { method: 'POST', body: auditForm() })).status, 403);
      assert.equal((await request('official', `${auditUrl()}/${f._id}`)).status, 403);
      for (const patch of [{ isActive: false }, { isApproved: false }, { isVerified: false }]) {
        await User.updateOne({ _id: users.auditor._id }, { $set: patch });
        assert.ok([401, 403].includes((await request('auditor', auditUrl(), { method: 'POST', body: auditForm() })).status));
        await User.updateOne({ _id: users.auditor._id }, { $set: { isActive: true, isApproved: true, isVerified: true } });
      }
    });
    await t.test('invalid and failed batches leave no evidence, counters or history', async () => {
      const before = (await Expenditure.findById(e._id)).toObject();
      const count = await AuditorEvidence.countDocuments({ expenditureId: e._id });
      assert.equal((await request('auditor', auditUrl(), { method: 'POST', body: auditForm(' ') })).status, 422);
      const invalid = auditForm(); invalid.append('evidence', new Blob(['bad'], { type: 'image/png' }), 'invalid.png');
      assert.equal((await request('auditor', auditUrl(), { method: 'POST', body: invalid })).status, 422);
      assert.equal((await request('auditor', auditUrl(), { method: 'POST', body: auditForm('Inspection', 6) })).status, 422);
      const oversized = auditForm(); oversized.append('evidence', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'application/pdf' }), 'large.pdf');
      assert.equal((await request('auditor', auditUrl(), { method: 'POST', body: oversized })).status, 422);
      const original = AuditorEvidence.create;
      AuditorEvidence.create = async function (docs, options) { await original.call(this, docs.slice(0, 1), options); throw new Error('Injected failure after first file'); };
      try { assert.equal((await request('auditor', auditUrl(), { method: 'POST', body: auditForm('Inspection', 2) })).status, 500); }
      finally { AuditorEvidence.create = original; }
      assert.equal(await AuditorEvidence.countDocuments({ expenditureId: e._id }), count);
      assert.deepEqual((await Expenditure.findById(e._id)).toObject(), before);
    });
    await t.test('concurrent uploads enforce cumulative limits atomically', async () => {
      await Expenditure.updateOne({ _id: e._id }, { $set: { auditEvidenceCount: 49 } });
      const responses = await Promise.all([1, 2].map(() => request('auditor', auditUrl(), { method: 'POST', body: auditForm() })));
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
      await Expenditure.updateOne({ _id: e._id }, { $set: { auditEvidenceCount: 2, auditEvidenceBytes: 50 * 1024 * 1024 } });
      assert.equal((await request('auditor', auditUrl(), { method: 'POST', body: auditForm() })).status, 409);
      await Expenditure.updateOne({ _id: e._id }, { $set: { auditEvidenceBytes: pdf.length * 2 } });
    });
    await t.test('analysis failure retains evidence and unavailable status; retry does not duplicate', async () => {
      pipeline.processBatch = async () => { calls++; throw new Error('Simulated unavailable checker'); };
      const other = await budget(); const key = crypto.randomUUID();
      const response = await submit(other, form('10', key)); assert.equal(response.status, 201); assert.equal(response.body.assessmentStatus, 'unavailable'); assert.equal(response.body.assessment, undefined);
      const before = calls; assert.equal((await submit(other, form('10', key))).status, 200); assert.equal(calls, before);
    });
    await t.test('a review during analysis keeps reviewer metadata on the eventual transaction', async () => {
      let release, entered;
      const wait = new Promise(resolve => { release = resolve; });
      const analyzing = new Promise(resolve => { entered = resolve; });
      pipeline.processBatch = async function (...args) { entered(); await wait; return originalPipeline.apply(this, args); };
      const other = await budget(); const key = crypto.randomUUID();
      const pendingResponse = submit(other, form('10', key));
      await analyzing;
      try {
        const pending = await Expenditure.findOne({ submissionKey: key });
        assert.equal((await review(other, pending, 'verified', 'Manually reviewed evidence')).status, 200);
      } finally { release(); }
      const response = await pendingResponse; assert.equal(response.status, 201);
      const tx = await Transaction.findById(response.body.transactionId);
      assert.equal(tx.verificationStatus, 'Verified'); assert.equal(tx.verifiedBy, String(users.auditor._id)); assert.ok(tx.verifiedAt);
    });
    await t.test('all approved budgets are visible without selecting or assigning a barangay', async () => {
      const response = await request('treasurer', '/approved-budgets');
      assert.equal(response.status, 200);
      assert.ok(response.body.some(row => row._id === String(p._id)));
      assert.equal(users.treasurer.barangayId, undefined);
      assert.equal(users.auditor.barangayId, undefined);
      assert.equal((await request('official', '/approved-budgets')).status, 403);
    });
    const csvContent = (a = 40, b = 20) => `record_id,post_date,agency,program_name,payer_name,payee_name,debit_amount,credit_amount,description_raw,transaction_type,item1_name,item1_quantity,item1_unit_price\nCSV-1,2026-10-20,LGU,Repairs,Office,Supplier A,${a},0,Materials,Procurement,Cement,2,10\nCSV-2,2026-10-20,LGU,Repairs,Office,Supplier B,${b},0,Delivery,Procurement,Gravel,1,20\n`;
    function csvForm(content, key, selections = [{ evidenceIndexes: [0] }, { evidenceIndexes: [1] }]) {
      const data = new FormData(); data.append('csvFile', new Blob([content], { type: 'text/csv' }), 'expenses.csv');
      data.append('submissionKey', key); data.append('rows', JSON.stringify(selections));
      data.append('evidence', new Blob([pdf], { type: 'application/pdf' }), 'first.pdf'); data.append('evidence', new Blob([pdf.replace('fixture', 'second')], { type: 'application/pdf' }), 'second.pdf'); return data;
    }
    const csvSubmit = (p, content, key, selections) => request('treasurer', `/approved-budgets/${p._id}/expenditures/import-csv`, { method: 'POST', body: csvForm(content, key, selections) });
    await t.test('CSV preview uses legacy fields and creates no expenditure or reservation', async () => {
      const other = await budget(); const data = new FormData(); data.append('csvFile', new Blob([csvContent()], { type: 'text/csv' }), 'expenses.csv');
      const response = await request('treasurer', `/approved-budgets/${other._id}/expenditures/preview-csv`, { method: 'POST', body: data });
      assert.equal(response.status, 200, JSON.stringify(response)); assert.equal(response.body.rows.length, 2); assert.equal(response.body.rows[0].payee, 'Supplier A'); assert.equal(response.body.rows[0].input.lineItems[0].name, 'Cement');
      assert.equal(await Expenditure.countDocuments({ budgetProposalId: other._id }), 0); assert.equal((await Proposal.findById(other._id)).expenditureReserved.size, 0);
    });
    await t.test('CSV budget overflow rolls back the entire batch before analysis', async () => {
      const other = await budget();
      const response = await csvSubmit(other, csvContent(60, 60), crypto.randomUUID()); assert.equal(response.status, 409, JSON.stringify(response));
      assert.equal(await Expenditure.countDocuments({ budgetProposalId: other._id }), 0); assert.equal((await Proposal.findById(other._id)).expenditureReserved.size, 0);
    });
    await t.test('each CSV row needs its own evidence association before any records are saved', async () => {
      const other = await budget();
      const response = await csvSubmit(other, csvContent(), crypto.randomUUID(), [{ allocationId: 'materials', evidenceIndexes: [0] }, { allocationId: 'materials', evidenceIndexes: [] }]);
      assert.equal(response.status, 422); assert.equal(await Expenditure.countDocuments({ budgetProposalId: other._id }), 0);
    });
    await t.test('CSV batch reuses the existing complete batch pipeline and preserves evidence, itemized fields and source IDs', async () => {
      const other = await budget(); const key = crypto.randomUUID(); let analyses = 0;
      pipeline.processBatch = async function (batch, options) { analyses++; assert.equal(batch.length, 2); assert.deepEqual(options, { requireApproval: true, staged: true, batchSize: 250, useML: true }); assert.ok(batch[0].timestamp instanceof Date); assert.equal(batch[0].evidence, undefined); return originalPipeline.call(this, batch, options); };
      const response = await csvSubmit(other, csvContent(), key); assert.equal(response.status, 201, JSON.stringify(response));
      const expenses = response.body.expenditures; assert.equal(expenses.length, 2); assert.equal(expenses[0].sourceRecordId, 'CSV-1'); assert.equal(expenses[1].sourceRecordId, 'CSV-2');
      assert.equal(expenses[0].assessmentStatus, 'complete'); assert.equal(expenses[1].assessmentStatus, 'complete');
      assert.equal((await request('auditor', auditUrl(other, expenses[0]), { method: 'POST', body: auditForm() })).status, 201);
      const first = await Transaction.findById(expenses[0].transactionId); assert.equal(first.lineItems[0].name, 'Cement'); assert.equal(first.amount, 40); assert.equal(first.mlUsed, true);
      const stored = await Expenditure.find({ budgetProposalId: other._id }).select('+evidence.data').sort({ sourceRowNumber: 1 });
      assert.deepEqual([...stored[0].evidence[0].categories], ['expenditure_evidence']);
      assert.equal(stored[0].evidence[0].data.toString(), pdf); assert.equal(stored[1].evidence[0].data.toString(), pdf.replace('fixture', 'second'));
      assert.equal((await csvSubmit(other, csvContent(), key)).status, 200); assert.equal(analyses, 1);
      assert.equal((await csvSubmit(other, csvContent(), crypto.randomUUID())).status, 409); assert.equal(analyses, 1);
      assert.equal(await Expenditure.countDocuments({ budgetProposalId: other._id }), 2);
      const page = await request('treasurer', `/approved-budgets/${other._id}`); assert.equal(page.body.totals.pending, 6000); assert.equal(page.body.totals.available, 4000);
      assert.ok(mlRequests.length > 0); assert.equal(mlRequests.at(-1).transactions.length, 2); assert.equal(mlRequests.at(-1).evidence, undefined);
    });
    await t.test('CSV analysis failure after transaction persistence keeps all submissions and reconciles original transaction references', async () => {
      const other = await budget(); const key = crypto.randomUUID(); let analyses = 0;
      pipeline.processBatch = async function (...args) { analyses++; await originalPipeline.apply(this, args); throw new Error('Simulated failure after original transaction persistence'); };
      const response = await csvSubmit(other, csvContent(), key); assert.equal(response.status, 201);
      for (const e of response.body.expenditures) { assert.equal(e.assessmentStatus, 'unavailable'); assert.ok(e.transactionId); assert.equal(e.assessment, undefined); }
      assert.equal((await csvSubmit(other, csvContent(), key)).status, 200); assert.equal(analyses, 1);
    });
    await t.test('Treasurer can upload image and Word evidence and auditor can preview them', async () => {
      pipeline.processBatch = originalPipeline;
      const other = await budget();
      const docx = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../scripts/fixtures/evidence-preview.docx'));
      const png = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../scripts/fixtures/evidence-preview.png'));
      for (const [filename, type, bytes] of [['receipt.png', 'image/png', png], ['delivery.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docx]]) {
        const data = form('1'); data.delete('evidence'); data.append('evidence', new Blob([bytes], { type }), filename);
        const saved = await submit(other, data); assert.equal(saved.status, 201);
        const attachment = saved.body.evidence[0]; assert.equal(attachment.mimeType, type);
        const response = await request('auditor', `/approved-budgets/${other._id}/expenditures/${saved.body._id}/evidence/${attachment._id}?preview=true`);
        assert.equal(response.status, 200); assert.equal(response.headers.get('content-type').split(';')[0], type);
      }
    });
  } finally {
    pipeline.processBatch = originalPipeline;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    // Only this freshly named fixture database is removed, never restored/source data.
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
