const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const TrustedDevice = require('../models/TrustedDevice');
const BlacklistedToken = require('../models/BlacklistedToken');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { generateSecret, generateURI, verifySync } = require('otplib');
const QRCode = require('qrcode');
const emailService = require('../services/emailService');
const fs = require('fs');
const path = require('path');
const { normalizeEmail, findUserByEmail } = require('../utils/emailNormalization');

// Artificial delay to prevent timing attacks and user enumeration
const authDelay = () => new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 400));


// SECURITY: Generate 6-digit OTP using cryptographically secure random
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Generate a limited-scope token for onboarding steps
const generateOnboardingToken = (userId, scope) => {
  return jwt.sign({ id: userId, scope }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// ==========================================
// REGISTER
// ==========================================
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, birthday, email, password, role, position } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // SECURITY: Public registration is resident-only.
    if (role && role !== 'resident') {
      return res.status(403).json({
        error: 'Registration failed. Please check your input and try again.'
      });
    }

    const existingUser = await findUserByEmail(User, normalizedEmail);
    if (existingUser) {
      // SECURITY: Generic error to prevent user enumeration
      return res.status(400).json({ error: 'Registration failed. Please check your input and try again.' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = new User({
      firstName,
      lastName,
      birthday: birthday || null,
      email: normalizedEmail,
      password,
      role: 'resident',
      position,
      isVerified: false,
      otp,
      otpExpires,
      otpAttempts: 0,
      otpLastSentAt: new Date()
    });

    await user.save();

    // Send OTP via email
    try {
      await emailService.sendOTPEmail(normalizedEmail, otp, user.username);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // SECURITY: Send token as HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        birthday: user.birthday,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        twoFactorEnabled: false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
    await AuditLog.logAction({
      action: 'user_register',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { email: normalizedEmail }
    });
  } catch (error) {
    console.error('[Registration Error]', error.message);
    res.status(400).json({ error: 'Registration failed. Please check your input and try again.' });
  }
};

// ==========================================
// LOGIN (with TOTP 2FA + Device Detection)
// ==========================================
exports.login = async (req, res) => {
  try {
    const { email, password, totpCode, rememberDevice } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password || '').trim();

    const user = await findUserByEmail(User, normalizedEmail, '+twoFactorSecret +recoveryCodes +failedLoginAttempts +lockUntil');
    console.log(`[LOGIN-DEBUG] Attempt email=${normalizedEmail} found=${Boolean(user)}`);

    // SECURITY: Artificial delay for all auth responses
    await authDelay();

    // 1. Check if account is locked
    if (user && user.lockUntil && user.lockUntil > Date.now()) {
      const remainingMs = Math.max(user.lockUntil - Date.now(), 0);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      return res.status(401).json({
        error: 'Account is temporarily locked.',
        lockUntil: user.lockUntil,
        retryAfterSeconds: remainingSeconds
      });
    }

    // 2. Verify user existence and password
    // SECURITY: Use generic message for both non-existent user and wrong password
    if (!user || !(await user.comparePassword(normalizedPassword))) {
      if (user) {
        console.log(`[LOGIN-DEBUG] Password mismatch for ${normalizedEmail}`);
      }
      if (user) {
        user.failedLoginAttempts += 1;

        // Lock account after 5 failed attempts (OWASP Recommendation)
        if (user.failedLoginAttempts >= 5) {
          user.lockUntil = Date.now() + 5 * 60 * 1000; // Lock for 5 minutes
          await AuditLog.logAction({
            action: 'suspicious_login',
            userId: user._id,
            userRole: user.role,
            username: user.username,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: { reason: 'account_locked_brute_force', failedAttempts: user.failedLoginAttempts },
            isSuspicious: true,
            suspiciousReason: 'Account locked due to multiple failed login attempts'
          });
        }
        await user.save();

        await AuditLog.logAction({
          action: 'login_failed',
          userId: user._id,
          userRole: user.role,
          username: user.username,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: { reason: 'invalid_credentials' },
          isSuspicious: true,
          suspiciousReason: 'Failed login attempt'
        });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLoginProvider = 'local';
    await user.save();

    // Self-heal legacy admin-created operational accounts that were left unverified by older flows.
    if (
      !user.isVerified &&
      !user.mustChangePassword &&
      ['administrator', 'barangay_official', 'auditor'].includes(user.role)
    ) {
      user.isVerified = true;
      await user.save();
    }

    // CHECK 1: Must change password (new accounts)
    if (user.mustChangePassword) {
      const onboardingToken = generateOnboardingToken(user._id, 'change_password');

      // SECURITY: Must set cookie for onboarding flow persistence
      res.cookie('token', onboardingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 3600000, // 1 hour (matching onboarding token expiry)
        path: '/'
      });

      return res.json({
        mustChangePassword: true,
        token: onboardingToken,
        message: 'You must change your password before continuing.'
      });
    }

    // Detect Device Trust FIRST (to allow skipping 2FA)
    const userAgent = req.get('User-Agent') || 'unknown';
    const clientIp = req.ip;
    const isTrusted = await TrustedDevice.isDeviceTrusted(user._id, userAgent, clientIp);

    // CHECK 2: TOTP 2FA verification (if enabled AND device not trusted)
    if (user.twoFactorEnabled && !isTrusted) {
      if (!totpCode) {
        return res.json({
          totpRequired: true,
          userId: user._id,
          message: 'Please enter your authenticator code.'
        });
      }

      // Try TOTP code first
      const secret = user.getTwoFactorSecret();
      const isValidTotp = verifySync({ token: totpCode, secret }).valid;

      if (!isValidTotp) {
        // Try recovery code
        const isRecovery = await user.useRecoveryCode(totpCode);
        if (!isRecovery) {
          await AuditLog.logAction({
            action: 'login_failed',
            userId: user._id,
            userRole: user.role,
            username: user.username,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: { reason: 'invalid_totp' },
            isSuspicious: true,
            suspiciousReason: 'Failed 2FA attempt'
          });
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      }
    }

    // CHECK 3: OTP verification for non-2FA users
    // - auditor + barangay_official: OTP on every login
    // - all other non-2FA users: OTP only on untrusted device
    const requiresOtpEveryLogin = ['auditor', 'barangay_official'].includes(user.role);
    const shouldRequireEmailOtp = !user.twoFactorEnabled && !user.mustChangePassword && (requiresOtpEveryLogin || !isTrusted);

    if (shouldRequireEmailOtp) {
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      user.otp = otp;
      user.otpExpires = otpExpires;
      user.otpAttempts = 0;
      user.otpLastSentAt = new Date();
      await user.save();

      // Log removed for security

      try {
        await emailService.sendOTPEmail(user.email, otp, user.username);
      } catch (emailError) {
        console.error('Failed to send OTP email:', emailError);
      }

      await AuditLog.logAction({
        action: 'new_device_detected',
        userId: user._id,
        userRole: user.role,
        username: user.username,
        ipAddress: clientIp,
        userAgent: userAgent,
        details: { reason: 'new_device_or_ip' }
      });

      // SECURITY: Send token as HttpOnly cookie even for OTP step
      // This allows the user to call /resend-login-otp which is protected
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.json({
        otpRequired: true,
        newDeviceDetected: !isTrusted,
        userId: user._id,
        message: 'Verification code sent to your email.'
      });
    }

    // Log new device for users WITH 2FA (they already proved identity via TOTP)
    if (!isTrusted && user.twoFactorEnabled) {
      await AuditLog.logAction({
        action: 'new_device_detected',
        userId: user._id,
        userRole: user.role,
        username: user.username,
        ipAddress: clientIp,
        userAgent: userAgent,
        details: { reason: 'new_device_verified_via_totp' }
      });
    }

    // Remember device if requested
    if (rememberDevice) {
      await TrustedDevice.addTrustedDevice(user._id, userAgent, clientIp);
      await AuditLog.logAction({
        action: 'device_added',
        userId: user._id,
        userRole: user.role,
        username: user.username,
        ipAddress: clientIp,
        userAgent: userAgent,
        details: { label: 'Auto-trusted after verification' }
      });
    }

    // CHECK 4: Must setup 2FA (admin accounts, or flagged accounts)
    if (user.mustSetup2FA) {
      const onboardingToken = generateOnboardingToken(user._id, 'setup_2fa');

      res.cookie('token', onboardingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 3600000, // 1 hour
        path: '/'
      });

      return res.json({
        mustSetup2FA: true,
        token: onboardingToken,
        message: 'You must set up two-factor authentication before continuing.'
      });
    }

    // ALL CHECKS PASSED — issue full session token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // SECURITY: Send token as HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        birthday: user.birthday,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        position: user.position,
        createdAt: user.createdAt || user._id.getTimestamp(),
        updatedAt: user.updatedAt || user._id.getTimestamp()
      }
    });

    await AuditLog.logAction({
      action: 'user_login',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { email: normalizedEmail, twoFactor: user.twoFactorEnabled }
    });
  } catch (error) {
    console.error('[Login Error]', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// ==========================================
// VERIFY LOGIN OTP (Email OTP for new devices)
// ==========================================
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { userId, otp, rememberDevice } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.otpAttempts >= 10) {
      return res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
    }

    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // OTP valid — clear it
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();

    // Remember device if requested
    if (rememberDevice) {
      await TrustedDevice.addTrustedDevice(user._id, req.get('User-Agent'), req.ip);
    }

    // Check if must setup 2FA
    if (user.mustSetup2FA) {
      const onboardingToken = generateOnboardingToken(user._id, 'setup_2fa');

      res.cookie('token', onboardingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 3600000,
        path: '/'
      });

      return res.json({
        mustSetup2FA: true,
        token: onboardingToken,
        message: 'You must set up two-factor authentication before continuing.'
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // SECURITY: Send token as HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Relax for dev/localhost
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        birthday: user.birthday,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        position: user.position,
        createdAt: user.createdAt || user._id.getTimestamp(),
        updatedAt: user.updatedAt || user._id.getTimestamp()
      }
    });

    await AuditLog.logAction({
      action: 'user_login_otp',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { email: user.email, method: 'otp' }
    });
  } catch (error) {
    console.error('[Verify OTP Error]', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// ==========================================
// VERIFY MFA (For OAuth 2FA enforcement)
// ==========================================
exports.verifyMfa = async (req, res) => {
  try {
    const { totpCode, rememberDevice } = req.body;
    const user = await User.findById(req.user.id).select('+twoFactorSecret +recoveryCodes');

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Verify TOTP code
    const secret = user.getTwoFactorSecret();
    const isValidTotp = verifySync({ token: totpCode, secret }).valid;

    if (!isValidTotp) {
      // Try recovery code
      const isRecovery = await user.useRecoveryCode(totpCode);
      if (!isRecovery) {
        await AuditLog.logAction({
          action: 'login_failed',
          userId: user._id,
          userRole: user.role,
          username: user.username,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: { reason: 'invalid_mfa_totp', method: 'oauth_mfa' },
          isSuspicious: true,
          suspiciousReason: 'Failed MFA attempt after OAuth'
        });
        return res.status(401).json({ error: 'Invalid authenticator code.' });
      }
    }

    // Success — Clear MFA requirement and issue full token
    if (rememberDevice) {
      await TrustedDevice.addTrustedDevice(user._id, req.get('User-Agent'), req.ip);
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });

    await AuditLog.logAction({
      action: 'login_mfa_verified',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { method: 'mfa_verified' }
    });
  } catch (error) {
    console.error('[Verify MFA Error]', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// ==========================================
// FORCE PASSWORD CHANGE (First login)
// ==========================================
exports.forceChangePassword = async (req, res) => {
  try {
    const { newPassword, newEmail } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    if (!user.mustChangePassword) {
      return res.status(400).json({ error: 'Password change is not required.' });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.'
      });
    }

    // Update password
    user.password = newPassword;
    user.mustChangePassword = false;

    // Handle Email Update if provided
    // Administrators must change to a different email during onboarding.
    let emailChanged = false;
    if (user.role === 'administrator') {
      if (!newEmail || normalizeEmail(newEmail) === normalizeEmail(user.email)) {
        return res.status(400).json({
          error: 'Administrator onboarding requires changing to a new email address.'
        });
      }
    }

    if (newEmail && newEmail !== user.email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = normalizeEmail(newEmail);

      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }

      // Check if email already exists
      const existingUser = await findUserByEmail(User, normalizedEmail);
      if (existingUser && String(existingUser._id) !== String(user._id)) {
        return res.status(400).json({ error: 'Email is already in use.' });
      }

      user.email = normalizedEmail;
      user.isVerified = false; // Require verification for new email
      emailChanged = true;
    }

    // SECURITY: Bypass script-only check if this IS the user setting their own onboarding password
    if (user.role === 'administrator') {
      user._allowAdminChange = true;
    }

    await user.save();

    await AuditLog.logAction({
      action: 'forced_password_change',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { method: 'first_login', emailChanged }
    });

    // If email changed, trigger verification flow
    if (emailChanged) {
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();

      // Send verification email via SMTP
      try {
        await emailService.sendOTPEmail(user.email, otp, user.username);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Note: We still return success but maybe warn? 
        // For now, assume SMTP is configured as per requirement.
      }

      // Issue a standard token for verification flow (middleware handles isVerified check)
      const onboardingToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', onboardingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 3600000,
        path: '/'
      });

      return res.json({
        success: true,
        verifyEmail: true,
        email: user.email,
        message: 'Password changed. Please verify your new email address.'
      });
    }

    // For admin-provisioned accounts that were previously unverified, complete verification
    // once password onboarding is successfully finished without an email change.
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    // If must also setup 2FA, return that requirement
    if (user.mustSetup2FA) {
      const onboardingToken = generateOnboardingToken(user._id, 'setup_2fa');

      res.cookie('token', onboardingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 3600000,
        path: '/'
      });

      return res.json({
        success: true,
        mustSetup2FA: true,
      });
    }

    // ALL CHECKS PASSED — issue full session token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });



    // SECURITY: Send token as HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Relax for dev/localhost
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('[Force Change Password Error]', error);
    // Include specific error message for debugging (remove in high-security production)
    res.status(500).json({ error: `Something went wrong: ${error.message}` });
  }
};

// ==========================================
// 2FA SETUP (TOTP Authenticator App)
// ==========================================
exports.setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    // Allow setup only if 2FA is not already enabled
    // If a previous setup exists but wasn't verified, generate a new one
    if (user.twoFactorEnabled && user.recoveryCodes && user.recoveryCodes.length > 0) {
      return res.status(400).json({ error: '2FA is already enabled.' });
    }

    // Generate TOTP secret (this can be called multiple times during onboarding)
    const secret = generateSecret();
    user.setTwoFactorSecret(secret);
    await user.save();

    // Generate QR code
    const otpAuthUrl = generateURI({ secret, issuer: 'ChainShield', accountName: user.email });
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    res.json({
      success: true,
      secret: secret, // Show to user for manual entry
      qrCode: qrCodeDataUrl,
      message: 'Scan the QR code with your authenticator app, then verify with a code.'
    });
  } catch (error) {
    console.error('[Setup 2FA Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

exports.verifySetup2FA = async (req, res) => {
  try {
    console.log('[DEBUG] verifySetup2FA called');
    const { totpCode } = req.body;
    console.log('[DEBUG] totpCode received:', totpCode);

    const user = await User.findById(req.user.id).select('+twoFactorSecret +recoveryCodes');
    if (!user) {
      console.log('[DEBUG] User not found (401)');
      return res.status(401).json({ error: 'Authentication failed' });
    }

    if (user.twoFactorEnabled) {
      console.log('[DEBUG] 2FA already enabled (400)');
      return res.status(400).json({ error: '2FA is already enabled.' });
    }

    const secret = user.getTwoFactorSecret();
    if (!secret) {
      console.log('[DEBUG] No secret found (400)');
      return res.status(400).json({ error: 'Please initiate 2FA setup first.' });
    }

    // Verify the TOTP code
    const result = verifySync({ token: totpCode, secret });
    console.log('[DEBUG] verifySync result:', result);

    if (!result.valid) {
      console.log('[DEBUG] verification failed (400)');
      return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
    }

    // Enable 2FA and generate recovery codes
    user.twoFactorEnabled = true;
    user.mustSetup2FA = false;
    const recoveryCodes = await user.generateRecoveryCodes();
    await user.save();

    await AuditLog.logAction({
      action: 'totp_setup',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { method: 'authenticator_app' }
    });

    // Issue full token if this was part of onboarding
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // SECURITY: Send token as HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Relax for dev/localhost
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });

    res.json({
      success: true,
      recoveryCodes, // Show ONCE — user must save these
      message: '2FA enabled successfully. Save your recovery codes in a safe place.'
    });
  } catch (error) {
    console.error('[Verify 2FA Setup Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// ==========================================
// RESTART 2FA SETUP (resend QR code)
// ==========================================
exports.restart2FASetup = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate a fresh TOTP secret
    const { secret, qrCode } = await user.generateTOTPSecret();

    await AuditLog.logAction({
      action: 'totp_setup_restarted',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { method: 'restart_during_onboarding' }
    });

    res.json({
      success: true,
      secret,
      qrCode,
      message: 'QR code regenerated. Scan it again with your authenticator app.'
    });
  } catch (error) {
    console.error('[Restart 2FA Setup Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// ==========================================
// 2FA MANAGEMENT (Profile)
// ==========================================

exports.send2faOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    try {
      await emailService.sendOTPEmail(user.email, otp, user.username);
      res.json({ success: true, message: 'Verification code sent.' });
    } catch (emailError) {
      console.error('Failed to send 2FA management OTP email:', emailError);
      res.status(500).json({ error: 'Something went wrong' });
    }
  } catch (error) {
    console.error('[Send 2FA OTP Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

exports.disable2FA = async (req, res) => {
  try {
    const { password, otp } = req.body;
    const user = await User.findById(req.user.id).select('+twoFactorSecret +recoveryCodes');
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled.' });
    }

    // Admin accounts MUST have 2FA — cannot disable
    if (user.role === 'administrator') {
      return res.status(403).json({ error: 'Administrators cannot disable two-factor authentication.' });
    }

    // Verify password
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify Email OTP
    if (user.otpAttempts >= 10) {
      return res.status(429).json({ error: 'Too many failed attempts.' });
    }
    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ error: 'Verification code has expired.' });
    }
    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.recoveryCodes = [];
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();

    await AuditLog.logAction({
      action: 'totp_disabled',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { method: 'email_otp_verified' }
    });

    res.json({ success: true, message: '2FA has been disabled.' });
  } catch (error) {
    console.error('[Disable 2FA Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

exports.reset2FA = async (req, res) => {
  try {
    const { password, otp } = req.body;
    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    // Verify password
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify Email OTP
    if (user.otpAttempts >= 10) {
      return res.status(429).json({ error: 'Too many failed attempts.' });
    }
    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ error: 'Verification code has expired.' });
    }
    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // Clear existing 2FA and prep for setup
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.recoveryCodes = [];
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;

    // Generate NEW TOTP secret
    const secret = generateSecret();
    user.setTwoFactorSecret(secret);
    await user.save();

    // Generate QR code
    const otpAuthUrl = generateURI({ secret, issuer: 'ChainShield', accountName: user.email });
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    res.json({
      success: true,
      secret: secret,
      qrCode: qrCodeDataUrl,
      message: 'New 2FA initiated. Scan the QR code and verify to complete.'
    });

    await AuditLog.logAction({
      action: 'totp_reset_initiated',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { method: 'email_otp_verified' }
    });
  } catch (error) {
    console.error('[Reset 2FA Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// ==========================================
// SECURE EMAIL CHANGE (Password + 2FA + Dual OTP)
// ==========================================
exports.requestEmailChange = async (req, res) => {
  try {
    const { newEmail, password, totpCode } = req.body;
    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    // Verify password
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify TOTP if 2FA enabled
    if (user.twoFactorEnabled) {
      if (!totpCode) return res.status(400).json({ error: 'Authenticator code required.' });
      const secret = user.getTwoFactorSecret();
      if (!verifySync({ token: totpCode, secret }).valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Check if new email is available
    const normalizedNewEmail = normalizeEmail(newEmail);
    const existing = await findUserByEmail(User, normalizedNewEmail);
    if (existing && String(existing._id) !== String(user._id)) {
      // Generic error — don't reveal if email exists
      return res.status(400).json({ error: 'Request denied. Please try again.' });
    }

    // Generate OTPs for old and new email
    const otpOld = generateOTP();
    const otpNew = generateOTP();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.pendingEmail = normalizedNewEmail;
    user.emailChangeOtpOld = otpOld;
    user.emailChangeOtpNew = otpNew;
    user.emailChangeExpires = expires;
    await user.save();

    // Send OTPs
    try {
      await emailService.sendEmailChangeOTP(user.email, otpOld, true);
      await emailService.sendEmailChangeOTP(normalizedNewEmail, otpNew, false);
    } catch (emailError) {
      console.error('Failed to send email change OTPs:', emailError);
    }

    await AuditLog.logAction({
      action: 'email_change_attempt',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { oldEmail: user.email, newEmail: normalizedNewEmail }
    });

    res.json({
      success: true,
      message: 'Verification codes sent to both old and new email addresses.'
    });
  } catch (error) {
    console.error('[Email Change Request Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

exports.confirmEmailChange = async (req, res) => {
  try {
    const { otpOld, otpNew } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    if (!user.pendingEmail || !user.emailChangeExpires || user.emailChangeExpires < Date.now()) {
      return res.status(400).json({ error: 'Email change request has expired. Please start again.' });
    }

    if (user.emailChangeOtpOld !== otpOld || user.emailChangeOtpNew !== otpNew) {
      return res.status(400).json({ error: 'Invalid verification codes.' });
    }

    const oldEmail = user.email;
    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.emailChangeOtpOld = undefined;
    user.emailChangeOtpNew = undefined;
    user.emailChangeExpires = undefined;
    await user.save();

    await AuditLog.logAction({
      action: 'email_changed',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { oldEmail, newEmail: user.email }
    });

    res.json({ success: true, message: 'Email changed successfully.' });
  } catch (error) {
    console.error('[Email Change Confirm Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// ==========================================
// FORGOT PASSWORD (Secure Flow)
// ==========================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // ALWAYS return generic response — prevent enumeration
    const genericResponse = { success: true, message: 'If an account with that email exists, a reset link has been sent.' };

    const user = await findUserByEmail(User, normalizedEmail);
    if (!user) {
      // Log but return generic
      return res.json(genericResponse);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    try {
      await emailService.sendPasswordResetEmail(user.email, resetUrl, user.username);
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
    }

    await AuditLog.logAction({
      action: 'password_reset_requested',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {}
    });

    res.json(genericResponse);
  } catch (error) {
    console.error('[Forgot Password Error]', error.message);
    res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword, totpCode } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Invalid request.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+twoFactorSecret');

    if (!user) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    // If 2FA is enabled, require TOTP verification
    if (user.twoFactorEnabled) {
      if (!totpCode) {
        return res.json({
          totpRequired: true,
          message: 'Please enter your authenticator code to complete password reset.'
        });
      }
      const secret = user.getTwoFactorSecret();
      if (!verifySync({ token: totpCode, secret }).valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.'
      });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.mustChangePassword = false;
    await user.save();

    // Invalidate all existing sessions — blacklist approach: clear trusted devices
    await TrustedDevice.removeAllForUser(user._id);

    // Send notification email
    try {
      await emailService.sendPasswordChangedNotification(user.email, user.username);
    } catch (emailError) {
      console.error('Failed to send password changed notification:', emailError);
    }

    await AuditLog.logAction({
      action: 'password_reset_completed',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { allSessionsInvalidated: true }
    });

    res.json({ success: true, message: 'Password has been reset. Please log in with your new password.' });
  } catch (error) {
    console.error('[Reset Password Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// ==========================================
// EXISTING ENDPOINTS (preserved with security fixes)
// ==========================================

exports.verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    if (user.otpAttempts >= 10) {
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
    }

    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully' });

    await AuditLog.logAction({
      action: 'user_verified',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { method: 'otp' }
    });
  } catch (error) {
    console.error('[Verify Email Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Cooldown check (60 seconds)
    if (user.otpLastSentAt && (Date.now() - user.otpLastSentAt) < 60000) {
      const remaining = Math.ceil((60000 - (Date.now() - user.otpLastSentAt)) / 1000);
      return res.status(429).json({ error: `Please wait ${remaining} seconds before requesting a new code.` });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();

    try {
      await emailService.sendOTPEmail(user.email, otp, user.username);
      res.json({ success: true, message: 'Verification code resent.' });
    } catch (emailError) {
      console.error('Failed to resend OTP email:', emailError);
      res.status(500).json({ error: 'Something went wrong' });
    }
  } catch (error) {
    console.error('[Resend OTP Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// ==========================================
// RESEND LOGIN OTP (New Device)
// ==========================================
exports.resendLoginOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    // Cooldown check (60 seconds)
    if (user.otpLastSentAt && (Date.now() - user.otpLastSentAt) < 60000) {
      const remaining = Math.ceil((60000 - (Date.now() - user.otpLastSentAt)) / 1000);
      return res.status(429).json({ error: `Please wait ${remaining} seconds before requesting a new code.` });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();

    if (process.env.NODE_ENV === 'development') {
      console.log(`[OTP-DEBUG] Resent Login OTP for ${user.email}: ${otp}`);
    }

    try {
      await emailService.sendOTPEmail(user.email, otp, user.username);
      res.json({ success: true, message: 'Verification code resent.' });
    } catch (emailError) {
      console.error('Failed to resend Login OTP:', emailError);
      res.status(500).json({ error: 'Something went wrong' });
    }
  } catch (error) {
    console.error('[Resend Login OTP Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -otp -otpExpires -resetPasswordToken -resetPasswordExpires -emailChangeOtpOld -emailChangeOtpNew -pendingEmail +recoveryCodes');
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    const userObj = user.toObject();
    userObj.recoveryCodeCount = user.recoveryCodes ? user.recoveryCodes.length : 0;
    delete userObj.recoveryCodes; // Don't send hashed codes

    if (!userObj.createdAt) userObj.createdAt = user._id.getTimestamp();
    if (!userObj.updatedAt) userObj.updatedAt = user._id.getTimestamp();

    res.json(userObj);
  } catch (error) {
    console.error('[Get Profile Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

exports.sendProfileOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    try {
      await emailService.sendOTPEmail(user.email, otp, user.username);
      res.json({ success: true, message: 'Verification code sent.' });
    } catch (emailError) {
      console.error('Failed to send profile OTP email:', emailError);
      res.status(500).json({ error: 'Something went wrong' });
    }
  } catch (error) {
    console.error('[Send Profile OTP Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

exports.sendPasswordOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    try {
      await emailService.sendOTPEmail(user.email, otp, user.username);
      res.json({ success: true, message: 'Verification code sent.' });
    } catch (emailError) {
      console.error('Failed to send password OTP email:', emailError);
      res.status(500).json({ error: 'Something went wrong' });
    }
  } catch (error) {
    console.error('[Send Password OTP Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, birthday, otp } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ error: 'Authentication failed' });



  if (user.otpAttempts >= 10) {
    return res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
  }

    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // Update name fields if provided (email change uses separate flow now)
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (birthday !== undefined) user.birthday = birthday || null;

    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (error) {
    console.error('[Update Profile Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};



exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, otp } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ error: 'Authentication failed' });



  if (!(await user.comparePassword(currentPassword))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

    if (user.otpAttempts >= 10) {
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
    }

    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();

    await AuditLog.logAction({
      action: 'password_changed',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { method: 'authenticated_change' }
    });

    // Send notification
    try {
      await emailService.sendPasswordChangedNotification(user.email, user.username);
    } catch (emailError) {
      console.error('Failed to send password change notification:', emailError);
    }

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('[Change Password Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// ==========================================
// RECOVERY CODES MANAGEMENT
// ==========================================
exports.getRecoveryCodeCount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+recoveryCodes');
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    res.json({
      success: true,
      count: user.recoveryCodes ? user.recoveryCodes.length : 0
    });
  } catch (error) {
    console.error('[Get Recovery Code Count Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

exports.regenerateRecoveryCodes = async (req, res) => {
  try {
    const { password, otp } = req.body;
    const user = await User.findById(req.user.id).select('+password +otp +otpExpires +otpAttempts');
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    // Verify Password
    if (!password || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify Email OTP
    if (user.otpAttempts >= 10) {
      return res.status(429).json({ error: 'Too many failed attempts.' });
    }
    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ error: 'Verification code has expired.' });
    }

    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // Generate NEW recovery codes
    const codes = await user.generateRecoveryCodes();

    // Reset OTP status
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();

    await AuditLog.logAction({
      action: 'recovery_codes_regenerated',
      userId: user._id,
      userRole: user.role,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { method: 'authenticated_regeneration' }
    });

    res.json({
      success: true,
      codes, // Plaintext codes returned ONCE
      message: 'New recovery codes generated. Please save them securely.'
    });
  } catch (error) {
    console.error('[Regenerate Recovery Codes Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// ==========================================
// LOGOUT
// ==========================================
exports.logout = async (req, res) => {
  try {
    // Token is stored in an HttpOnly cookie — NOT in Authorization header
    const token = req.cookies?.token;

    // Always clear the cookie regardless of whether we have a token
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/'
    });

    if (token) {
      // SECURITY: Add to database blacklist so the token can't be reused
      // even if someone extracts it before the cookie is cleared
      try {
        await BlacklistedToken.create({ token });
      } catch (blacklistErr) {
        // Ignore duplicate key errors (token already blacklisted)
        if (blacklistErr.code !== 11000) throw blacklistErr;
      }

      if (req.user) {
        await User.findByIdAndUpdate(req.user._id, {
          $set: {
            lastLogoutAt: new Date(),
            lastSeenAt: new Date()
          }
        });

        await AuditLog.logAction({
          action: 'user_logout',
          userId: req.user._id,
          userRole: req.user.role,
          username: req.user.username,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: { method: 'token_blacklist_db' }
        });
      }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Logout Error]', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// ==========================================
// PROFILE PICTURE
// ==========================================
exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      // Remove uploaded file if user not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete old profile picture if it exists
    if (user.profilePicture) {
      const oldPath = path.join(__dirname, '..', user.profilePicture);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err) {
          console.error('Failed to delete old profile picture:', err);
        }
      }
    }

    // Save new path (normalized for URL, relative to uploads root)
    user.profilePicture = req.file.path.replace(/\\/g, '/').replace(/^uploads\//, '');
    await user.save();

    res.json({
      success: true,
      profilePicture: user.profilePicture,
      message: 'Profile picture updated'
    });

    await AuditLog.logAction({
      action: 'profile_picture_update',
      userId: user._id,
      userRole: user.role || 'resident',
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  } catch (error) {
    console.error('[Upload Profile Picture Error]', error.message);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
};

exports.deleteProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.profilePicture) {
      return res.status(404).json({ error: 'No profile picture to delete' });
    }

    const filePath = path.join(__dirname, '..', user.profilePicture);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    user.profilePicture = null;
    await user.save();

    res.json({ success: true, message: 'Profile picture deleted' });

    await AuditLog.logAction({
      action: 'profile_picture_delete',
      userId: user._id,
      userRole: user.role || 'resident',
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  } catch (error) {
    console.error('[Delete Profile Picture Error]', error.message);
    res.status(500).json({ error: 'Failed to delete profile picture' });
  }
};
