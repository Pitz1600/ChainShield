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

        const hasAgencyCol  = Boolean(columnMappings.agency  || columnMappings.programName);
        const hasProgramCol = Boolean(columnMappings.programName || columnMappings.agency);

        if (!hasAgencyCol)  missingColumns.push('agency');
        if (!hasProgramCol) missingColumns.push('program_name');
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

          const finalTxId = txData.transactionId || `PH-GOV-${Math.floor(Math.random() * 1000000000).toString(16)}-${Date.now()}`;

          mappedTxs.push({
            transactionId:   finalTxId,
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
            lineItems:       mapper.extractLineItems(data),
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
  const headers = [
    'record_id','post_date','agency','program_name','payer_name','payee_name',
    'debit_amount','credit_amount','currency','description_raw','transaction_type',
    'item1_name','item1_unit','item1_quantity','item1_unit_price','item1_total_price','item1_supplier','item1_notes',
    'item2_name','item2_unit','item2_quantity','item2_unit_price','item2_total_price','item2_supplier','item2_notes',
    'item3_name','item3_unit','item3_quantity','item3_unit_price','item3_total_price','item3_supplier','item3_notes',
    'item4_name','item4_unit','item4_quantity','item4_unit_price','item4_total_price','item4_supplier','item4_notes',
    'item5_name','item5_unit','item5_quantity','item5_unit_price','item5_total_price','item5_supplier','item5_notes',
  ].join(',');

  const rows = [
    headers,
    // Row 1 — procurement with 3 items
    'TX-001,2024-01-15,Barangay Pantal,Infrastructure & Public Works,Barangay Pantal,Santos Construction Corp.,38500,0,PHP,Road Repair - Sitio Banaoang Pantal,Procurement,' +
    'Portland Cement (bag),bag,50,285,14250,Reyes Aggregates & Hardware,,' +
    'Gravel (cu.m),cu.m,8,1450,11600,Reyes Aggregates & Hardware,,' +
    'Labor - Skilled (day),day,6,800,4800,Construction Workers Cooperative,,' +
    ',,,,,,' +
    ',,,,,,',
    // Row 2 — social welfare with 2 items
    'TX-002,2024-01-16,Barangay Pantal,Health & Nutrition Program,Barangay Pantal,Mercury Drug Dagupan,12400,0,PHP,Medicines for BHC - Antibiotics & Pain Relievers,Social Welfare,' +
    'Paracetamol 500mg (box),box,40,95,3800,Mercury Drug Dagupan,,' +
    'Amoxicillin 500mg (box),box,25,120,3000,Mercury Drug Dagupan,,' +
    'Alcohol 70% (L),L,28,85,2380,Pangasinan Medical Supply,,' +
    ',,,,,,' +
    ',,,,,,',
    // Row 3 — small expense (transportation)
    'TX-003,2024-01-17,Barangay Pantal,General Fund Operations,Barangay Pantal,Petron Dagupan,1250,0,PHP,Gasoline - Barangay Vehicle Pantal (10L),Other,' +
    'Gasoline (L),L,10,125,1250,Petron Dagupan,,' +
    ',,,,,,' +
    ',,,,,,' +
    ',,,,,,' +
    ',,,,,,',
    // Row 4 — grant
    'TX-004,2024-01-18,Barangay Pantal,Agriculture & Livelihood Program,Barangay Pantal,DA Region I,18500,0,PHP,Palay Seed Distribution - Cropping Season,Grant,' +
    'Palay Seeds (kg),kg,150,65,9750,DA Region I,,' +
    'Fertilizer 50kg (bag),bag,4,1200,4800,Seed & Fertilizer Supplier,,' +
    'Sprayer (unit),unit,1,2800,2800,Pangasinan Agri Supply Center,,' +
    ',,,,,,' +
    ',,,,,,',
    // Row 5 — revenue / credit side
    'TX-005,2024-01-19,Barangay Pantal,Business Permit & Licensing,Business Permit Applicant,Barangay Pantal,0,2500,PHP,Barangay Clearance - Business Permit 2024,Revenue,' +
    'Business Permit Fee,permit,1,2500,2500,Business Permit Applicant,,' +
    ',,,,,,' +
    ',,,,,,' +
    ',,,,,,' +
    ',,,,,,',
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=chainshield_import_template.csv');
  res.send(rows.join('\n'));
};
