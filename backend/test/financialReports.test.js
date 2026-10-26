const { test } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../services/financialReportService');
const policy = require('../services/reportPolicy');
const user = { _id: 'user', firstName: 'Test', role: 'auditor', isActive: true, isVerified: true, isApproved: true };
const proposal = { _id: 'p', proposalNumber: 'P-1', items: [{ itemId: 'a', name: 'Same name', estimatedAmountCentavos: 10000000 }], totalAmountCentavos: 10000000 };
const rows = ['verified', 'submitted', 'correction_required', 'rejected'].map((reviewStatus, i) => ({ _id: String(i), budgetProposalId: 'p', allocationId: 'a', amountCentavos: [2000000, 1000000, 500000, 700000][i], reviewStatus, input: { timestamp: '2026-10-25T16:00:00Z', description: '<script>text</script>', toAddress: 'Payee' }, evidence: [] }));
const filters = extra => service.normalize({ type: 'summary', fiscalYear: 2026, ...extra });
test('accounting fixture, repeated transaction budgets never counted', () => {
  const r = service.construct([proposal], rows, [{ _id: 'unused', approvedBudget: 99999999 }], [], filters(), user);
  assert.equal(r.summary.approved, 10000000); assert.equal(r.summary.allRecorded, 4200000);
  assert.equal(r.summary.pendingReserved, 1500000); assert.equal(r.summary.available, 6500000); assert.equal(r.summary.utilizationPercent, 20);
});
test('position-aware capability, onboarding and feature flag', () => {
  const old = process.env.BUDGET_EXPENDITURES_ENABLED;
  try {
    process.env.BUDGET_EXPENDITURES_ENABLED = 'true';
    assert.equal(policy.access(user).reportTypes.length, 3);
    const treasurer = { ...user, role: 'barangay_official', position: ' Barangay TREASURER ' };
    assert.deepEqual(policy.access(treasurer).reportTypes, ['summary', 'register']);
    assert.throws(() => policy.requireAccess(treasurer, 'audit'));
    for (const patch of [{ isActive: false }, { isVerified: false }, { isApproved: false }, { mustChangePassword: true }, { mustSetup2FA: true }, { role: 'barangay_official', position: 'Barangay Captain' }]) assert.equal(policy.access({ ...user, ...patch }).reportTypes.length, 0);
    process.env.BUDGET_EXPENDITURES_ENABLED = 'false'; assert.throws(() => policy.requireAccess(user), /unavailable/);
  } finally { if (old === undefined) delete process.env.BUDGET_EXPENDITURES_ENABLED; else process.env.BUDGET_EXPENDITURES_ENABLED = old; }
});
test('Manila dates, leap days, status selection and stable order', () => {
  assert.equal(new Date(service.boundary('2024-02-29')).toISOString(), '2024-02-28T16:00:00.000Z');
  for (const date of ['2025-02-29', '2026-13-01', 'invalid']) assert.throws(() => service.boundary(date));
  assert.throws(() => filters({ type: 'register', from: '2026-10-27', to: '2026-10-26' }));
  assert.throws(() => filters({ status: 'verified' }));
  const r = service.construct([proposal], [...rows, { ...rows[0], _id: 'before', input: { timestamp: '2026-10-25T15:59:59Z' } }], [], [], filters({ type: 'register', from: '2026-10-26', to: '2026-10-26', status: 'verified' }), user);
  assert.equal(r.recordCount, 1); assert.equal(r.summary.allRecorded, 2000000); assert.equal(r.rows[0].id, '0');
  const review = service.construct([proposal], rows, [], [], filters({ type: 'audit', dateBasis: 'review', from: '2026-10-26' }), user); assert.equal(review.recordCount, 0);
});
test('missing allocations, malformed money, unsafe totals and inconsistent budgets fail', () => {
  for (const entry of [{ ...rows[0], allocationId: 'missing' }, { ...rows[0], amountCentavos: 1.5 }, { ...rows[0], input: { timestamp: 'bad' } }]) assert.throws(() => service.construct([proposal], [entry], [], [], filters(), user));
  assert.throws(() => service.construct([{ ...proposal, totalAmountCentavos: 1 }], [], [], [], filters(), user));
  assert.throws(() => service.totals([{ reviewStatus: 'verified', amountCentavos: Number.MAX_SAFE_INTEGER }, { reviewStatus: 'verified', amountCentavos: 1 }]));
  assert.equal(service.totals([], 0).utilizationPercent, null);
});
test('complete datasets exceed old 200/500 caps; explicit detail limit', () => {
  const proposals = Array.from({ length: 201 }, (_, i) => ({ ...proposal, _id: `p${i}` }));
  const expenses = Array.from({ length: 501 }, (_, i) => ({ ...rows[0], _id: String(i), budgetProposalId: `p${i % 201}` }));
  const r = service.construct(proposals, expenses, [], [], filters(), user);
  assert.equal(r.allocationTotals.length, 201); assert.equal(r.recordCount, 501); assert.equal(r.summary.approved, 2010000000);
  assert.throws(() => service.construct([proposal], Array.from({ length: 5001 }, (_, i) => ({ ...rows[0], _id: String(i) })), [], [], filters({ type: 'register' }), user), /5,000/);
});
test('audit allowlist, missing assessment, orphan link and evidence version', () => {
  const e = { ...rows[0], transactionId: 'missing', evidence: [{ _id: 'file', originalName: 'receipt.pdf', categories: ['receipt'], version: 2, data: Buffer.from('secret'), sha256: 'hash', storagePath: '/secret' }] };
  const r = service.construct([proposal], [e], [], [], filters({ type: 'audit' }), user);
  assert.equal(r.printable, false); assert.equal(r.rows[0].assessmentStatus, 'Unavailable'); assert.equal(r.rows[0].aiRisk, null);
  assert.equal(r.rows[0].evidence[0].version, 2); assert.ok(!JSON.stringify(r).includes('secret'));
  assert.equal(r.rows[0].purpose, '<script>text</script>');
});
test('generation audit failure is disclosed without storing financial rows', async () => {
  const service = require('../services/financialReportService'), AuditLog = require('../models/AuditLog');
  const router = require('../routes/reports');
  const originalGenerate = service.generate, originalLog = AuditLog.logAction, flag = process.env.BUDGET_EXPENDITURES_ENABLED;
  try {
    process.env.BUDGET_EXPENDITURES_ENABLED = 'true';
    service.generate = async () => ({ reportId: 'fixture', templateVersion: '1.0', generatedAt: new Date().toISOString(), recordCount: 1, notices: [], rows: [{ payee: 'Private' }] });
    AuditLog.logAction = async data => { assert.equal(data.action, 'financial_report_generated'); assert.ok(!JSON.stringify(data).includes('Private')); return undefined; };
    const handler = router.stack.find(l => l.route?.path === '/preview').route.stack[0].handle;
    let result; await handler({ body: { type: 'summary', fiscalYear: 2026 }, user }, { json: data => { result = data; } }, e => { throw e; });
    assert.match(result.notices[0], /could not be recorded/);
  } finally { service.generate = originalGenerate; AuditLog.logAction = originalLog; if (flag === undefined) delete process.env.BUDGET_EXPENDITURES_ENABLED; else process.env.BUDGET_EXPENDITURES_ENABLED = flag; }
});
test('snapshot unavailability fails explicitly and releases session', async () => {
  const mongoose = require('mongoose'), original = mongoose.startSession;
  let ended = false;
  mongoose.startSession = async () => ({ withTransaction: async (fn, options) => { assert.equal(options.readConcern.level, 'snapshot'); throw new Error('Replica set unavailable'); }, endSession: async () => { ended = true; } });
  try { await assert.rejects(service.generate(filters(), user), e => e.status === 503 && /consistent financial snapshot/.test(e.message)); assert.equal(ended, true); }
  finally { mongoose.startSession = original; }
});
