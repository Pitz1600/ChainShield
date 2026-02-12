const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/chainshield';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    birthday: Date,
    email: { type: String, unique: true },
    password: String,
    role: String,
    department: String,
    isVerified: Boolean,
    createdAt: Date,
    updatedAt: Date
});

const User = mongoose.model('User', userSchema);

async function recreateAdmin() {
    try {
        // Delete existing admin if present
        const existing = await User.findOne({ email: 'admin@chainshield.local' });
        if (existing) {
            await User.deleteOne({ _id: existing._id });
            console.log('🗑️  Deleted existing admin account (admin@chainshield.local)');
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
        console.log('⚠️  IMPORTANT: Save this password securely!');
        console.log('');

    } catch (error) {
        console.error('❌ Error recreating admin account:', error);
    } finally {
        mongoose.connection.close();
    }
}

recreateAdmin();
