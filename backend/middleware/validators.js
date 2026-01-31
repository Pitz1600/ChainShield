const { body, validationResult } = require('express-validator');

/**
 * Input Validation Middleware
 * Validates and sanitizes user inputs
 */

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

/**
 * Registration validation
 */
const validateRegistration = [
    body('username')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s\-\.]+$/).withMessage('Name can only contain letters, spaces, hyphens, and periods'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),

    body('role')
        .notEmpty().withMessage('Role is required')
        .isIn(['resident', 'barangay_official']).withMessage('Invalid role. Only resident and barangay_official are allowed for public registration'),

    body('position')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Position must not exceed 100 characters'),

    handleValidationErrors
];

/**
 * Login validation
 */
const validateLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required'),

    handleValidationErrors
];

/**
 * OTP verification validation
 */
const validateOTP = [
    body('otp')
        .trim()
        .notEmpty().withMessage('OTP is required')
        .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
        .isNumeric().withMessage('OTP must contain only numbers'),

    handleValidationErrors
];

/**
 * Email validation
 */
const validateEmail = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    handleValidationErrors
];

/**
 * Admin creation validation
 */
const validateAdminCreation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    body('username')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

    handleValidationErrors
];

module.exports = {
    validateRegistration,
    validateLogin,
    validateOTP,
    validateEmail,
    validateAdminCreation,
    handleValidationErrors,
};
