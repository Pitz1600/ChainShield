const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter Configurations for ChainShield
 * Protects against brute force and abuse
 */

// Login rate limiter - 5 attempts per 15 minutes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
        error: 'Too many login attempts. Please try again in 15 minutes.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
});

// OTP verification limiter - 3 attempts per 10 minutes
const otpVerificationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3, // 3 requests per window
    message: {
        error: 'Too many verification attempts. Please request a new OTP.',
        retryAfter: '10 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// OTP resend limiter - 3 resends per hour
const otpResendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per window
    message: {
        error: 'Too many OTP requests. Please wait before requesting another code.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Registration limiter - 3 registrations per hour per IP
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per window
    message: {
        error: 'Too many registration attempts. Please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// General API limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
        error: 'Too many requests. Please slow down.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict limiter for sensitive operations - 10 per hour
const strictLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per window
    message: {
        error: 'Rate limit exceeded for this operation.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    loginLimiter,
    otpVerificationLimiter,
    otpResendLimiter,
    registrationLimiter,
    apiLimiter,
    strictLimiter,
};
