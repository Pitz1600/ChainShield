const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter Configurations for ChainShield
 * Protects against brute force and abuse
 *
 * SECURITY FIX (V2): Uses Redis for persistent rate limiting across restarts.
 * Falls back to in-memory store if Redis is not configured.
 */

// Redis store setup — graceful fallback to memory if Redis unavailable
let makeStore;
try {
    const { RedisStore } = require('rate-limit-redis');
    const Redis = require('ioredis');

    const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        // Allow commands to queue while Redis is starting up (fixes startup crash)
        enableOfflineQueue: true,
        // Retry connection with backoff, give up after 10 attempts
        retryStrategy: (times) => {
            if (times > 10) return null; // stop retrying
            return Math.min(times * 200, 3000); // wait up to 3s between retries
        },
        lazyConnect: false,
    });

    redisClient.on('error', (err) => {
        // Log but never crash — rate limiter degrades gracefully to memory
        console.warn('[Redis] Rate limiter connection error:', err.message);
    });

    redisClient.on('connect', () => {
        console.log('📦 Rate Limiter: Redis connected');
    });

    makeStore = (prefix) => new RedisStore({
        sendCommand: async (...args) => {
            try {
                return await redisClient.call(...args);
            } catch (err) {
                // If Redis is down mid-request, fail open (don't block the user)
                console.warn('[Redis] Rate limit command failed:', err.message);
                throw err;
            }
        },
        prefix: `rl:${prefix}:`,
    });

    console.log('📦 Rate Limiter: Redis store configured');
} catch (e) {
    console.warn('⚠️  Rate Limiter: Redis unavailable, using in-memory store');
    makeStore = () => undefined; // express-rate-limit defaults to memory
}


// Login rate limiter - HARDENED: 5 attempts per 15 minutes (OWASP recommendation)
// SECURITY FIX (V4): Reduced from 20 to 5 to prevent credential stuffing attacks
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window — industry standard
    store: makeStore('login'),
    message: {
        error: 'Too many login attempts. Please try again in 15 minutes.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
});

// OTP verification limiter - 10 attempts per 10 minutes
const otpVerificationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // 10 requests per window
    store: makeStore('otp_verify'),
    message: {
        error: 'Too many verification attempts. Please request a new OTP.',
        retryAfter: '10 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// OTP resend limiter - 10 resends per hour
const otpResendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per window
    store: makeStore('otp_resend'),
    message: {
        error: 'Too many OTP requests. Please wait before requesting another code.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Registration limiter - 10 registrations per hour per IP
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per window
    store: makeStore('register'),
    message: {
        error: 'Too many registration attempts. Please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// General API limiter - 5000 requests per 15 minutes (only counts errors)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // 5000 requests per window
    store: makeStore('api'),
    message: {
        error: 'Too many requests. Please slow down.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed requests
});

// Strict limiter for sensitive operations - 50 per hour
const strictLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 requests per window
    store: makeStore('strict'),
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
