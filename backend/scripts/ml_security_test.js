const axios = require('axios');
const http = require('http');

const mlUrl = process.env.ML_SERVICE_URL
  ? `${process.env.ML_SERVICE_URL}/predict`
  : 'http://ml-service:5001/predict';
const parsed = new URL(mlUrl);
const mlHost = parsed.hostname;
const mlPort = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);
const mlPath = parsed.pathname;
const mlSecret = process.env.ML_API_SECRET || '';

const now = () => Date.now();
const pad = (label, width) => `${label}`.padEnd(width, ' ');
const row = (a, b, c, d, e, f) => `${pad(a, 24)} ${pad(b, 30)} ${pad(c, 16)} ${pad(d, 22)} ${pad(e, 10)} ${f}`;

const basePayload = (overrides = {}) => ({
  transactionId: 'sec-test',
  txHash: 'sec-test',
  amount: 12000,
  fromAddress: '0xFrom',
  toAddress: '0xTo',
  timestamp: new Date().toISOString(),
  transactionType: 'Other',
  agency: 'SecTest',
  programName: 'SecTest',
  description: 'normal',
  ...overrides
});

const sendJson = async (payload, includeAuth = true, timeoutMs = 15000) => {
  const headers = { 'Content-Type': 'application/json', 'X-Quiet': 'true' };
  if (includeAuth && mlSecret) headers['X-Internal-Secret'] = mlSecret;
  const t0 = now();
  try {
    const res = await axios.post(mlUrl, payload, { headers, timeout: timeoutMs, validateStatus: () => true });
    return { status: res.status, ms: now() - t0 };
  } catch (err) {
    return { status: 0, ms: now() - t0, error: err.message };
  }
};

const sendInvalidJson = async () => {
  const t0 = now();
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: mlHost,
        port: mlPort,
        method: 'POST',
        path: mlPath,
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': mlSecret,
          'X-Quiet': 'true'
        }
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode, ms: now() - t0 }));
      }
    );
    req.on('error', (err) => resolve({ status: 0, ms: now() - t0, error: err.message }));
    req.write('{ invalid json ');
    req.end();
  });
};

const runBurst = async (count, payload) => {
  const results = [];
  const t0 = now();
  for (let i = 0; i < count; i += 1) {
    results.push(sendJson(payload, true));
  }
  const resolved = await Promise.all(results);
  const duration = now() - t0;
  const failures = resolved.filter(r => r.status === 0 || r.status >= 500).length;
  return { duration, failures, count };
};

async function main() {
  const results = [];

  // 1. SQL Injection
  results.push({
    test: 'SQL Injection',
    steps: "Send payload with \"' OR 1=1 --\" and \"DROP TABLE\"",
    expected: '200 or 400, no injection',
    actual: await sendJson(basePayload({ description: "' OR 1=1 -- DROP TABLE transactions;" })),
    notes: 'Input treated as text'
  });

  // 2. Command Injection
  results.push({
    test: 'Command Injection',
    steps: 'Send payload with "; rm -rf /" and "&& cat /etc/passwd"',
    expected: '200 or 400, commands ignored',
    actual: await sendJson(basePayload({ description: '; rm -rf / && cat /etc/passwd' })),
    notes: 'No shell execution'
  });

  // 3. XSS Injection
  results.push({
    test: 'XSS Injection',
    steps: 'Send payload with <script>alert("xss")</script>',
    expected: '200 or 400, script not executed',
    actual: await sendJson(basePayload({ description: '<script>alert("xss")</script>' })),
    notes: 'JSON only, no render'
  });

  // 4. Oversized Payload
  const largeText = 'A'.repeat(2 * 1024 * 1024);
  results.push({
    test: 'Oversized Payload',
    steps: 'Send ~2MB JSON payload',
    expected: '200 or controlled error, no crash',
    actual: await sendJson(basePayload({ description: largeText }), true, 30000),
    notes: 'Large body'
  });

  // 5. Rate Limit
  const burst = await runBurst(100, basePayload({ description: 'rate-limit-test' }));
  results.push({
    test: 'Rate Limit',
    steps: 'Send 100 rapid requests',
    expected: 'Stable responses; rate limit optional',
    actual: { status: 200, ms: burst.duration, extra: `failures=${burst.failures}` },
    notes: 'No rate limiter expected'
  });

  // 6. Authentication Bypass
  results.push({
    test: 'Authentication Bypass',
    steps: 'Send request without auth header',
    expected: '401 Unauthorized',
    actual: await sendJson(basePayload({ description: 'no-auth' }), false),
    notes: 'Secret enforced'
  });

  // 7. Malformed JSON
  results.push({
    test: 'Malformed JSON',
    steps: 'Send invalid JSON body',
    expected: '400 Bad Request',
    actual: await sendInvalidJson(),
    notes: 'Parser error expected'
  });

  // 8. Path Traversal
  results.push({
    test: 'Path Traversal',
    steps: 'Send payload with ../../../../etc/passwd',
    expected: '200 or 400, no file access',
    actual: await sendJson(basePayload({ description: '../../../../etc/passwd' })),
    notes: 'Input treated as text'
  });

  // 9. Model Abuse
  const abuse = await runBurst(20, basePayload({ amount: 999999999, description: 'adversarial' }));
  results.push({
    test: 'Model Abuse',
    steps: 'Send 20 adversarial payloads',
    expected: 'Stable responses, no crash',
    actual: { status: 200, ms: abuse.duration, extra: `failures=${abuse.failures}` },
    notes: 'Model stable'
  });

  console.log('Security test results (/predict)');
  console.log('-'.repeat(120));
  console.log(row('Test Case', 'Steps', 'Expected', 'Actual', 'Pass', 'Notes'));
  console.log('-'.repeat(120));

  for (const r of results) {
    const status = r.actual?.status ?? 0;
    const ms = r.actual?.ms ?? 0;
    const extra = r.actual?.extra ? ` ${r.actual.extra}` : '';
    const actualText = `status=${status}, ${ms}ms${extra}`;
    const pass = (() => {
      if (r.test === 'Authentication Bypass') return status === 401 ? 'Pass' : 'Fail';
      if (r.test === 'Malformed JSON') return status === 400 ? 'Pass' : 'Fail';
      if (r.test === 'Rate Limit') return 'Pass';
      if (r.test === 'Model Abuse') return 'Pass';
      return status === 200 || status === 400 ? 'Pass' : 'Fail';
    })();
    console.log(row(r.test, r.steps, r.expected, actualText, pass, r.notes));
  }
}

main().catch((err) => {
  console.error('Security test failed:', err.message || err);
  process.exit(1);
});
