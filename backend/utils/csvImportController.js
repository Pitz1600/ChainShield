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
            transactionId:   txData.transactionId,
            transactionType: txData.transactionType,
            agency:          txData.agency,
            programName:     txData.programName || '',
            fromAddress:     padAddress(txData.fromAddress),
            toAddress:       padAddress(txData.toAddress),
            amount:          parseFloat(txData.amount),
            beneficiaryType: txData.beneficiaryType || 'Individual',
            currency:        txData.currency || 'PHP',
            timestamp:       txData.timestamp ? new Date(txData.timestamp) : new Date(),
            description:     txData.description || '',
            // COA-specific fields
            budgetCategory:  txData.budgetCategory  || txData.agency || '',
            coaObjectCode:   txData.coaObjectCode   || '',
            eventPhase:      txData.eventPhase       || '',
            eventProgram:    txData.eventProgram     || txData.programName || '',
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
  // COA-compliant Barangay Pantal template (COA Circular 2015-010)
  const template = `record_id,post_date,barangay,city,province,payer_name,payee_name,debit_amount,credit_amount,currency,description_raw,budget_category,coa_object_code,transaction_type,event_phase,event
PNTL-0001,2024-04-05,Barangay Pantal,Dagupan City,Pangasinan,Barangay Captain Office - Pantal,Petron Station - Dagupan City,650.00,0,PHP,Gasoline - Barangay Vehicle Pantal (10L),Transportation & Gas,5-02-10-030,Other,pre,Barangay Pantal Fiesta 2024
PNTL-0002,2024-04-10,Barangay Pantal,Dagupan City,Pangasinan,Barangay Captain Office - Pantal,Dagupan Print & Design Center,1200.00,0,PHP,Tarpaulin Printing 10x4ft - Pantal Fiesta 2024,Decorations & Tarpaulin,5-02-03-010,Other,pre,Barangay Pantal Fiesta 2024
PNTL-0003,2024-05-14,Barangay Pantal,Dagupan City,Pangasinan,Barangay Captain Office - Pantal,Mang Juan Catering Services - Dagupan,25000.00,0,PHP,Catering Deposit - Pantal Fiesta May 15 2024,Food & Catering,5-02-01-010,Other,event,Barangay Pantal Fiesta 2024
PNTL-0004,2024-05-15,Barangay Pantal,Dagupan City,Pangasinan,Barangay Captain Office - Pantal,Barangay Fiesta Committee Members,500.00,0,PHP,Per Diem - Barangay Council Fiesta Day,Per Diem & Allowances,5-01-04-030,Other,event,Barangay Pantal Fiesta 2024
PNTL-0005,2024-04-08,Barangay Pantal,Dagupan City,Pangasinan,Barangay Captain Office - Pantal,Pantal Print & Copy Center,150.00,0,PHP,Photocopying - Fiesta Budget Documents 50 pages,Printing & Photocopying,5-02-03-010,Other,pre,Barangay Pantal Fiesta 2024`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=barangay_pantal_fiesta_template.csv');
  res.send(template);
};
