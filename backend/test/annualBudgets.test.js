const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fields, reconcile, year } = require('../services/annualBudgetPolicy');
test('annual budget validates exact centavos, year with an optional legacy reference', () => {
  assert.equal(fields({ totalCentavos: 0, reference: ' Ordinance 42, section 3 ' }).totalCentavos, 0);
  for (const n of [-1, 1.5, NaN, Infinity, '100', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => fields({ totalCentavos: n, reference: 'basis' }));
  assert.equal(fields({ totalCentavos: 100 }).reference, undefined);
  assert.equal(fields({ totalCentavos: 100, reference: ' ' }).reference, '');
  for (const n of [null, '', 1999, 2201, 2026.5]) assert.throws(() => year(n));
});
test('reconciliation includes archived approvals and identifies ambiguous historical records', () => {
  const rows = [
    { status: 'ADMIN_APPROVED', fiscalYear: 2026, totalAmountCentavos: 70000, archived: true },
    { status: 'ADMIN_APPROVED', fiscalYear: 2026, totalAmountCentavos: 30000 },
    { status: 'ADMIN_APPROVED', fiscalYear: 2027, totalAmountCentavos: 90000 },
    { status: 'SUBMITTED', fiscalYear: 2026, totalAmountCentavos: 90000 },
  ];
  assert.deepEqual(reconcile(rows, 2026), { reservedCentavos: 100000, discrepancies: [] });
  assert.equal(reconcile(rows, 2027).reservedCentavos, 90000);
  rows.push({ status: 'ADMIN_APPROVED', totalAmountCentavos: 100 }, { status: 'ADMIN_APPROVED', fiscalYear: 2026, totalAmountCentavos: -1 }, { status: 'REJECTED', fiscalYear: 2026, history: [{ to: 'ADMIN_APPROVED' }] });
  assert.equal(reconcile(rows, 2026).discrepancies.length, 3);
  assert.equal(reconcile(rows, 2027).discrepancies.length, 1);
});
