const axios = require('axios');
const { Web3 } = require('web3');
const crypto = require('crypto');

const cases = [
  { name: 'Normal input', text: 'Payment for office supplies, amount 12000, type Procurement' },
  { name: 'Long input', text: 'A'.repeat(5000) },
  { name: 'Empty input', text: '' },
  { name: 'Special characters input', text: '!@#$%^&*()_+-=[]{}|;:\'",.<>/?`~' },
  { name: 'Garbage input', text: crypto.randomBytes(64).toString('hex') },
  { name: 'Repeated input', text: 'Repeated transaction payload', repeat: 5 }
];

const mlUrl = process.env.ML_SERVICE_URL
  ? `${process.env.ML_SERVICE_URL}/predict`
  : 'http://ml-service:5001/predict';
const mlSecret = process.env.ML_API_SECRET || '';

const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://ganache:8545';
const contractAddress = process.env.CONTRACT_ADDRESS;
const account = process.env.BLOCKCHAIN_ACCOUNT;
const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

const contractABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: '_txHash', type: 'bytes32' },
      { internalType: 'uint8', name: '_riskScore', type: 'uint8' },
      { internalType: 'bytes32', name: '_metaHash', type: 'bytes32' }
    ],
    name: 'recordSuspicious',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const now = () => Date.now();
const pad = (label, width) => `${label}`.padEnd(width, ' ');
const row = (a, b, c) => `${pad(a, 28)} ${pad(b, 18)} ${c}`;
const separator = '-'.repeat(70);

const toBytes32 = (hex) => `0x${hex.padStart(64, '0').slice(0, 64)}`;
const sha256Hex = (input) => crypto.createHash('sha256').update(input).digest('hex');

const buildMlPayload = (text, idx) => ({
  transactionId: `perf-${idx}`,
  txHash: `perf-${idx}`,
  amount: 1000 + (idx % 5000),
  fromAddress: `0xFrom${idx}`,
  toAddress: `0xTo${idx % 50}`,
  timestamp: new Date().toISOString(),
  transactionType: 'Other',
  agency: 'PerfTest',
  programName: 'PerfTest',
  description: text,
  frequency: idx % 20,
  time_diff: 60,
  address_degree: idx % 100,
  convergence_score: 0.1,
  circular_pattern: 0
});

async function runMlCase(testCase, idxBase) {
  const headers = { 'Content-Type': 'application/json', 'X-Quiet': 'true' };
  if (mlSecret) headers['X-Internal-Secret'] = mlSecret;

  const repeats = testCase.repeat || 1;
  let totalMs = 0;
  let success = 0;
  for (let i = 0; i < repeats; i += 1) {
    const payload = buildMlPayload(testCase.text, idxBase + i);
    const t0 = now();
    try {
      await axios.post(mlUrl, payload, { headers, timeout: 15000 });
      totalMs += now() - t0;
      success += 1;
    } catch (err) {
      totalMs += now() - t0;
    }
  }
  const avg = Math.round(totalMs / repeats);
  return { avgMs: avg, success };
}

async function runChainCase(web3, contract, testCase) {
  if (!contract || !account || !privateKey) {
    return { ok: false, ms: 0, error: 'Blockchain not configured' };
  }

  const repeats = testCase.repeat || 1;
  let totalMs = 0;
  let success = 0;
  let lastError = '';

  for (let i = 0; i < repeats; i += 1) {
    const txHash = sha256Hex(testCase.text || `case-${i}`);
    const metaHash = sha256Hex(`${testCase.text}-${Date.now()}-${i}`);
    const hashBytes32 = toBytes32(txHash);
    const metaBytes32 = toBytes32(metaHash);
    const t0 = now();
    try {
      const gasPrice = await web3.eth.getGasPrice();
      const tx = contract.methods.recordSuspicious(hashBytes32, 80, metaBytes32);
      const gasEstimate = await tx.estimateGas({ from: account });
      const signed = await web3.eth.accounts.signTransaction(
        {
          from: account,
          to: contractAddress,
          data: tx.encodeABI(),
          gas: gasEstimate,
          gasPrice
        },
        privateKey
      );
      await web3.eth.sendSignedTransaction(signed.rawTransaction);
      totalMs += now() - t0;
      success += 1;
    } catch (err) {
      totalMs += now() - t0;
      lastError = err?.message || 'Unknown error';
    }
  }

  return {
    ok: success > 0,
    avgMs: Math.round(totalMs / repeats),
    success,
    error: success > 0 ? '' : lastError
  };
}

async function main() {
  console.log('Performance test');
  console.log(separator);
  console.log('AI feature (ML service)');
  console.log(separator);
  console.log(row('Case', 'Avg ms', 'Success'));

  let idxBase = 0;
  for (const testCase of cases) {
    const result = await runMlCase(testCase, idxBase);
    idxBase += testCase.repeat || 1;
    console.log(row(testCase.name, String(result.avgMs), `${result.success}/${testCase.repeat || 1}`));
  }

  console.log('\nBlockchain feature (smart contract)');
  console.log(separator);
  console.log(row('Case', 'Avg ms', 'Success'));

  const web3 = new Web3(rpcUrl);
  const contract = contractAddress ? new web3.eth.Contract(contractABI, contractAddress) : null;

  for (const testCase of cases) {
    const result = await runChainCase(web3, contract, testCase);
    const successText = result.error
      ? `0/${testCase.repeat || 1} (${result.error})`
      : `${result.success}/${testCase.repeat || 1}`;
    console.log(row(testCase.name, String(result.avgMs || 0), successText));
  }
}

main().catch((err) => {
  console.error('Performance test failed:', err.message || err);
  process.exit(1);
});
