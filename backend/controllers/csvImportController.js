const Transaction = require('../models/Transaction');
const fraudDetectionService = require('../services/fraudDetection');
const blockchainService = require('../services/blockchainService');
const CSVColumnMapper = require('../utils/csvColumnMapper');
const csv = require('csv-parser');
const fs = require('fs');

/**
 * Import transactions from ANY CSV file (no template required!)
 * Intelligently detects columns and runs Philippine fraud detection
 */
exports.importTransactions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const results = [];
    const errors = [];
    const rawTransactions = [];
    let headers = null;
    let columnMappings = null;
    const mapper = new CSVColumnMapper();

    // Parse CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
        // Auto-detect column mappings
        columnMappings = mapper.detectColumns(headers);
        const confidence = mapper.getConfidence(columnMappings);

        console.log('📊 CSV Column Detection:');
        console.log('  Headers:', headers);
        console.log('  Mappings:', columnMappings);
        console.log('  Confidence:', confidence + '%');
      })
      .on('data', (data) => rawTransactions.push(data))
      .on('end', async () => {
        try {
          console.log(`\n🔍 Processing ${rawTransactions.length} transactions...`);

          // Process each transaction
          for (let i = 0; i < rawTransactions.length; i++) {
            try {
              const rawData = rawTransactions[i];

              // Map CSV row to transaction object
              const txData = mapper.mapRow(rawData, columnMappings);

              // Validate mapped transaction
              const validation = mapper.validate(txData);
              if (!validation.isValid) {
                errors.push({
                  row: i + 2, // +2 because row 1 is headers, array is 0-indexed
                  error: validation.errors.join(', '),
                  data: rawData
                });
                continue;
              }

              // Helper function to pad addresses to valid Ethereum format
              const padAddress = (addr) => {
                if (!addr) return addr;
                if (addr.startsWith('0x') && addr.length === 42) return addr;
                if (!addr.startsWith('0x')) addr = '0x' + addr;
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
                timestamp: txData.timestamp ? new Date(txData.timestamp) : new Date(),
                description: txData.description || ''
              });

              // Generate transaction hash if not provided
              if (!transaction.txHash) {
                transaction.txHash = blockchainService.generateTxHash(transaction);
              }

              // Run PHILIPPINE FRAUD DETECTION 🇵🇭
              console.log(`  Row ${i + 2}: Analyzing with Philippine fraud patterns...`);
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

              // Return enhanced results with Philippine fraud detection
              results.push({
                row: i + 2,
                transactionId: transaction.transactionId,
                amount: transaction.amount,
                transactionType: transaction.transactionType,
                riskScore: transaction.riskScore,
                riskLevel: transaction.riskLevel,
                flagged: transaction.flagged,
                fraudType: fraudAnalysis.fraudType,
                reasons: fraudAnalysis.reasons || [],
                // Philippine fraud detection specific
                philippinePatterns: fraudAnalysis.graphPatterns || [],
                networkFeatures: transaction.networkFeatures
              });

            } catch (error) {
              console.error(`  Row ${i + 2}: Error -`, error.message);
              errors.push({
                row: i + 2,
                error: error.message,
                data: rawTransactions[i]
              });
            }
          }

          // Clean up uploaded file with retry for Windows
          try {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          } catch (err) {
            console.warn('Warning: Could not delete temp file (Windows lock?):', err.message);
          }

          // Calculate statistics
          const flaggedCount = results.filter(r => r.flagged).length;
          const highRiskCount = results.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;

          console.log(`\n✅ Import Complete:`);
          console.log(`  Total: ${rawTransactions.length}`);
          console.log(`  Imported: ${results.length}`);
          console.log(`  Failed: ${errors.length}`);
          console.log(`  Flagged as Fraud: ${flaggedCount}`);
          console.log(`  High Risk: ${highRiskCount}`);

          // Return enhanced results
          res.json({
            success: true,
            message: `Processed ${rawTransactions.length} transactions with Philippine fraud detection`,
            imported: results.length,
            failed: errors.length,
            flaggedCount,
            highRiskCount,
            columnMappings,
            mappingConfidence: mapper.getConfidence(columnMappings),
            results,
            errors: errors.length > 0 ? errors : undefined
          });

        } catch (error) {
          console.error('Processing Error:', error);
          // Clean up uploaded file
          try {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          } catch (e) { /* ignore */ }

          res.status(500).json({ error: error.message });
        }
      })
      .on('error', (error) => {
        console.error('CSV Parse Error:', error);
        // Clean up uploaded file
        try {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch (e) { /* ignore */ }

        res.status(500).json({ error: 'Error parsing CSV file: ' + error.message });
      });

  } catch (error) {
    console.error('CSV Import Error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generate CSV template for download (optional - system works without it!)
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

