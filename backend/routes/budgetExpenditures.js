const router = require('express').Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const multer = require('multer');
const Proposal = require('../models/BudgetProposal');
const Expenditure = require('../models/BudgetExpenditure');
const Transaction = require('../models/Transaction');
const policy = require('../services/budgetExpenditurePolicy');
const { fail, text } = require('../services/budgetProposalPolicy');
const { validate } = require('../services/budgetDocumentPolicy');
const csvImport = require('../services/budgetExpenditureCsv');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const event = (req, action, reason = '') => ({ actor: req.user._id, action, reason, at: new Date() });
const reserveKey = id => `expenditureReserved.${crypto.createHash('sha256').update(id).digest('hex')}`;
router.use(require('../middleware/auth'));
router.get('/access', (req, res) => res.json({ enabled: policy.enabled(), canSubmit: policy.enabled() && policy.treasurer(req.user), canReview: policy.enabled() && req.user.role === 'auditor' && policy.reader(req.user), canRead: policy.enabled() && policy.reader(req.user) }));
router.use((req, res, next) => !policy.enabled() ? res.status(503).json({ error: 'Budget expenditures are not enabled pending rollout verification' }) : !policy.reader(req.user) ? res.status(403).json({ error: 'Expenditure access denied' }) : next());
async function budget(req) {
  if (!mongoose.isValidObjectId(req.params.id)) fail('Budget not found', 404);
  const p = await Proposal.findOne({ _id: req.params.id, status: 'ADMIN_APPROVED' });
  if (!p) fail('Approved budget not found', 404);
  return p;
}
async function expense(req, data = false) {
  if (!mongoose.isValidObjectId(req.params.expenseId)) fail('Expenditure not found', 404);
  let query = Expenditure.findOne({ _id: req.params.expenseId, budgetProposalId: req.params.id });
  if (data) query = query.select('+evidence.data');
  const e = await query; if (!e) fail('Expenditure not found', 404); return e;
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 15, parts: 20 } });
async function files(req, res) {
  await new Promise((resolve, reject) => upload.array('evidence', 5)(req, res, err => err ? reject(Object.assign(err, { status: 422 })) : resolve()));
  return evidenceDocuments(req);
}
function evidenceDocuments(req, maxFiles = 5) {
  let categories;
  try { categories = JSON.parse(req.body.categories); } catch { fail('Evidence classifications required'); }
  if (!req.files?.length || !Array.isArray(categories) || categories.length !== req.files.length || req.files.length > maxFiles || req.files.reduce((n, f) => n + f.size, 0) > 10 * 1024 * 1024) fail(`Attach one to ${maxFiles} files, at most 5 MB each and 10 MB combined`);
  const docs = req.files.map((f, i) => {
    const c = categories[i];
    if (!Array.isArray(c) || !c.length || c.some(v => !['receipt', 'supporting_document'].includes(v))) fail('Invalid evidence classification');
    if (/\.xlsx$/i.test(f.originalname)) fail('Use PDF, DOCX, JPG or PNG evidence');
    return { categories: [...new Set(c)], originalName: text(f.originalname.replace(/[\\/\x00-\x1f\x7f]/g, '_'), 240), mimeType: validate(f), bytes: f.size, data: f.buffer, sha256: crypto.createHash('sha256').update(f.buffer).digest('hex'), uploadedBy: req.user._id, uploadedAt: new Date(), version: 1 };
  });
  if (!['receipt', 'supporting_document'].every(c => docs.some(d => d.categories.includes(c)))) fail('Receipt and supporting document are both required; one file may serve both');
  return docs;
}
const safe = e => { const out = e.toObject(); out.evidence.forEach(d => delete d.data); return out; };
function transactionReview(e) {
  const settled = ['verified', 'rejected'].includes(e.reviewStatus);
  return { $set: { verificationStatus: e.reviewStatus === 'verified' ? 'Verified' : e.reviewStatus === 'rejected' ? 'Rejected' : 'Pending', ...(settled && { verifiedBy: String(e.reviewerId), verifiedAt: e.reviewedAt }) }, ...(!settled && { $unset: { verifiedBy: '', verifiedAt: '' } }) };
}
async function finishAssessment(req, id, fields, action) {
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const current = await Expenditure.findOneAndUpdate({ _id: id }, { $set: fields, $push: { history: event(req, action) } }, { new: true, session });
    // Serialize with human review if it occurred during external analysis.
    if (current.transactionId) await Transaction.updateOne({ _id: current.transactionId }, transactionReview(current), { session });
  }); } finally { await session.endSession(); }
}

router.get('/', wrap(async (req, res) => {
  const rows = await Proposal.find({ status: 'ADMIN_APPROVED' }).select('proposalNumber title reviewedAt reviewedBy totalAmountCentavos items barangayId').sort({ reviewedAt: -1 }).limit(200).lean();
  const expenses = await Expenditure.find({ budgetProposalId: { $in: rows.map(p => p._id) } }).select('budgetProposalId amountCentavos reviewStatus').lean();
  res.json(rows.map(p => ({ ...p, totals: policy.totals(expenses.filter(e => String(e.budgetProposalId) === String(p._id)), p.totalAmountCentavos) })));
}));
const csvUpload = multer({ storage: csvImport.memoryStorage, limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 2 } }).single('csvFile');
const batchUpload = multer({ storage: csvImport.memoryStorage, limits: { fileSize: 5 * 1024 * 1024, files: 21, fields: 3, parts: 25, fieldSize: 65536 } }).fields([{ name: 'csvFile', maxCount: 1 }, { name: 'evidence', maxCount: 20 }]);
const receive = (upload, req, res) => new Promise((resolve, reject) => upload(req, res, error => error ? reject(Object.assign(error, { status: error.status || 422 })) : resolve()));
router.post('/:id/expenditures/preview-csv', wrap(async (req, res) => {
  if (!policy.treasurer(req.user)) fail('Approved Treasurer required', 403);
  await budget(req); await receive(csvUpload, req, res);
  res.json(await csvImport.parse(req.file));
}));
router.post('/:id/expenditures/import-csv', wrap(async (req, res) => {
  if (!policy.treasurer(req.user)) fail('Approved Treasurer required', 403);
  const p = await budget(req); await receive(batchUpload, req, res);
  const parsed = await csvImport.parse(req.files?.csvFile?.[0]);
  const batchKey = text(req.body.submissionKey, 60);
  if (!/^[a-zA-Z0-9-]{16,60}$/.test(batchKey)) fail('Valid submission key required');
  let selections;
  try { selections = JSON.parse(req.body.rows); } catch { fail('Select allocation and evidence for every CSV row'); }
  if (!Array.isArray(selections) || selections.length !== parsed.rows.length) fail('Select allocation and evidence for every CSV row');
  req.files = req.files.evidence;
  const documents = evidenceDocuments(req, 20);
  const entries = parsed.rows.map((row, i) => {
    const selection = selections[i];
    const normalized = policy.normalize({ ...row.input, allocationId: selection?.allocationId }, p);
    const indexes = selection?.evidenceIndexes;
    if (!Array.isArray(indexes) || !indexes.length || indexes.some(n => !Number.isInteger(n) || n < 0 || n >= documents.length)) fail(`CSV row ${row.rowNumber}: select its evidence files`);
    const evidence = [...new Set(indexes)].map(n => documents[n]);
    if (!['receipt', 'supporting_document'].every(c => evidence.some(f => f.categories.includes(c)))) fail(`CSV row ${row.rowNumber}: receipt and supporting document are both required`);
    return { ...normalized, input: { ...normalized.input, lineItems: row.input.lineItems, beneficiaryType: row.input.beneficiaryType }, evidence,
      budgetProposalId: p._id, submittedBy: req.user._id, submissionKey: `${batchKey}-${i}`,
      sourceCsvHash: parsed.sha256, sourceRowNumber: row.rowNumber, sourceFilename: parsed.filename,
      sourcePayer: row.payer, sourcePayee: row.payee, ...(row.recordId && { sourceRecordId: row.recordId }), history: [event(req, 'csv_submitted_with_evidence')] };
  });
  if (entries.reduce((sum, e) => sum + e.evidence.reduce((n, f) => n + f.bytes, 0), 0) > 25 * 1024 * 1024) fail('Batch evidence exceeds 25 MB across expenditures; split the CSV into smaller batches');
  await Expenditure.init();
  const previous = await Expenditure.find({ budgetProposalId: p._id, submissionKey: { $in: entries.map(e => e.submissionKey) } }).sort({ sourceRowNumber: 1 });
  if (previous.length) {
    if (previous.length !== entries.length || previous.some(e => String(e.submittedBy) !== String(req.user._id) || e.sourceCsvHash !== parsed.sha256)) fail('Submission key conflict', 409);
    return res.json({ expenditures: previous });
  }
  const session = await mongoose.startSession(); let saved;
  try { await session.withTransaction(async () => {
    const records = [];
    for (const entry of entries) {
      const { allocation, ...record } = entry;
      const key = reserveKey(record.allocationId);
      const updated = await Proposal.findOneAndUpdate({ _id: p._id, status: 'ADMIN_APPROVED', $expr: { $lte: [{ $add: [{ $ifNull: [`$${key}`, 0] }, record.amountCentavos] }, allocation.estimatedAmountCentavos] } }, { $inc: { [key]: record.amountCentavos } }, { session, new: true });
      if (!updated) fail('CSV batch exceeds an approved allocation’s available funds; no expenditures saved', 409);
      record.input.remainingBudget = (allocation.estimatedAmountCentavos - updated.expenditureReserved.get(key.split('.')[1])) / 100;
      records.push(record);
    }
    saved = await Expenditure.create(records, { session });
  }); } finally { await session.endSession(); }
  try {
    const { results } = await require('../services/multiStageFraudPipeline').processBatch(saved.map(e => ({ ...e.input, timestamp: new Date(e.input.timestamp), transactionId: `EXP-${e._id}` })), { requireApproval: true, staged: true, batchSize: 250, useML: true });
    if (results?.length !== saved.length) throw new Error('Incomplete CSV assessment');
    for (let i = 0; i < saved.length; i++) await finishAssessment(req, saved[i]._id, { transactionId: results[i].transactionId, assessment: results[i], assessmentStatus: 'complete' }, 'assessment_linked');
  } catch (error) {
    console.error('CSV expenditure assessment unavailable:', error.message);
    for (const e of saved) {
      const transaction = await Transaction.findOne({ transactionId: `EXP-${e._id}` });
      await finishAssessment(req, e._id, { assessmentStatus: 'unavailable', ...(transaction && { transactionId: transaction._id }) }, 'assessment_unavailable');
    }
  }
  res.status(201).json({ expenditures: await Expenditure.find({ _id: { $in: saved.map(e => e._id) } }).sort({ sourceRowNumber: 1 }) });
}));
router.get('/:id', wrap(async (req, res) => {
  const p = await budget(req); const rows = await Expenditure.find({ budgetProposalId: p._id }).sort({ createdAt: -1 });
  res.json({ budget: p, expenditures: rows, totals: policy.totals(rows, p.totalAmountCentavos), allocations: p.items.map(i => ({ ...i, totals: policy.totals(rows.filter(e => e.allocationId === i.itemId), i.estimatedAmountCentavos) })) });
}));
router.post('/:id/expenditures', wrap(async (req, res) => {
  if (!policy.treasurer(req.user)) fail('Approved Treasurer required', 403);
  const p = await budget(req); const evidence = await files(req, res);
  const { input, allocationId, amountCentavos, allocation } = policy.normalize(req.body, p);
  const submissionKey = text(req.body.submissionKey, 80);
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(submissionKey)) fail('Valid submission key required');
  await Expenditure.init(); // Ensure idempotency's unique index exists before accepting submissions.
  const existing = await Expenditure.findOne({ budgetProposalId: p._id, submissionKey });
  if (existing) { if (String(existing.submittedBy) !== String(req.user._id)) fail('Submission key conflict', 409); return res.json(safe(existing)); }
  const session = await mongoose.startSession(); let e;
  try {
    await session.withTransaction(async () => {
      const key = reserveKey(allocationId);
      const updated = await Proposal.findOneAndUpdate({ _id: p._id, status: 'ADMIN_APPROVED', $expr: { $lte: [{ $add: [{ $ifNull: [`$${key}`, 0] }, amountCentavos] }, allocation.estimatedAmountCentavos] } }, { $inc: { [key]: amountCentavos } }, { session, new: true });
      if (!updated) fail('Allocation has insufficient available funds', 409);
      const reserved = updated.expenditureReserved.get(key.split('.')[1]);
      input.remainingBudget = (allocation.estimatedAmountCentavos - reserved) / 100;
      [e] = await Expenditure.create([{ budgetProposalId: p._id, allocationId, submissionKey, submittedBy: req.user._id, amountCentavos, input, evidence, history: [event(req, 'submitted_with_evidence')] }], { session });
    });
  } finally { await session.endSession(); }
  // External analysis runs only after the evidence and reservation commit. Never
  // retry this call automatically: the existing pipeline may have saved a transaction.
  try {
    const { results } = await require('../services/multiStageFraudPipeline').processBatch([{ ...input, timestamp: new Date(input.timestamp), transactionId: `EXP-${e._id}` }], { requireApproval: true });
    if (!results?.[0]) throw new Error('No assessment returned');
    await finishAssessment(req, e._id, { transactionId: results[0].transactionId, assessment: results[0], assessmentStatus: 'complete' }, 'assessment_linked');
  } catch (err) {
    console.error('Expenditure assessment unavailable:', e.id, err.message);
    const saved = await Transaction.findOne({ transactionId: `EXP-${e._id}` });
    await finishAssessment(req, e._id, { assessmentStatus: 'unavailable', ...(saved && { transactionId: saved._id }) }, 'assessment_unavailable');
  }
  res.status(201).json(await Expenditure.findById(e._id));
}));
router.get('/:id/expenditures/:expenseId', wrap(async (req, res) => { await budget(req); res.json(await expense(req)); }));
router.get('/:id/expenditures/:expenseId/evidence/:fileId', wrap(async (req, res) => {
  await budget(req); const e = await expense(req, true); const f = e.evidence.id(req.params.fileId);
  if (!f) fail('Evidence not found', 404);
  await Expenditure.updateOne({ _id: e._id }, { $push: { history: event(req, 'evidence_downloaded', String(f._id)) } });
  res.set('Cache-Control', 'private, no-store').set('X-Content-Type-Options', 'nosniff').set('Content-Security-Policy', "sandbox; default-src 'none'").type(f.mimeType).attachment(f.originalName).send(f.data);
}));
router.post('/:id/expenditures/:expenseId/evidence', wrap(async (req, res) => {
  await budget(req); const e = await expense(req);
  if (!policy.treasurer(req.user) || String(e.submittedBy) !== String(req.user._id)) fail('Only submitting Treasurer can correct evidence', 403);
  if (e.reviewStatus !== 'correction_required') fail('Corrections must first be requested by an auditor', 409);
  const docs = await files(req, res), reason = text(req.body.reason, 4000);
  if (!reason) fail('Correction reason required');
  const version = Math.max(...e.evidence.map(f => f.version)) + 1;
  if (e.evidence.reduce((n, f) => n + f.bytes, 0) + docs.reduce((n, f) => n + f.bytes, 0) > 12 * 1024 * 1024) fail('Evidence version storage limit reached; contact administrator');
  const updated = await Expenditure.findOneAndUpdate({ _id: e._id, updatedAt: e.updatedAt, reviewStatus: 'correction_required' }, { $set: { reviewStatus: 'submitted' }, $unset: { reviewerId: '', reviewedAt: '', reviewReason: '' }, $push: { evidence: { $each: docs.map(d => ({ ...d, version, reason })) }, history: event(req, 'correction_submitted', reason) } }, { new: true });
  if (!updated) fail('Expenditure changed; reload', 409); res.json(safe(updated));
}));
router.post('/:id/expenditures/:expenseId/review', wrap(async (req, res) => {
  await budget(req); const e = await expense(req);
  if (req.user.role !== 'auditor' || String(e.submittedBy) === String(req.user._id)) fail('Independent auditor required', 403);
  const status = req.body.status, reason = text(req.body.reason, 4000);
  if (!['verified', 'rejected', 'correction_required'].includes(status) || (status !== 'verified' && !reason)) fail('Valid review decision and adverse decision reason required');
  if (e.reviewStatus !== 'submitted') fail('Only submitted expenditures can be reviewed', 409);
  const session = await mongoose.startSession(); let updated;
  try { await session.withTransaction(async () => {
    updated = await Expenditure.findOneAndUpdate({ _id: e._id, reviewStatus: 'submitted', updatedAt: e.updatedAt }, { $set: { reviewStatus: status, reviewerId: req.user._id, reviewedAt: new Date(), reviewReason: reason }, $push: { history: event(req, status, reason) } }, { new: true, session });
    if (!updated) fail('Expenditure changed; reload', 409);
    if (status === 'rejected') await Proposal.updateOne({ _id: e.budgetProposalId }, { $inc: { [reserveKey(e.allocationId)]: -e.amountCentavos } }, { session });
    if (e.transactionId) await Transaction.updateOne({ _id: e.transactionId }, transactionReview(updated), { session });
  }); } finally { await session.endSession(); }
  res.json(updated);
}));
router.use((err, req, res, next) => { if (!err.status && !['CastError', 'ValidationError'].includes(err.name) && err.code !== 11000) return next(err); res.status(err.code === 11000 ? 409 : err.status || 422).json({ error: err.code === 11000 ? 'Submission or CSV record already exists; reload budget' : err.message }); });
module.exports = router;
