const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { validateFieldLengths } = require('../middleware/fieldLimits');
const { createTemplateDownloadLimiter } = require('../middleware/templateDownloadLimiter');

function validate(body, baseUrl = '/api/auth') {
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let next = false;
  validateFieldLengths({ method: 'POST', body, baseUrl }, res, () => { next = true; });
  return { ...res, next };
}
test('write validation accepts limits and rejects overflow without truncation', () => {
  assert.ok(validate({ firstName: 'a'.repeat(50), email: 'e'.repeat(254), position: 'p'.repeat(100) }).next);
  const input = { firstName: 'a'.repeat(51), description: 'x'.repeat(501) };
  const result = validate(input, '/api/transactions');
  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.body.details.map(detail => detail.field), ['firstName', 'description']);
  assert.equal(input.firstName.length, 51);
});
test('credentials and opaque metadata retain compatibility', () => {
  assert.ok(validate({ password: 'a'.repeat(3000), resetToken: 'x'.repeat(3000), metadata: { original: 'x'.repeat(5000) } }).next);
  assert.equal(validate({ transactions: [{ agency: 'x'.repeat(121) }] }).body.details[0].field, 'transactions.0.agency');
});
test('complaint field limits match the complaint form', () => {
  assert.ok(validate({ subject: 'a'.repeat(200), description: 'a'.repeat(2000) }, '/api/complaints').next);
  assert.equal(validate({ description: 'a'.repeat(2001) }, '/api/complaints').statusCode, 400);
});
function request(limiter, id) {
  return new Promise((resolve, reject) => {
    const req = { user: { _id: id }, headers: {}, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' }, app: { get() { return false; } } };
    const res = new EventEmitter();
    res.headers = {};
    res.setHeader = (key, value) => { res.headers[key.toLowerCase()] = value; };
    res.getHeader = key => res.headers[key.toLowerCase()];
    res.set = res.setHeader;
    res.status = code => { res.statusCode = code; return res; };
    res.json = body => { res.body = body; resolve(res); return res; };
    limiter(req, res, error => error ? reject(error) : resolve(res));
  });
}
test('template downloads limit by account and provide a retry window', async () => {
  const limiter = createTemplateDownloadLimiter();
  for (let i = 0; i < 5; i++) assert.notEqual((await request(limiter, 'official-a')).statusCode, 429);
  const denied = await request(limiter, 'official-a');
  assert.equal(denied.statusCode, 429);
  assert.ok(denied.body.retryAfterSeconds > 0 && denied.body.retryAfterSeconds <= 600);
  assert.equal(denied.headers['retry-after'], String(denied.body.retryAfterSeconds));
  assert.notEqual((await request(limiter, 'official-b')).statusCode, 429);
  limiter.resetKey('official-a');
  assert.notEqual((await request(limiter, 'official-a')).statusCode, 429);
});

test('CSV and manual imports enforce the same text limits before processing', () => {
  const Mapper = require('../utils/csvColumnMapper');
  const mapper = new Mapper();
  const valid = { agency: 'a'.repeat(120), programName: 'p'.repeat(120), description: 'd'.repeat(500), fromAddress: 'n'.repeat(100), toAddress: 'n'.repeat(100), amount: 10 };
  assert.equal(mapper.validate({ ...valid }).isValid, true);
  for (const [field, limit] of [['agency', 120], ['programName', 120], ['description', 500], ['fromAddress', 100], ['toAddress', 100]]) {
    const result = mapper.validate({ ...valid, [field]: 'a'.repeat(limit + 1) });
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some(message => message.includes(field)));
  }
});
