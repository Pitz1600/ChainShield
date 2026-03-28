# Database Hardening Guide (MongoDB)

To ensure the integrity and confidentiality of ChainShield data, the following database hardening measures are implemented and enforced.

## 1. Authentication & Authorization
- **Security Enabled:** MongoDB is configured with `security.authorization: enabled`.
- **RBAC:** Role-Based Access Control is enforced. The application user has only `readWrite` access to the `chainshield` database and cannot modify system collections.
- **Strong Passwords:** Minimum 24-character random passwords for all database users.

## 2. Network Security
- **IP Whitelisting:** MongoDB is configured to only bind to internal network interfaces (e.g., `127.0.0.1` or the Docker bridge IP).
- **Firewall:** Port `27017` is blocked from external access via system firewall (ufw/iptables).
- **No Default Ports:** (Optional) Production database runs on a non-standard port to avoid automated scanning.

## 3. Encryption
- **Encryption at Rest:** (Production) All data files are encrypted using AES-256.
- **Encryption in Transit:** All connections MUST use TLS/SSL with certificate validation. See `c:\Users\Yume\Documents\ChainShield\backend\config\database.js`.

## 4. Hardening Checklist
- [x] Disable remote root login.
- [x] Enable internal authentication.
- [x] Disable unused ports and services.
- [x] Enforce TLS for all nodes.
- [x] Implement database-level query limits and timeouts.

## 5. Maintenance
Database security configurations are reviewed monthly as part of the system-wide threat model review.
