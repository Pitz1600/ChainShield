const Transaction = require('../models/Transaction');
const riskDetectionService = require('../services/fraudDetection');
const blockchainService = require('../services/blockchainService');
const multiStagePipeline = require('../services/multiStageFraudPipeline');

exports.createTransaction = async (req, res) => {
  try {
    const input = req.body;
    const { results } = await multiStagePipeline.processBatch([input], { requireApproval: true });
    const first = results[0];
    const saved = await Transaction.findById(first.transactionId);

    res.status(201).json({
      transaction: saved,
      fraudAnalysis: first
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

    // exclude staged unless explicitly requested
    if (req.query.includeStaged !== 'true') {
      query.staged = { $ne: true };
    }

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
        query.riskScore = { $gte: 90 };
      } else if (severity === 'high') {
        query.riskScore = { $gte: 71, $lt: 90 };
      } else if (severity === 'medium') {
        query.riskScore = { $gte: 41, $lt: 71 };
      }
    }

    const alerts = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('transactionId transactionType agency programName amount fromAddress toAddress riskScore riskLevel flagged timestamp fraudPatterns reasons mlUsed mlScore');

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

// Batch processing endpoint
exports.processBatch = async (req, res) => {
  try {
    const txs = req.body.transactions || [];
    if (!Array.isArray(txs) || txs.length === 0) {
      return res.status(400).json({ error: 'transactions array required' });
    }
    const result = await multiStagePipeline.processBatch(txs, { requireApproval: true });
    res.json(result);
  } catch (err) {
    console.error('Batch processing error:', err);
    res.status(500).json({ error: err.message });
  }
};

// NEW: Get current user's transactions only
exports.getMyTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      dateFrom,
      dateTo,
      sortBy = 'timestamp',
      sortOrder = 'desc',
      search,
      includeStaged
    } = req.query;

    const isOfficial = ['administrator', 'barangay_official', 'auditor'].includes(req.user.role);

    // ── Base visibility clause ───────────────────────────────────────
    // Residents: see all non-staged (public records) + their own staged
    // Officials: see everything
    let visibilityClause = null;
    if (!isOfficial) {
      if (includeStaged === 'true') {
        // Residents requested staged data: show all public records
        visibilityClause = null;
      } else {
        visibilityClause = {
          $or: [
            { staged: { $ne: true } },
            { userId: req.user._id },
            { fromAddress: req.user.email },
          ]
        };
      }
    } else if (includeStaged !== 'true') {
      // Officials who didn't request staged: exclude staged
      visibilityClause = { staged: { $ne: true } };
    }
    // includeStaged === 'true' for officials → no staged filter (see everything)

    // ── Optional filters ─────────────────────────────────────────────
    const andClauses = [];

    // Apply visibility as the first $and clause
    if (visibilityClause) andClauses.push(visibilityClause);

    // Search across text fields
    if (search && search.trim()) {
      andClauses.push({
        $or: [
          { transactionId:   { $regex: search, $options: 'i' } },
          { description:     { $regex: search, $options: 'i' } },
          { transactionType: { $regex: search, $options: 'i' } },
          { agency:          { $regex: search, $options: 'i' } },
          { programName:     { $regex: search, $options: 'i' } },
          { fromAddress:     { $regex: search, $options: 'i' } },
          { toAddress:       { $regex: search, $options: 'i' } },
        ]
      });
    }

    // Verification status filter
    if (status && status !== 'all') {
      // Support comma-separated statuses e.g. "Flagged,Suspicious" for Under Review
      const statusValues = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statusValues.length === 1) {
        andClauses.push({ verificationStatus: statusValues[0] });
      } else if (statusValues.length > 1) {
        andClauses.push({ verificationStatus: { $in: statusValues } });
      }
    }

    // Date range
    if (dateFrom || dateTo) {
      const tsFilter = {};
      if (dateFrom) tsFilter.$gte = new Date(dateFrom);
      if (dateTo)   tsFilter.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
      andClauses.push({ timestamp: tsFilter });
    }

    // Build final query
    const query = andClauses.length === 1
      ? andClauses[0]
      : andClauses.length > 1
        ? { $and: andClauses }
        : {};

    // ── Sort ─────────────────────────────────────────────────────────
    const allowedSortFields = { timestamp: 'timestamp', riskScore: 'riskScore', status: 'verificationStatus' };
    const sortField = allowedSortFields[sortBy] || 'timestamp';
    const sortDir   = sortOrder === 'asc' ? 1 : -1;

    const pageNum   = Math.max(1, parseInt(page)  || 1);
    const limitNum  = Math.min(500, parseInt(limit) || 20);

    const [transactions, count] = await Promise.all([
      Transaction.find(query)
        .sort({ [sortField]: sortDir })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .select('transactionId transactionType amount status timestamp blockchainTxId blockNumber riskScore zScore riskLevel flagged velocityFlag receiverPatternFlag amountSpikeFlag mlUsed mlScore verificationStatus verifiedBy fromAddress toAddress description fraudPatterns reasons metadata networkFeatures agency programName lineItems staged currency beneficiaryType'),
      Transaction.countDocuments(query)
    ]);

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
      zScore: txn.zScore,
      riskLevel: txn.riskLevel,
      flagged: txn.flagged,
      reasons: txn.reasons,
      velocityFlag: txn.velocityFlag,
      receiverPatternFlag: txn.receiverPatternFlag,
      amountSpikeFlag: txn.amountSpikeFlag,
      mlUsed: txn.mlUsed,
      mlScore: txn.mlScore,
      verificationStatus: txn.verificationStatus,
      verifiedBy: txn.verifiedBy,
      fromAddress: txn.fromAddress,
      toAddress: txn.toAddress,
      description: txn.description,
      agency: txn.agency,
      programName: txn.programName
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

// NEW: Add remark to transaction
exports.addRemark = async (req, res) => {
  try {
    const { id } = req.params;
    const { remark } = req.body;

    if (!remark) return res.status(400).json({ error: 'Remark text is required' });

    const transaction = await Transaction.findById(id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    transaction.remarks.push({
      text: remark,
      author: req.user?.name || req.user?.email || req.user?.role || 'Auditor'
    });

    await transaction.save();

    res.json({
      success: true,
      message: 'Remark added successfully',
      transaction
    });
  } catch (error) {
    console.error('Add remark error:', error);
    res.status(500).json({ error: error.message });
  }
};

// NEW: Update transaction verification status
exports.updateVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Verified', 'Suspicious', 'Flagged', 'Denied', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid verification status' });
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    transaction.verificationStatus = status === 'Denied' ? 'Rejected' : status;

    // Determine verifier identity
    if (transaction.verificationStatus === 'Pending') {
      transaction.verifiedBy = undefined; // cleared on undo
    } else {
      transaction.verifiedBy = req.user?.name || req.user?.fullName || req.user?.email || req.user?.role || 'Official';
    }

    // If approved and flagged, record on-chain (once)
    if (transaction.verificationStatus === 'Verified' && transaction.flagged && !transaction.blockchainTxId) {
      try {
        const receipt = await blockchainService.recordSuspiciousEvidence(
          transaction.txHash,
          transaction.riskScore || 0
        );
        transaction.blockchainTxId = receipt.transactionHash;
        transaction.blockNumber = receipt.blockNumber;
        transaction.gasUsed = receipt.gasUsed;
      } catch (err) {
        console.warn('Blockchain logging on verify failed:', err.message);
      }
    }

    await transaction.save();

    res.json({
      success: true,
      message: `Transaction marked as ${status}`,
      transaction: {
        _id: transaction._id,
        verificationStatus: transaction.verificationStatus,
        verifiedBy: transaction.verifiedBy,
        blockchainTxId: transaction.blockchainTxId,
        blockNumber: transaction.blockNumber
      }
    });
  } catch (error) {
    console.error('Update verification status error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Hard delete for rejected transactions (only officials/admins)
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    await tx.deleteOne();
    return res.json({ success: true, message: 'Transaction deleted', id });
  } catch (err) {
    console.error('Delete transaction error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Approve staged transaction and optionally record blockchain if flagged
exports.approveTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    tx.verificationStatus = 'Verified';
    tx.verifiedBy = req.user?.name || req.user?.fullName || req.user?.email || req.user?.role || 'Official';
    tx.staged = false;

    if (tx.flagged && !tx.blockchainTxId) {
      try {
        const receipt = await blockchainService.recordSuspiciousEvidence(tx.txHash, tx.riskScore || 0);
        tx.blockchainTxId = receipt.transactionHash;
        tx.blockNumber = receipt.blockNumber;
        tx.gasUsed = receipt.gasUsed;
      } catch (err) {
        console.warn('Blockchain logging on approve failed:', err.message);
      }
    }

    if (tx.verificationStatus !== 'Pending') tx.staged = false;
    await tx.save();

    res.json({
      success: true,
      transaction: {
        _id: tx._id,
        verificationStatus: tx.verificationStatus,
        verifiedBy: tx.verifiedBy,
        blockchainTxId: tx.blockchainTxId,
        blockNumber: tx.blockNumber
      }
    });
  } catch (err) {
    console.error('Approve transaction error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Batch action: approve, flag, or delete multiple transactions
exports.batchAction = async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (!['approve', 'flag', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve, flag, or delete' });
    }

    const verifierName = req.user?.name || req.user?.fullName || req.user?.email || req.user?.role || 'Official';
    const results = { success: [], failed: [] };

    for (const id of ids) {
      try {
        const tx = await Transaction.findById(id);
        if (!tx) { results.failed.push({ id, reason: 'Not found' }); continue; }

        if (action === 'delete') {
          await tx.deleteOne();
          results.success.push({ id, action: 'deleted' });
        } else if (action === 'approve') {
          tx.verificationStatus = 'Verified';
          tx.verifiedBy = verifierName;
          tx.staged = false;
          if (tx.flagged && !tx.blockchainTxId) {
            try {
              const receipt = await blockchainService.recordSuspiciousEvidence(tx.txHash, tx.riskScore || 0);
              tx.blockchainTxId = receipt.transactionHash;
              tx.blockNumber = receipt.blockNumber;
            } catch (e) { /* blockchain optional */ }
          }
          await tx.save();
          results.success.push({ id, action: 'approved', blockchainTxId: tx.blockchainTxId || null });
        } else if (action === 'flag') {
          tx.verificationStatus = 'Flagged';
          tx.flagged = true;
          tx.verifiedBy = verifierName;
          await tx.save();
          results.success.push({ id, action: 'flagged' });
        }
      } catch (err) {
        results.failed.push({ id, reason: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('Batch action error:', err);
    res.status(500).json({ error: err.message });
  }
};
