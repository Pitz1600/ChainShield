const Alert = require('../models/Alert');
const Transaction = require('../models/Transaction');
const axios = require('axios');
const blockchainService = require('./blockchainService');
const economicDataService = require('./economicDataService');

class FraudDetectionService {
  constructor() {
    // Support free ML APIs or local service
    // Options:
    // - Local: http://localhost:5001 (runs on your PC)
    // - Hugging Face: https://api-inference.huggingface.co/models/... (free tier)
    // - Or set to 'none' to use rule-based only
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
    this.useFreeMLAPI = process.env.USE_FREE_ML_API === 'true';
    this.freeMLAPIUrl = process.env.FREE_ML_API_URL; // e.g., Hugging Face

    this.graphServiceUrl = process.env.GRAPH_SERVICE_URL || 'http://localhost:5002';
    this.useFreeGraphAPI = process.env.USE_FREE_GRAPH_API === 'true';
  }

  /**
   * Comprehensive fraud analysis integrating ML, blockchain, and graph analytics
   */
  async analyzeTransaction(transaction) {
    try {
      // Step 1: Get graph analytics
      const graphAnalysis = await this.getGraphAnalysis(transaction);

      // Step 2: Prepare ML features with graph data
      const mlFeatures = await this.prepareMLFeatures(transaction, graphAnalysis);

      // Step 3: Call ML service for fraud prediction
      const mlResponse = await this.callMLService(transaction, mlFeatures);

      // Step 4: Record transaction hash on blockchain
      const blockchainReceipt = await blockchainService.recordTransactionHash(
        transaction.txHash || transaction._id.toString(),
        {
          riskScore: mlResponse.riskScore,
          timestamp: transaction.timestamp || new Date(),
          transactionType: transaction.transactionType
        }
      );

      // Step 5: Combine all analysis results
      return {
        riskScore: mlResponse.riskScore,
        riskLevel: mlResponse.riskLevel,
        isFraudulent: mlResponse.isFraudulent,
        fraudType: mlResponse.fraudType,
        reasons: mlResponse.explanation || mlResponse.reasons || [],
        shapValues: mlResponse.shapValues || {},
        graphPatterns: graphAnalysis.fraudPatterns || [],
        networkFeatures: graphAnalysis.networkFeatures || {},
        blockchainTxId: blockchainReceipt.transactionHash,
        blockchainBlockNumber: blockchainReceipt.blockNumber,
        anomalyScore: mlResponse.anomalyScore,
        isAnomaly: mlResponse.isAnomaly
      };
    } catch (error) {
      console.error('Fraud Detection Error:', error.message);
      // Fallback to rule-based detection
      return this.ruleBasedDetection(transaction);
    }
  }

  /**
   * Get graph analytics for transaction
   * Supports local service or can be disabled
   */
  async getGraphAnalysis(transaction) {
    // Skip graph analysis if disabled
    if (!this.graphServiceUrl || this.graphServiceUrl === 'none') {
      return {
        networkFeatures: {},
        fraudPatterns: [],
        graphStats: {}
      };
    }

    try {
      const response = await axios.post(`${this.graphServiceUrl}/analyze`, {
        transaction: {
          fromAddress: transaction.fromAddress,
          toAddress: transaction.toAddress,
          amount: transaction.amount,
          timestamp: transaction.timestamp || new Date().toISOString(),
          transactionType: transaction.transactionType
        }
      }, {
        timeout: 5000 // 5 second timeout
      });

      return response.data;
    } catch (error) {
      console.warn('Graph Analysis Error (using fallback):', error.message);
      return {
        networkFeatures: {},
        fraudPatterns: [],
        graphStats: {}
      };
    }
  }

  /**
   * Prepare ML features including graph analytics and transaction history
   */
  async prepareMLFeatures(transaction, graphAnalysis) {
    try {
      // Calculate transaction frequency (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentTransactions = await Transaction.countDocuments({
        fromAddress: transaction.fromAddress,
        timestamp: { $gte: oneDayAgo }
      });

      // Calculate convergence score (multiple beneficiaries to one address)
      const convergenceCount = await Transaction.countDocuments({
        toAddress: transaction.toAddress
      }).distinct('fromAddress').length;

      // Calculate time difference from last transaction
      const lastTransaction = await Transaction.findOne({
        fromAddress: transaction.fromAddress
      }).sort({ timestamp: -1 });

      let timeDiff = 86400; // Default 1 day in seconds
      if (lastTransaction && lastTransaction.timestamp) {
        timeDiff = (new Date(transaction.timestamp || Date.now()) - new Date(lastTransaction.timestamp)) / 1000;
      }

      // Extract network features from graph analysis
      const networkFeatures = graphAnalysis.networkFeatures || {};

      // Check for circular pattern
      const hasCircularPattern = graphAnalysis.fraudPatterns?.some(
        p => p.type === 'Circular Movement'
      ) ? 1 : 0;

      return {
        frequency: recentTransactions,
        convergence_score: Math.min(convergenceCount / 100, 1.0), // Normalized
        address_degree: networkFeatures.degree || 0,
        circular_pattern: hasCircularPattern,
        time_diff: Math.max(timeDiff, 0)
      };
    } catch (error) {
      console.error('Error preparing ML features:', error.message);
      return {
        frequency: 0,
        convergence_score: 0,
        address_degree: 0,
        circular_pattern: 0,
        time_diff: 86400
      };
    }
  }

  /**
   * Call ML service for fraud prediction
   * Supports local Python service or free ML APIs
   */
  async callMLService(transaction, mlFeatures) {
    try {
      // Option 1: Use free ML API (e.g., Hugging Face)
      if (this.useFreeMLAPI && this.freeMLAPIUrl) {
        return await this.callFreeMLAPI(transaction, mlFeatures);
      }

      // Option 2: Use local ML service (runs on your PC)
      if (this.mlServiceUrl && this.mlServiceUrl !== 'none') {
        try {
          const response = await axios.post(`${this.mlServiceUrl}/predict`, {
            transactionId: transaction.transactionId,
            txHash: transaction.txHash,
            amount: transaction.amount,
            fromAddress: transaction.fromAddress,
            toAddress: transaction.toAddress,
            timestamp: transaction.timestamp || new Date().toISOString(),
            transactionType: transaction.transactionType,
            agency: transaction.agency,
            programName: transaction.programName,
            ...mlFeatures
          }, {
            timeout: 10000 // 10 second timeout
          });

          return response.data;
        } catch (localError) {
          console.warn('Local ML service unavailable, falling back to rule-based:', localError.message);
          throw localError; // Will trigger fallback
        }
      }

      // If no ML service configured, throw to trigger rule-based fallback
      throw new Error('ML service not configured');
    } catch (error) {
      console.error('ML Service Error:', error.message);
      throw error; // Will be caught and trigger rule-based detection
    }
  }

  /**
   * Call free ML API (e.g., Hugging Face)
   * Example: Hugging Face Inference API (free tier: 1000 requests/month)
   */
  async callFreeMLAPI(transaction, mlFeatures) {
    try {
      // Prepare features for API
      const features = [
        mlFeatures.amount_normalized || (transaction.amount / 1000000),
        mlFeatures.frequency || 0,
        mlFeatures.time_diff || 86400,
        mlFeatures.address_degree || 0,
        mlFeatures.convergence_score || 0,
        mlFeatures.circular_pattern || 0
      ];

      // Call Hugging Face or other free ML API
      const response = await axios.post(
        this.freeMLAPIUrl,
        { inputs: features },
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY || ''}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      // Process response (format depends on API)
      const prediction = response.data[0] || response.data;
      const riskScore = Math.min(Math.max(prediction * 100, 0), 100);

      return {
        riskScore: Math.round(riskScore),
        riskLevel: this.getRiskLevel(riskScore),
        isFraudulent: riskScore >= 60,
        fraudType: this.classifyFraudType(transaction, []),
        explanation: ['ML prediction from free API'],
        shapValues: {},
        anomalyScore: 0,
        isAnomaly: riskScore > 70
      };
    } catch (error) {
      console.warn('Free ML API error, using rule-based:', error.message);
      throw error; // Trigger fallback
    }
  }

  /**
   * Rule-based fraud detection (fallback)
   * Philippine government context-specific rules
   */
  ruleBasedDetection(transaction) {
    let riskScore = 0;
    const reasons = [];

    // Rule 1: High amount check
    if (transaction.amount > 100000) {
      riskScore += 30;
      reasons.push('Unusually high transaction amount');
    }

    // Rule 2: Social Welfare specific rules
    if (transaction.transactionType === 'Social Welfare') {
      if (transaction.amount > 50000) {
        riskScore += 25;
        reasons.push('Abnormal social welfare disbursement amount');
      }
    }

    // Rule 3: Procurement fraud indicators
    if (transaction.transactionType === 'Procurement' && transaction.amount > 500000) {
      riskScore += 35;
      reasons.push('High-value procurement transaction - requires review');
    }

    // Rule 4: Rapid transactions (would need history check)
    // This is handled in ML features

    const riskLevel = this.getRiskLevel(riskScore);

    return {
      riskScore,
      riskLevel,
      isFraudulent: riskScore >= 60,
      fraudType: this.classifyFraudType(transaction, reasons),
      reasons,
      shapValues: {},
      graphPatterns: [],
      networkFeatures: {},
      blockchainTxId: null,
      blockchainBlockNumber: null,
      anomalyScore: 0,
      isAnomaly: false
    };
  }

  /**
   * Classify fraud type based on transaction and reasons
   */
  classifyFraudType(transaction, reasons) {
    const reasonsStr = reasons.join(' ').toLowerCase();

    if (reasonsStr.includes('welfare') || transaction.transactionType === 'Social Welfare') {
      return 'Welfare Fraud';
    }
    if (reasonsStr.includes('procurement') || transaction.transactionType === 'Procurement') {
      return 'Procurement Fraud';
    }
    if (reasonsStr.includes('tax') || transaction.transactionType === 'Tax') {
      return 'Tax Evasion';
    }

    return 'Other';
  }

  /**
   * Get risk level from score
   */
  getRiskLevel(riskScore) {
    if (riskScore >= 80) return 'CRITICAL';
    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Create alert for fraudulent transaction
   */
  async createAlert(transaction, fraudAnalysis) {
    const severity = this.calculateSeverity(fraudAnalysis.riskScore);

    const alert = new Alert({
      transactionId: transaction._id,
      txHash: transaction.txHash,
      severity,
      fraudType: fraudAnalysis.fraudType,
      riskScore: fraudAnalysis.riskScore,
      reasons: fraudAnalysis.reasons,
      shapValues: fraudAnalysis.shapValues,
      features: {
        networkFeatures: fraudAnalysis.networkFeatures,
        graphPatterns: fraudAnalysis.graphPatterns,
        blockchainTxId: fraudAnalysis.blockchainTxId
      },
      status: 'open'
    });

    await alert.save();
    return alert;
  }

  /**
   * Calculate alert severity from risk score
   */
  calculateSeverity(riskScore) {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }
}

module.exports = new FraudDetectionService();