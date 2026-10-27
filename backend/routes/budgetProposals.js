const router = require('express').Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const multer = require('multer');
const Proposal = require('../models/BudgetProposal');
const User = require('../models/User');
const Audit = require('../models/AuditLog');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { normalize, captain, barangay, text, fail } = require('../services/budgetProposalPolicy');
const { validate } = require('../services/budgetDocumentPolicy');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.use(require('../middleware/auth'));
const isAdmin = req => req.user.role === 'administrator';
const canSubmit = (req, res, next) => captain(req.user) ? next() : res.status(403).json({ error: 'Verified Captain assignment required' });
const audit = (req, details, action = 'budget_proposal_changed') => Audit.logAction({ action, userId: req.user._id, userRole: req.user.role, username: `${req.user.firstName} ${req.user.lastName}`, details, ipAddress: req.ip });
router.get('/access', (req, res) => res.json({ canSubmit: captain(req.user), canReview: isAdmin(req), barangayId: barangay(req.user) }));
router.put('/assignments/:userId', requireAdmin, wrap(async (req, res) => {
  const actor = await User.findById(req.user._id).select('+twoFactorSecret');
  const code = String(req.body.totpCode || '');
  if (!actor?.twoFactorEnabled || !/^\d{6}$/.test(code) || !require('otplib').verifySync({ token: code, secret: actor.getTwoFactorSecret() }).valid) fail('A current authenticator code is required', 403);
  if (!mongoose.isValidObjectId(req.params.userId)) fail('User not found', 404);
  if (typeof req.body.enabled !== 'boolean') fail('enabled must be a boolean');
  const barangayId = barangay(req.user);
  const user = await User.findOneAndUpdate({ _id: req.params.userId, role: 'barangay_official', isApproved: true }, { $set: { submitBudgetProposals: req.body.enabled, budgetProposalAccessManaged: true, barangayId } }, { new: true });
  if (!user) fail('Approved official not found', 404);
  await audit(req, { userId: user.id, enabled: req.body.enabled, barangayId }, 'budget_proposal_assignment');
  res.json({ success: true });
}));
router.use((req, res, next) => isAdmin(req) || captain(req.user) ? next() : res.status(403).json({ error: 'Budget proposal access denied' }));
const scope = req => isAdmin(req) ? {} : { createdBy: req.user._id };
async function get(req, data = false) {
  if (!mongoose.isValidObjectId(req.params.id)) fail('Proposal not found', 404);
  let query = Proposal.findOne({ _id: req.params.id, ...scope(req) });
  if (data) query = query.select('+documents.data');
  const p = await query;
  if (!p) fail('Proposal not found', 404);
  return p;
}
function event(req, p, action, to = p.status, remarks = '', snapshot) {
  return { actor: req.user._id, action, from: p.status, to, revision: p.revision, at: new Date(), remarks, ...(snapshot && { snapshot, snapshotHash: crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex') }) };
}
async function change(req, p, set, entry, extra = {}) {
  if (req.body.revision !== p.revision) fail('Proposal changed. Reload before continuing.', 409);
  const updated = await Proposal.findOneAndUpdate({ _id: p._id, revision: p.revision, status: p.status }, { $set: set, $inc: { revision: 1 }, $push: { history: entry }, ...extra }, { new: true });
  if (!updated) fail('Proposal changed. Reload before continuing.', 409);
  await audit(req, { proposalId: p.id, action: entry.action, status: updated.status, revision: updated.revision });
  return updated;
}
function draftOwner(req, p) {
  if (!captain(req.user) || String(p.createdBy) !== String(req.user._id)) fail('Only the Captain owner can edit', 403);
  if (p.status !== 'DRAFT') fail('Only drafts can be edited', 409);
}
router.get('/', wrap(async (req, res) => {
  const filter = { ...scope(req) };
  if (req.query.status) { if (!['DRAFT', 'SUBMITTED', 'ADMIN_APPROVED', 'REJECTED'].includes(req.query.status)) fail('Invalid status'); filter.status = req.query.status; }
  if (req.query.year) { filter.fiscalYear = Number(req.query.year); if (!Number.isInteger(filter.fiscalYear)) fail('Invalid year'); }
  res.json(await Proposal.find(filter).select('proposalNumber barangayId createdBy title fiscalYear totalAmountCentavos submittedAt status createdAt updatedAt').populate('createdBy', 'firstName lastName').sort({ createdAt: -1 }).limit(200));
}));
router.post('/', canSubmit, wrap(async (req, res) => {
  const fields = normalize(req.body);
  const p = new Proposal({ ...fields, proposalNumber: `BP-${fields.fiscalYear || new Date().getFullYear()}-${crypto.randomUUID().toUpperCase()}`, createdBy: req.user._id, barangayId: barangay(req.user) });
  p.history.push(event(req, p, 'draft_created'));
  await p.save(); await audit(req, { proposalId: p.id, action: 'draft_created' });
  res.status(201).json(p);
}));
router.get('/:id', wrap(async (req, res) => { const p = await get(req); await p.populate('createdBy', 'firstName lastName'); res.json(p); }));
router.get('/:id/history', wrap(async (req, res) => res.json((await get(req)).history)));
router.patch('/:id', canSubmit, wrap(async (req, res) => {
  const p = await get(req); draftOwner(req, p);
  res.json(await change(req, p, normalize(req.body), event(req, p, 'draft_saved')));
}));
router.post('/:id/submit', canSubmit, wrap(async (req, res) => {
  const p = await get(req); draftOwner(req, p); normalize(p.toObject(), true);
  const snapshot = p.toObject(); delete snapshot.history;
  res.json(await change(req, p, { status: 'SUBMITTED', submittedAt: new Date() }, event(req, p, 'submitted', 'SUBMITTED', '', snapshot)));
}));
for (const [route, status] of [['approve', 'ADMIN_APPROVED'], ['reject', 'REJECTED']]) router.post(`/:id/${route}`, requireAdmin, wrap(async (req, res) => {
  const p = await get(req);
  if (String(p.createdBy) === String(req.user._id)) fail('Self review is prohibited', 403);
  if (p.status !== 'SUBMITTED') fail('Proposal is no longer pending review', 409);
  const remarks = text(req.body.remarks, 4000);
  if (route === 'reject' && !remarks) fail('Rejection explanation required');
  const set = { status, reviewedAt: new Date(), reviewedBy: req.user._id, reviewerRemarks: remarks };
  const entry = event(req, p, route === 'approve' ? 'administrative_review_approved' : 'rejected', status, remarks);
  if (route === 'approve') {
    const updated = await require('../services/annualBudgetService').approve(p, req.body.revision, set, entry);
    await audit(req, { proposalId: p.id, action: entry.action, status: updated.status, revision: updated.revision });
    return res.json(updated);
  }
  res.json(await change(req, p, set, entry));
}));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 1, parts: 6 } });
router.post('/:id/documents', canSubmit, wrap(async (req, res) => {
  const p = await get(req); draftOwner(req, p);
  await new Promise((resolve, reject) => upload.array('documents', 5)(req, res, err => err ? reject(Object.assign(err, { status: 422 })) : resolve()));
  req.body.revision = Number(req.body.revision);
  if (!req.files?.length || p.documents.length + req.files.length > 5) fail('Attach one to five documents, at most 5 MB each');
  const docs = req.files.map(file => ({ _id: new mongoose.Types.ObjectId(), originalName: text(file.originalname, 240), mimeType: validate(file), bytes: file.size, data: file.buffer }));
  // Keep each MongoDB document below its 16 MB limit, including history snapshots.
  if (p.documents.reduce((n, d) => n + d.bytes, 0) + docs.reduce((n, d) => n + d.bytes, 0) > 10 * 1024 * 1024) fail('Combined attachments must be at most 10 MB');
  res.json(await change(req, p, {}, event(req, p, 'documents_added'), { $push: { history: event(req, p, 'documents_added'), documents: { $each: docs } } }));
}));
router.delete('/:id/documents/:fileId', canSubmit, wrap(async (req, res) => {
  const p = await get(req); draftOwner(req, p);
  if (!p.documents.id(req.params.fileId)) fail('Document not found', 404);
  res.json(await change(req, p, {}, event(req, p, 'document_removed'), { $pull: { documents: { _id: req.params.fileId } } }));
}));
router.get('/:id/documents/:fileId', wrap(async (req, res) => {
  const p = await get(req, true); const file = p.documents.id(req.params.fileId);
  if (!file) fail('Document not found', 404);
  res.set('Cache-Control', 'private, no-store'); res.set('X-Content-Type-Options', 'nosniff');
  res.type(file.mimeType).attachment(file.originalName).send(file.data);
}));
router.use((err, req, res, next) => { if (!err.status && err.name !== 'CastError') return next(err); res.status(err.status || 404).json({ error: err.message }); });
module.exports = router;
