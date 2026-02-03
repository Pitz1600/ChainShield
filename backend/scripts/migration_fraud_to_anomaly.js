/**
 * Database Migration Script
 * Migrates existing alerts from fraudType to anomalyCategory
 * 
 * Run this script ONCE after deploying the new code:
 * node scripts/migration_fraud_to_anomaly.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';

async function migrate() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const alertsCollection = db.collection('alerts');

        // Check if migration is needed
        const sampleAlert = await alertsCollection.findOne({});
        if (!sampleAlert) {
            console.log('ℹ️  No alerts found in database. Migration not needed.');
            await mongoose.disconnect();
            return;
        }

        if (sampleAlert.anomalyCategory) {
            console.log('ℹ️  Migration already completed. anomalyCategory field exists.');
            await mongoose.disconnect();
            return;
        }

        console.log('\n📊 Starting migration...');

        // Rename fraudType → anomalyCategory
        const renameResult = await alertsCollection.updateMany(
            {},
            { $rename: { 'fraudType': 'anomalyCategory' } }
        );

        console.log(`✅ Renamed fraudType → anomalyCategory: ${renameResult.modifiedCount} documents`);

        // Update enum values to new terminology
        const mappings = {
            'Procurement Fraud': 'Procurement Anomaly',
            'Tax Evasion': 'Tax Anomaly',
            'Welfare Fraud': 'Welfare Anomaly',
            'Identity Fraud': 'Identity Anomaly',
            'Money Laundering': 'Money Laundering Anomaly'
        };

        let totalUpdated = 0;
        for (const [oldValue, newValue] of Object.entries(mappings)) {
            const updateResult = await alertsCollection.updateMany(
                { anomalyCategory: oldValue },
                { $set: { anomalyCategory: newValue } }
            );

            if (updateResult.modifiedCount > 0) {
                console.log(`  ✅ Updated "${oldValue}" → "${newValue}": ${updateResult.modifiedCount} documents`);
                totalUpdated += updateResult.modifiedCount;
            }
        }

        console.log(`\n✅ Migration complete! Total documents updated: ${totalUpdated}`);

        // Verify migration
        const verifyCount = await alertsCollection.countDocuments({ fraudType: { $exists: true } });
        if (verifyCount > 0) {
            console.warn(`⚠️  Warning: ${verifyCount} documents still have fraudType field`);
        } else {
            console.log('✅ Verification passed: No fraudType fields remain');
        }

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrate();
