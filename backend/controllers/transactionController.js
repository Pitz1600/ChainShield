const Transaction = require('../models/Transaction');
const fraudDetectionService = require('../services/fraudDetection');
const blockchainService = require('../services/blockchainService');

exports.createTransaction = async (req, res) => {
  try {
    const transaction = new Transaction(req.body);
    
    // Generate transaction hash if not provided
    if (!transaction.txHash) {
      transaction.txHash = blockchainService.generateTxHash(transaction);
    }
    
    // Run comprehensive fraud detection (includes blockchain recording)
    const fraudAnalysis = await fraudDetectionService.analyzeTransaction(transaction);
    
    // Update transaction with fraud analysis results
    transaction.riskScore = fraudAnalysis.riskScore;
    transaction.riskLevel = fraudAnalysis.riskLevel;
    transaction.flagged = fraudAnalysis.isFraudulent;
    transaction.blockchainTxId = fraudAnalysis.blockchainTxId;
    transaction.blockNumber = fraudAnalysis.blockchainBlockNumber;
    
    // Store network features from graph analysis
    if (fraudAnalysis.networkFeatures) {
      transaction.networkFeatures = {
        degree: fraudAnalysis.networkFeatures.degree || 0,
        inDegree: fraudAnalysis.networkFeatures.inDegree || 0,
        outDegree: fraudAnalysis.networkFeatures.outDegree || 0,
        clusteringCoefficient: fraudAnalysis.networkFeatures.clusteringCoefficient || 0,
        betweennessCentrality: fraudAnalysis.networkFeatures.betweennessCentrality || 0
      };
    }
    
    // Store fraud patterns detected
    if (fraudAnalysis.graphPatterns && fraudAnalysis.graphPatterns.length > 0) {
      transaction.fraudPatterns = fraudAnalysis.graphPatterns.map(pattern => ({
        type: pattern.type,
        severity: pattern.severity,
        description: pattern.description
      }));
    }
    
    await transaction.save();
    
    // Create alert if flagged
    if (fraudAnalysis.isFraudulent) {
      await fraudDetectionService.createAlert(transaction, fraudAnalysis);
    }
    
    // Return transaction with fraud analysis details
    res.status(201).json({
      ...transaction.toObject(),
      fraudAnalysis: {
        reasons: fraudAnalysis.reasons,
        graphPatterns: fraudAnalysis.graphPatterns,
        blockchainTxId: fraudAnalysis.blockchainTxId,
        shapValues: fraudAnalysis.shapValues
      }
    });
  } catch (error) {
    console.error('Transaction creation error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      flagged, 
      minRisk, 
      transactionType,
      riskLevel,
      agency,
      programName
    } = req.query;
    
    const query = {};
    
    if (flagged !== undefined) query.flagged = flagged === 'true';
    if (minRisk) query.riskScore = { $gte: parseFloat(minRisk) };
    if (transactionType) query.transactionType = transactionType;
    if (riskLevel) query.riskLevel = riskLevel;
    if (agency) query.agency = agency;
    if (programName) query.programName = programName;
    
    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Transaction.countDocuments(query);
    
    res.json({
      transactions,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalCount: count
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