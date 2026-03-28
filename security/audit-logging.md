# Audit Logging & Integrity Guide

## 1. Goal
The audit logging system is designed to provide a secure, tamper-resistant record of all critical system activities for security auditing, forensic analysis, and compliance.

## 2. Tamper Protection (Hash Chaining)
ChainShield implements a "Hash-Chain" mechanism for audit logs.
- Each log entry contains a SHA-256 HMAC `hash`.
- The hash is generated from the entry's content PLUS the `hash` of the immediately preceding entry.
- **Why?** If an attacker modifies or deletes a bridge log entry, the entire chain after that point will become invalid, immediately alerting administrators to data tampering.

## 3. What is Logged
- **Authentication:** Success, failure (generic), lockouts, 2FA setup/disable.
- **Authorization:** Role changes, permission denials.
- **Security Events:** Suspicious login attempts, detected tampering, rate limit triggers.
- **System Events:** Database configuration changes, scheduled security reviews.

## 4. Retention & Storage
- **Retention:** Minimum 6 months for production systems.
- **Access Control:** Audit logs are **read-only**. No endpoints exist for deletion or modification of logs. Only the "Super Administrator" can view the audit dashboard.
- **Storage:** Stored in a dedicated MongoDB collection with restricted access.

## 5. Log Review Process
Audit logs should be reviewed during the **Monthly Security Review**. High-severity event logs (e.g., `suspicious_login`, `account_locked_brute_force`) should trigger immediate alerts.
