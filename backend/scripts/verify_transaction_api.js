const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
require('dotenv').config();

const MONGO_URI = (process.env.MONGODB_URI || 'mongodb://chainshield_admin:changeme_in_production@localhost:27017/chainshield?authSource=admin').replace('@mongodb:', '@localhost:');

async function verifyBackend() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Find a transaction
        const tx = await Transaction.findOne();
        if (!tx) {
            console.log('No transactions found to test.');
            process.exit(0);
        }

        console.log(`Testing with Transaction ID: ${tx.transactionId}`);

        // Mock a user for verification
        const admin = await User.findOne({ role: 'administrator' });
        if (!admin) {
            console.log('No admin user found to test.');
            process.exit(0);
        }

        // Test Verification Logic (simulate controller)
        tx.isVerified = true;
        tx.verifiedBy = admin._id;
        tx.verifiedAt = new Date();
        await tx.save();
        console.log('Transaction verified successfully in DB.');

        // Verify fields
        const updatedTx = await Transaction.findById(tx._id).populate('verifiedBy');
        if (updatedTx.isVerified && updatedTx.verifiedBy.email === admin.email) {
            console.log('Verification data integrity check: PASSED');
        } else {
            console.log('Verification data integrity check: FAILED');
        }

        // Test Un-verification
        updatedTx.isVerified = false;
        updatedTx.verifiedBy = null;
        updatedTx.verifiedAt = null;
        await updatedTx.save();
        console.log('Transaction un-verified successfully in DB.');

        const finalTx = await Transaction.findById(tx._id);
        if (!finalTx.isVerified && !finalTx.verifiedBy) {
            console.log('Un-verification data integrity check: PASSED');
        } else {
            console.log('Un-verification data integrity check: FAILED');
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verifyBackend();
