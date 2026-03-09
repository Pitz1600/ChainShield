const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const blockchainService = require('./blockchainService');
const { computeRiskScore } = require('../utils/riskScoreEngine');
const { buildProfile, behaviorDeviation } = require('../utils/behaviorProfiler');
const { logBatchSummary } = require('../utils/structuredLogger');

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
    const { requireApproval = false, staged = false } = opts;
    const start = Date.now();
    const batchId = Date.now();
    const txs = rawTransactions || [];

    // Historical baseline for mean/std to avoid batch dilution
    const history = await Transaction.find({}, { amount: 1 }).sort({ timestamp: -1 }).limit(1000).lean();
    const histAmounts = history.map((h) => Number(h.amount || 0));
    const baselineMean = histAmounts.length ? (histAmounts.reduce((a, b) => a + b, 0) / histAmounts.length) : 50000;
    const baselineVariance = histAmounts.length
      ? histAmounts.reduce((sum, val) => sum + Math.pow(val - baselineMean, 2), 0) / histAmounts.length
      : Math.pow(20000, 2);
    const baselineStd = Math.sqrt(baselineVariance) || 1;

    const graphMap = await this.graphBatch(txs);
    const results = [];
    let flagged = 0;

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      if (!tx.txHash) {
        tx.txHash = blockchainService.generateTxHash(tx);
      }

      const zScore = (Number(tx.amount || 0) - baselineMean) / baselineStd;
      const ruleHits = this.ruleFilter(tx);

      const freq24h = await Transaction.countDocuments({
        fromAddress: tx.fromAddress,
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      const highFreq = freq24h >= 10;

      const freq1h = await Transaction.countDocuments({
        fromAddress: tx.fromAddress,
        timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
      });
      const burst = freq1h > 10;

      const profile = await buildProfile(tx.fromAddress);
      const behavior = behaviorDeviation(tx, profile);

      const txHour = new Date(tx.timestamp || Date.now()).getHours();
      const unusualTime = txHour < 6 || txHour > 22;

      const graphRes =
        graphMap.get(tx.txHash) ||
        graphMap.get(tx.transactionId) ||
        graphMap.get(tx._id?.toString()) ||
        graphMap.get(`idx-${i}`) ||
        {};

      const components = {
        zScore,
        ruleRisk: ruleHits.risk || 0,
        highFreq: highFreq || ruleHits.highFreq,
        burst,
        behavior: behavior.risk,
        unusualTime: unusualTime ? 10 : 0,
        graph: graphRes.graphRisk || 0,
        propagated: graphRes.propagatedRisk || 0
      };

      const { riskScore, reasons } = computeRiskScore(components);
      const combinedReasons = [
        ...reasons,
        ...ruleHits.reasons,
        ...behavior.reasons,
        ...(graphRes.fraudPatterns ? graphRes.fraudPatterns.map((p) => p.type) : [])
      ];
      const anomalyCategory = this.classifyAnomalyCategory(tx, combinedReasons, graphRes.fraudPatterns || []);

      const decision = riskScore >= 60;
      if (decision) flagged += 1;

      const txDoc = new Transaction({
        ...tx,
        riskScore,
        riskLevel: this.getRiskLevel(riskScore),
        flagged: decision,
        fraudPatterns: graphRes.fraudPatterns || [],
        networkFeatures: graphRes.networkFeatures || {},
        verificationStatus: requireApproval ? 'Pending' : 'Verified',
        verifiedBy: requireApproval ? undefined : 'System',
        staged: staged || requireApproval
      });

      // only suspicious go to blockchain when approval not required
      let chainReceipt = null;
      if (!requireApproval && decision) {
        try {
          const metaHash = crypto
            .createHash('sha256')
            .update(JSON.stringify({ reasons: combinedReasons, components }))
            .digest('hex');
          chainReceipt = await blockchainService.recordSuspiciousEvidence(
            txDoc.txHash || txDoc._id?.toString() || crypto.randomBytes(16).toString('hex'),
            riskScore,
            metaHash
          );
          txDoc.blockchainTxId = chainReceipt.transactionHash;
          txDoc.blockNumber = chainReceipt.blockNumber;
          txDoc.gasUsed = chainReceipt.gasUsed;
        } catch (err) {
          console.warn('Blockchain logging skipped:', err.message);
        }
      }

      await txDoc.save();

      results.push({
        transactionId: txDoc._id,
        txHash: txDoc.txHash,
        riskScore,
        riskLevel: txDoc.riskLevel,
        anomalyCategory,
        flagged: decision,
        reasons: combinedReasons,
        graphRisk: components.graph,
        propagatedRisk: components.propagated,
        zScore: Number(zScore.toFixed(3)),
        chainReceipt,
        verificationStatus: txDoc.verificationStatus,
        verifiedBy: txDoc.verifiedBy
      });
    }

    const mean = baselineMean;
    const std = baselineStd;

    logBatchSummary({
      batchId,
      total: txs.length,
      flagged,
      durationMs: Date.now() - start,
      stats: { mean, std }
    });

    return { batchId, results, summary: { flagged, total: txs.length, mean, std } };
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

  async graphBatch(txs) {
    const map = new Map();
    if (!this.graphServiceUrl || this.graphServiceUrl === 'none') {
      return map;
    }
    try {
      const response = await axios.post(`${this.graphServiceUrl}/batch/analyze`, { transactions: txs }, { timeout: 8000 });
      const results = response.data.results || [];
      results.forEach((res, idx) => {
        const tx = txs[idx];
        const key = tx.txHash || tx.transactionId || `idx-${idx}`;
        map.set(key, res);
        map.set(`idx-${idx}`, res); // ensure fallback by index
      });
      return map;
    } catch (err) {
      console.warn('Graph batch error, falling back to per-tx:', err.message);
      for (const tx of txs) {
        try {
          const res = await axios.post(`${this.graphServiceUrl}/analyze`, { transaction: tx }, { timeout: 5000 });
          map.set(tx.txHash || tx.transactionId, res.data);
        } catch (inner) {
          map.set(tx.txHash || tx.transactionId, {});
        }
      }
      return map;
    }
  }

  getRiskLevel(score) {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
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
