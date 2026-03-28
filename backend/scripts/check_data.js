const mongoose = require('mongoose');
require('dotenv').config();

async function checkData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield');
        console.log('✅ Connected to MongoDB\n');

        // Get Transaction model
        const Transaction = require('../models/Transaction');
        const Feedback = require('../models/Feedback');

        // Count total transactions
        const totalTransactions = await Transaction.countDocuments();
        console.log(`📊 Total Transactions: ${totalTransactions}`);

        // Get recent transactions
        const recentTransactions = await Transaction.find()
            .sort({ timestamp: -1 })
            .limit(10)
            .select('_id amount transactionType riskScore riskLevel timestamp');

        console.log('\n📋 Recent Transactions:');
        console.log('─'.repeat(80));
        recentTransactions.forEach((tx, index) => {
            console.log(`${index + 1}. ID: ${tx._id}`);
            console.log(`   Amount: ₱${tx.amount?.toLocaleString() || 'N/A'}`);
            console.log(`   Type: ${tx.transactionType || 'N/A'}`);
            console.log(`   Risk Score: ${tx.riskScore || 'N/A'} (${tx.riskLevel || 'N/A'})`);
            console.log(`   Date: ${tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A'}`);
            console.log('─'.repeat(80));
        });

        // Count pending feedback
        const pendingFeedback = await Feedback.countDocuments({ status: 'pending' });
        const approvedFeedback = await Feedback.countDocuments({ status: 'approved' });
        const rejectedFeedback = await Feedback.countDocuments({ status: 'rejected' });
        const totalFeedback = await Feedback.countDocuments();

        console.log('\n💬 Feedback Statistics:');
        console.log(`   Total Feedback: ${totalFeedback}`);
        console.log(`   Pending: ${pendingFeedback}`);
        console.log(`   Approved: ${approvedFeedback}`);
        console.log(`   Rejected: ${rejectedFeedback}`);

        if (pendingFeedback > 0) {
            console.log('\n📋 Pending Feedback Items:');
            const pending = await Feedback.find({ status: 'pending' })
                .populate('transactionId', 'amount transactionType')
                .populate('analystId', 'username')
                .limit(5);

            pending.forEach((fb, index) => {
                console.log(`\n${index + 1}. Feedback ID: ${fb._id}`);
                console.log(`   Transaction: ${fb.transactionId?._id || 'N/A'}`);
                console.log(`   Amount: ₱${fb.transactionId?.amount?.toLocaleString() || 'N/A'}`);
                console.log(`   AI Predicted Risk: ${fb.predictedRisk}`);
                console.log(`   Analyst Says: ${fb.actualFraud ? 'FRAUD' : 'NOT FRAUD'}`);
                console.log(`   Confidence: ${fb.confidence}/5`);
                console.log(`   Analyst: ${fb.analystId?.username || 'Unknown'}`);
                console.log(`   Notes: ${fb.notes || 'No notes'}`);
            });
        } else {
            console.log('\n⚠️  No pending feedback found!');
            console.log('   To see feedback in the admin panel, analysts need to submit feedback first.');
        }

        // Disconnect
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkData();
