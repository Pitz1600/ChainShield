const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';
mongoose.connect(MONGODB_URI);

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: String,
    position: String,
    isVerified: Boolean,
    isActive: Boolean,
    otpAttempts: Number,
    createdAt: Date,
    updatedAt: Date
});

const User = mongoose.model('User', userSchema);

async function createCustomAdmin() {
    try {
        const adminEmail = 'admin2@chainshield.local';
        const adminUsername = 'Secondary Administrator';

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('⚠️  Admin account with this email already exists!');
            console.log('Email:', adminEmail);
            mongoose.connection.close();
            return;
        }

        // Generate secure random password
        const adminPassword = crypto.randomBytes(16).toString('hex');

        // Hash the password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Create admin user
        const admin = new User({
            username: adminUsername,
            email: adminEmail,
            password: hashedPassword,
            role: 'administrator',
            position: 'System Administrator',
            isVerified: true,
            isActive: true,
            otpAttempts: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await admin.save();

        console.log('✅ Admin account created successfully!');
        console.log('');
        console.log('📧 Email:', adminEmail);
        console.log('👤 Username:', adminUsername);
        console.log('🔒 Password:', adminPassword);
        console.log('');
        console.log('⚠️  IMPORTANT: Save this password securely! It is generated randomly.');
        console.log('');

    } catch (error) {
        console.error('❌ Error creating admin account:', error);
    } finally {
        mongoose.connection.close();
    }
}

createCustomAdmin();
