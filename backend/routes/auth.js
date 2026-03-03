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
    validateOTP,
    validateTOTP
} = require('../middleware/validators');
const { uploadProfile } = require('../middleware/upload');

// ==========================================
// PUBLIC ROUTES (rate-limited)
// ==========================================
router.post('/register', registrationLimiter, validateRegistration, authController.register);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/verify-login-otp', loginLimiter, validateOTP, authController.verifyLoginOtp);
router.post('/verify-mfa', authMiddleware, otpVerificationLimiter, validateTOTP, authController.verifyMfa);
router.post('/resend-login-otp', authMiddleware, otpResendLimiter, authController.resendLoginOtp);

// Forgot / Reset Password (public, rate-limited)
router.post('/forgot-password', loginLimiter, authController.forgotPassword);
router.post('/reset-password', loginLimiter, authController.resetPassword);

// ==========================================
// ONBOARDING ROUTES (require auth token, limited scope)
// ==========================================
router.post('/force-change-password', authMiddleware, authController.forceChangePassword);

// ==========================================
// 2FA ROUTES (require auth)
// ==========================================
router.post('/2fa/send-otp', authMiddleware, otpResendLimiter, authController.send2faOtp);
router.post('/2fa/setup', authMiddleware, authController.setup2FA);
router.post('/2fa/verify-setup', authMiddleware, authController.verifySetup2FA);
router.post('/2fa/restart-setup', authMiddleware, authController.restart2FASetup);
router.post('/2fa/disable', authMiddleware, otpVerificationLimiter, authController.disable2FA);
router.post('/2fa/reset', authMiddleware, otpVerificationLimiter, authController.reset2FA);
router.get('/2fa/recovery-codes/count', authMiddleware, authController.getRecoveryCodeCount);
router.post('/2fa/recovery-codes/regenerate', authMiddleware, otpVerificationLimiter, authController.regenerateRecoveryCodes);

// ==========================================
// EMAIL CHANGE (require auth + multi-step verification)
// ==========================================
router.post('/email-change/request', authMiddleware, otpResendLimiter, authController.requestEmailChange);
router.post('/email-change/confirm', authMiddleware, otpVerificationLimiter, authController.confirmEmailChange);

// ==========================================
// PROTECTED ROUTES (require full auth)
// ==========================================
router.post('/verify-email', authMiddleware, otpVerificationLimiter, validateOTP, authController.verifyEmail);
router.post('/resend-otp', authMiddleware, otpResendLimiter, authController.resendOtp);
router.get('/profile', authMiddleware, authController.getProfile);

// Profile update with OTP
router.post('/send-profile-otp', authMiddleware, otpResendLimiter, authController.sendProfileOtp);
router.put('/update-profile', authMiddleware, otpVerificationLimiter, authController.updateProfile);

// Profile picture
router.put('/profile-picture', authMiddleware, uploadProfile.single('profilePicture'), authController.uploadProfilePicture);
router.delete('/profile-picture', authMiddleware, authController.deleteProfilePicture);

// Password change with OTP
router.post('/send-password-otp', authMiddleware, otpResendLimiter, authController.sendPasswordOtp);
router.post('/change-password', authMiddleware, otpVerificationLimiter, authController.changePassword);

// Logout - invalidates token
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;