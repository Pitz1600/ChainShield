const Alert = require('../models/Alert');
const axios = require('axios');

class FraudDetectionService {
  async analyzeTransaction(transaction) {
    try {
      // Call ML service for fraud detection
      const response = await axios.post(`${process.env.ML_SERVICE_URL}/predict`, {
        txHash: transaction.txHash,
        amount: transaction.amount,
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        timestamp: transaction.timestamp
      });
      
      return {
        riskScore: response.data.riskScore,
        isFraudulent: response.data.riskScore >= 60,
        fraudType: response.data.fraudType,
        reasons: response.data.reasons,
        shapValues: response.data.shapValues
      };
    } catch (error) {
      console.error('ML Service Error:', error.message);
      // Fallback to rule-based detection
      return this.ruleBasedDetection(transaction);
    }
  }
  
  ruleBasedDetection(transaction) {
    let riskScore = 0;
    const reasons = [];
    
    // High amount check
    if (transaction.amount > 100000) {
      riskScore += 30;
      reasons.push('Unusually high transaction amount');
    }
    
    // Add more rules here
    
    return {
      riskScore,
      isFraudulent: riskScore >= 60,
      fraudType: 'Other',
      reasons
    };
  }
  
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
      status: 'open'
    });
    
    await alert.save();
    return alert;
  }
  
  calculateSeverity(riskScore) {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }
}

module.exports = new FraudDetectionService();