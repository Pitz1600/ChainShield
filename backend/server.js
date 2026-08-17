const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const cookieParser = require('cookie-parser');
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

// Create profiles uploads subdirectory
const profilesDir = path.join(__dirname, 'uploads', 'profiles');
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
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
      imgSrc: ["'self'", "data:", "https:", "http://localhost:5000", "http://127.0.0.1:5000"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
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

// Static files middleware for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Audit Logging
const auditLog = require('./middleware/auditLog');
app.use(auditLog);

// ========================================
// SECURITY ENHANCEMENTS
// ========================================

// Parse cookies (required for CSRF double-submit cookie pattern)
app.use(cookieParser());

// ========================================
// CSRF PROTECTION (Double-Submit Cookie)
// ========================================
app.use(csrfProtection);

// ========================================
// ROUTES
// ========================================

// CSRF token endpoint (public — must be before CSRF protection is applied to routes)
app.get('/api/auth/csrf-token', issueCsrfToken);

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