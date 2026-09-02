const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function createAdmin() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected.');

    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Admin account already exists:', email);
      existing.role = 'administrator';
      existing._allowAdminChange = true;
      existing.isVerified = true;
      existing.isActive = true;
      existing.mustChangePassword = true;
      existing.mustSetup2FA = true;
      await existing.save();
      console.log('Role ensured as administrator and onboarding flags set.');
      process.exit(0);
    }

    const admin = new User({
      firstName: 'Admin',
      lastName: 'Master',
      email: email,
      password: 'password123',
      role: 'administrator',
      isVerified: true,
      isActive: true,
      mustChangePassword: true,
      mustSetup2FA: true
    });

    // Bypass role change security guard for administrator
    admin._allowAdminChange = true;

    await admin.save();
    console.log('Successfully created admin account:');
    console.log('Email:', email);
    console.log('Password: password123');
    console.log('Role: administrator');
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin account:', err);
    process.exit(1);
  }
}

createAdmin();
