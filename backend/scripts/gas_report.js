const { Web3 } = require('web3');
const path = require('path');
const fs = require('fs');

const argv = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = argv.indexOf(name);
  if (idx === -1) return fallback;
  const value = argv[idx + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
};

const blocksToScan = Math.max(1, Math.min(2000, Number(getArg('--blocks', '200')) || 200));
const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545';
const contractAddressEnv = process.env.CONTRACT_ADDRESS || '';
const contractAddress = getArg('--address', contractAddressEnv);

if (!contractAddress) {
  console.error('Missing contract address. Set CONTRACT_ADDRESS or pass --address.');
  process.exit(1);
}

const normalize = (addr) => addr?.toLowerCase();

const formatEther = (web3, wei) => {
  try {
    return web3.utils.fromWei(String(wei), 'ether');
  } catch (_) {
    return '0';
  }
};

async function main() {
  const web3 = new Web3(rpcUrl);
  const latest = await web3.eth.getBlockNumber();
  const start = Math.max(0, Number(latest) - blocksToScan + 1);

  let totalGas = 0;
  let txCount = 0;
  let maxGas = 0;
  let minGas = null;
  let totalWei = 0n;

  for (let b = start; b <= latest; b += 1) {
    const block = await web3.eth.getBlock(b, true);
    if (!block || !Array.isArray(block.transactions)) continue;
    for (const tx of block.transactions) {
      if (!tx || normalize(tx.to) !== normalize(contractAddress)) continue;
      const receipt = await web3.eth.getTransactionReceipt(tx.hash);
      if (!receipt) continue;
      const gasUsed = Number(receipt.gasUsed || 0);
      const effectiveGasPrice = receipt.effectiveGasPrice || tx.gasPrice || 0;

      totalGas += gasUsed;
      txCount += 1;
      maxGas = Math.max(maxGas, gasUsed);
      minGas = minGas === null ? gasUsed : Math.min(minGas, gasUsed);
      try {
        totalWei += BigInt(gasUsed) * BigInt(effectiveGasPrice);
      } catch (_) {
        // ignore BigInt issues
      }
    }
  }

  const avgGas = txCount ? Math.round(totalGas / txCount) : 0;
  const totalEth = formatEther(web3, totalWei.toString());

  const report = {
    rpcUrl,
    contractAddress,
    latestBlock: Number(latest),
    blocksScanned: Number(latest) - start + 1,
    transactionsToContract: txCount,
    gasUsed: {
      total: totalGas,
      avg: avgGas,
      min: minGas ?? 0,
      max: maxGas
    },
    estimatedCostEth: totalEth
  };

  const pad = (label, width) => `${label}`.padEnd(width, ' ');
  const row = (label, value) => `${pad(label, 28)} ${value}`;
  const separator = '-'.repeat(60);

  console.log('Gas Usage Report');
  console.log(separator);
  console.log(row('RPC URL', report.rpcUrl));
  console.log(row('Contract', report.contractAddress));
  console.log(row('Latest Block', report.latestBlock));
  console.log(row('Blocks Scanned', report.blocksScanned));
  console.log(row('Transactions', report.transactionsToContract));
  console.log(separator);
  console.log(row('Gas Total', report.gasUsed.total));
  console.log(row('Gas Average', report.gasUsed.avg));
  console.log(row('Gas Min', report.gasUsed.min));
  console.log(row('Gas Max', report.gasUsed.max));
  console.log(row('Estimated Cost (ETH)', report.estimatedCostEth));
}

main().catch((err) => {
  console.error('Gas report failed:', err.message || err);
  process.exit(1);
});
