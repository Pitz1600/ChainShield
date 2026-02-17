const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';

async function resetDatabase() {
    // SECURITY: Require explicit --confirm flag
    if (!process.argv.includes('--confirm')) {
        console.log('');
        console.log('⚠️  DATABASE RESET');
        console.log('═══════════════════════════════════════════════');
        console.log('This will:');
        console.log('  1. Drop ALL collections (users, audit logs, etc.)');
        console.log('  2. Recreate database indexes');
        console.log('  3. Create a fresh admin account with forced onboarding');
        console.log('');
        console.log('⛔ THIS CANNOT BE UNDONE.');
        console.log('');
        console.log('To proceed, run:');
        console.log('  node scripts/reset-database.js --confirm');
        console.log('');
        process.exit(0);
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        // Get all collection names
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        console.log(`\n📋 Found ${collectionNames.length} collections: ${collectionNames.join(', ')}`);

        // Drop all collections
        for (const name of collectionNames) {
            await db.dropCollection(name);
            console.log(`  🗑️  Dropped: ${name}`);
        }

        console.log('\n✅ All collections dropped.');

        // Force Mongoose to recreate models and their indexes
        console.log('\n📐 Recreating indexes...');

        // Re-register models to trigger index creation
        await User.createIndexes();
        await AuditLog.createIndexes();

        // Also create indexes for TrustedDevice
        const TrustedDevice = require('../models/TrustedDevice');
        await TrustedDevice.createIndexes();

        console.log('  ✅ User indexes created');
        console.log('  ✅ AuditLog indexes created');
        console.log('  ✅ TrustedDevice indexes created');

        // Create fresh admin account
        const tempPassword = crypto.randomBytes(12).toString('base64url');

        const admin = new User({
            firstName: 'System',
            lastName: 'Administrator',
            email: 'admin@chainshield.local',
            password: tempPassword,
            role: 'administrator',
            position: 'System Administrator',
            isVerified: true,
            isActive: true,
            mustChangePassword: true,
            mustSetup2FA: true,
        });

        await admin.save();

        // Log the reset event
        await AuditLog.create({
            action: 'db_reset',
            userId: admin._id,
            userRole: 'administrator',
            username: admin.username,
            details: {
                timestamp: new Date().toISOString(),
                collectionsDropped: collectionNames,
                performedBy: 'system_script'
            },
            ipAddress: '127.0.0.1',
            userAgent: 'reset-database-script'
        });

        console.log('');
        console.log('✅ Database reset complete!');
        console.log('═══════════════════════════════════════════════');
        console.log(`  Admin Email:        admin@chainshield.local`);
        console.log(`  Temporary Password: ${tempPassword}`);
        console.log('═══════════════════════════════════════════════');
        console.log('');
        console.log('🔒 On first login:');
        console.log('  1. Password change will be required');
        console.log('  2. Authenticator app 2FA must be set up');
        console.log('');

    } catch (error) {
        console.error('❌ Error during database reset:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

resetDatabase();
