const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse, MAX_ROWS } = require('../services/budgetExpenditureCsv');
const header = 'record_id,post_date,agency,program_name,payer_name,payee_name,debit_amount,credit_amount,description_raw,transaction_type,item1_name,item1_quantity,item1_unit_price\n';
const line = (id = 'TX-CSV-1', amount = '123.45') => `${id},2026-10-20,Barangay,Road repair,LGU,Supplier,${amount},0,"Cement, delivery",Procurement,Cement,2,50\n`;
const file = text => ({ originalname: 'expenses.csv', mimetype: 'text/csv', buffer: Buffer.from(text) });
test('legacy CSV format preserves mapped financial inputs, quoted descriptions and itemized fields', async () => {
  const result = await parse(file(header + line()));
  assert.equal(result.rows[0].recordId, 'TX-CSV-1'); assert.equal(result.rows[0].input.amount, 123.45);
  assert.equal(result.rows[0].input.description, 'Cement, delivery');
  assert.equal(result.rows[0].input.lineItems[0].quantity, 2); assert.equal(result.rows[0].input.lineItems[0].totalPrice, 100);
  assert.equal(result.rows[0].input.fromAddress, '0xLGU'.padEnd(42, '0'));
  assert.equal(result.rows[0].payer, 'LGU'); assert.equal(result.sha256.length, 64);
});
test('old manual-entry CSV headers and credit amount use the existing mapper', async () => {
  const result = await parse(file('Date,Agency,Program Name,Payer Name,Payee Name,Debit Amount,Credit Amount,Description\n2026-10-20,LGU,Repairs,Office,Supplier,0,45,Materials\n'));
  assert.equal(result.rows[0].input.amount, 45); assert.equal(result.rows[0].input.programName, 'Repairs');
});
test('CSV rejects missing financial fields, duplicate record IDs, malformed amounts and nonexistent dates', async () => {
  for (const content of [header, header + line() + line(), header + line().replace('2026-10-20', '2026-02-30'), header + line().replace(',LGU,', ',,'), header + line('TX-A', '12abc'), header + line('TX-A', '-1'), header + line('TX-A', '0'), header + line('TX-A', '1.001'), header + line().replace(',Supplier,', ',Supplier,extra,')]) await assert.rejects(parse(file(content)));
});
test('CSV file bounds, UTF-8, MIME and row limit are enforced', async () => {
  for (const changes of [{ originalname: 'file.exe' }, { mimetype: 'image/png' }, { buffer: Buffer.from([255, 254]) }, { buffer: Buffer.from([0]) }, { buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 65) }]) await assert.rejects(parse({ ...file(header + line()), ...changes }));
  await assert.rejects(parse(file(header + Array.from({ length: MAX_ROWS + 1 }, (_, i) => line(`TX-${i}`)).join(''))));
});

test('multipart memory storage caps aggregate file bytes across files, including chunked uploads', async () => {
  const { memoryStorage } = require('../services/budgetExpenditureCsv');
  const { Readable } = require('node:stream');
  const req = {};
  const store = data => new Promise((resolve, reject) => memoryStorage._handleFile(req, { stream: Readable.from(data) }, (error, file) => error ? reject(error) : resolve(file)));
  const first = await store([Buffer.alloc(5 * 1024 * 1024)]); assert.equal(first.size, 5 * 1024 * 1024);
  await store([Buffer.alloc(5 * 1024 * 1024)]);
  await assert.rejects(store([Buffer.alloc(3 * 1024 * 1024)]), error => error.status === 422);
});
