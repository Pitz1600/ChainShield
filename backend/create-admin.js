const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';
mongoose.connect(MONGODB_URI);

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: String,
    department: String,
    isVerified: Boolean,
    createdAt: Date,
    updatedAt: Date
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
    try {
        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'admin@chainshield.local' });

        if (existingAdmin) {
            console.log('⚠️  Admin account already exists!');
            console.log('Email: admin@chainshield.local');
            console.log('If you need to reset the password, delete this user first.');
            mongoose.connection.close();
            return;
        }

        // Generate secure random password
        const crypto = require('crypto');
        const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');

        // Hash the password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Create admin user
        const admin = new User({
            firstName: 'System',
            lastName: 'Administrator',
            birthday: null,
            email: 'admin@chainshield.local',
            password: hashedPassword,
            role: 'administrator',
            department: 'IT Department',
            isVerified: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await admin.save();

        console.log('✅ Admin account created successfully!');
        console.log('');
        console.log('📧 Email: admin@chainshield.local');
        console.log('🔒 Password: ' + adminPassword);
        console.log('');
        console.log('⚠️  IMPORTANT: Save this password securely! It is generated randomly.');
        console.log('');

    } catch (error) {
        console.error('❌ Error creating admin account:', error);
    } finally {
        mongoose.connection.close();
    }
}

createAdmin();
