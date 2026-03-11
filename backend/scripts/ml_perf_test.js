const axios = require('axios');

const argv = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = argv.indexOf(name);
  if (idx === -1) return fallback;
  const value = argv[idx + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
};

const totalRequests = Math.max(1, Number(getArg('--requests', '1000')) || 1000);
const concurrency = Math.max(1, Number(getArg('--concurrency', '20')) || 20);
const url = getArg('--url', process.env.ML_SERVICE_URL ? `${process.env.ML_SERVICE_URL}/predict` : 'http://ml-service:5001/predict');
const secret = process.env.ML_API_SECRET || '';

const headers = {};
if (secret) headers['X-Internal-Secret'] = secret;

const now = () => Date.now();

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
};

const createPayload = (i) => ({
  transactionId: `perf-${i}`,
  txHash: `perf-${i}`,
  amount: 1000 + (i % 5000),
  fromAddress: `0xFrom${i}`,
  toAddress: `0xTo${i % 50}`,
  timestamp: new Date().toISOString(),
  transactionType: 'Other',
  agency: 'PerfTest',
  programName: 'PerfTest',
  frequency: i % 20,
  time_diff: 60,
  address_degree: i % 100,
  convergence_score: 0.1,
  circular_pattern: 0
});

async function main() {
  const latencies = [];
  let failures = 0;
  let counter = 0;
  const start = now();

  const worker = async () => {
    while (true) {
      const idx = counter;
      if (idx >= totalRequests) return;
      counter += 1;

      const payload = createPayload(idx);
      const t0 = now();
      try {
        await axios.post(url, payload, { headers, timeout: 15000 });
        latencies.push(now() - t0);
      } catch (err) {
        failures += 1;
      }
    }
  };

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const durationMs = now() - start;
  const successCount = totalRequests - failures;
  const avg = successCount ? Math.round(latencies.reduce((a, b) => a + b, 0) / successCount) : 0;
  const min = latencies.length ? Math.min(...latencies) : 0;
  const max = latencies.length ? Math.max(...latencies) : 0;
  const p50 = percentile(latencies, 0.50);
  const p95 = percentile(latencies, 0.95);
  const p99 = percentile(latencies, 0.99);

  const pad = (label, width) => `${label}`.padEnd(width, ' ');
  const row = (label, value) => `${pad(label, 24)} ${value}`;
  const separator = '-'.repeat(52);

  console.log('ML Service Performance Test');
  console.log(separator);
  console.log(row('URL', url));
  console.log(row('Requests', totalRequests));
  console.log(row('Concurrency', concurrency));
  console.log(row('Duration (ms)', durationMs));
  console.log(row('Success', successCount));
  console.log(row('Failures', failures));
  console.log(separator);
  console.log(row('Latency avg (ms)', avg));
  console.log(row('Latency min (ms)', min));
  console.log(row('Latency max (ms)', max));
  console.log(row('Latency p50 (ms)', p50));
  console.log(row('Latency p95 (ms)', p95));
  console.log(row('Latency p99 (ms)', p99));
}

main().catch((err) => {
  console.error('Performance test failed:', err.message || err);
  process.exit(1);
});
