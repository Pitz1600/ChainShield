require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('./models/User');
const tempPassword = 'Aa1!' + require('crypto').randomBytes(24).toString('hex');

async function createAuditor() {
  if (process.env.NODE_ENV === 'production') throw new Error('Account scripts are disabled in production');
  try {
    const uri = process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected.');

    const email = 'auditor@example.com';
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Auditor account already exists:', email);
      existing.sessionVersion += 1;
      existing.role = 'auditor';
      existing.mustChangePassword = true;
      existing.mustSetup2FA = true;
      await existing.save();
      console.log('Role ensured as auditor and onboarding flags set.');
      process.exit(0);
    }

    const auditor = new User({
      firstName: 'Audit',
      lastName: 'Master',
      email: email,
      password: tempPassword,
      role: 'auditor',
      isVerified: true,
      mustChangePassword: true,
      mustSetup2FA: true
    });

    await auditor.save();
    console.log('Successfully created auditor account:');
    console.log('Email:', email);
    console.log('Temporary password:', tempPassword);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createAuditor();
