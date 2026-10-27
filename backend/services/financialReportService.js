const mongoose = require('mongoose');
const crypto = require('crypto');
const Proposal = require('../models/BudgetProposal');
const Expenditure = require('../models/BudgetExpenditure');
const AuditorEvidence = require('../models/AuditorEvidence');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { fail, barangay, text } = require('./budgetProposalPolicy');
const MAX_ROWS = 5000, MAX_BYTES = 8 * 1024 * 1024;
const statuses = ['verified', 'submitted', 'correction_required', 'rejected'];
const name = u => u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unnamed user' : 'Unavailable';
const { money, add, totals } = require('./financialTotals');
function boundary(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Invalid date; use YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) fail('Invalid calendar date');
  return +date - 8 * 3600000;
}
function normalize(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Invalid report filters');
  if (Object.keys(body).some(k => !['type', 'fiscalYear', 'proposalId', 'allocationId', 'status', 'dateBasis', 'from', 'to', 'includeHistory'].includes(k))) fail('Unsupported report filter or scope');
  if (!['summary', 'register', 'audit'].includes(body.type)) fail('Invalid report type');
  const fiscalYear = Number(body.fiscalYear);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2200) fail('Select a valid fiscal year');
  const proposalId = text(body.proposalId, 80), allocationId = text(body.allocationId, 80);
  if (proposalId && !mongoose.isValidObjectId(proposalId)) fail('Invalid proposal');
  if (allocationId && !proposalId) fail('Select a proposal for allocation filtering');
  const status = text(body.status, 40), dateBasis = body.dateBasis || 'expenditure';
  const from = text(body.from, 10), to = text(body.to, 10);
  if (status && !statuses.includes(status)) fail('Invalid review status');
  if (!['expenditure', 'review'].includes(dateBasis) || (dateBasis === 'review' && body.type !== 'audit')) fail('Invalid date basis');
  if (body.type === 'summary' && (from || to || status || dateBasis !== 'expenditure')) fail('Summary uses all current expenditures; date/status filters are not supported');
  if (from) boundary(from); if (to) boundary(to);
  if (from && to && from > to) fail('Start date must precede end date');
  if (body.includeHistory != null && typeof body.includeHistory !== 'boolean') fail('Invalid history option');
  if (body.includeHistory && body.type !== 'audit') fail('History is available only in audit reports');
  return { type: body.type, fiscalYear, proposalId, allocationId, status, dateBasis, from, to, includeHistory: body.includeHistory === true };
}
async function snapshot(fn) {
  const session = await mongoose.startSession(); let result;
  try { await session.withTransaction(async () => { result = await fn(session); }, { readConcern: { level: 'snapshot' }, readPreference: 'primary' }); return result; }
  catch (error) { if (error.status) throw error; console.error('Financial report snapshot failed:', error.message); fail('Unable to obtain a consistent financial snapshot. Try again or contact an administrator.', 503); }
  finally { await session.endSession(); }
}
async function scopeCheck(session) {
  if (await Proposal.exists({ status: 'ADMIN_APPROVED', barangayId: { $ne: barangay() } }).session(session)) fail('Data issue: approved budgets have a different barangay label. Administrator resolution required.', 409);
}
async function options(query) {
  const year = query.fiscalYear ? normalize({ type: 'summary', fiscalYear: query.fiscalYear }).fiscalYear : null;
  const page = Number(query.page || 1);
  if (!Number.isSafeInteger(page) || page < 1) fail('Invalid options page');
  return snapshot(async session => {
    await scopeCheck(session);
    const filter = { status: 'ADMIN_APPROVED', barangayId: barangay() };
    const fiscalYears = await Proposal.distinct('fiscalYear', filter).session(session);
    if (year) filter.fiscalYear = year;
    const count = await Proposal.countDocuments(filter).session(session);
    const proposals = await Proposal.find(filter).select('proposalNumber title fiscalYear items.itemId items.name').sort({ fiscalYear: -1, _id: 1 }).skip((page - 1) * 100).limit(100).session(session).lean();
    return { fiscalYears: fiscalYears.filter(Number.isInteger).sort((a, b) => b - a), proposals: proposals.map(p => ({ id: String(p._id), proposalNumber: p.proposalNumber, title: p.title, fiscalYear: p.fiscalYear, allocations: p.items.map(i => ({ id: i.itemId, name: i.name })) })), page, pages: Math.ceil(count / 100) };
  });
}
function construct(proposals, expenses, transactions, users, filters, user) {
  const allocations = new Map(), notices = [];
  const wholeBudgets = new Set(expenses.filter(e => e.allocationId === '__whole_budget__').map(e => String(e.budgetProposalId)));
  for (const p of proposals) {
    let sum = 0;
    for (const i of p.items) {
      sum = add(sum, money(i.estimatedAmountCentavos));
      const key = `${p._id}/${i.itemId}`;
      if (!i.itemId || allocations.has(key)) fail('Data issue: missing or duplicate allocation ID', 409);
      allocations.set(key, { proposalId: String(p._id), proposalNumber: p.proposalNumber, allocationId: i.itemId, name: i.name, approved: i.estimatedAmountCentavos, expenses: [] });
    }
    if (wholeBudgets.has(String(p._id))) allocations.set(`${p._id}/__whole_budget__`, { proposalId: String(p._id), proposalNumber: p.proposalNumber, allocationId: '__whole_budget__', name: 'Whole approved budget', approved: p.totalAmountCentavos, expenses: [] });
    if (sum !== money(p.totalAmountCentavos)) fail(`Data issue: inconsistent total for ${p.proposalNumber}`, 409);
  }
  const tx = new Map(transactions.map(t => [String(t._id), t])), people = new Map(users.map(u => [String(u._id), u]));
  const selected = [];
  for (const e of expenses) {
    const a = allocations.get(`${e.budgetProposalId}/${e.allocationId}`);
    if (!a) fail(`Data issue: missing allocation for expenditure ${e._id}`, 409);
    money(e.amountCentavos);
    if (!statuses.includes(e.reviewStatus)) fail('Data issue: invalid review status', 409);
    const date = new Date(e.input?.timestamp);
    if (!e.input?.timestamp || !Number.isFinite(+date)) fail(`Data issue: invalid expenditure date ${e._id}`, 409);
    if (e.reviewedAt && !Number.isFinite(+new Date(e.reviewedAt))) fail('Data issue: invalid review date', 409);
    if (filters.allocationId && e.allocationId !== filters.allocationId) continue;
    a.expenses.push(e);
    if (e.allocationId !== '__whole_budget__' && !filters.allocationId && wholeBudgets.has(String(e.budgetProposalId))) allocations.get(`${e.budgetProposalId}/__whole_budget__`).expenses.push(e);
    const basis = filters.dateBasis === 'review' ? (e.reviewedAt ? +new Date(e.reviewedAt) : null) : +date;
    if (filters.status && e.reviewStatus !== filters.status) continue;
    if ((filters.from || filters.to) && (basis === null || (filters.from && basis < boundary(filters.from)) || (filters.to && basis >= boundary(filters.to) + 86400000))) continue;
    const linked = e.transactionId ? tx.get(String(e.transactionId)) : null;
    if (e.transactionId && !linked) notices.push(`Orphan transaction reference on EXP-${e._id}`);
    if (e.reviewerId && !people.has(String(e.reviewerId))) notices.push(`Reviewer unavailable on EXP-${e._id}`);
    const row = { id: String(e._id), reference: `EXP-${e._id}`, date: date.toISOString(), proposalNumber: a.proposalNumber, allocation: a.name, purpose: text(e.input.description), payee: text(e.sourcePayee || e.input.toAddress), amountCentavos: e.amountCentavos, reviewStatus: e.reviewStatus, transactionReference: linked?.transactionId || (e.transactionId ? 'Unavailable (orphan link)' : 'Not linked'), evidenceCount: (e.evidence?.length || 0) + (e.auditorEvidence?.length || 0), sortDate: basis };
    if (filters.type === 'audit') Object.assign(row, { reviewer: name(people.get(String(e.reviewerId))), reviewedAt: e.reviewedAt || null, reviewReason: e.reviewReason || '', assessmentStatus: e.assessmentStatus === 'complete' && e.assessment ? 'Complete' : e.assessmentStatus === 'pending' ? 'Pending' : 'Unavailable', aiRisk: e.assessmentStatus === 'complete' && e.assessment ? { level: typeof e.assessment.riskLevel === 'string' ? e.assessment.riskLevel : 'Unavailable', score: Number.isFinite(e.assessment.riskScore) ? e.assessment.riskScore : null } : null, auditorEvidence: (e.auditorEvidence || []).map(f => ({ reference: String(f._id), filename: f.originalName, mimeType: f.mimeType, bytes: f.bytes, uploader: f.uploaderName, uploadedBy: String(f.uploadedBy), uploadedAt: f.uploadedAt, explanation: f.explanation, checksum: f.sha256 })), evidence: (e.evidence || []).map(f => ({ reference: String(f._id), filename: f.originalName, categories: f.categories, version: f.version, ...(filters.includeHistory && { checksum: f.sha256 }) })), ...(filters.includeHistory && { history: (e.history || []).map(h => ({ actor: name(people.get(String(h.actor))), action: h.action, at: h.at, reason: h.reason, evidenceReferences: (h.evidenceReferences || []).map(String) })) }) });
    selected.push(row);
  }
  if (selected.length > MAX_ROWS) fail('Report exceeds 5,000 detail rows. Narrow filters.', 413);
  const allocationTotals = [...allocations.values()].filter(a => filters.allocationId ? a.allocationId === filters.allocationId : !wholeBudgets.has(a.proposalId) || a.allocationId === '__whole_budget__').map(({ expenses: entries, approved, ...a }) => ({ ...a, totals: totals(entries, approved) }));
  if (filters.allocationId && !allocationTotals.length) fail('Allocation not found', 404);
  const approved = allocationTotals.reduce((n, a) => add(n, a.totals.approved), 0);
  selected.sort((a, b) => (a.sortDate ?? 0) - (b.sortDate ?? 0) || a.id.localeCompare(b.id));
  selected.forEach(r => delete r.sortDate);
  const report = { reportId: crypto.randomUUID(), templateVersion: '1.0', generatedAt: new Date().toISOString(), timezone: 'Asia/Manila', generatedBy: { id: String(user._id), name: name(user), role: user.role }, deploymentLabel: barangay(), filters, basis: filters.type === 'summary' ? 'Current snapshot of selected fiscal-year budgets; all associated expenditures.' : `${filters.dateBasis} date, then ID; review status is current at generation, not historical period end.`, recordCount: selected.length, summary: filters.type === 'summary' ? totals(selected, approved) : totals(selected), allocationTotals: filters.type === 'summary' ? allocationTotals : [], rows: filters.type === 'summary' ? [] : selected, notices: [...new Set(notices)], printable: notices.length === 0 };
  if (Buffer.byteLength(JSON.stringify(report)) > MAX_BYTES) fail('Report exceeds 8 MB. Narrow filters or omit history.', 413);
  return report;
}
async function generate(filters, user) {
  return snapshot(async session => {
    await scopeCheck(session);
    const proposals = await Proposal.find({ status: 'ADMIN_APPROVED', barangayId: barangay(), fiscalYear: filters.fiscalYear, ...(filters.proposalId && { _id: filters.proposalId }) }).select('proposalNumber fiscalYear items totalAmountCentavos').session(session).lean();
    if (filters.proposalId && !proposals.length) fail('Approved proposal not found in selected scope/year', 404);
    const expenses = await Expenditure.find({ budgetProposalId: { $in: proposals.map(p => p._id) } }).select(`budgetProposalId allocationId amountCentavos input.timestamp input.description input.toAddress sourcePayee reviewStatus transactionId reviewerId reviewedAt reviewReason assessmentStatus assessment.riskLevel assessment.riskScore evidence._id evidence.originalName evidence.categories evidence.version ${filters.includeHistory ? 'evidence.sha256 history' : ''}`).session(session).lean();
    if (filters.type !== 'summary') {
      const files = await AuditorEvidence.find({ budgetProposalId: { $in: proposals.map(p => p._id) }, expenditureId: { $in: expenses.map(e => e._id) } }).sort({ uploadedAt: 1, _id: 1 }).session(session).lean();
      const byExpense = new Map();
      for (const f of files) { const key = String(f.expenditureId); if (!byExpense.has(key)) byExpense.set(key, []); byExpense.get(key).push(f); }
      for (const e of expenses) e.auditorEvidence = byExpense.get(String(e._id)) || [];
    }
    const transactions = await Transaction.find({ _id: { $in: expenses.map(e => e.transactionId).filter(Boolean) } }).select('transactionId').session(session).lean();
    const users = await User.find({ _id: { $in: expenses.flatMap(e => [e.reviewerId, ...(e.history || []).map(h => h.actor)]).filter(Boolean) } }).select('firstName lastName').session(session).lean();
    return construct(proposals, expenses, transactions, users, filters, user);
  });
}
module.exports = { normalize, totals, boundary, construct, generate, options, MAX_ROWS, MAX_BYTES };
