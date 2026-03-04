const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Transaction = require('../models/Transaction');
const CSVColumnMapper = require('../utils/csvColumnMapper');

async function verifyImportLogic() {
    try {
        console.log('Connecting to MongoDB...');
        let uri = process.env.MONGODB_URI;
        if (uri && uri.includes('@mongodb')) {
            uri = uri.replace('@mongodb', '@localhost');
        }
        await mongoose.connect(uri);
        console.log('Connected.');

        const mapper = new CSVColumnMapper();

        // Test Case 1: Debit Transaction
        const sampleRow1 = {
            'record_id': 'TEST-DEBIT-001',
            'post_date': '2024-03-04',
            'payer_name': 'Barangay Pantal',
            'payee_name': 'Dagupan Office Supplies',
            'debit_amount': '5500.50',
            'credit_amount': '0',
            'description_raw': 'Purchase of printer ink and paper'
        };

        // Test Case 2: Credit Transaction
        const sampleRow2 = {
            'record_id': 'TEST-CREDIT-002',
            'post_date': '2024-03-04',
            'payer_name': 'DSWD',
            'payee_name': 'Juan Dela Cruz',
            'debit_amount': '0',
            'credit_amount': '3000',
            'description_raw': 'AICS Financial Assistance'
        };

        const headers = Object.keys(sampleRow1);
        const mappings = mapper.detectColumns(headers);

        console.log('\n--- Testing Mapping Logic ---');
        console.log('Detected Mappings:', mappings);

        const testRows = [sampleRow1, sampleRow2];

        for (const row of testRows) {
            console.log(`\nProcessing row: ${row.record_id}`);
            const txData = mapper.mapRow(row, mappings);
            console.log('Mapped Data:', txData);

            const transaction = new Transaction({
                transactionType: txData.transactionType || 'Other',
                agency: txData.agency || 'Test Agency',
                programName: txData.programName || '',
                fromAddress: txData.fromAddress || '0xSender',
                toAddress: txData.toAddress || '0xReceiver',
                amount: txData.amount || 0,
                debitAmount: txData.debitAmount || 0,
                creditAmount: txData.creditAmount || 0,
                description: txData.description || txData.programName || '',
                txHash: '0x' + Math.random().toString(16).substring(2, 42),
                blockchainTxId: '0x' + Math.random().toString(16).substring(2, 42)
            });

            await transaction.save();
            console.log(`✅ Saved Transaction ${transaction.transactionId} to DB`);

            // Fetch back to verify
            const saved = await Transaction.findById(transaction._id);
            console.log('Verification from DB:');
            console.log(`  ID: ${saved.transactionId}`);
            console.log(`  Debit: ${saved.debitAmount}`);
            console.log(`  Credit: ${saved.creditAmount}`);
            console.log(`  Description: ${saved.description}`);
        }

        await mongoose.connection.close();
        console.log('\nVerification complete. Connection closed.');
    } catch (error) {
        console.error('Verification error:', error);
        process.exit(1);
    }
}

verifyImportLogic();
