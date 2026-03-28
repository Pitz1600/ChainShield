const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const Case = require('../models/Case');
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); // Assuming bcryptjs is used in User model
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chainshield';

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Transaction.deleteMany({});
        await Alert.deleteMany({});
        await Case.deleteMany({});
        console.log('Cleared existing data');

        // 1. Create Users
        const adminUser = await User.create({
            username: 'System Administrator',
            email: 'admin@gov.ph',
            password: 'password123',
            role: 'administrator',
            isActive: true,
            isVerified: true
        });

        // 2. Create Transactions
        const transactions = await Transaction.insertMany([
            {
                transactionId: 'PH-GOV-100001',
                txHash: '0xabc123...', // simplified
                transactionType: 'Procurement',
                programName: 'Infrastructure Build',
                agency: 'DPWH',
                fromAddress: '0xGovWallet1',
                toAddress: '0xContractor1',
                amount: 5000000,
                flagged: true,
                riskScore: 85,
                riskLevel: 'HIGH',
                fraudPatterns: [{ type: 'Unusual Amount', severity: 'High', description: 'Amount exceeds typical threshold' }]
            },
            {
                transactionId: 'PH-GOV-100002',
                txHash: '0xdef456...',
                transactionType: 'Social Welfare',
                programName: '4Ps',
                agency: 'DSWD',
                fromAddress: '0xGovWallet2',
                toAddress: '0xBeneficiary1',
                amount: 5000,
                flagged: false,
                riskScore: 10,
                riskLevel: 'LOW'
            },
            {
                transactionId: 'PH-GOV-100003',
                txHash: '0xghi789...',
                transactionType: 'Procurement',
                programName: 'Office Supplies',
                agency: 'DepEd',
                fromAddress: '0xGovWallet3',
                toAddress: '0xVendorShell',
                amount: 250000,
                flagged: true,
                riskScore: 92,
                riskLevel: 'CRITICAL',
                fraudPatterns: [{ type: 'Shell Wallet', severity: 'Critical', description: 'Recipient address has characteristics of a shell wallet' }]
            }
        ]);
        console.log('Created Transactions');

        // 3. Create Alerts & Cases for flagged transactions
        for (const tx of transactions) {
            if (tx.flagged) {
                const alert = await Alert.create({
                    transactionId: tx._id,
                    txHash: tx.txHash,
                    severity: tx.riskLevel.toLowerCase(),
                    fraudType: tx.transactionType === 'Procurement' ? 'Procurement Fraud' : 'Welfare Fraud',
                    riskScore: tx.riskScore,
                    reasons: tx.fraudPatterns.map(p => p.description),
                    status: 'open',
                    assignedTo: adminUser._id
                });

                await Case.create({
                    caseNumber: `CASE-${Date.now()}-${tx.transactionId}`,
                    title: `Investigate ${tx.transactionId} - ${tx.fraudPatterns[0].type}`,
                    description: `Automated case created for high-risk transaction ${tx.transactionId}. Detected pattern: ${tx.fraudPatterns[0].description}`,
                    transactions: [tx._id],
                    alerts: [alert._id],
                    status: 'open',
                    priority: tx.riskLevel === 'CRITICAL' ? 'critical' : 'high',
                    assignedTo: adminUser._id
                });
            }
        }
        console.log('Created Alerts and Cases');

        console.log('Seeding completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();
