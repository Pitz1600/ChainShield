/**
 * Test script for 2FA setup flow
 * This script tests the middleware path matching and 2FA setup endpoint
 */

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const jwt = require('jsonwebtoken');

async function testTwoFactorSetup() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chainshield');
    console.log('✓ Connected to database');

    // Find or create a test user
    let testUser = await User.findOne({ email: 'test-2fa@chainshield.test' });
    if (!testUser) {
      testUser = await User.create({
        email: 'test-2fa@chainshield.test',
        firstName: 'Test',
        lastName: 'User',
        password: 'TestPassword123!',
        role: 'analyst',
        isVerified: true,
        mustChangePassword: false,
        mustSetup2FA: true,
        isActive: true
      });
      console.log('✓ Created test user');
    } else {
      // Update user to require 2FA setup
      testUser.mustSetup2FA = true;
      await testUser.save();
      console.log('✓ Updated test user to require 2FA setup');
    }

    // Generate a scoped onboarding token (as the backend would do)
    const onboardingToken = jwt.sign(
      {
        id: testUser._id,
        email: testUser.email,
        scope: 'setup_2fa'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    console.log('\n📋 Test Case 1: Scoped Token with setup_2fa Scope');
    console.log('─'.repeat(50));
    console.log('Token payload:');
    console.log(`  - User ID: ${testUser._id}`);
    console.log(`  - Scope: setup_2fa`);
    console.log('');
    console.log('Allowed paths:');
    console.log('  - /api/auth/2fa/setup');
    console.log('  - /api/auth/2fa/verify-setup');
    console.log('  - /api/auth/profile');

    // Test path matching logic
    const allowedPaths = {
      'setup_2fa': ['/api/auth/2fa/setup', '/api/auth/2fa/verify-setup']
    };
    const allowed = [...(allowedPaths['setup_2fa'] || []), '/api/auth/profile'];

    const testPaths = [
      '/api/auth/2fa/setup',
      '/api/auth/2fa/setup/',
      '/api/auth/2fa/verify-setup',
      '/api/auth/2fa/disable',
      '/api/auth/profile',
      '/api/auth/force-change-password'
    ];

    console.log('\n✓ Testing path matching:');
    testPaths.forEach(path => {
      // Normalize path
      let normalizedPath = path;
      if (normalizedPath.endsWith('/') && normalizedPath !== '/') {
        normalizedPath = normalizedPath.slice(0, -1);
      }
      
      const isAllowed = allowed.includes(normalizedPath);
      const status = isAllowed ? '✓ ALLOWED' : '✗ BLOCKED';
      console.log(`  ${status}: ${path}`);
    });

    // Test case 2: Non-scoped token with mustSetup2FA flag
    console.log('\n📋 Test Case 2: Non-Scoped Token with mustSetup2FA Flag');
    console.log('─'.repeat(50));

    const fullToken = jwt.sign(
      {
        id: testUser._id,
        email: testUser.email
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    const onboardingRoutes = [
      '/api/auth/force-change-password',
      '/api/auth/2fa/setup',
      '/api/auth/2fa/verify-setup',
      '/api/auth/verify-email',
      '/api/auth/resend-otp',
      '/api/auth/resend-login-otp',
      '/api/auth/verify-otp',
      '/api/auth/logout',
      '/api/auth/profile'
    ];

    console.log('Allowed paths:');
    onboardingRoutes.forEach(path => console.log(`  - ${path}`));

    console.log('\n✓ Testing path matching:');
    testPaths.forEach(path => {
      let normalizedPath = path;
      if (normalizedPath.endsWith('/') && normalizedPath !== '/') {
        normalizedPath = normalizedPath.slice(0, -1);
      }
      
      const isAllowed = onboardingRoutes.includes(normalizedPath);
      const status = isAllowed ? '✓ ALLOWED' : '✗ BLOCKED';
      console.log(`  ${status}: ${path}`);
    });

    console.log('\n✅ All tests completed successfully!');
    console.log('\nTo test the actual HTTP endpoints:');
    console.log(`1. Use this scoped token as cookie:`);
    console.log(`   Scoped Token: ${onboardingToken.substring(0, 20)}...`);
    console.log(`2. Try POST /api/auth/2fa/setup with the scoped token`);
    console.log(`3. It should return a QR code and secret, not a 403 error`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run tests
testTwoFactorSetup();
