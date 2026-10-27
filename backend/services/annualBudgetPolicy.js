const { fail, text } = require('./budgetProposalPolicy');
function year(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 2000 || n > 2200) fail('Fiscal year must be between 2000 and 2200');
  return n;
}
function amount(n) {
  if (!Number.isSafeInteger(n) || n < 0) fail('Budget must be nonnegative integer centavos');
  return n;
}
function fields(body) {
  return { totalCentavos: amount(body.totalCentavos), remarks: text(body.remarks, 4000),
    ...(body.reference !== undefined && { reference: text(body.reference, 2000) }) };
}
// The application is one barangay per deployment. Include historical record labels,
// archived records and inconsistent approval histories; never silently discard them.
function reconcile(rows, fiscalYear) {
  let reservedCentavos = 0;
  const discrepancies = [];
  for (const p of rows) {
    const approved = p.status === 'ADMIN_APPROVED';
    const everApproved = p.history?.some(e => e.to === 'ADMIN_APPROVED');
    if (!approved && !everApproved) continue;
    const id = p.proposalNumber || String(p._id);
    if (!Number.isInteger(p.fiscalYear) || p.fiscalYear < 2000 || p.fiscalYear > 2200) { discrepancies.push(`${id}: missing or invalid fiscal year`); continue; }
    if (p.fiscalYear !== fiscalYear) continue;
    if (!approved) { discrepancies.push(`${id}: approval history conflicts with current status`); continue; }
    if (!Number.isSafeInteger(p.totalAmountCentavos) || p.totalAmountCentavos <= 0) { discrepancies.push(`${id}: invalid approved amount`); continue; }
    reservedCentavos += p.totalAmountCentavos;
    if (!Number.isSafeInteger(reservedCentavos)) fail('Historical reservation total is too large');
  }
  return { reservedCentavos, discrepancies };
}
module.exports = { year, amount, fields, reconcile };
