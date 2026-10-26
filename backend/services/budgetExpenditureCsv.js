const { Readable } = require('stream');
const { TextDecoder } = require('util');
const crypto = require('crypto');
const csv = require('csv-parser');
const Mapper = require('../utils/csvColumnMapper');
const { fail, text } = require('./budgetProposalPolicy');
const MAX_ROWS = 25;
async function parse(file) {
  if (!file || !/\.csv$/i.test(file.originalname) || !['text/csv', 'application/vnd.ms-excel', 'text/plain'].includes(file.mimetype)) fail('Choose a CSV file');
  if (file.buffer.length > 2 * 1024 * 1024 || file.buffer.includes(0)) fail('CSV must be UTF-8 text, at most 2 MB');
  try { new TextDecoder('utf-8', { fatal: true }).decode(file.buffer); } catch { fail('CSV must be UTF-8 text'); }
  const mapper = new Mapper(), rows = [], seen = new Set(); let mappings;
  const parser = csv({ strict: true, maxRowBytes: 65536 });
  parser.on('headers', headers => {
    mappings = mapper.detectColumns(headers);
  });
  try {
    for await (const row of Readable.from([file.buffer]).pipe(parser)) {
      if (rows.length >= MAX_ROWS) fail(`Import at most ${MAX_ROWS} expenditures at a time`);
      const line = rows.length + 2;
      for (const field of ['timestamp', 'agency', 'programName', 'fromAddress', 'toAddress', 'description']) {
        if (!mappings?.[field] || !String(row[mappings[field]] || '').trim()) fail(`CSV row ${line}: ${field} is required`);
      }
      const amountColumns = ['amount', 'debit_amount', 'credit_amount'].map(k => mappings[k]).filter(Boolean);
      if (!amountColumns.length) fail('CSV needs amount, debit_amount or credit_amount');
      for (const column of amountColumns) {
        const raw = String(row[column] || '').trim();
        if (raw && !/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) fail(`CSV row ${line}: ${column} must contain a valid amount with at most two decimals`);
      }
      const input = mapper.mapRow(row, mappings);
      const validation = mapper.validate(input);
      if (!validation.isValid) fail(`CSV row ${line}: ${validation.errors.join(', ')}`);
      const date = new Date(input.timestamp);
      if (!Number.isFinite(date.getTime())) fail(`CSV row ${line}: invalid date`);
      const isoDate = String(input.timestamp).match(/^\d{4}-\d{2}-\d{2}$/);
      if (isoDate && date.toISOString().slice(0, 10) !== input.timestamp) fail(`CSV row ${line}: invalid date`);
      const recordId = text(input.transactionId, 200);
      if (recordId && seen.has(recordId)) fail(`CSV row ${line}: duplicate record ID ${recordId}`);
      if (recordId) seen.add(recordId);
      // Match the original CSV import adapter's structured transaction inputs.
      const pad = value => value.startsWith('0x') && value.length === 42 ? value : (value.startsWith('0x') ? value : `0x${value}`).padEnd(42, '0');
      rows.push({ rowNumber: line, recordId, payer: String(row[mappings.fromAddress]), payee: String(row[mappings.toAddress]), input: {
        transactionType: input.transactionType, agency: input.agency, programName: input.programName,
        fromAddress: pad(input.fromAddress), toAddress: pad(input.toAddress), amount: input.amount,
        beneficiaryType: input.beneficiaryType, currency: input.currency, timestamp: date.toISOString(),
        description: input.description, lineItems: mapper.extractLineItems(row)
      } });
    }
  } catch (error) { if (error.status) throw error; fail(`Invalid CSV: ${error.message}`); }
  if (!rows.length) fail('CSV has no expenditure rows');
  return { filename: text(file.originalname.replace(/[\\/\x00-\x1f]/g, '_'), 240), sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'), rows };
}
// Bound total buffered multipart bytes, including uploads that use chunked transfer.
const memoryStorage = {
  _handleFile(req, file, callback) {
    const chunks = []; let size = 0, finished = false;
    const done = (error, data) => { if (!finished) { finished = true; callback(error, data); } };
    file.stream.on('data', chunk => {
      req.expenditureUploadBytes = (req.expenditureUploadBytes || 0) + chunk.length;
      if (req.expenditureUploadBytes > 12 * 1024 * 1024) { chunks.length = 0; done(Object.assign(new Error('Combined CSV and evidence upload must be at most 12 MB'), { status: 422 })); return; }
      if (!finished) { size += chunk.length; chunks.push(chunk); }
    });
    file.stream.on('error', done);
    file.stream.on('end', () => done(null, { buffer: Buffer.concat(chunks), size }));
  },
  _removeFile(req, file, callback) { delete file.buffer; callback(null); }
};
module.exports = { parse, memoryStorage, MAX_ROWS };
