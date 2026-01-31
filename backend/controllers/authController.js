const User = require('../models/User');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');

// Helper to generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, role, position } = req.body;

    // SECURITY: Block admin registration via public endpoint
    if (role === 'admin' || role === 'administrator') {
      return res.status(403).json({
        error: 'Administrator accounts cannot be created through public registration. Please contact an existing administrator.'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = new User({
      username, // Full Name
      email,
      password,
      role,
      position,
      isVerified: false,
      otp,
      otpExpires,
      otpAttempts: 0, // Track failed OTP attempts
    });

    await user.save();

    // Send OTP via email
    try {
      await emailService.sendOTPEmail(email, otp, username);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      // Don't fail registration if email fails, but log it
      // In production, you might want to handle this differently
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        role: user.role,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact an administrator.' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        position: user.position,
        createdAt: user.createdAt || user._id.getTimestamp(),
        updatedAt: user.updatedAt || user._id.getTimestamp()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.user.id; // From middleware

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Check if OTP attempts exceeded
    if (user.otpAttempts >= 3) {
      return res.status(429).json({
        message: 'Too many failed attempts. Please request a new OTP.',
        action: 'resend_required'
      });
    }

    // Check OTP validity
    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ message: 'No OTP found. Please request a new one.' });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({
        message: 'OTP has expired. Please request a new one.',
        action: 'resend_required'
      });
    }

    if (user.otp !== otp) {
      // Increment failed attempts
      user.otpAttempts += 1;
      await user.save();

      const remainingAttempts = 3 - user.otpAttempts;
      return res.status(400).json({
        message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
        remainingAttempts
      });
    }

    // OTP is valid - verify user
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Generate new OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0; // Reset attempts on resend
    await user.save();

    // Send OTP via email
    try {
      await emailService.sendOTPEmail(user.email, otp, user.username);
      res.json({ success: true, message: 'OTP resent successfully. Please check your email.' });
    } catch (emailError) {
      console.error('Failed to resend OTP email:', emailError);
      res.status(500).json({ message: 'Failed to send email. Please try again later.' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -otp -otpExpires');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add fallback for createdAt/updatedAt using ObjectId timestamp
    const userObj = user.toObject();
    if (!userObj.createdAt) userObj.createdAt = user._id.getTimestamp();
    if (!userObj.updatedAt) userObj.updatedAt = user._id.getTimestamp();

    res.json(userObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
