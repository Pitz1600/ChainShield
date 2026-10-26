const { fail } = require('./budgetProposalPolicy');
const statuses = ['verified', 'submitted', 'correction_required', 'rejected'];
function money(n) { if (!Number.isSafeInteger(n) || n < 0) fail('Data issue: invalid integer-centavo amount', 409); return n; }
function add(a, b) { const n = a + b; if (!Number.isSafeInteger(n)) fail('Data issue: unsafe financial total', 409); return n; }
function totals(rows, approved = 0) {
  money(approved);
  const result = { approved, verified: 0, submitted: 0, correctionRequired: 0, rejected: 0 };
  for (const row of rows) {
    if (!statuses.includes(row.reviewStatus)) fail('Data issue: invalid review status', 409);
    const key = row.reviewStatus === 'correction_required' ? 'correctionRequired' : row.reviewStatus;
    result[key] = add(result[key], money(row.amountCentavos));
  }
  result.pendingReserved = add(result.submitted, result.correctionRequired);
  result.allRecorded = add(add(result.verified, result.pendingReserved), result.rejected);
  result.available = add(add(approved, -result.verified), -result.pendingReserved);
  result.utilizationPercent = approved ? result.verified / approved * 100 : null;
  return result;
}
module.exports = { money, add, totals };
