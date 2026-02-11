const Transaction = require('../models/Transaction');
const riskDetectionService = require('../services/fraudDetection');
const blockchainService = require('../services/blockchainService');

exports.createTransaction = async (req, res) => {
  try {
    const transaction = new Transaction(req.body);

    // Generate transaction hash if not provided
    if (!transaction.txHash) {
      transaction.txHash = blockchainService.generateTxHash(transaction);
    }

    // Run comprehensive risk assessment (includes blockchain recording)
    const riskAnalysis = await riskDetectionService.analyzeTransaction(transaction);

    // Update transaction with risk analysis results
    transaction.riskScore = riskAnalysis.riskScore;
    transaction.riskLevel = riskAnalysis.riskLevel;
    transaction.flagged = riskAnalysis.isFraudulent;
    transaction.blockchainTxId = riskAnalysis.blockchainTxId;
    transaction.blockNumber = riskAnalysis.blockchainBlockNumber;
    transaction.gasUsed = riskAnalysis.gasUsed;

    // Store network features from graph analysis
    if (riskAnalysis.networkFeatures) {
      transaction.networkAnalysis = {
        degree: riskAnalysis.networkFeatures.degree || 0,
        inDegree: riskAnalysis.networkFeatures.inDegree || 0,
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

// NEW: Get flagged transactions (alerts)
exports.getAlerts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      severity // critical, high, medium
    } = req.query;

    const query = { flagged: true };

    // Filter by severity if provided
    if (severity) {
      if (severity === 'critical') {
        query.riskScore = { $gte: 80 };
      } else if (severity === 'high') {
        query.riskScore = { $gte: 60, $lt: 80 };
      } else if (severity === 'medium') {
        query.riskScore = { $gte: 40, $lt: 60 };
      }
    }

    const alerts = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('transactionId transactionType agency programName amount fromAddress toAddress riskScore riskLevel flagged timestamp fraudPatterns');

    const count = await Transaction.countDocuments(query);

    res.json({
      success: true,
      alerts,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      count
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: error.message });
  }
};

// NEW: Get current user's transactions only
exports.getMyTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      dateFrom,
      dateTo
    } = req.query;

    // Build query to only show user's transactions
    const query = {
      $or: [
        { userId: req.user.userId },
        { fromAddress: req.user.email },
        { toAddress: req.user.email }
      ]
    };

    // Apply filters
    if (type && type !== 'all') {
      query.transactionType = type;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (dateFrom || dateTo) {
      query.timestamp = {};
      if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
      if (dateTo) query.timestamp.$lte = new Date(dateTo);
    }

    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('transactionId transactionType amount status timestamp blockchainTxId riskScore');

    const count = await Transaction.countDocuments(query);

    // Format transactions for frontend
    const formattedTransactions = transactions.map(txn => ({
      _id: txn._id,
      transactionId: txn.transactionId,
      type: txn.transactionType,
      amount: txn.amount,
      status: txn.status || 'completed',
      date: txn.timestamp,
      blockchainHash: txn.blockchainTxId,
      riskScore: txn.riskScore
    }));

    res.json({
      success: true,
      transactions: formattedTransactions,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      count
    });
  } catch (error) {
    console.error('Get my transactions error:', error);
    res.status(500).json({ error: error.message });
  }
};
