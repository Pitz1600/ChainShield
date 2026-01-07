const Alert = require('../models/Alert');
const Transaction = require('../models/Transaction');

/**
 * Get evaluation metrics for fraud detection system
 * Calculates Precision, Recall, F1-score, and False Positive Rate
 */
exports.getEvaluationMetrics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Get total transactions
    const totalTransactions = await Transaction.countDocuments(query);
    
    // Get flagged transactions
    const flaggedTransactions = await Transaction.countDocuments({
      ...query,
      flagged: true
    });
    
    // Get alerts
    const alerts = await Alert.find(query);
    
    // Calculate metrics based on alert status
    // True Positives: Alerts that were closed (investigated and confirmed)
    const truePositives = alerts.filter(a => 
      a.status === 'closed' && 
      a.severity !== 'low' &&
      !a.status.includes('false')
    ).length;
    
    // False Positives: Alerts marked as false positive
    const falsePositives = alerts.filter(a => 
      a.status === 'false_positive' || 
      a.severity === 'low'
    ).length;
    
    // False Negatives: Would need manual review data
    // For prototype, estimate based on unflagged high-risk transactions
    const unflaggedHighRisk = await Transaction.countDocuments({
      ...query,
      flagged: false,
      riskScore: { $gte: 70 }
    });
    const falseNegatives = Math.floor(unflaggedHighRisk * 0.1); // Estimate 10% are false negatives
    
    // True Negatives: Correctly identified as non-fraudulent
    const trueNegatives = totalTransactions - flaggedTransactions - falseNegatives;
    
    // Calculate metrics
    const precision = truePositives + falsePositives > 0 
      ? truePositives / (truePositives + falsePositives) 
      : 0;
    
    const recall = truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;
    
    const f1Score = precision + recall > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;
    
    const falsePositiveRate = truePositives + falsePositives > 0
      ? falsePositives / (falsePositives + truePositives)
      : 0;
    
    // Additional metrics
    const accuracy = totalTransactions > 0
      ? (truePositives + trueNegatives) / totalTransactions
      : 0;
    
    const detectionRate = totalTransactions > 0
      ? flaggedTransactions / totalTransactions
      : 0;
    
    // Risk level distribution
    const riskDistribution = {
      CRITICAL: await Transaction.countDocuments({ ...query, riskLevel: 'CRITICAL' }),
      HIGH: await Transaction.countDocuments({ ...query, riskLevel: 'HIGH' }),
      MEDIUM: await Transaction.countDocuments({ ...query, riskLevel: 'MEDIUM' }),
      LOW: await Transaction.countDocuments({ ...query, riskLevel: 'LOW' })
    };
    
    // Fraud type distribution
    const fraudTypeDistribution = await Alert.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$fraudType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      metrics: {
        precision: precision.toFixed(4),
        recall: recall.toFixed(4),
        f1Score: f1Score.toFixed(4),
        falsePositiveRate: falsePositiveRate.toFixed(4),
        accuracy: accuracy.toFixed(4),
        detectionRate: detectionRate.toFixed(4)
      },
      counts: {
        totalTransactions,
        flaggedTransactions,
        truePositives,
        falsePositives,
        falseNegatives,
        trueNegatives
      },
      distribution: {
        riskLevel: riskDistribution,
        fraudType: fraudTypeDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      period: {
        startDate: startDate || 'all',
        endDate: endDate || 'all'
      }
    });
  } catch (error) {
    console.error('Evaluation metrics error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get model performance statistics
 */
exports.getModelPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Get risk score distribution
    const riskScores = await Transaction.find(query).select('riskScore');
    const scores = riskScores.map(t => t.riskScore || 0).filter(s => s > 0);
    
    const avgRiskScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    
    const maxRiskScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minRiskScore = scores.length > 0 ? Math.min(...scores) : 0;
    
    // Get alerts by severity
    const alerts = await Alert.find(query);
    const severityDistribution = {
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length
    };
    
    res.json({
      riskScoreStats: {
        average: avgRiskScore.toFixed(2),
        max: maxRiskScore,
        min: minRiskScore,
        totalScored: scores.length
      },
      severityDistribution,
      totalAlerts: alerts.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
