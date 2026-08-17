const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const blockchainService = require('./blockchainService');
const { logBatchSummary } = require('../utils/structuredLogger');
const axios = require('axios');

class MultiStageFraudPipeline {
  constructor() {
    this.graphServiceUrl = process.env.GRAPH_SERVICE_URL || 'http://localhost:5002';
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
  }

  /**
   * Process a batch of transactions.
   * opts.requireApproval = true => skip blockchain, mark verificationStatus='Pending', leave verifiedBy unset.
   */
  async processBatch(rawTransactions, opts = {}) {
    const { requireApproval = false, staged = false, batchSize, useML = false } = opts;
    const start = Date.now();
    const batchId = Date.now();
    const txs = Array.isArray(rawTransactions)
      ? rawTransactions.filter(t => t && Number.isFinite(Number(t.amount)) && Number(t.amount) > 0)
      : [];
    if (Array.isArray(rawTransactions) && rawTransactions.length > 0 && txs.length === 0) {
      throw new Error('Transaction processing failed: Amount must be a positive number greater than 0');
    }
    const normalizedBatchSize = Math.min(500, Math.max(100, Number(batchSize) || 250));
    const totalBatches = Math.ceil(txs.length / normalizedBatchSize) || 1;

    const batchSlices = Array.from({ length: totalBatches }, (_, i) =>
      txs.slice(i * normalizedBatchSize, (i + 1) * normalizedBatchSize)
    );

    const results = [];
    let flagged = 0;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const mlEnabled = useML || String(process.env.INTEGRITY_USE_ML || '').toLowerCase() === 'true';
    const mlWeight = Number(process.env.INTEGRITY_ML_WEIGHT || 0.3);
    const mlUrl = process.env.ML_SERVICE_URL ? `${process.env.ML_SERVICE_URL}/predict` : 'http://ml-service:5001/predict';
    const mlBatchUrl = process.env.ML_SERVICE_URL ? `${process.env.ML_SERVICE_URL}/predict-batch` : 'http://ml-service:5001/predict-batch';
    const mlSecret = process.env.ML_API_SECRET || '';
    const mlConcurrency = Math.max(1, Number(process.env.INTEGRITY_ML_CONCURRENCY || 10));
    const lowerBound = (arr, target) => {
      let lo = 0;
      let hi = arr.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (arr[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };

    const upperBound = (arr, target) => {
      let lo = 0;
      let hi = arr.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (arr[mid] <= target) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };

    for (const batch of batchSlices) {
      if (batch.length === 0) continue;

      const amounts = batch.map((tx) => Number(tx?.amount || 0));
      const count = amounts.length;
      const mean = count ? amounts.reduce((sum, val) => sum + val, 0) / count : 0;
      const variance = count
        ? amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count
        : 0;
      const std = Math.sqrt(variance) || 0;

      const zScores = amounts.map((val) => (std > 0 ? (val - mean) / std : 0));
      const baseRiskScores = zScores.map((z) => Math.min(Math.abs(z) * 30, 100));

      const senderSet = new Set(batch.map((tx) => tx?.fromAddress).filter(Boolean));
      const senders = [...senderSet];
      const since10m = new Date(Date.now() - 10 * 60 * 1000);

      const [recentRows, senderAverages] = await Promise.all([
        senders.length
          ? Transaction.find({
            fromAddress: { $in: senders },
            timestamp: { $gte: since10m }
          }).select('fromAddress toAddress timestamp amount').lean()
          : [],
        senders.length
          ? Transaction.aggregate([
            { $match: { fromAddress: { $in: senders } } },
            { $group: { _id: '$fromAddress', avgAmount: { $avg: '$amount' } } }
          ])
          : []
      ]);

      const senderAvgMap = new Map(senderAverages.map((row) => [row._id, Number(row.avgAmount || 0)]));

      const batchSenderStats = new Map();
      for (const tx of batch) {
        if (!tx?.fromAddress) continue;
        const entry = batchSenderStats.get(tx.fromAddress) || { sum: 0, count: 0 };
        entry.sum += Number(tx.amount || 0);
        entry.count += 1;
        batchSenderStats.set(tx.fromAddress, entry);
      }

      const senderTimesMap = new Map();
      const pairTimesMap = new Map();

      for (const row of recentRows) {
        const ts = new Date(row.timestamp).getTime();
        if (!Number.isFinite(ts)) continue;
        const sender = row.fromAddress;
        const receiver = row.toAddress;
        if (sender) {
          const list = senderTimesMap.get(sender) || [];
          list.push(ts);
          senderTimesMap.set(sender, list);
        }
        if (sender && receiver) {
          const key = `${sender}||${receiver}`;
          const list = pairTimesMap.get(key) || [];
          list.push(ts);
          pairTimesMap.set(key, list);
        }
      }

      for (const tx of batch) {
        const ts = new Date(tx.timestamp || Date.now()).getTime();
        const sender = tx?.fromAddress;
        const receiver = tx?.toAddress;
        if (sender) {
          const list = senderTimesMap.get(sender) || [];
          list.push(ts);
          senderTimesMap.set(sender, list);
        }
        if (sender && receiver) {
          const key = `${sender}||${receiver}`;
          const list = pairTimesMap.get(key) || [];
          list.push(ts);
          pairTimesMap.set(key, list);
        }
      }

      for (const [sender, list] of senderTimesMap.entries()) {
        list.sort((a, b) => a - b);
        senderTimesMap.set(sender, list);
      }
      for (const [key, list] of pairTimesMap.entries()) {
        list.sort((a, b) => a - b);
        pairTimesMap.set(key, list);
      }

      const computed = batch.map((tx, idx) => {
        const ts = new Date(tx.timestamp || Date.now()).getTime();
        const sender = tx?.fromAddress;
        const receiver = tx?.toAddress;

        const senderTimes = sender ? (senderTimesMap.get(sender) || []) : [];
        const count60s = senderTimes.length
          ? (upperBound(senderTimes, ts) - lowerBound(senderTimes, ts - 60 * 1000))
          : 0;
        const count5m = senderTimes.length
          ? (upperBound(senderTimes, ts) - lowerBound(senderTimes, ts - 5 * 60 * 1000))
          : 0;
        const velocityFlag = count60s > 5 || count5m > 10;

        const pairKey = sender && receiver ? `${sender}||${receiver}` : null;
        const pairTimes = pairKey ? (pairTimesMap.get(pairKey) || []) : [];
        const pairCount10m = pairTimes.length
          ? (upperBound(pairTimes, ts) - lowerBound(pairTimes, ts - 10 * 60 * 1000))
          : 0;
        const receiverPatternFlag = pairCount10m > 3;

        const senderAvg = senderAvgMap.has(sender)
          ? senderAvgMap.get(sender)
          : (() => {
            const stats = batchSenderStats.get(sender);
            if (!stats || !stats.count) return 0;
            return stats.sum / stats.count;
          })();
        const amountSpikeFlag = senderAvg > 0 && Number(tx.amount || 0) > 5 * senderAvg;

        const velocityPenalty = velocityFlag ? 20 : 0;
        const receiverPenalty = receiverPatternFlag ? 15 : 0;
        const amountSpikePenalty = amountSpikeFlag ? 25 : 0;

        const baseRisk = clamp(baseRiskScores[idx] + velocityPenalty + receiverPenalty + amountSpikePenalty, 0, 100);
        const finalRiskScore = baseRisk;
        const riskLevel = this.getRiskLevel(finalRiskScore);
        const flaggedTx = finalRiskScore >= 71;

        const reasons = [];
        if (baseRiskScores[idx] > 0) {
          reasons.push(`Amount deviates from batch average (z=${zScores[idx].toFixed(2)})`);
        }
        if (velocityFlag) {
          reasons.push(`High transaction velocity (${count60s} in 60s / ${count5m} in 5m)`);
        }
        if (receiverPatternFlag) {
          reasons.push(`Repeated sender→receiver pattern (${pairCount10m} in 10m)`);
        }
        if (amountSpikeFlag) {
          reasons.push('Amount spike vs sender average (>5x)');
        }

        const summaryParts = [];
        if (baseRiskScores[idx] > 0) summaryParts.push('amount out of usual range');
        if (velocityFlag) summaryParts.push('unusually frequent activity');
        if (receiverPatternFlag) summaryParts.push('repeated receiver pattern');
        if (amountSpikeFlag) summaryParts.push('large spike vs sender average');
        if (summaryParts.length === 0) summaryParts.push('no major anomalies detected');
        reasons.push(`Summary: ${summaryParts.join(', ')}.`);

        return {
          zScore: Number(zScores[idx].toFixed(3)),
          riskScore: Number(finalRiskScore.toFixed(2)),
          riskLevel,
          flagged: flaggedTx,
          velocityFlag,
          receiverPatternFlag,
          amountSpikeFlag,
          reasons,
          mlUsed: false,
          mlScore: null,
          velocityCounts: { count60s, count5m },
          receiverCount10m: pairCount10m
        };
      });

      let mlScores = null;
      let mlHybrid = null;
      if (mlEnabled) {
        const headers = {
          'Content-Type': 'application/json',
          'X-Quiet': 'true'
        };
        if (mlSecret) headers['X-Internal-Secret'] = mlSecret;

        const batchPayload = {
          transactions: batch.map((tx, idx) => ({
            transactionId: tx.transactionId || `batch-${idx}`,
            txHash: tx.txHash,
            amount: Number(tx.amount || 0),
            fromAddress: tx.fromAddress,
            toAddress: tx.toAddress,
            timestamp: tx.timestamp || new Date().toISOString(),
            transactionType: tx.transactionType || 'Other',
            agency: tx.agency,
            programName: tx.programName,
            transaction_velocity: computed[idx].velocityCounts?.count5m || 0,
            receiver_frequency: computed[idx].receiverCount10m || 0,
            amount_ratio: 0,
            sender_historical_risk: 0,
            transaction_sequence_index: idx
          }))
        };

        try {
          const res = await axios.post(mlBatchUrl, batchPayload, { headers, timeout: 20000 });
          mlHybrid = res?.data?.results || null;
        } catch (_) {
          mlHybrid = null;
        }

        if (!mlHybrid) {
          const tasks = batch.map((tx, idx) => async () => {
            const payload = {
              transactionId: tx.transactionId || `batch-${idx}`,
              txHash: tx.txHash,
              amount: Number(tx.amount || 0),
              fromAddress: tx.fromAddress,
              toAddress: tx.toAddress,
              timestamp: tx.timestamp || new Date().toISOString(),
              transactionType: tx.transactionType || 'Other',
              agency: tx.agency,
              programName: tx.programName,
              transaction_velocity: computed[idx].velocityCounts?.count5m || 0,
              receiver_frequency: computed[idx].receiverCount10m || 0,
              amount_ratio: 0,
              sender_historical_risk: 0,
              transaction_sequence_index: idx
            };
            try {
              const res = await axios.post(mlUrl, payload, { headers, timeout: 15000 });
              const score = res?.data?.risk_score ?? res?.data?.riskScore;
              return Number(score || 0);
            } catch (_) {
              return null;
            }
          });

          const runWithConcurrency = async (fns, limit) => {
            const results = new Array(fns.length);
            let index = 0;
            const workers = new Array(Math.min(limit, fns.length)).fill(null).map(async () => {
              while (true) {
                const current = index;
                if (current >= fns.length) return;
                index += 1;
                results[current] = await fns[current]();
              }
            });
            await Promise.all(workers);
            return results;
          };

          mlScores = await runWithConcurrency(tasks, mlConcurrency);
        }
      }

      if (mlHybrid) {
        for (let i = 0; i < computed.length; i += 1) {
          const h = mlHybrid[i];
          if (!h) continue;
          const finalProb = Number(h.final_probability ?? 0);
          if (Number.isFinite(finalProb)) {
            const mlScore = finalProb * 100;
            const base = computed[i].riskScore;
            const combined = clamp(base * (1 - mlWeight) + mlScore * mlWeight, 0, 100);
            computed[i].riskScore = Number(combined.toFixed(2));
            computed[i].riskLevel = this.getRiskLevel(computed[i].riskScore);
            computed[i].flagged = computed[i].riskScore >= 71;
            computed[i].mlUsed = true;
            computed[i].mlScore = Number(mlScore.toFixed(2));
            computed[i].reasons.push(`ML hybrid assessment (score=${Math.round(mlScore)})`);
            computed[i].reasons.push(`AI Summary: ML confirms ${mlScore >= 60 ? 'elevated risk' : 'low risk'} when combined with batch statistics.`);
          }
        }
      } else if (mlScores) {
        for (let i = 0; i < computed.length; i += 1) {
          const mlScore = mlScores[i];
          if (typeof mlScore === 'number' && Number.isFinite(mlScore)) {
            const base = computed[i].riskScore;
            const combined = clamp(base * (1 - mlWeight) + mlScore * mlWeight, 0, 100);
            computed[i].riskScore = Number(combined.toFixed(2));
            computed[i].riskLevel = this.getRiskLevel(computed[i].riskScore);
            computed[i].flagged = computed[i].riskScore >= 71;
            computed[i].mlUsed = true;
            computed[i].mlScore = Number(mlScore.toFixed(2));
            computed[i].reasons.push(`ML model assessment (score=${Math.round(mlScore)})`);
          }
        }
      }

      const txDocs = batch.map((tx, idx) => {
        const next = { ...tx };
        if (!next.txHash) {
          next.txHash = blockchainService.generateTxHash(next);
        }
        return {
          ...next,
          riskScore: computed[idx].riskScore,
          zScore: computed[idx].zScore,
          riskLevel: computed[idx].riskLevel,
          flagged: computed[idx].flagged,
          velocityFlag: computed[idx].velocityFlag,
          receiverPatternFlag: computed[idx].receiverPatternFlag,
          amountSpikeFlag: computed[idx].amountSpikeFlag,
          mlUsed: computed[idx].mlUsed,
          mlScore: computed[idx].mlScore,
          reasons: computed[idx].reasons,
          fraudPatterns: [],
          networkFeatures: {},
          verificationStatus: requireApproval ? 'Pending' : 'Verified',
          verifiedBy: requireApproval ? undefined : 'System',
          staged: staged || requireApproval
        };
      });

      const inserted = await Transaction.insertMany(txDocs, { ordered: true });

      const batchResults = inserted.map((doc, idx) => ({
        transactionId: doc._id,
        txHash: doc.txHash,
        riskScore: doc.riskScore,
        riskLevel: doc.riskLevel,
        anomalyCategory: computed[idx].receiverPatternFlag ? 'Money Laundering Anomaly' : (computed[idx].flagged ? 'Amount Anomaly' : 'Other'),
        flagged: doc.flagged,
        reasons: computed[idx].reasons,
        graphRisk: 0,
        propagatedRisk: 0,
        zScore: computed[idx].zScore,
        velocityFlag: computed[idx].velocityFlag,
        receiverPatternFlag: computed[idx].receiverPatternFlag,
        amountSpikeFlag: computed[idx].amountSpikeFlag,
        mlUsed: computed[idx].mlUsed,
        mlScore: computed[idx].mlScore,
        fromAddress: doc.fromAddress,
        toAddress: doc.toAddress,
        chainReceipt: null,
        verificationStatus: doc.verificationStatus,
        verifiedBy: doc.verifiedBy
      }));

      const highRiskEntries = inserted
        .map((doc, idx) => ({ doc, idx }))
        .filter(({ idx }) => computed[idx].riskLevel === 'HIGH' && computed[idx].riskScore >= 71);

      if (highRiskEntries.length) {
        const chainUpdates = [];
        for (const { doc, idx } of highRiskEntries) {
          try {
            const receipt = await blockchainService.recordSuspiciousEvidence(doc.txHash, Math.round(doc.riskScore || 0));
            chainUpdates.push({
              updateOne: {
                filter: { _id: doc._id },
                update: {
                  $set: {
                    blockchainTxId: receipt.transactionHash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed
                  }
                }
              }
            });
            batchResults[idx].chainReceipt = receipt;
          } catch (err) {
            console.warn('Blockchain logging skipped:', err.message);
          }
        }
        if (chainUpdates.length) {
          await Transaction.bulkWrite(chainUpdates, { ordered: false });
        }
      }

      results.push(...batchResults);

      const alertsToInsert = inserted
        .map((doc, idx) => ({ doc, idx }))
        .filter(({ idx }) => computed[idx].flagged)
        .map(({ doc, idx }) => ({
          transactionId: doc._id,
          txHash: doc.txHash,
          severity: doc.riskScore >= 90 ? 'critical' : 'high',
          anomalyCategory: computed[idx].receiverPatternFlag ? 'Money Laundering Anomaly' : 'Other',
          riskScore: doc.riskScore,
          reasons: computed[idx].reasons,
          features: {
            zScore: computed[idx].zScore,
            velocityFlag: computed[idx].velocityFlag,
            receiverPatternFlag: computed[idx].receiverPatternFlag,
            amountSpikeFlag: computed[idx].amountSpikeFlag
          },
          status: 'open'
        }));

      if (alertsToInsert.length) {
        await Alert.insertMany(alertsToInsert, { ordered: true });
      }

      flagged += computed.filter((c) => c.flagged).length;

      logBatchSummary({
        batchId,
        total: batch.length,
        flagged: computed.filter((c) => c.flagged).length,
        durationMs: Date.now() - start,
        stats: { mean, std }
      });
    }

    return {
      batchId,
      results,
      summary: { flagged, total: txs.length, batches: totalBatches }
    };
  }

  ruleFilter(tx) {
    const reasons = [];
    let highFreq = false;
    let risk = 0;

    if (tx.amount > 1_000_000) {
      reasons.push('Rule: amount > 1,000,000');
      risk += 40;
    }
    if (tx.transactionType === 'Social Welfare' && tx.amount > 50_000) {
      reasons.push('Rule: abnormal welfare amount');
      risk += 25;
    }
    if (tx.transactionType === 'Procurement' && tx.amount > 500_000) {
      reasons.push('Rule: high-value procurement');
      risk += 25;
    }
    if (tx.frequency && tx.frequency > 20) {
      highFreq = true;
      reasons.push('Rule: high transaction frequency attribute');
      risk += 20;
    }

    return { reasons, highFreq, risk };
  }

  getRiskLevel(score) {
    if (score >= 71) return 'HIGH';
    if (score >= 41) return 'MEDIUM';
    return 'LOW';
  }

  classifyAnomalyCategory(transaction, reasons = [], fraudPatterns = []) {
    const reasonsStr = reasons.join(' ').toLowerCase();
    const patternTypes = fraudPatterns.map((pattern) => String(pattern.type || '')).join(' ').toLowerCase();
    const categoryText = `${reasonsStr} ${patternTypes}`;

    if (categoryText.includes('welfare') || transaction.transactionType === 'Social Welfare') {
      return 'Welfare Anomaly';
    }
    if (categoryText.includes('procurement') || transaction.transactionType === 'Procurement') {
      return 'Procurement Anomaly';
    }
    if (categoryText.includes('tax') || transaction.transactionType === 'Tax') {
      return 'Tax Anomaly';
    }
    if (categoryText.includes('rapid sequential') || categoryText.includes('circular movement') || categoryText.includes('collusion')) {
      return 'Network Pattern Anomaly';
    }
    if (categoryText.includes('unusual amount') || categoryText.includes('amount')) {
      return 'Amount Anomaly';
    }
    if (categoryText.includes('timing') || categoryText.includes('unusual transaction time')) {
      return 'Timing Anomaly';
    }

    return 'Other';
  }
}

module.exports = new MultiStageFraudPipeline();
