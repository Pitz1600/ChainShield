const mongoose = require('mongoose');
const User = require('./models/User'); // Import the actual User model
require('dotenv').config();

// Connect to MongoDB
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
            console.log('If you need to reset the password, please delete this user from the database manually.');
            return;
        }

        // Create admin user
        // Note: Password hashing is handled by the User model pre-save hook
        const admin = new User({
            firstName: 'System',
            lastName: 'Administrator',
            email: adminEmail,
            password: 'admin123', // Default temporary password
            role: 'administrator',
            position: 'System Administrator',
            isVerified: true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await admin.save();

        console.log('✅ Admin account created successfully!');
        console.log('---------------------------------------------------');
        console.log(`Email:    ${adminEmail}`);
        console.log(`Password: admin123`);
        console.log('---------------------------------------------------');
        console.log('⚠️  IMPORTANT: Change this password immediately after login!');

    } catch (error) {
        console.error('❌ Error creating admin account:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

createAdmin();
