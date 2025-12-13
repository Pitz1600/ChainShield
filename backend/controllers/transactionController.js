const Transaction = require('../models/Transaction');
const fraudDetectionService = require('../services/fraudDetection');

exports.createTransaction = async (req, res) => {
  try {
    const transaction = new Transaction(req.body);
    
    // Run fraud detection
    const fraudAnalysis = await fraudDetectionService.analyzeTransaction(transaction);
    transaction.riskScore = fraudAnalysis.riskScore;
    transaction.flagged = fraudAnalysis.isFraudulent;
    
    await transaction.save();
    
    // Create alert if flagged
    if (fraudAnalysis.isFraudulent) {
      await fraudDetectionService.createAlert(transaction, fraudAnalysis);
    }
    
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 50, flagged, minRisk } = req.query;
    const query = {};
    
    if (flagged !== undefined) query.flagged = flagged === 'true';
    if (minRisk) query.riskScore = { $gte: parseFloat(minRisk) };
    
    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Transaction.countDocuments(query);
    
    res.json({
      transactions,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};