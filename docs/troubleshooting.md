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

### "MongoDB Connection Error: connection refused"
- **Cause:** Database service is not running or the IP is not whitelisted.
- **Fix:** Ensure `mongod` is running and `bindIp` includes the server IP.

### "TLS handshake failed"
- **Cause:** SSL/TLS is enabled but certificates are missing or invalid.
- **Fix:** Check `MONGODB_TLS` environment variable and ensure `MONGODB_TLS_CA_FILE` points to a valid certificate if required.

## 3. Deployment & Operational Issues

### "Rate limit exceeded"
- **Cause:** Too many requests from a single IP.
- **Fix:** Wait for the rate limit window to reset (usually 15 minutes for security routes).

### Audit Log Tampering Detected
- **Cause:** Internal check found a mismatch in the log hash chain.
- **Urgent Fix:** Investigate for unauthorized database access or accidental direct modifications to the `AuditLog` collection.
