const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { documents } = require('../services/auditorEvidencePolicy');
const pdf = Buffer.from('%PDF-1.4\nfixture\n%%EOF');
const file = (buffer = pdf, originalname = 'inspection.pdf', mimetype = 'application/pdf') => ({ buffer, originalname, mimetype });
const user = { _id: 'auditor', firstName: 'Audit', lastName: 'Fixture' };
test('Auditor evidence validates explanation, types, content and batch limits', () => {
  for (const reason of [undefined, '', '  ', {}, 'a'.repeat(4001)]) assert.throws(() => documents([file()], reason, user));
  for (const files of [[], Array(6).fill(file()), [file(Buffer.alloc(5 * 1024 * 1024 + 1))], Array(3).fill(file(Buffer.alloc(4 * 1024 * 1024))), [file(pdf, 'fake.png', 'image/png')], [file(pdf, 'fake.xlsx')], [file(pdf, 'wrong.pdf', 'image/png')], [file(Buffer.from('not a pdf'))]]) assert.throws(() => documents(files, 'Inspection', user));
  const [doc] = documents([file()], ' Site inspection ', user);
  assert.equal(doc.explanation, 'Site inspection'); assert.equal(doc.uploaderName, 'Audit Fixture');
  assert.equal(doc.sha256, crypto.createHash('sha256').update(pdf).digest('hex'));
  assert.equal(doc.bytes, pdf.length); assert.equal(doc.categories, undefined);
});
test('audit report distinguishes Auditor metadata and never embeds bytes', () => {
  const service = require('../services/financialReportService');
  const report = service.construct([{ _id: 'p', items: [{ itemId: 'a', estimatedAmountCentavos: 100 }], totalAmountCentavos: 100 }], [{ _id: 'e', budgetProposalId: 'p', allocationId: 'a', amountCentavos: 50, reviewStatus: 'verified', input: { timestamp: '2026-01-01' }, evidence: [], auditorEvidence: [{ ...documents([file()], 'Inspection', user)[0], _id: 'f' }] }], [], [], service.normalize({ type: 'audit', fiscalYear: 2026 }), user);
  assert.equal(report.rows[0].evidenceCount, 1); assert.deepEqual(report.rows[0].evidence, []);
  assert.equal(report.rows[0].auditorEvidence[0].explanation, 'Inspection');
  assert.equal(report.rows[0].auditorEvidence[0].uploader, 'Audit Fixture');
  assert.ok(!JSON.stringify(report).includes('%PDF'));
  assert.equal(report.rows[0].auditorEvidence[0].data, undefined);
});
