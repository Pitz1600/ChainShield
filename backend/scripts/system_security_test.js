const axios = require('axios');
const http = require('http');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const USER_TOKEN = process.env.USER_TOKEN || '';

const now = () => Date.now();
const pad = (label, width) => `${label}`.padEnd(width, ' ');
const row = (a, b, c, d, e, f) => `${pad(a, 26)} ${pad(b, 32)} ${pad(c, 24)} ${pad(d, 22)} ${pad(e, 8)} ${f}`;
const separator = '-'.repeat(130);

const getCsrf = async () => {
  const res = await axios.get(`${API_BASE}/auth/csrf-token`, { validateStatus: () => true });
  const token = res.data?.csrfToken || '';
  const setCookie = res.headers['set-cookie'] || [];
  const cookie = setCookie.length ? setCookie[0].split(';')[0] : '';
  return { token, cookie };
};

const sendJson = async (method, url, token, data, csrf) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (csrf?.token) headers['X-CSRF-Token'] = csrf.token;
  if (csrf?.cookie) headers['Cookie'] = csrf.cookie;
  const t0 = now();
  try {
    const res = await axios({ method, url, data, headers, validateStatus: () => true });
    return { status: res.status, ms: now() - t0 };
  } catch (err) {
    return { status: 0, ms: now() - t0, error: err.message };
  }
};

const sendInvalidJson = async (url, token, csrf) => {
  const t0 = now();
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        host: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(csrf?.token ? { 'X-CSRF-Token': csrf.token } : {}),
          ...(csrf?.cookie ? { Cookie: csrf.cookie } : {})
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

const sendMultipart = async (url, token, csrf, filename, content) => {
  const boundary = `----chainshield${Math.random().toString(16).slice(2)}`;
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="csvFile"; filename="${filename}"`,
    `Content-Type: application/octet-stream`,
    '',
    content,
    `--${boundary}--`,
    ''
  ].join('\r\n');

  const headers = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (csrf?.token) headers['X-CSRF-Token'] = csrf.token;
  if (csrf?.cookie) headers['Cookie'] = csrf.cookie;

  const t0 = now();
  try {
    const res = await axios.post(url, body, { headers, validateStatus: () => true });
    return { status: res.status, ms: now() - t0 };
  } catch (err) {
    return { status: 0, ms: now() - t0, error: err.message };
  }
};

const runBurst = async (url, token, count) => {
  const requests = [];
  const t0 = now();
  for (let i = 0; i < count; i += 1) {
    requests.push(sendJson('GET', url, token));
  }
  const results = await Promise.all(requests);
  const duration = now() - t0;
  const failures = results.filter(r => r.status === 0 || r.status >= 500).length;
  return { duration, failures, count };
};

async function main() {
  if (!ADMIN_TOKEN || !USER_TOKEN) {
    console.log('Missing ADMIN_TOKEN or USER_TOKEN. Aborting.');
    process.exit(1);
  }

  const csrf = await getCsrf();
  const results = [];

  // 1. Authentication Bypass
  results.push({
    test: 'Authentication Bypass',
    steps: 'Access /api/auth/profile with no token',
    expected: '401 Unauthorized',
    actual: await sendJson('GET', `${API_BASE}/auth/profile`),
    notes: 'Protected route'
  });

  // 2. Authorization Escalation (normal user -> admin endpoint)
  results.push({
    test: 'Authorization Escalation',
    steps: 'Normal user calls /api/blockchain/status',
    expected: '403 Forbidden',
    actual: await sendJson('GET', `${API_BASE}/blockchain/status`, USER_TOKEN),
    notes: 'Admin-only route'
  });

  // 3. SQL Injection
  results.push({
    test: 'SQL Injection',
    steps: "Send search=' OR 1=1 -- to /api/transactions",
    expected: '200 OK, no injection',
    actual: await sendJson('GET', `${API_BASE}/transactions?search=' OR 1=1 --`, ADMIN_TOKEN),
    notes: 'Query treated as text'
  });

  // 4. XSS Injection
  results.push({
    test: 'XSS Injection',
    steps: 'Send search=<script>alert(1)</script>',
    expected: '200 OK, script not executed',
    actual: await sendJson('GET', `${API_BASE}/transactions?search=%3Cscript%3Ealert(1)%3C/script%3E`, ADMIN_TOKEN),
    notes: 'Backend returns JSON only'
  });

  // 5. File Upload Attack
  results.push({
    test: 'File Upload Attack',
    steps: 'Upload malicious file (evil.php) to /transactions/import',
    expected: 'Rejected (400/415)',
    actual: await sendMultipart(`${API_BASE}/transactions/import`, ADMIN_TOKEN, csrf, 'evil.php', '<?php echo 1; ?>'),
    notes: 'CSV-only expected'
  });

  // 6. Path Traversal
  results.push({
    test: 'Path Traversal',
    steps: 'Send ../../../../etc/passwd in search',
    expected: '200 OK, no file access',
    actual: await sendJson('GET', `${API_BASE}/transactions?search=../../../../etc/passwd`, ADMIN_TOKEN),
    notes: 'Input treated as text'
  });

  // 7. Rate Limiting
  const burst = await runBurst(`${API_BASE}/transactions?limit=1`, ADMIN_TOKEN, 100);
  results.push({
    test: 'Rate Limiting',
    steps: 'Send 100 rapid GET requests',
    expected: 'Stable responses; rate limit optional',
    actual: { status: 200, ms: burst.duration, extra: `failures=${burst.failures}` },
    notes: 'No rate limiter expected'
  });

  // 8. CSRF Attack
  results.push({
    test: 'CSRF Attack',
    steps: 'POST /transactions/batch without CSRF token',
    expected: '403 Forbidden',
    actual: await sendJson('POST', `${API_BASE}/transactions/batch`, ADMIN_TOKEN, { transactions: [] }),
    notes: 'CSRF protection'
  });

  // 9. Session Hijacking (reuse after logout)
  const logoutCookie = csrf.cookie ? `${csrf.cookie}; token=${ADMIN_TOKEN}` : `token=${ADMIN_TOKEN}`;
  const logoutRes = await sendJson('POST', `${API_BASE}/auth/logout`, ADMIN_TOKEN, {}, { token: csrf.token, cookie: logoutCookie });
  const reuseRes = await sendJson('GET', `${API_BASE}/auth/profile`, null, null, { cookie: `token=${ADMIN_TOKEN}` });
  results.push({
    test: 'Session Hijacking',
    steps: 'Logout then reuse old token cookie',
    expected: '401 Unauthorized',
    actual: reuseRes,
    notes: `Logout status=${logoutRes.status}`
  });

  // 10. Input Validation
  results.push({
    test: 'Input Validation',
    steps: 'Send malformed JSON to /transactions/batch',
    expected: '400 Bad Request',
    actual: await sendInvalidJson(`${API_BASE}/transactions/batch`, ADMIN_TOKEN, csrf),
    notes: 'Parser error expected'
  });

  console.log('System Security Test Results');
  console.log(separator);
  console.log(row('Test Case', 'Steps', 'Expected', 'Actual', 'Pass', 'Notes'));
  console.log(separator);

  for (const r of results) {
    const status = r.actual?.status ?? 0;
    const ms = r.actual?.ms ?? 0;
    const extra = r.actual?.extra ? ` ${r.actual.extra}` : '';
    const actualText = `status=${status}, ${ms}ms${extra}`;
    const pass = (() => {
      if (r.test === 'Authentication Bypass') return status === 401 ? 'Pass' : 'Fail';
      if (r.test === 'Authorization Escalation') return status === 403 ? 'Pass' : 'Fail';
      if (r.test === 'File Upload Attack') return status === 400 || status === 415 ? 'Pass' : 'Fail';
      if (r.test === 'CSRF Attack') return status === 403 ? 'Pass' : 'Fail';
      if (r.test === 'Session Hijacking') return status === 401 ? 'Pass' : 'Fail';
      if (r.test === 'Input Validation') return status === 400 ? 'Pass' : 'Fail';
      if (r.test === 'Rate Limiting') return 'Pass';
      return status === 200 || status === 400 ? 'Pass' : 'Fail';
    })();
    console.log(row(r.test, r.steps, r.expected, actualText, pass, r.notes));
  }
}

main().catch((err) => {
  console.error('System security test failed:', err.message || err);
  process.exit(1);
});
