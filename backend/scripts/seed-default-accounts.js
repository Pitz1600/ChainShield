const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in the environment variables.');
  process.exit(1);
}

const accounts = [
  {
    firstName: 'System',
    lastName: 'Administrator',
    email: 'admin@chainshield.local',
    role: 'administrator',
    position: 'System Administrator',
    password: 'Password123!',
    isVerified: true,
    isActive: true,
    mustSetup2FA: true,
    mustChangePassword: true,
  },
  {
    firstName: 'Barangay',
    lastName: 'Official',
    email: 'official@chainshield.local',
    role: 'barangay_official',
    position: 'Barangay Captain',
    password: 'Password123!',
    isVerified: true,
    isActive: true,
    mustSetup2FA: true,
    mustChangePassword: true,
  },
  {
    firstName: 'System',
    lastName: 'Auditor',
    email: 'auditor@chainshield.local',
    role: 'auditor',
    position: 'Financial Auditor',
    password: 'Password123!',
    isVerified: true,
    isActive: true,
    mustSetup2FA: true,
    mustChangePassword: true,
  },
  {
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'resident@chainshield.local',
    role: 'resident',
    position: 'Resident Representative',
    password: 'Password123!',
    isVerified: true,
    isActive: true,
    mustSetup2FA: true,
    mustChangePassword: true,
  }
];

async function seedDefaultAccounts() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully.');

    // 1. Purge all existing documents from all collections to start completely clean
    console.log('\nPurging all existing database records...');
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      console.log(`  Wiping collection: ${key}...`);
      await collections[key].deleteMany({});
    }
    console.log('✅ Database purged.');

    // 2. Seed the default accounts
    console.log('\nSeeding default accounts...');
    for (const accountData of accounts) {
      const user = new User(accountData);

      // Bypass role change security guard for administrator
      if (accountData.role === 'administrator') {
        user._allowAdminChange = true;
      }

      await user.save();
      console.log(`  Created ${accountData.role} account (${accountData.email}).`);
    }

    console.log('\n==========================================================');
    console.log(' DATABASE PURGED & DEFAULT ACCOUNTS SEEDED SUCCESSFULLY');
    console.log('==========================================================');
    accounts.forEach(acc => {
      console.log(`Role:      ${acc.role}`);
      console.log(`Email:     ${acc.email}`);
      console.log(`Password:  Password123!`);
      console.log(`2FA Flow:  FORCED ON FIRST LOGIN`);
      console.log('----------------------------------------------------------');
    });
    console.log('Use these accounts to test the login, password change, and 2FA flow.');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB.');
  }
}

seedDefaultAccounts();
