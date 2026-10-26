const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../services/budgetExpenditurePolicy');
const Proposal = require('../models/BudgetProposal');
const Expenditure = require('../models/BudgetExpenditure');
const Transaction = require('../models/Transaction');
const router = require('../routes/budgetExpenditures');
const guard = require('../middleware/protectBudgetExpenditures');
const original = { proposal: Proposal.findOne, expense: Expenditure.findOne, exists: Transaction.exists, init: Expenditure.init };
afterEach(() => { Proposal.findOne = original.proposal; Expenditure.findOne = original.expense; Transaction.exists = original.exists; Expenditure.init = original.init; });
const user = { _id: '507f1f77bcf86cd799439011', role: 'barangay_official', position: 'Barangay Treasurer', isVerified: true, isApproved: true, barangayId: 'pantal' };
const id = '507f1f77bcf86cd799439012';
const proposal = { _id: id, items: [{ itemId: 'cement', estimatedAmountCentavos: 10000 }] };
const input = { allocationId: 'cement', amount: '1.23', timestamp: '2026-10-20T10:00:00Z', fromAddress: 'Barangay', toAddress: 'Supplier', agency: 'LGU', programName: 'Road repair', description: 'Materials', transactionType: 'Procurement' };
async function call(path, req, method = 'post') {
  const handler = router.stack.find(l => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
  const res = { status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } };
  let error; await handler(req, res, e => { error = e; }); return { res, error };
}
test('approved verified Treasurers may submit without a barangay assignment', () => {
  assert.equal(policy.treasurer(user), true);
  for (const change of [{ role: 'administrator' }, { role: 'auditor' }, { position: 'Barangay Captain' }, { isVerified: false }, { isApproved: false }]) assert.equal(policy.treasurer({ ...user, ...change }), false);
  assert.equal(policy.treasurer({ ...user, barangayId: undefined }), true);
  assert.equal(policy.reader({ role: 'auditor', isVerified: true, isApproved: true }), true);
});
test('structured input uses existing financial contract, approved allocation and exact centavos', () => {
  const result = policy.normalize({ ...input, approvedBudget: 999999, evidence: 'do not send' }, proposal);
  assert.equal(result.amountCentavos, 123);
  assert.equal(result.input.approvedBudget, 100);
  assert.equal(result.input.evidence, undefined);
  for (const change of [{ amount: '0' }, { amount: '0.000000001' }, { amount: '-1' }, { amount: '1.001' }, { amount: 'Infinity' }, { allocationId: 'unknown' }, { agency: '' }, { programName: '' }, { timestamp: 'bad' }, { transactionType: 'Invented' }]) assert.throws(() => policy.normalize({ ...input, ...change }, proposal));
});
test('pending corrections reserve funds, rejection releases them, verified totals stay separate', () => {
  const rows = [{ reviewStatus: 'submitted', amountCentavos: 100 }, { reviewStatus: 'verified', amountCentavos: 200 }, { reviewStatus: 'correction_required', amountCentavos: 300 }, { reviewStatus: 'rejected', amountCentavos: 400 }];
  assert.deepEqual(policy.totals(rows, 1000), { approved: 1000, recorded: 1000, verified: 200, pending: 400, available: 400 });
});
test('submission refuses ordinary officials before touching uploads or analysis', async () => {
  const r = await call('/:id/expenditures', { user: { ...user, position: 'Barangay Captain' }, params: { id } });
  assert.equal(r.error.status, 403);
});
test('budget reads require approved status without a per-user barangay filter', async () => {
  Proposal.findOne = async filter => { assert.equal(filter.status, 'ADMIN_APPROVED'); assert.equal(filter.barangayId, undefined); return null; };
  const r = await call('/:id', { user, params: { id } }, 'get');
  assert.equal(r.error.status, 404);
});
test('auditor review rejects self review, missing adverse reasons and settled decisions', async () => {
  Proposal.findOne = async () => proposal;
  const e = { submittedBy: user._id, reviewStatus: 'submitted' };
  Expenditure.findOne = async filter => { assert.equal(filter.budgetProposalId, id); return e; };
  const req = { user, params: { id, expenseId: '507f1f77bcf86cd799439013' }, body: { status: 'verified' } };
  assert.equal((await call('/:id/expenditures/:expenseId/review', req)).error.status, 403);
  assert.equal((await call('/:id/expenditures/:expenseId/review', { ...req, user: { ...user, role: 'auditor' } })).error.status, 403);
  const auditor = { ...user, _id: '507f1f77bcf86cd799439014', role: 'auditor' };
  assert.equal((await call('/:id/expenditures/:expenseId/review', { ...req, user: auditor, body: { status: 'rejected' } })).error.status, 422);
  e.reviewStatus = 'rejected';
  assert.equal((await call('/:id/expenditures/:expenseId/review', { ...req, user: auditor })).error.status, 409);
});
test('legacy mutations cannot delete, verify or change a linked expenditure including batches', async () => {
  Transaction.exists = async filter => { assert.equal(String(filter.transactionId), '/^EXP-/'); assert.ok(filter._id.$in.includes(id)); return true; };
  for (const req of [{ method: 'DELETE', path: `/${id}` }, { method: 'PUT', path: '/batch-action', body: { ids: [id], action: 'approve' } }]) {
    let advanced = false; const res = { status(n) { this.code = n; return this; }, json(v) { this.body = v; } };
    await guard(req, res, () => { advanced = true; }); assert.equal(advanced, false); assert.equal(res.code, 409);
  }
});

const { Readable } = require('node:stream');
const mongoose = require('mongoose');
const pipeline = require('../services/multiStageFraudPipeline');
function multipart(categories, data = '%PDF-1.4\nexample\n%%EOF') {
  const boundary = 'chainshield-test-boundary';
  const fields = { ...input, submissionKey: 'submission-test-key', categories: JSON.stringify(categories) };
  let content = Object.entries(fields).map(([key, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`).join('');
  content += `--${boundary}\r\nContent-Disposition: form-data; name="evidence"; filename="receipt.pdf"\r\nContent-Type: application/pdf\r\n\r\n${data}\r\n--${boundary}--\r\n`;
  const bytes = Buffer.from(content), req = Readable.from([bytes]);
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(bytes.length) };
  req.method = 'POST'; req.user = user; req.params = { id }; return req;
}
test('actual multipart endpoint requires both evidence categories and matching signatures', async () => {
  Proposal.findOne = async () => proposal;
  for (const categories of [[], [['receipt']], [['supporting_document']], [['receipt', 'unsupported']]]) assert.equal((await call('/:id/expenditures', multipart(categories))).error.status, 422);
  assert.equal((await call('/:id/expenditures', multipart([['receipt', 'supporting_document']], '<script>bad</script>'))).error.status, 422);
});
test('submission commits evidence before analysis; failure persists without fabricated results or duplicate retry', async () => {
  const originals = { start: mongoose.startSession, create: Expenditure.create, update: Proposal.findOneAndUpdate, expenseUpdate: Expenditure.findOneAndUpdate, byId: Expenditure.findById, batch: pipeline.processBatch, transaction: Transaction.findOne };
  let saved, committed = false, calls = 0;
  try {
    Proposal.findOne = async () => proposal; Expenditure.findOne = async () => saved; Expenditure.init = async () => {};
    mongoose.startSession = async () => ({ async withTransaction(fn) { await fn(); committed = true; }, async endSession() {} });
    Proposal.findOneAndUpdate = async (filter, update) => {
      assert.equal(filter.status, 'ADMIN_APPROVED'); assert.equal(filter.$expr.$lte[1], 10000);
      const [key, value] = Object.entries(update.$inc)[0]; assert.equal(value, 123);
      return { expenditureReserved: new Map([[key.split('.')[1], 123]]) };
    };
    Expenditure.create = async ([fields]) => {
      assert.equal(committed, false); assert.equal(fields.evidence.length, 1);
      assert.deepEqual(fields.evidence[0].categories, ['receipt', 'supporting_document']);
      assert.equal(fields.evidence[0].sha256.length, 64);
      saved = new Expenditure(fields); return [saved];
    };
    pipeline.processBatch = async ([fields], options) => {
      calls++; assert.equal(committed, true); assert.deepEqual(options, { requireApproval: true });
      assert.equal(fields.evidence, undefined); assert.ok(fields.timestamp instanceof Date); assert.equal(fields.amount, 1.23); assert.equal(fields.remainingBudget, 98.77);
      throw new Error('Simulated inference unavailable');
    };
    Transaction.findOne = async () => null;
    Expenditure.findOneAndUpdate = async (_, update) => { Object.assign(saved, update.$set); saved.history.push(update.$push.history); return saved; };
    Expenditure.findById = async () => saved;
    const result = await call('/:id/expenditures', multipart([['receipt', 'supporting_document']]));
    assert.equal(result.error, undefined); assert.equal(result.res.code, 201);
    assert.equal(result.res.body.assessmentStatus, 'unavailable'); assert.equal(result.res.body.assessment, undefined);
    const repeat = await call('/:id/expenditures', multipart([['receipt', 'supporting_document']]));
    assert.equal(repeat.error, undefined); assert.equal(calls, 1); assert.equal(repeat.res.body.evidence[0].data, undefined);
  } finally {
    mongoose.startSession = originals.start; Expenditure.create = originals.create; Proposal.findOneAndUpdate = originals.update; Expenditure.findOneAndUpdate = originals.expenseUpdate; Expenditure.findById = originals.byId; pipeline.processBatch = originals.batch; Transaction.findOne = originals.transaction;
  }
});
test('atomic allocation predicate refuses exhausted funds before record creation or analysis', async () => {
  const originals = { start: mongoose.startSession, update: Proposal.findOneAndUpdate };
  try {
    Proposal.findOne = async () => proposal; Expenditure.findOne = async () => null; Expenditure.init = async () => {};
    mongoose.startSession = async () => ({ async withTransaction(fn) { await fn(); }, async endSession() {} });
    Proposal.findOneAndUpdate = async filter => { assert.equal(filter.$expr.$lte[0].$add[1], 123); assert.equal(filter.$expr.$lte[1], 10000); return null; };
    assert.equal((await call('/:id/expenditures', multipart([['receipt', 'supporting_document']]))).error.status, 409);
  } finally { mongoose.startSession = originals.start; Proposal.findOneAndUpdate = originals.update; }
});
