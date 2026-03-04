const multiStagePipeline = require('../services/multiStageFraudPipeline');
const CSVColumnMapper = require('../utils/csvColumnMapper');
const csv = require('csv-parser');
const fs = require('fs');

/**
 * Import transactions from ANY CSV file (no template required!)
 * Now routes all rows through the multi-stage AI batch pipeline.
 */
exports.importTransactions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const errors = [];
    const rawRows = [];
    const mappedTxs = [];
    let headers = null;
    let columnMappings = null;
    const mapper = new CSVColumnMapper();

    const inputStream = fs.createReadStream(req.file.path);

    inputStream
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
        columnMappings = mapper.detectColumns(headers);
        const confidence = mapper.getConfidence(columnMappings);
        console.log('[CSV] Detected columns', { headers, columnMappings, confidence: `${confidence}%` });
      })
      .on('data', (data) => rawRows.push(data))
      .on('end', async () => {
        try {
          console.log(`\n🔍 Processing ${rawRows.length} transactions with multi-stage AI...`);

          for (let i = 0; i < rawRows.length; i++) {
            try {
              const rawData = rawRows[i];
              const txData = mapper.mapRow(rawData, columnMappings);

              const validation = mapper.validate(txData);
              if (!validation.isValid) {
                errors.push({ row: i + 2, error: validation.errors.join(', '), data: rawData });
                continue;
              }

              const padAddress = (addr) => {
                if (!addr) return addr;
                if (addr.startsWith('0x') && addr.length === 42) return addr;
                if (!addr.startsWith('0x')) addr = '0x' + addr;
                return addr.padEnd(42, '0');
              };

              mappedTxs.push({
                transactionId: txData.transactionId,
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
            } catch (err) {
              console.error(`  Row ${i + 2}: Error -`, err.message);
              errors.push({ row: i + 2, error: err.message, data: rawRows[i] });
            }
          }

          const batchResult = await multiStagePipeline.processBatch(mappedTxs, { requireApproval: true, staged: true });
          const results = batchResult.results.map((r, idx) => ({
            row: idx + 2,
            transactionId: r.transactionId,
            txHash: r.txHash,
            amount: mappedTxs[idx]?.amount,
            transactionType: mappedTxs[idx]?.transactionType,
            riskScore: r.riskScore,
            riskLevel: r.riskLevel,
            flagged: r.flagged,
            reasons: r.reasons,
            graphRisk: r.graphRisk,
            propagatedRisk: r.propagatedRisk,
            blockchainTxId: r.chainReceipt?.transactionHash || null,
            blockNumber: r.chainReceipt?.blockNumber || null
          }));

          const flaggedCount = results.filter((r) => r.flagged).length;
          const highRiskCount = results.filter((r) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;
          const blockchainVerified = results.filter((r) => r.blockchainTxId).length;

          console.log(`\n✅ Import Complete:`);
          console.log(`  Total rows: ${rawRows.length}`);
          console.log(`  Processed: ${results.length}`);
          console.log(`  Failed: ${errors.length}`);
          console.log(`  Flagged: ${flaggedCount}`);
          console.log(`  High Risk: ${highRiskCount}`);
          console.log(`  On-chain: ${blockchainVerified}`);

          res.json({
            success: true,
            message: `Submitted ${rawRows.length} transactions for review (AI analyzed; awaiting official approval)`,
            imported: results.length,
            failed: errors.length,
            flaggedCount,
            highRiskCount,
            blockchainVerified,
            columnMappings,
            mappingConfidence: mapper.getConfidence(columnMappings),
            results,
            errors: errors.length > 0 ? errors : undefined
          });
        } catch (error) {
          console.error('Processing Error:', error);
          res.status(500).json({ error: error.message });
        }
      })
      .on('error', (error) => {
        console.error('CSV Parse Error:', error);
        res.status(500).json({ error: 'Error parsing CSV file: ' + error.message });
      });
  } catch (error) {
    console.error('CSV Import Error:', error);
    res.status(500).json({ error: error.message });
  }
};

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
