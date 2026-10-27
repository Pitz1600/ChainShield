const router = require('express').Router();
const mongoose = require('mongoose');
const Pool = require('../models/AnnualBudget');
const Proposal = require('../models/BudgetProposal');
const { barangay, captain, fail, text } = require('../services/budgetProposalPolicy');
const { reader } = require('../services/budgetExpenditurePolicy');
const { year, fields } = require('../services/annualBudgetPolicy');
const { transaction, assessment } = require('../services/annualBudgetService');
const { requireAdmin } = require('../middleware/roleMiddleware');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.use(require('../middleware/auth'));
router.get('/access', (req, res) => res.json({ canRead: captain(req.user) || reader(req.user) }));
router.use((req, res, next) => captain(req.user) || reader(req.user) ? next() : res.status(403).json({ error: 'Annual budget access denied' }));
router.get('/:year', wrap(async (req, res) => {
  const fiscalYear = year(req.params.year);
  const pool = await Pool.findOne({ barangayId: barangay(), fiscalYear }).populate('history.actor', 'firstName lastName').lean();
  const existing = await assessment(fiscalYear);
  const discrepancies = [...existing.discrepancies];
  if (pool && existing.reservedCentavos > pool.totalCentavos) discrepancies.push('Existing approved proposals exceed the recorded pool');
  if (pool?.reconciled && pool.reservedCentavos !== existing.reservedCentavos) discrepancies.push('Recorded reservations differ from approved proposals; reconciliation required');
  res.json({ fiscalYear, pool, ...existing, discrepancies, availableCentavos: pool ? pool.totalCentavos - existing.reservedCentavos : null });
}));
router.post('/:year', requireAdmin, wrap(async (req, res) => {
  const fiscalYear = year(req.params.year), values = fields(req.body);
  await Pool.init(); // Ensure the unique scope/year index exists before the first write.
  const pool = await Pool.create({ barangayId: barangay(), fiscalYear, ...values, history: [{ action: 'recorded', newCentavos: values.totalCentavos, reference: values.reference, actor: req.user._id, at: new Date() }] });
  res.status(201).json(pool);
}));
router.patch('/:year', requireAdmin, wrap(async (req, res) => {
  const fiscalYear = year(req.params.year), values = fields(req.body), reason = text(req.body.reason, 4000);
  if (!reason) fail('Adjustment reason is required');
  res.json(await transaction(async session => {
    const pool = await Pool.findOne({ barangayId: barangay(), fiscalYear }).session(session);
    if (!pool) fail('Annual budget not found', 404);
    if (pool.revision !== req.body.revision) fail('Budget changed. Reload before continuing.', 409);
    const existing = await assessment(fiscalYear, session);
    if (values.totalCentavos < Math.max(pool.reservedCentavos, existing.reservedCentavos)) fail('Cannot reduce the pool below existing reservations', 409);
    return Pool.findOneAndUpdate({ _id: pool._id }, { $set: values, $inc: { revision: 1 }, $push: { history: { action: 'adjusted', previousCentavos: pool.totalCentavos, newCentavos: values.totalCentavos, reason, reference: values.reference, actor: req.user._id, at: new Date() } } }, { new: true, session });
  }));
}));
router.post('/:year/reconcile', requireAdmin, wrap(async (req, res) => {
  const fiscalYear = year(req.params.year);
  res.json(await transaction(async session => {
    const pool = await Pool.findOne({ barangayId: barangay(), fiscalYear }).session(session);
    if (!pool) fail('Record a supported annual budget first', 409);
    if (pool.revision !== req.body.revision) fail('Budget changed. Reload before continuing.', 409);
    // Snapshot raw BSON, including attachment bytes and unknown legacy/archive fields,
    // before changing reservations. Each source record is a separate backup document.
    const backupId = new mongoose.Types.ObjectId();
    const backups = mongoose.connection.collection('annualbudgetbackups');
    await backups.insertOne({ backupId, collection: Pool.collection.name, sourceId: pool._id, document: pool.toObject(), actor: req.user._id, at: new Date() }, { session });
    const cursor = Proposal.collection.find({}, { session });
    for await (const document of cursor) await backups.insertOne({ backupId, collection: Proposal.collection.name, sourceId: document._id, document }, { session });
    const existing = await assessment(fiscalYear, session);
    const discrepancies = [...existing.discrepancies];
    if (existing.reservedCentavos > pool.totalCentavos) discrepancies.push('Existing approved proposals exceed the recorded pool');
    const updated = await Pool.findOneAndUpdate({ _id: pool._id }, { $set: { reservedCentavos: existing.reservedCentavos, reconciled: discrepancies.length === 0 }, $inc: { revision: 1 }, $push: { history: { action: 'reconciled', reason: discrepancies.join('; ') || 'Existing approved proposals reconciled', actor: req.user._id, at: new Date(), backupId } } }, { new: true, session });
    return { pool: updated, discrepancies, backupId };
  }));
}));
router.use((err, req, res, next) => {
  if (err.code === 11000) return res.status(409).json({ error: 'An annual budget already exists for this fiscal year' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  next(err);
});
module.exports = router;
