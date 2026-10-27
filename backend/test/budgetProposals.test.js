const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { normalize, captain } = require('../services/budgetProposalPolicy');
const { validate } = require('../services/budgetDocumentPolicy');
const Proposal = require('../models/BudgetProposal');
const Audit = require('../models/AuditLog');
const router = require('../routes/budgetProposals');
const annual = require('../services/annualBudgetService');
const original = { approve: annual.approve, find: Proposal.findOne, update: Proposal.findOneAndUpdate, audit: Audit.logAction };
afterEach(() => { annual.approve = original.approve; Proposal.findOne = original.find; Proposal.findOneAndUpdate = original.update; Audit.logAction = original.audit; });
const valid = () => ({ title: 'Road repair', fiscalYear: 2027, proposalType: 'annual', sector: 'infrastructure', justification: 'Repair damaged roads', items: [{ name: 'Cement', description: '100 bags for Pantal road', estimatedAmountCentavos: 10001 }] });
const user = { _id: '507f1f77bcf86cd799439011', role: 'barangay_official', submitBudgetProposals: true, barangayId: 'pantal' };
const id = '507f1f77bcf86cd799439012';
async function call(path, req, method) {
  const route = router.stack.find(layer => layer.route?.path === path && (!method || layer.route.methods[method])).route;
  const handler = route.stack.at(-1).handle;
  const res = { json(body) { this.body = body; return this; } };
  let error; await handler(req, res, e => { error = e; });
  return { res, error };
}
test('ordinary officials and administrators do not inherit Captain capability', () => {
  assert.equal(captain(user), true);
  for (const override of [{ submitBudgetProposals: false, position: 'Barangay Captain' }, { role: 'administrator' }, { role: 'auditor' }]) assert.equal(captain({ ...user, ...override }), false);
});
test('integer totals are recomputed and drafts permit partial but not malformed amounts', () => {
  const body = valid(); body.totalAmountCentavos = 1; body.items.push({ ...body.items[0], estimatedAmountCentavos: 20002 });
  assert.equal(normalize(body, true).totalAmountCentavos, 30003);
  assert.equal(normalize({ items: [] }).title, '');
  for (const amount of [-1, 1.5, '100', NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => normalize({ items: [{ estimatedAmountCentavos: amount }] }));
  assert.throws(() => normalize({ items: [] }, true));
  assert.throws(() => normalize({ ...valid(), title: 'x'.repeat(201) }));
  assert.throws(() => normalize({ ...valid(), items: [{ ...valid().items[0], description: '' }] }, true));
});
test('file contents must agree with declared extension and MIME; arbitrary ZIP is rejected', () => {
  const file = { originalname: 'estimate.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nexample\n%%EOF') };
  assert.equal(validate(file), 'application/pdf');
  for (const overrides of [{ originalname: 'estimate.exe' }, { mimetype: 'image/png' }, { buffer: Buffer.from('<html>bad</html>') }, { originalname: 'estimate.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK\x03\x04invalid') }]) assert.throws(() => validate({ ...file, ...overrides }));
});
test('submission scopes ownership, persists snapshot atomically, rejects stale and duplicate submissions', async () => {
  const p = new Proposal({ ...valid(), _id: id, createdBy: user._id, barangayId: 'pantal', proposalNumber: 'BP-test' });
  let filter, update;
  Proposal.findOne = async f => { assert.equal(String(f.createdBy), user._id); assert.equal(f.barangayId, undefined); return p; };
  Proposal.findOneAndUpdate = async (f, u) => { filter = f; update = u; return { status: 'SUBMITTED', revision: 2 }; };
  Audit.logAction = async () => {};
  const req = { params: { id }, user, body: { revision: 1 } };
  assert.equal((await call('/:id/submit', req)).error, undefined);
  assert.equal(filter.status, 'DRAFT'); assert.equal(filter.revision, 1);
  assert.equal(update.$set.status, 'SUBMITTED'); assert.ok(update.$push.history.snapshotHash); assert.equal(update.$push.history.snapshot.items[0].name, 'Cement');
  assert.equal((await call('/:id/submit', { ...req, body: { revision: 0 } })).error.status, 409);
  Proposal.findOneAndUpdate = async () => null;
  assert.equal((await call('/:id/submit', req)).error.status, 409);
  p.status = 'SUBMITTED'; assert.equal((await call('/:id/submit', req)).error.status, 409);
});
test('review requires pending state, reason on rejection, and forbids self review', async () => {
  const p = new Proposal({ ...valid(), _id: id, createdBy: user._id, barangayId: 'pantal', proposalNumber: 'BP-test', status: 'SUBMITTED' });
  Proposal.findOne = async () => p;
  const req = { params: { id }, user: { _id: '507f1f77bcf86cd799439013', role: 'administrator' }, body: { revision: 1, remarks: '' } };
  assert.equal((await call('/:id/reject', req)).error.status, 422);
  assert.equal((await call('/:id/approve', { ...req, user: { ...req.user, _id: user._id } })).error.status, 403);
  let update; annual.approve = async (proposal, revision, set, entry) => { assert.equal(proposal, p); assert.equal(revision, 1); update = { $set: set, $push: { history: entry } }; return { status: 'ADMIN_APPROVED', revision: 2 }; }; Audit.logAction = async () => {};
  assert.equal((await call('/:id/approve', req)).error, undefined);
  assert.equal(update.$set.status, 'ADMIN_APPROVED'); assert.equal(update.$push.history.action, 'administrative_review_approved');
  p.status = 'ADMIN_APPROVED'; assert.equal((await call('/:id/reject', req)).error.status, 409);
});
test('inaccessible proposals and documents return 404 and reviewed drafts cannot be edited', async () => {
  Proposal.findOne = async () => null;
  assert.equal((await call('/:id/history', { params: { id }, user })).error.status, 404);
  const p = new Proposal({ ...valid(), _id: id, createdBy: user._id, barangayId: 'pantal', proposalNumber: 'BP-test', status: 'REJECTED' });
  Proposal.findOne = async () => p;
  assert.equal((await call('/:id', { params: { id }, user, body: { ...valid(), revision: 1 } }, 'patch')).error.status, 409);
});
test('administrators cannot create, upload, edit, remove documents or submit even with a Captain flag', () => {
  for (const [path, method] of [['/', 'post'], ['/:id/documents', 'post'], ['/:id', 'patch'], ['/:id/documents/:fileId', 'delete'], ['/:id/submit', 'post']]) {
    const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
    const gate = route.stack[0].handle;
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    let passed = false;
    gate({ user: { ...user, role: 'administrator' } }, res, () => { passed = true; });
    assert.equal(res.code, 403, `${method} ${path}`); assert.equal(passed, false);
    gate({ user }, res, () => { passed = true; }); assert.equal(passed, true);
  }
});

test('existing admin-approved and admin-created verified Captains can submit without a separate entitlement', () => {
  const identity = { role: 'barangay_official', position: 'Barangay Captain', isApproved: true, isVerified: true };
  const { barangay, assignApprovedCaptain } = require('../services/budgetProposalPolicy');
  for (const trusted of [{ approvedBy: 'admin' }, { invitedBy: 'admin' }]) {
    assert.equal(captain({ ...identity, ...trusted }), true);
    assert.equal(captain({ ...identity, ...trusted, submitBudgetProposals: false }), true);
    assert.ok(barangay(identity));
  }
  for (const override of [{}, { approvedBy: 'admin', isApproved: false }, { approvedBy: 'admin', isVerified: false }, { approvedBy: 'admin', position: 'Barangay Treasurer' }, { approvedBy: 'admin', submitBudgetProposals: false, budgetProposalAccessManaged: true }, { approvedBy: 'admin', role: 'administrator' }]) {
    assert.equal(captain({ ...identity, ...override }), false);
  }
  assignApprovedCaptain(identity, 'admin');
  assert.equal(identity.submitBudgetProposals, true); assert.ok(identity.barangayId); assert.equal(identity.approvedBy, 'admin');
  identity.position = 'Barangay Secretary'; assignApprovedCaptain(identity, 'admin'); assert.equal(identity.submitBudgetProposals, false);
});

test('list projection never combines documents with its excluded data child', async () => {
  const find = Proposal.find;
  let projection;
  Proposal.find = function (filter) {
    const query = find.call(this, filter);
    query.exec = async function () { this._applyPaths(); projection = this.projection(); return []; };
    return query;
  };
  try {
    const result = await call('/', { user, query: {} }, 'get');
    assert.equal(result.error, undefined);
    assert.deepEqual(result.res.body, []);
    assert.equal(projection.proposalNumber, 1);
    assert.equal(projection.documents, undefined);
    assert.equal(projection['documents.data'], undefined);
    assert.equal(projection.history, undefined);
  } finally { Proposal.find = find; }
});


test('deployment barangay label does not depend on per-user assignments', () => {
  const { barangay } = require('../services/budgetProposalPolicy');
  assert.equal(barangay({}), barangay({ barangayId: 'historical-label' }));
});
