const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('./models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://chainshield_admin:changeme_in_production@localhost:27017/chainshield?authSource=admin';

async function createAuditor() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const auditorEmail = process.argv[2] || 'auditor@chainshield.local';

        // Check if auditor already exists
        const existingAuditor = await User.findOne({ email: auditorEmail });

        if (existingAuditor) {
            console.log('⚠️  Auditor account already exists!');
            console.log(`Email: ${auditorEmail}`);
            console.log('Run reset-admin.js to reset credentials if needed.');
            return;
        }

        // SECURITY: Generate cryptographically random temporary password
        const tempPassword = crypto.randomBytes(12).toString('base64url');

        const auditor = new User({
            firstName: 'System',
            lastName: 'Auditor',
            email: auditorEmail,
            password: tempPassword,         // Pre-save hook will hash
            role: 'auditor',
            position: 'Blockchain Auditor',
            isVerified: true,
            isActive: true,
            mustChangePassword: true,       // FORCED on first login
            mustSetup2FA: true,             // FORCED before dashboard access
        });

        // Bypass security hook for authorized script
        auditor._allowAdminChange = true;

        await auditor.save();

        console.log('');
        console.log('✅ Auditor account created successfully!');
        console.log('═══════════════════════════════════════════════');
        console.log(`  Email:              ${auditorEmail}`);
        console.log(`  Temporary Password: ${tempPassword}`);
        console.log('═══════════════════════════════════════════════');
        console.log('');
        console.log('🔐 SECURITY REMINDERS:');
        console.log('• Change password immediately after first login');
        console.log('• Setup 2FA using an authenticator app');
        console.log('• This account is for blockchain transaction verification only');
        console.log('');
        console.log('📋 NEXT STEPS:');
        console.log('1. Login with the temporary credentials');
        console.log('2. Complete password change and 2FA setup');
        console.log('3. Access audit logs and transaction verification features');

    } catch (error) {
        console.error('❌ Error creating auditor account:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the function
createAuditor();