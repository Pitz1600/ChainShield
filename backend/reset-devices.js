const mongoose = require('mongoose');
const User = require('./models/User');
const TrustedDevice = require('./models/TrustedDevice');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';

async function resetDevices() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check for specific email arg, otherwise default to "ALL ADMINS" mode
        const targetEmail = process.argv[2];

        let targetUserIds = [];
        let successMessage = '';

        if (targetEmail) {
            // Target specific user
            console.log(`🔍 Looking for user: ${targetEmail}...`);
            const user = await User.findOne({ email: targetEmail });

            if (!user) {
                console.log(`❌ User not found: ${targetEmail}`);
                return;
            }

            targetUserIds.push(user._id);
            successMessage = `trusted device(s) for ${user.username || targetEmail}`;
        } else {
            // Target ALL administrators (default)
            console.log('🔍 Looking for ALL administrators...');
            const admins = await User.find({ role: 'administrator' });

            if (admins.length === 0) {
                console.log('⚠️  No administrators found.');
                return;
            }

            targetUserIds = admins.map(u => u._id);
            console.log(`ℹ️  Found ${admins.length} administrator(s): ${admins.map(a => a.email).join(', ')}`);
            successMessage = `trusted device(s) for ${admins.length} admin(s)`;
        }

        if (targetUserIds.length > 0) {
            const result = await TrustedDevice.deleteMany({ userId: { $in: targetUserIds } });
            console.log(`✅ Cleared ${result.deletedCount} ${successMessage}.`);
            console.log('ℹ️  Next login will require 2FA (if enabled) regardless of "Remember Me" history.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

resetDevices();
