const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('./models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';

async function createAdmin() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const adminEmail = 'admin@chainshield.local';

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('⚠️  Admin account already exists!');
            console.log(`Email: ${adminEmail}`);
            console.log('Run reset-admin.js to reset credentials.');
            return;
        }

        // SECURITY: Generate cryptographically random temporary password
        const tempPassword = crypto.randomBytes(12).toString('base64url');

        const admin = new User({
            firstName: 'System',
            lastName: 'Administrator',
            email: adminEmail,
            password: tempPassword,         // Pre-save hook will hash
            role: 'administrator',
            position: 'System Administrator',
            isVerified: true,
            isActive: true,
            mustChangePassword: true,       // FORCED on first login
            mustSetup2FA: true,             // FORCED before dashboard access
        });

        await admin.save();

        console.log('');
        console.log('✅ Admin account created successfully!');
        console.log('═══════════════════════════════════════════════');
        console.log(`  Email:              ${adminEmail}`);
        console.log(`  Temporary Password: ${tempPassword}`);
        console.log('═══════════════════════════════════════════════');
        console.log('');
        console.log('🔒 SECURITY REQUIREMENTS:');
        console.log('  1. Password MUST be changed on first login');
        console.log('  2. Authenticator app 2FA MUST be set up');
        console.log('  3. Copy the temporary password NOW — it will NOT be shown again');
        console.log('');

    } catch (error) {
        console.error('❌ Error creating admin account:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

createAdmin();
