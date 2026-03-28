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

async function createBarangayOfficial() {
    try {
        const officialEmail = 'official@chainshield.local';
        const officialUsername = 'Barangay Official';

        // Check if user already exists
        const existingOfficial = await User.findOne({ email: officialEmail });

        if (existingOfficial) {
            console.log('⚠️  User account with this email already exists!');
            console.log('Email:', officialEmail);
            mongoose.connection.close();
            return;
        }

        // Generate secure random password
        const officialPassword = crypto.randomBytes(8).toString('hex'); // 8 bytes = 16 chars

        // Hash the password
        const hashedPassword = await bcrypt.hash(officialPassword, 10);

        // Create user
        const official = new User({
            username: officialUsername,
            email: officialEmail,
            password: hashedPassword,
            role: 'barangay_official',
            position: 'Barangay Captain',
            isVerified: true,
            isActive: true,
            otpAttempts: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await official.save();

        console.log('✅ Barangay Official account created successfully!');
        console.log('');
        console.log('📧 Email:', officialEmail);
        console.log('👤 Username:', officialUsername);
        console.log('🔒 Password:', officialPassword);
        console.log('');
        console.log('⚠️  IMPORTANT: Save this password securely! It is generated randomly.');
        console.log('');

    } catch (error) {
        console.error('❌ Error creating official account:', error);
    } finally {
        mongoose.connection.close();
    }
}

createBarangayOfficial();
