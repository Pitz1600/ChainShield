const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'admin@chainshield.gov.ph' });

        if (existingAdmin) {
            console.log('✅ Admin user already exists');
            console.log('   Email: admin@chainshield.gov.ph');
            process.exit(0);
        }

        // Generate secure random password
        const adminPassword = crypto.randomBytes(16).toString('hex');

        // Create admin user
        const admin = new User({
            username: 'System Administrator',
            email: 'admin@chainshield.gov.ph',
            password: adminPassword,
            role: 'administrator',
            isVerified: true, // Admin is pre-verified
            isActive: true
        });

        await admin.save();

        console.log('\n✅ Admin user created successfully!');
        console.log('================================================');
        console.log('   Email:    admin@chainshield.gov.ph');
        console.log('   Password: ' + adminPassword);
        console.log('================================================');
        console.log('\n⚠️  IMPORTANT: Save this password securely!');
        console.log('   This password will not be shown again.\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

seedAdmin();
