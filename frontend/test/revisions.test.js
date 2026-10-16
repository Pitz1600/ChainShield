import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldLimit, manualRowErrors, rowPages, clampPage, apiFieldErrors } from '../src/utils/fieldValidation.js';
import { formatCurrency } from '../src/utils/helpers.js';

const validRow = { date: '2026-10-17', agency: 'Barangay Pantal', programName: 'Road repairs', payerName: 'Barangay Pantal', payeeName: 'Supplier', description: 'Repair road', debitAmount: '1,000.50', creditAmount: '0' };
test('manual entry requires all fields and valid amounts', () => {
  assert.deepEqual(manualRowErrors(validRow), {});
  for (const field of ['date', 'agency', 'programName', 'payerName', 'payeeName', 'description']) assert.ok(manualRowErrors({ ...validRow, [field]: ' ' })[field]);
  for (const debitAmount of ['-1', '1.2.3', 'Infinity', '']) assert.ok(manualRowErrors({ ...validRow, debitAmount }).debitAmount);
  assert.ok(manualRowErrors({ ...validRow, debitAmount: '0' }).debitAmount);
  assert.deepEqual(manualRowErrors({ ...validRow, debitAmount: '0', creditAmount: '25' }), {});
});
test('manual row limits include boundary and pasted text validation', () => {
  for (const [field, length] of Object.entries({ agency: 120, programName: 120, payerName: 100, payeeName: 100, description: 500 })) {
    assert.equal(manualRowErrors({ ...validRow, [field]: 'a'.repeat(length) })[field], undefined);
    assert.ok(manualRowErrors({ ...validRow, [field]: 'a'.repeat(length + 1) })[field]);
  }
  assert.ok(manualRowErrors({ ...validRow, agency: '<script>' }).agency);
});
test('pagination remains bounded and clamps after removing records', () => {
  assert.deepEqual(rowPages(0, 1), [0]);
  assert.deepEqual(rowPages(50, 100), [0, 49, 50, 51, 99]);
  assert.ok(rowPages(5000, 10000).length <= 5);
  assert.equal(clampPage(3, 20, 10), 2);
  assert.equal(clampPage(2, 0, 10), 1);
});
test('field limits preserve credentials and existing stricter limits', () => {
  assert.equal(fieldLimit('firstName'), 50);
  assert.equal(fieldLimit('position'), 100);
  assert.equal(fieldLimit('email'), 254);
  assert.equal(fieldLimit('searchInput'), 200);
  assert.equal(fieldLimit('remark'), 2000);
  assert.equal(fieldLimit('subject'), 200);
  assert.equal(fieldLimit('other'), 255);
  assert.equal(fieldLimit('password', 'text'), undefined);
  assert.equal(fieldLimit('currentPassword'), undefined);
  assert.equal(fieldLimit('resetToken'), undefined);
  assert.equal(fieldLimit('birthday', 'date'), undefined);
  assert.equal(fieldLimit('amount', 'number'), undefined);
});
test('server validation details map to field errors', () => {
  assert.deepEqual(apiFieldErrors({ response: { data: { details: [{ field: 'firstName', message: 'Too long' }] } } }), { firstName: 'Too long' });
  assert.deepEqual(apiFieldErrors({}), {});
});
test('currency formatting retains currency identity', () => {
  assert.equal(formatCurrency(1234.5), '₱1,234.50');
  assert.equal(formatCurrency(0), '₱0.00');
  assert.match(formatCurrency(12, 'EUR'), /€/);
  assert.equal(formatCurrency('bad'), '—');
});

test('service-local field limits agree when running in the repository', async t => {
  const { existsSync, readFileSync } = await import('node:fs');
  const backendLimits = new URL('../../backend/constants/fieldLimits.json', import.meta.url);
  if (!existsSync(backendLimits)) { t.skip('Backend is outside this service build context'); return; }
  const frontendLimits = new URL('../src/constants/fieldLimits.json', import.meta.url);
  assert.deepEqual(JSON.parse(readFileSync(frontendLimits, 'utf8')), JSON.parse(readFileSync(backendLimits, 'utf8')));
});

test('manual entry rejects nonexistent dates', () => {
  assert.ok(manualRowErrors({ ...validRow, date: '2026-02-31' }).date);
});
