# CategoryCreate - Security Feature Documentation

This document outlines the security measures implemented in the application, specifically focusing on the requirements for secure data handling. Although named `CategoryCreate.md`, these practices are applied to the backend API, exemplified by the Complaint Submission flow.

## 1. Server-Side Input Validation

All inputs are validated on the server side to ensure they meet expected formats, types, and constraints before any processing occurs.

**Implementation:**
We use `express-validator` to define validation chains for incoming requests.

**Example (Complaint Submission):**
```javascript
const { body, validationResult } = require('express-validator');

// Validation Chain
const validateComplaint = [
    body('category').isIn(['Infrastructure', 'Public Services', ...]).withMessage('Invalid category'),
    body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 100 }),
    body('description').trim().notEmpty().withMessage('Description is required')
];

// Usage in Route
router.post('/', validateComplaint, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    // Proceed...
});
```

## 2. XSS Protection (Context-Aware Escaping)

Cross-Site Scripting (XSS) attacks are prevented by sanitizing user inputs before saving them to the database. We sanitize HTML/Script tags to ensure injected scripts are neutralized.

**Implementation:**
We use the `xss` library to sanitize string inputs.

**Example:**
```javascript
const xss = require('xss');

const sanitizedDescription = xss(req.body.description);
// Any <script> tags or malicious attributes are removed or escaped.
```

## 3. API Schema Validation

We enforce strict schemas for our API endpoints. Requests that include unexpected fields or missing required fields are rejected or sanitized.

**Implementation:**
- **Mongoose Schemas**: Define the rigid structure of our data models (e.g., `Complaint.js`).
- **Express-Validator**: Ensures the incoming HTTP request body matches the expected schema.

## 4. NoSQL Injection Protection

We protect against NoSQL injection attacks where attackers might inject MongoDB operators (like `$gt`, `$ne`) into input fields to manipulate queries.

**Implementation:**
We use `express-mongo-sanitize` middleware globally.

**Code:**
```javascript
// server.js
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());
```
This middleware searches for any keys in objects that begin with `$` or contain `.` and removes them.

## 5. CSRF Tokens Enabled

Cross-Site Request Forgery (CSRF) protection is enabled to prevent unauthorized commands from being transmitted from a user that the web application trusts.

**Implementation:**
We use `csurf` middleware with `cookie-parser`.

**How it works:**
1.  **Token Generation**: The server explicitly provides a route `GET /api/csrf-token` which generates a token.
2.  **Token Validation**: For every state-changing request (POST, PUT, DELETE), the client must send this token in the `CSRF-Token` header.
3.  **Cookie**: The token is verified against a secret stored in a securely signed cookie.

**Configuration:**
```javascript
// server.js
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: true }));

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```
