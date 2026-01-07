const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'admin@chainshield.gov.ph' });

        if (existingAdmin) {
            console.log('✅ Admin user already exists');
            process.exit(0);
        }

        // Create admin user
        const admin = new User({
            username: 'admin',
            email: 'admin@chainshield.gov.ph',
            password: 'admin123',
            role: 'admin',
            department: 'Document Verification Unit',
            isActive: true
        });

        await admin.save();
        console.log('✅ Admin user created successfully!');
        console.log('   Email: admin@chainshield.gov.ph');
        console.log('   Password: admin123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

seedAdmin();
