const crypto = require('crypto');
const fail = (message, status = 422) => { throw Object.assign(new Error(message), { status }); };
// One deployment serves one barangay. This is a record label, not a per-user tenant.
const barangay = () => process.env.BUDGET_PROPOSAL_BARANGAY_ID || 'single-barangay';
const approvedCaptain = user => user.role === 'barangay_official'
  && /^barangay captain$/i.test(String(user.position || '').trim())
  && user.isApproved === true && user.isVerified === true
  && Boolean(user.approvedBy || user.invitedBy);
const captain = user => user.role === 'barangay_official'
  && (user.submitBudgetProposals === true
    || (!user.budgetProposalAccessManaged && approvedCaptain(user)))
  && Boolean(barangay(user));
// Called only by administrator-controlled identity changes. Registration and
// profile editing must never call this helper or accept these privileged fields.
function assignApprovedCaptain(user, actorId) {
  user.budgetProposalAccessManaged = true;
  user.submitBudgetProposals = user.role === 'barangay_official'
    && /^barangay captain$/i.test(String(user.position || '').trim());
  if (user.submitBudgetProposals) {
    user.barangayId = barangay(user);
    user.approvedBy = actorId;
  }
}
function text(value, max = 4000) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) fail(`Text must be at most ${max} characters`);
  return value.trim();
}
function normalize(body, complete = false) {
  const out = {};
  for (const [key, max] of Object.entries({ title: 200, justification: 10000, proposalType: 30, sector: 50 })) out[key] = text(body[key], max);
  if (out.proposalType && !['annual', 'supplemental'].includes(out.proposalType)) fail('Invalid proposal type');
  if (out.sector && !['infrastructure', 'health', 'education', 'sanitation', 'other'].includes(out.sector)) fail('Invalid sector');
  out.fiscalYear = body.fiscalYear === '' || body.fiscalYear == null ? null : Number(body.fiscalYear);
  if (out.fiscalYear !== null && (!Number.isInteger(out.fiscalYear) || out.fiscalYear < 2000 || out.fiscalYear > 2200)) fail('Invalid fiscal year');
  if (!Array.isArray(body.items) || body.items.length > 100) fail('Supply at most 100 project items');
  out.items = body.items.map(item => {
    if (!item || typeof item !== 'object') fail('Invalid project item');
    const result = {};
    for (const key of ['name', 'description', 'proposedSupplier', 'supplierAddress', 'expectedTimeline', 'additionalDetails']) result[key] = text(item[key], key === 'name' ? 200 : 4000);
    const amount = item.estimatedAmountCentavos;
    if (!Number.isSafeInteger(amount) || amount < 0) fail('Amounts must be nonnegative integer centavos');
    result.estimatedAmountCentavos = amount;
    result.itemId = text(item.itemId, 80) || crypto.randomUUID();
    if (complete && (!result.name || !result.description || amount <= 0)) fail('Each item needs a name, spending purpose and positive amount');
    if (complete && !result.expectedTimeline) fail('Each item needs an expected timeline');
    return result;
  });
  out.totalAmountCentavos = out.items.reduce((sum, item) => sum + item.estimatedAmountCentavos, 0);
  if (!Number.isSafeInteger(out.totalAmountCentavos)) fail('Total amount is too large');
  const limit = process.env.BUDGET_PROPOSAL_LIMIT_CENTAVOS;
  if (limit && (!Number.isSafeInteger(Number(limit)) || Number(limit) <= 0)) fail('Proposal policy limit is misconfigured', 503);
  if (limit && out.totalAmountCentavos > Number(limit)) fail('Total exceeds the configured proposal limit');
  if (complete && (!out.title || !out.fiscalYear || !out.proposalType || !out.sector || !out.justification || !out.items.length)) fail('Complete all required proposal details and add at least one item');
  return out;
}
module.exports = { normalize, captain, barangay, assignApprovedCaptain, text, fail };
