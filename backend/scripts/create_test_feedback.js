const mongoose = require('mongoose');
require('dotenv').config();

async function createTestFeedback() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield');
        console.log('✅ Connected to MongoDB\n');

        const Transaction = require('../models/Transaction');
        const Feedback = require('../models/Feedback');
        const User = require('../models/User');

        // Get high-risk transactions
        const highRiskTransactions = await Transaction.find({ riskScore: { $gte: 60 } })
            .sort({ riskScore: -1 })
            .limit(5);

        if (highRiskTransactions.length === 0) {
            console.log('❌ No high-risk transactions found!');
            await mongoose.disconnect();
            return;
        }

        console.log(`📋 Found ${highRiskTransactions.length} high-risk transactions\n`);

        // Get or create a test analyst user
        let analyst = await User.findOne({ role: { $in: ['analyst', 'senior_analyst', 'investigator'] } });

        if (!analyst) {
            console.log('⚠️  No analyst user found. Creating test analyst...');
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('password123', 10);

            analyst = await User.create({
                username: 'Test Analyst',
                email: 'analyst@test.com',
                password: hashedPassword,
                role: 'analyst',
                isActive: true,
                isVerified: true
            });
            console.log('✅ Created test analyst user\n');
        }

        console.log(`👤 Using analyst: ${analyst.username} (${analyst.role})\n`);

        // Create feedback for each high-risk transaction
        const feedbackData = [
            {
                actualFraud: false,
                confidence: 4,
                notes: 'Verified with DBM - legitimate office supplies purchase. Amount is high but justified by bulk order.'
            },
            {
                actualFraud: true,
                confidence: 5,
                notes: 'Confirmed fraud - ghost supplier detected. No delivery receipts found.'
            },
            {
                actualFraud: false,
                confidence: 3,
                notes: 'Appears legitimate but needs further investigation. Vendor is registered but new.'
            },
            {
                actualFraud: true,
                confidence: 4,
                notes: 'Suspicious pattern - same vendor, inflated prices. Recommending audit.'
            },
            {
                actualFraud: false,
                confidence: 5,
                notes: 'False positive - emergency procurement during typhoon relief. Fully documented.'
            }
        ];

        console.log('Creating feedback items...\n');

        for (let i = 0; i < Math.min(highRiskTransactions.length, feedbackData.length); i++) {
            const tx = highRiskTransactions[i];
            const data = feedbackData[i];

            // Check if feedback already exists for this transaction
            const existingFeedback = await Feedback.findOne({ transactionId: tx._id });
            if (existingFeedback) {
                console.log(`⏭️  Skipping transaction ${tx._id} - feedback already exists`);
                continue;
            }

            const feedback = await Feedback.create({
                transactionId: tx._id,
                analystId: analyst._id,
                analystRole: analyst.role,
                predictedRisk: tx.riskScore,
                predictedCategory: tx.riskCategory || 'Other',
                actualFraud: data.actualFraud,
                actualCategory: data.actualFraud ? 'Procurement Anomaly' : 'Not Fraud',
                confidence: data.confidence,
                notes: data.notes,
                modelVersion: 'v1.0.0-static',
                features: {
                    amount: tx.amount,
                    transactionType: tx.transactionType,
                    riskScore: tx.riskScore,
                    timestamp: tx.timestamp
                },
                status: 'pending',
                reviewDate: new Date()
            });

            console.log(`✅ Created feedback #${i + 1}:`);
            console.log(`   Transaction: ${tx._id}`);
            console.log(`   Amount: ₱${tx.amount?.toLocaleString()}`);
            console.log(`   AI Predicted: ${tx.riskScore} (${tx.riskLevel})`);
            console.log(`   Analyst Says: ${data.actualFraud ? 'FRAUD ❌' : 'NOT FRAUD ✅'}`);
            console.log(`   Confidence: ${'⭐'.repeat(data.confidence)}`);
            console.log(`   Notes: "${data.notes}"`);
            console.log('');
        }

        // Count pending feedback
        const pendingCount = await Feedback.countDocuments({ status: 'pending' });
        console.log(`\n📊 Total Pending Feedback: ${pendingCount}`);
        console.log('\n✅ Test feedback created successfully!');
        console.log('\n🎯 Next steps:');
        console.log('   1. Go to Admin Panel');
        console.log('   2. Click "Feedback Review" tab');
        console.log('   3. You should see the pending feedback items');

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

createTestFeedback();
