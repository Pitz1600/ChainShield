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
        outDegree: riskAnalysis.networkFeatures.outDegree || 0,
        clusteringCoefficient: riskAnalysis.networkFeatures.clusteringCoefficient || 0,
        betweennessCentrality: riskAnalysis.networkFeatures.betweennessCentrality || 0
      };
    }

    // Store fraud patterns detected
    if (riskAnalysis.graphPatterns && riskAnalysis.graphPatterns.length > 0) {
      transaction.fraudPatterns = riskAnalysis.graphPatterns.map(pattern => ({
        type: pattern.type,
        severity: pattern.severity,
        description: pattern.description
      }));
    }

    await transaction.save();

    // Create alert if flagged
    if (riskAnalysis.isFraudulent) {
      await riskDetectionService.createAlert(transaction, riskAnalysis);
    }

    // Return transaction with fraud analysis details
    res.status(201).json({
      ...transaction.toObject(),
      fraudAnalysis: {
        reasons: riskAnalysis.reasons,
        graphPatterns: riskAnalysis.graphPatterns,
        blockchainTxId: riskAnalysis.blockchainTxId,
        shapValues: riskAnalysis.shapValues
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
    // Build query - Residents see only their own, Officials/Admins see all
    let query = {};
    const isOfficial = ['administrator', 'barangay_official', 'analyst', 'investigator'].includes(req.user.role);

    if (!isOfficial) {
      query = {
        $or: [
          { userId: req.user._id }, // Use _id as userId might not be populated in all contexts
          { userId: req.user.userId }, // Keep for backward compatibility
          { fromAddress: req.user.email },
          { toAddress: req.user.email }
        ]
      };
    }

    // Apply filters
    if (type && type !== 'all') {
      // General search filter instead of strict type
      query.$or = [
        { transactionId: { $regex: type, $options: 'i' } },
        { description: { $regex: type, $options: 'i' } },
        { transactionType: { $regex: type, $options: 'i' } },
        { fromAddress: { $regex: type, $options: 'i' } },
        { toAddress: { $regex: type, $options: 'i' } }
      ];
    } else if (req.query.search) {
      query.$or = [
        { transactionId: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { transactionType: { $regex: req.query.search, $options: 'i' } },
        { fromAddress: { $regex: req.query.search, $options: 'i' } },
        { toAddress: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      // Allow searching verificationStatus when status filter is provided
      // Since frontend formerly sent 'completed', 'pending', etc., we might map or just check both
      query.$or = query.$or || [];
      query.$or.push({ status: status });
      query.$or.push({ verificationStatus: status });

      // If $or only has these status checks, it's fine. 
      // But if there's a search term, we need $and. Let's simplify and just check both fields if status is provided, 
      // but to not break existing strict search, we will override the status logic:
      delete query.$or; // Resetting because $or with search is complex.
      // Simpler approach: Create a robust search that handles text input
    }

    // Better filter logic:
    if (req.query.search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { transactionId: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { transactionType: { $regex: req.query.search, $options: 'i' } },
          { fromAddress: { $regex: req.query.search, $options: 'i' } },
          { toAddress: { $regex: req.query.search, $options: 'i' } }
        ]
      });
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
      .select('transactionId transactionType amount status timestamp blockchainTxId riskScore riskLevel flagged verificationStatus verifiedBy fromAddress toAddress description');

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
      riskScore: txn.riskScore,
      riskLevel: txn.riskLevel,
      flagged: txn.flagged,
      verificationStatus: txn.verificationStatus,
      verifiedBy: txn.verifiedBy,
      fromAddress: txn.fromAddress,
      toAddress: txn.toAddress,
      description: txn.description
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

// NEW: Update transaction verification status
exports.updateVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Verified', 'Suspicious'].includes(status)) {
      return res.status(400).json({ error: 'Invalid verification status' });
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    transaction.verificationStatus = status;

    // Determine who verified based on action
    if (status === 'Pending') {
      transaction.verifiedBy = undefined; // Cleared on Undo
    } else {
      transaction.verifiedBy = req.user.role || 'Admin';
    }

    await transaction.save();

    res.json({
      success: true,
      message: `Transaction marked as ${status}`,
      transaction: {
        _id: transaction._id,
        verificationStatus: transaction.verificationStatus,
        verifiedBy: transaction.verifiedBy
      }
    });
  } catch (error) {
    console.error('Update verification status error:', error);
    res.status(500).json({ error: error.message });
  }
};
