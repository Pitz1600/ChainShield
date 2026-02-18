# Security & Compliance Guide

## 1. Authentication Security
ChainShield enforces a multi-layered authentication strategy to prevent unauthorized access.

### Anti-Enumeration Measures
- **Generic Login Errors:** All failed authentication attempts return the same generic "Invalid credentials" message to prevent user/email harvesting.
- **Artificial Delay:** All authentication routes (`/login`, `/register`, etc.) incorporate an artificial response delay of **500-900ms** to mitigate timing attacks.
- **Account Lockout:** Accounts are temporarily locked for **15 minutes** after **5 consecutive failed attempts**.

### Two-Factor Authentication (2FA)
- TOTP (Time-based One-Time Password) is enforced for all administrative users.
- Device trust detection allows users to "remember" secure devices for 30 days.

## 2. Information Protection
- **Data at Rest:** PII and sensitive fields are encrypted at the database level where applicable.
- **Data in Transit:** Enforced TLS/SSL for all client-server and backend-database connections.
- **CSRF Protection:** Double-Submit Cookie pattern enforced on all mutating requests.

## 3. Threat Modeling & Risk Assessment
- Living threat models and risk assessments are maintained in the `/security` directory.
- Automated monthly security reviews are triggered via system cron jobs.

## 4. Input Sanitization
- All raw inputs are sanitized via `XSS` and `mongoSanitize` middleware to prevent Injection and Cross-Site Scripting attacks.
