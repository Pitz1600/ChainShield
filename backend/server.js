const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const connectDB = require('./config/database');
const { apiLimiter } = require('./middleware/rateLimiter');
const { csrfProtection, issueCsrfToken } = require('./middleware/csrfMiddleware');
const { scheduleSecurityReviews } = require('./tasks/securityTasks');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create complaints uploads subdirectory
const complaintsDir = path.join(__dirname, 'uploads', 'complaints');
if (!fs.existsSync(complaintsDir)) {
  fs.mkdirSync(complaintsDir, { recursive: true });
}

// Connect to MongoDB
connectDB();

// ========================================
// SECURITY MIDDLEWARE
// ========================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS - Configure allowed origins
// CORS - Configure allowed origins
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    // SECURITY FIX (V5): In production, reject requests with no Origin header.
    // This prevents CORS bypass via Postman/curl in production environments.
    // In development, allow for local testing convenience.
    if (!origin) {
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(new Error('Origin header required'));
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-CSRF-Token'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize data to prevent NoSQL injection
app.use(mongoSanitize());

// XSS Protection - sanitize all string inputs in request body
const sanitizeInput = (obj) => {
  if (typeof obj === 'string') return xss(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeInput);
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return obj;
};

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeInput(req.body);
  }
  next();
});

// Apply general rate limiting to all routes
app.use('/api/', apiLimiter);

// Audit Logging
const auditLog = require('./middleware/auditLog');
app.use(auditLog);

// ========================================
// SECURITY ENHANCEMENTS
// ========================================

// Parse cookies (required for CSRF double-submit cookie pattern)
app.use(cookieParser());

// ========================================
// PASSPORT / OAUTH SETUP
// ========================================

// Configure Google OAuth 2.0 strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    scope: ['profile', 'email'],
  }, (accessToken, refreshToken, profile, done) => {
    // Attach profile to request — oauthController.googleCallback handles DB logic
    return done(null, profile);
  }));

  // Minimal session serialization (we use JWT cookies, not Passport sessions)
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  app.use(passport.initialize());
  console.log('🔑 Google OAuth: Configured');
} else {
  console.warn('⚠️  Google OAuth: GOOGLE_CLIENT_ID/SECRET not set — OAuth disabled');
}

// ========================================
// CSRF PROTECTION (Double-Submit Cookie)
// ========================================
app.use(csrfProtection);

// ========================================
// ROUTES
// ========================================

// CSRF token endpoint (public — must be before CSRF protection is applied to routes)
app.get('/api/auth/csrf-token', issueCsrfToken);

// OAuth routes (Passport redirects — no CSRF needed, handled by csrfMiddleware path exclusion)
const oauthController = require('./controllers/oauthController');
if (process.env.GOOGLE_CLIENT_ID) {
  app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
  );
  app.get('/api/auth/google/callback',
    (req, res, next) => {
      passport.authenticate('google', { session: false }, (err, profile) => {
        if (err || !profile) {
          // Clear any existing auth cookie so a stale session can't auto-login
          // after the user cancels or the OAuth flow fails.
          res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
          });
          return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=oauth_failed`);
        }
        req.oauthProfile = profile;
        next();
      })(req, res, next);
    },
    oauthController.googleCallback
  );
}

app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/evaluation', require('./routes/evaluation'));
app.use('/api/blockchain', require('./routes/blockchain'));
app.use('/api/datagovph', require('./routes/dataGovPh'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/feedbacks', require('./routes/feedbacks'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ChainShield API',
    version: '1.0.0',
    status: 'running'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🛡️  ChainShield Backend running on port ${PORT} `);
  console.log(`📧 Email Service: ${process.env.SMTP_HOST ? 'Configured' : 'Development mode (console logging)'} `);
  console.log(`🔒 Security: Helmet, CORS, Rate Limiting, Input Sanitization enabled`);

  // Initialize automated security tasks
  scheduleSecurityReviews();
});