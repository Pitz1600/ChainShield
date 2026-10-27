const mongoose = require('mongoose');
const Pool = require('../models/AnnualBudget');
const Proposal = require('../models/BudgetProposal');
const { barangay, fail } = require('./budgetProposalPolicy');
const { reconcile, amount } = require('./annualBudgetPolicy');
async function transaction(fn) {
  const session = await mongoose.startSession();
  let result;
  try { await session.withTransaction(async () => { result = await fn(session); }); }
  catch (e) {
    if (e.code === 20 || e.code === 303) fail('Annual budgets require MongoDB replica-set transactions', 503);
    throw e;
  } finally { await session.endSession(); }
  return result;
}
async function assessment(fiscalYear, session) {
  const rows = await Proposal.find({ $or: [{ status: 'ADMIN_APPROVED' }, { 'history.to': 'ADMIN_APPROVED' }] }).session(session || null).lean();
  return reconcile(rows, fiscalYear);
}
async function approve(p, revision, set, entry) {
  amount(p.totalAmountCentavos);
  if (!p.totalAmountCentavos) fail('Approved amount must be positive');
  if (revision !== p.revision) fail('Proposal changed. Reload before continuing.', 409);
  return transaction(async session => {
    const pool = await Pool.findOne({ barangayId: barangay(), fiscalYear: p.fiscalYear }).session(session);
    if (!pool) fail('Approval requires a recorded annual proposal budget for this fiscal year', 409);
    if (!pool.reconciled) fail('This fiscal year requires reconciliation before approval', 409);
    const existing = await assessment(p.fiscalYear, session);
    if (existing.discrepancies.length || existing.reservedCentavos !== pool.reservedCentavos) fail('Historical records require reconciliation before approval', 409);
    if (p.totalAmountCentavos > pool.totalCentavos - pool.reservedCentavos) fail(`Available for proposals: PHP ${((pool.totalCentavos - pool.reservedCentavos) / 100).toFixed(2)}. Proposal exceeds the annual budget.`, 409);
    const updated = await Proposal.findOneAndUpdate({ _id: p._id, status: 'SUBMITTED', revision: p.revision }, { $set: set, $inc: { revision: 1 }, $push: { history: entry } }, { new: true, session });
    if (!updated) fail('Proposal is no longer pending review. Reload before continuing.', 409);
    await Pool.updateOne({ _id: pool._id }, { $inc: { reservedCentavos: p.totalAmountCentavos, revision: 1 } }, { session });
    return updated;
  });
}
module.exports = { transaction, assessment, approve };
