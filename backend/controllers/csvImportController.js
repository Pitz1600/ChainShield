const Transaction = require('../models/Transaction');
const fraudDetectionService = require('../services/fraudDetection');
const blockchainService = require('../services/blockchainService');
const csv = require('csv-parser');
const fs = require('fs');

/**
 * Import transactions from CSV file
 * Processes each transaction and runs fraud detection
 */
exports.importTransactions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const results = [];
    const errors = [];
    const transactions = [];

    // Parse CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => transactions.push(data))
      .on('end', async () => {
        try {
          // Process each transaction
          for (let i = 0; i < transactions.length; i++) {
            try {
              const txData = transactions[i];

              // Validate required fields
              if (!txData.transactionType || !txData.fromAddress || !txData.toAddress || !txData.amount) {
                errors.push({
                  row: i + 1,
                  error: 'Missing required fields (transactionType, fromAddress, toAddress, amount)',
                  data: txData
                });
                continue;
              }

              // Helper function to pad addresses to valid Ethereum format
              const padAddress = (addr) => {
                if (!addr) return addr;
                // If it's already a valid length Ethereum address, return as is
                if (addr.startsWith('0x') && addr.length === 42) return addr;
                // If it doesn't start with 0x, add it
                if (!addr.startsWith('0x')) addr = '0x' + addr;
                // Pad to 42 characters (0x + 40 hex chars)
                return addr.padEnd(42, '0');
              };

              // Create transaction object
              const transaction = new Transaction({
                transactionType: txData.transactionType,
                agency: txData.agency || 'Unknown',
                programName: txData.programName || '',
                fromAddress: padAddress(txData.fromAddress),
                toAddress: padAddress(txData.toAddress),
                amount: parseFloat(txData.amount),
                beneficiaryType: txData.beneficiaryType || 'Individual',
                currency: txData.currency || 'PHP',
                timestamp: txData.timestamp ? new Date(txData.timestamp) : new Date()
              });

              // Generate transaction hash if not provided
              if (!transaction.txHash) {
                transaction.txHash = blockchainService.generateTxHash(transaction);
              }

              // Run fraud detection
              const fraudAnalysis = await fraudDetectionService.analyzeTransaction(transaction);

              // Update transaction with fraud analysis
              transaction.riskScore = fraudAnalysis.riskScore;
              transaction.riskLevel = fraudAnalysis.riskLevel;
              transaction.flagged = fraudAnalysis.isFraudulent;
              transaction.blockchainTxId = fraudAnalysis.blockchainTxId;
              transaction.blockNumber = fraudAnalysis.blockchainBlockNumber;

              // Store network features
              if (fraudAnalysis.networkFeatures) {
                transaction.networkFeatures = {
                  degree: fraudAnalysis.networkFeatures.degree || 0,
                  inDegree: fraudAnalysis.networkFeatures.inDegree || 0,
                  outDegree: fraudAnalysis.networkFeatures.outDegree || 0,
                  clusteringCoefficient: fraudAnalysis.networkFeatures.clusteringCoefficient || 0,
                  betweennessCentrality: fraudAnalysis.networkFeatures.betweennessCentrality || 0
                };
              }

              // Store fraud patterns
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

              results.push({
                row: i + 1,
                transactionId: transaction.transactionId,
                riskScore: transaction.riskScore,
                riskLevel: transaction.riskLevel,
                flagged: transaction.flagged
              });

            } catch (error) {
              errors.push({
                row: i + 1,
                error: error.message,
                data: transactions[i]
              });
            }
          }

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          // Return results
          res.json({
            success: true,
            message: `Processed ${transactions.length} transactions`,
            imported: results.length,
            failed: errors.length,
            results,
            errors: errors.length > 0 ? errors : undefined
          });

        } catch (error) {
          // Clean up uploaded file
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          res.status(500).json({ error: error.message });
        }
      })
      .on('error', (error) => {
        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Error parsing CSV file: ' + error.message });
      });

  } catch (error) {
    console.error('CSV Import Error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generate CSV template for download
 */
exports.downloadTemplate = (req, res) => {
  const template = `transactionType,agency,programName,fromAddress,toAddress,amount,beneficiaryType,currency,timestamp
Social Welfare,DSWD,4Ps,0x1234567890123456789012345678901234567890,0x0987654321098765432109876543210987654321,5000,Household,PHP,2024-01-15T10:30:00Z
Procurement,DBM,Infrastructure,0x2345678901234567890123456789012345678901,0x8765432109876543210987654321098765432109,500000,Contractor,PHP,2024-01-15T11:00:00Z
Tax,BIR,Income Tax,0x3456789012345678901234567890123456789012,0x7654321098765432109876543210987654321098,25000,Individual,PHP,2024-01-15T12:00:00Z`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=transaction_import_template.csv');
  res.send(template);
};
