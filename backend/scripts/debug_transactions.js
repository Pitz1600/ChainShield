const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Transaction = require('../models/Transaction');

async function debugTransactions() {
    try {
        console.log('Connecting to MongoDB...');
        let uri = process.env.MONGODB_URI;
        if (uri && uri.includes('@mongodb')) {
            uri = uri.replace('@mongodb', '@localhost');
        }
        await mongoose.connect(uri);
        console.log('Connected.');

        const transactions = await Transaction.find().sort({ timestamp: -1 }).limit(3);

        if (transactions.length === 0) {
            console.log('No transactions found in DB.');
        } else {
            console.log('Sample Transactions Structure:');
            transactions.forEach((t, i) => {
                const obj = t.toObject();
                console.log(`\n--- Transaction ${i + 1} ---`);
                console.log(`ID: ${obj.transactionId}`);
                console.log(`Payer (From): ${obj.fromAddress}`);
                console.log(`Payee (To): ${obj.toAddress}`);
                console.log(`Amount: ${obj.amount}`);
                console.log(`Debit: ${obj.debitAmount}`);
                console.log(`Credit: ${obj.creditAmount}`);
                console.log(`Description: ${obj.description}`);
                console.log(`Program: ${obj.programName}`);
                console.log(`Full JSON:`, JSON.stringify(obj, null, 2));
            });
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Debug error:', error);
        process.exit(1);
    }
}

debugTransactions();
