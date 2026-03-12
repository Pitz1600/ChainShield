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

    const uploadedPath = req.file.path;
    const errors = [];
    const rawRows = [];
    const mappedTxs = [];
    const rowRefs = [];
    let totalRows = 0;
    let headers = null;
    let columnMappings = null;
    let responded = false;
    const mapper = new CSVColumnMapper();

    const cleanupUpload = async () => {
      try {
        await fs.promises.unlink(uploadedPath);
      } catch (_) {
        // Best-effort cleanup only
      }
    };

    const inputStream = fs.createReadStream(uploadedPath);

    inputStream
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
        columnMappings = mapper.detectColumns(headers);
        const confidence = mapper.getConfidence(columnMappings);
        console.log('[CSV] Detected columns', { headers, columnMappings, confidence: `${confidence}%` });

        const hasAmountColumn = Boolean(
          columnMappings.amount || columnMappings.debit_amount || columnMappings.credit_amount
        );
        const missingColumns = [];

        if (!columnMappings.agency) missingColumns.push('agency');
        if (!columnMappings.programName) missingColumns.push('program_name');
        if (!hasAmountColumn) missingColumns.push('amount (or debit_amount / credit_amount)');

        if (missingColumns.length > 0) {
          responded = true;
          res.status(400).json({
            error: 'CSV import failed due to missing required column(s).',
            message: `Missing column(s): ${missingColumns.join(', ')}.`,
            missingColumns,
            requiredColumns: ['agency', 'program_name', 'amount|debit_amount|credit_amount'],
            detectedColumns: headers,
            mappingConfidence: confidence
          });
          inputStream.destroy();
          cleanupUpload();
        }
      })
      .on('data', (data) => {
        if (responded) return;
        totalRows += 1;
        rawRows.length = totalRows;
        const rowNumber = totalRows + 1; // header row is 1

        try {
          const txData = mapper.mapRow(data, columnMappings);

          const validation = mapper.validate(txData);
          if (!validation.isValid) {
            errors.push({ row: rowNumber, error: validation.errors.join(', '), data });
            return;
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
            agency: txData.agency,
            programName: txData.programName || '',
            fromAddress: padAddress(txData.fromAddress),
            toAddress: padAddress(txData.toAddress),
            amount: parseFloat(txData.amount),
            beneficiaryType: txData.beneficiaryType || 'Individual',
            currency: txData.currency || 'PHP',
            timestamp: txData.timestamp ? new Date(txData.timestamp) : new Date(),
            description: txData.description || ''
          });
          rowRefs.push(rowNumber);
        } catch (err) {
          errors.push({ row: rowNumber, error: err.message, data });
        }
      })
      .on('end', async () => {
        if (responded) return;
        try {
          console.log(`\n🔍 Processing ${rawRows.length} transactions with multi-stage AI...`);

          const batchResult = await multiStagePipeline.processBatch(mappedTxs, {
            requireApproval: true,
            staged: true,
            batchSize: 250,
            useML: true
          });
          const results = batchResult.results.map((r, idx) => ({
            row: rowRefs[idx] || null,
            transactionId: r.transactionId,
            txHash: r.txHash,
            amount: mappedTxs[idx]?.amount,
            transactionType: mappedTxs[idx]?.transactionType,
            fromAddress: r.fromAddress || mappedTxs[idx]?.fromAddress,
            toAddress: r.toAddress || mappedTxs[idx]?.toAddress,
            riskScore: r.riskScore,
            riskLevel: r.riskLevel,
            anomalyCategory: r.anomalyCategory || 'Other',
            flagged: r.flagged,
            reasons: r.reasons,
            mlUsed: r.mlUsed,
            mlScore: r.mlScore,
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
        } finally {
          await cleanupUpload();
        }
      })
      .on('error', (error) => {
        console.error('CSV Parse Error:', error);
        res.status(500).json({ error: 'Error parsing CSV file: ' + error.message });
        cleanupUpload();
      });
  } catch (error) {
    console.error('CSV Import Error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.downloadTemplate = (req, res) => {
  const template = `record_id,post_date,agency,program_name,payer_name,payee_name,debit_amount,credit_amount,currency,description_raw
TX-001,2024-01-15,Barangay Pantal,Office Supplies,Barangay Pantal,Dagupan City Treasury,6407.55,0,PHP,Check Encashment - Office Supplies
TX-002,2024-01-16,DSWD,4Ps,DSWD,Juan Dela Cruz,0,5000,PHP,4Ps Cash Assistance - January 2024
TX-003,2024-01-17,Barangay Pantal,Infrastructure,Barangay Pantal,ABC Construction,15000,0,PHP,Procurement - Construction Materials
TX-004,2024-01-18,DOH,Medical Assistance,DOH,Maria Santos,0,3000,PHP,Medical Assistance - Emergency Fund
TX-005,2024-01-19,Barangay Pantal,Local Revenue,Barangay Pantal,City Treasury,8500,0,PHP,Tax Payment - Business Permit`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=transaction_import_template.csv');
  res.send(template);
};
