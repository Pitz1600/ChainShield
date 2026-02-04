const Transaction = require('../models/Transaction');
const riskAssessmentService = require('../services/fraudDetection');
const blockchainService = require('../services/blockchainService');
const CSVColumnMapper = require('../utils/csvColumnMapper');
const csv = require('csv-parser');
const fs = require('fs');

/**
 * Import transactions from ANY CSV file (no template required!)
 * Intelligently detects columns and runs Philippine risk assessment
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

              // Run PHILIPPINE RISK ASSESSMENT 🇵🇭
              console.log(`  Row ${i + 2}: Analyzing with Philippine risk patterns...`);
              const riskAnalysis = await riskAssessmentService.analyzeTransaction(transaction);

              // Update transaction with risk analysis
              transaction.riskScore = riskAnalysis.riskScore;
              transaction.riskLevel = riskAnalysis.riskLevel;
              transaction.flagged = riskAnalysis.requiresReview;
              transaction.blockchainTxId = riskAnalysis.blockchainTxId;
              transaction.blockNumber = riskAnalysis.blockchainBlockNumber;

              // Store network features
              if (riskAnalysis.networkFeatures) {
                transaction.networkFeatures = {
                  degree: riskAnalysis.networkFeatures.degree || 0,
                  inDegree: riskAnalysis.networkFeatures.inDegree || 0,
                  outDegree: riskAnalysis.networkFeatures.outDegree || 0,
                  clusteringCoefficient: riskAnalysis.networkFeatures.clusteringCoefficient || 0,
                  betweennessCentrality: riskAnalysis.networkFeatures.betweennessCentrality || 0
                };
              }

              // Store anomaly patterns
              if (riskAnalysis.anomalyPatterns && riskAnalysis.anomalyPatterns.length > 0) {
                transaction.fraudPatterns = riskAnalysis.anomalyPatterns.map(pattern => ({
                  type: pattern.type,
                  severity: pattern.severity,
                  description: pattern.description
                }));
              }

              await transaction.save();

              // Create alert if flagged
              if (riskAnalysis.requiresReview) {
                await riskAssessmentService.createAlert(transaction, riskAnalysis);
              }

              // Return enhanced results with Philippine risk assessment
              results.push({
                row: i + 2,
                transactionId: transaction.transactionId,
                amount: transaction.amount,
                transactionType: transaction.transactionType,
                riskScore: transaction.riskScore,
                riskLevel: transaction.riskLevel,
                flagged: transaction.flagged,
                anomalyCategory: riskAnalysis.anomalyCategory,
                reasons: riskAnalysis.reasons || [],
                // Philippine risk assessment specific
                anomalyPatterns: riskAnalysis.anomalyPatterns || [],
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
          console.log(`  Flagged for Review: ${flaggedCount}`);
          console.log(`  High Risk: ${highRiskCount}`);

          // Return enhanced results
          res.json({
            success: true,
            message: `Processed ${rawTransactions.length} transactions with Philippine risk assessment`,
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
 * Shows flexible format with debit/credit columns
 */
exports.downloadTemplate = (req, res) => {
  const template = `record_id,post_date,payer_name,payee_name,debit_amount,credit_amount,currency,description_raw
TX-001,2024-01-15,Barangay Pantal,Dagupan City Treasury,6407.55,0,PHP,Check Encashment - Office Supplies
TX-002,2024-01-16,DSWD,Juan Dela Cruz,0,5000,PHP,4Ps Cash Assistance - January 2024
TX-003,2024-01-17,Barangay Pantal,ABC Construction,15000,0,PHP,Procurement - Construction Materials
TX-004,2024-01-18,DOH,Maria Santos,0,3000,PHP,Medical Assistance - Emergency Fund
TX-005,2024-01-19,Barangay Pantal,City Treasury,8500,0,PHP,Tax Payment - Business Permit`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=transaction_import_template.csv');
  res.send(template);
};

