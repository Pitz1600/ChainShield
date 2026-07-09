# Troubleshooting Guide

## 1. Authentication Issues

### "Invalid credentials" error
- **Cause:** Incorrect email, password, or TOTP code.
- **Security Feature:** This is a generic message. Check if your account is currently locked due to too many failed attempts (waits for 15 minutes).
- **Fix:** Verify credentials and ensure the system time on your authenticator device is synchronized.

### Session Expired / Redirect to Login
- **Cause:** JWT token has expired or the device is no longer trusted.
- **Fix:** Simply log in again. If the issue persists, clear browser cookies.

## 2. Database Connection Issues

### "MongoDB Connection Error" / Timeout
- **Cause:** The backend service cannot communicate with the MongoDB Atlas cluster. This is usually caused by:
  - An outdated or incorrect `MONGODB_URI` connection string in your `.env` file.
  - The local machine's IP address not being whitelisted in the MongoDB Atlas Network Access rules.
- **Fix:** 
  1. Log in to your [MongoDB Atlas Dashboard](https://cloud.mongodb.com).
  2. Navigate to **Network Access** and verify that your current IP address (or `0.0.0.0/0` for access from anywhere) is added and active.
  3. Ensure that your username and password are correctly replaced in the `MONGODB_URI` string inside the `.env` file.

### "TLS handshake failed" / Connection issues
- **Cause:** MongoDB Atlas enforces TLS connections by default, but local network security or proxies might interfere with the TLS handshake.
- **Fix:** Double check that your network is not blocking outgoing traffic on port `27017` or `27015`.

## 3. Deployment & Operational Issues

### "Rate limit exceeded"
- **Cause:** Too many requests from a single IP.
- **Fix:** Wait for the rate limit window to reset (usually 15 minutes for security routes).

### Audit Log Tampering Detected
- **Cause:** Internal check found a mismatch in the log hash chain.
- **Urgent Fix:** Investigate for unauthorized database access or accidental direct modifications to the `AuditLog` collection.

---

*Last Updated: 2026-07-09*
