const dataGovPhService = require('../services/dataGovPhService');
const Transaction = require('../models/Transaction');
const fraudDetectionService = require('../services/fraudDetection');
const blockchainService = require('../services/blockchainService');

/**
 * Scan data.gov.ph and ingest transactions
 */
exports.scanAndIngest = async (req, res) => {
  try {
    const { query, limit, resourceLimit } = req.body;

    // Scan data.gov.ph
    const transactions = await dataGovPhService.scanAndIngest({
      query: query || 'budget OR procurement OR welfare',
      limit: limit || 10,
      resourceLimit: resourceLimit || 50
    });

    if (transactions.length === 0) {
      return res.json({
        message: 'No transactions found from data.gov.ph',
        ingested: 0,
        transactions: []
      });
    }

    // Process each transaction
    const processed = [];
    const errors = [];

    for (const txData of transactions) {
      try {
        // Create transaction
        const transaction = new Transaction(txData);
        
        // Generate hash
        if (!transaction.txHash) {
          transaction.txHash = blockchainService.generateTxHash(transaction);
        }

        // Run fraud detection
        const fraudAnalysis = await fraudDetectionService.analyzeTransaction(transaction);
        
        // Update transaction
        transaction.riskScore = fraudAnalysis.riskScore;
        transaction.riskLevel = fraudAnalysis.riskLevel;
        transaction.flagged = transaction.riskScore >= 71;
        transaction.blockchainTxId = fraudAnalysis.blockchainTxId;
        transaction.blockNumber = fraudAnalysis.blockchainBlockNumber;

        // Store network features
        if (fraudAnalysis.networkFeatures) {
          transaction.networkFeatures = fraudAnalysis.networkFeatures;
        }

        // Store fraud patterns
        if (fraudAnalysis.graphPatterns && fraudAnalysis.graphPatterns.length > 0) {
          transaction.fraudPatterns = fraudAnalysis.graphPatterns;
        }

        // Save transaction
        await transaction.save();

        // Create alert only for HIGH risk
        if (transaction.riskScore >= 71) {
          await fraudDetectionService.createAlert(transaction, fraudAnalysis);
        }

        processed.push({
          transactionId: transaction.transactionId,
          riskScore: transaction.riskScore,
          flagged: transaction.flagged
        });
      } catch (error) {
        errors.push({
          transaction: txData,
          error: error.message
        });
      }
    }

    res.json({
      message: `Ingested ${processed.length} transactions from data.gov.ph`,
      ingested: processed.length,
      errors: errors.length,
      transactions: processed,
      errorDetails: errors
    });
  } catch (error) {
    console.error('Error scanning data.gov.ph:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Search datasets on data.gov.ph
 */
exports.searchDatasets = async (req, res) => {
  try {
    const { query, limit } = req.query;
    const datasets = await dataGovPhService.searchDatasets(query, parseInt(limit) || 10);
    res.json({ datasets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
