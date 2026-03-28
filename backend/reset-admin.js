const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('./models/User');
const TrustedDevice = require('./models/TrustedDevice'); // Add this
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';

async function resetAdmin() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const email = 'admin@chainshield.local';
        const user = await User.findOne({ email }).select('+twoFactorSecret +recoveryCodes');

        if (!user) {
            console.log('❌ Admin not found! Run create-admin.js first.');
            return;
        }

        // SECURITY: Generate new random temporary password
        const tempPassword = crypto.randomBytes(12).toString('base64url');

        user.password = tempPassword;
        user.mustChangePassword = true;
        user.mustSetup2FA = true;
        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        user.recoveryCodes = [];
        user.otp = undefined;
        user.otpExpires = undefined;
        user.otpAttempts = 0;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.isActive = true;
        // user.isVerified = true; // Maybe keep this as is? The new flow sets it to verified after email check? 
        // Actually, for admin reset, let's leave isVerified alone or set to true?
        // The new flow requires Email Change which sets it to false. 
        // So leaving it as is (or true) is fine until they change email.

        await user.save();

        // CLEAR TRUSTED DEVICES
        await TrustedDevice.deleteMany({ userId: user._id });
        console.log('✅ Cleared all trusted devices for admin.');

        console.log('');
        console.log('✅ Admin account reset successfully!');
        console.log('═══════════════════════════════════════════════');
        console.log(`  Email:              ${email}`);
        console.log(`  Temporary Password: ${tempPassword}`);
        console.log('═══════════════════════════════════════════════');
        console.log('');
        console.log('🔒 On next login:');
        console.log('  1. Password change will be required');
        console.log('  2. 2FA setup will be required');
        console.log('  3. All previous sessions are invalid');
        console.log('');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

resetAdmin();
