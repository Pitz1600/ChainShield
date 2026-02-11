const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' }); // Ensure .env is loaded from current dir

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';
console.log('Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

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
}, { strict: false }); // Allow other fields

const User = mongoose.model('User', userSchema);

async function createTestAdmin() {
    try {
        const adminEmail = 'testadmin@chainshield.local';
        const adminUsername = 'Test Administrator';
        const adminPasswordRaw = 'admin123';

        // Check if admin already exists
        let admin = await User.findOne({ email: adminEmail });

        // Hash the password
        const hashedPassword = await bcrypt.hash(adminPasswordRaw, 10);

        if (admin) {
            console.log('Updating existing admin...');
            admin.password = hashedPassword;
            admin.role = 'administrator';
            admin.isActive = true;
            admin.otpAttempts = 0;
        } else {
            console.log('Creating new admin...');
            admin = new User({
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
        }

        await admin.save();
        console.log('✅ Test Admin account ready!');
        console.log('Email:', adminEmail);
        console.log('Password:', adminPasswordRaw);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

createTestAdmin();
