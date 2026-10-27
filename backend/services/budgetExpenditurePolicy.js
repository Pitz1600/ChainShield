const { text, fail } = require('./budgetProposalPolicy');
const enabled = () => process.env.BUDGET_EXPENDITURES_ENABLED === 'true';
const treasurer = u => u.role === 'barangay_official' && /^barangay treasurer$/i.test(String(u.position || '').trim()) && u.isVerified === true && u.isApproved === true;
const reader = u => u.isVerified === true && u.isApproved === true && (treasurer(u) || ['administrator', 'auditor'].includes(u.role));
function normalize(body, proposal) {
  const allocationId = text(body.allocationId, 80) || '__whole_budget__';
  const allocation = proposal.items.find(i => i.itemId === allocationId);
  if (allocationId !== '__whole_budget__' && !allocation) fail('Unknown approved allocation');
  const amount = Number(body.amount), amountCentavos = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amountCentavos) || amountCentavos <= 0 || Math.abs(amount * 100 - amountCentavos) > 0.000001) fail('Amount must be positive PHP with at most two decimal places');
  const input = { amount };
  for (const key of ['fromAddress', 'toAddress', 'agency', 'programName', 'description', 'transactionType']) {
    input[key] = text(body[key], key === 'description' ? 4000 : 200);
    if (!input[key]) fail(`${key} is required`);
  }
  if (!['Social Welfare', 'Procurement', 'Grant', 'Tax', 'Revenue', 'Emergency Funds', 'Other'].includes(input.transactionType)) fail('Invalid transaction type');
  const date = new Date(body.timestamp);
  if (typeof body.timestamp !== 'string' || !Number.isFinite(date.getTime())) fail('Valid expenditure date required');
  input.timestamp = date.toISOString();
  // These existing fields come from the approved reference, never client overrides.
  input.approvedBudget = proposal.totalAmountCentavos / 100;
  input.currency = 'PHP';
  return { input, allocationId, amountCentavos };
}
function totals(rows, approved) {
  const result = require('./financialTotals').totals(rows, approved);
  return { approved: result.approved, recorded: result.allRecorded, verified: result.verified, pending: result.pendingReserved, available: result.available };
}
module.exports = { enabled, treasurer, reader, normalize, totals };
