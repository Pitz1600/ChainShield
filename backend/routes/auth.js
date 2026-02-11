const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const {
    loginLimiter,
    otpVerificationLimiter,
    otpResendLimiter,
    registrationLimiter
} = require('../middleware/rateLimiter');
const {
    validateRegistration,
    validateLogin,
    validateOTP
} = require('../middleware/validators');

// Public routes with rate limiting and validation
router.post('/register', registrationLimiter, validateRegistration, authController.register);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/verify-login-otp', loginLimiter, authController.verifyLoginOtp);

// Protected routes (require authentication)
router.post('/verify-email', authMiddleware, otpVerificationLimiter, validateOTP, authController.verifyEmail);
router.post('/resend-otp', authMiddleware, otpResendLimiter, authController.resendOtp);
router.get('/profile', authMiddleware, authController.getProfile);

// Profile update with OTP
router.post('/send-profile-otp', authMiddleware, otpResendLimiter, authController.sendProfileOtp);
router.put('/update-profile', authMiddleware, otpVerificationLimiter, authController.updateProfile);

// Password change with OTP
router.post('/send-password-otp', authMiddleware, otpResendLimiter, authController.sendPasswordOtp);
router.post('/change-password', authMiddleware, otpVerificationLimiter, authController.changePassword);

module.exports = router;