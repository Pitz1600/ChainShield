# ChainShield Threat Model

## 1. STRIDE Threat Categorization
| Category | Threat | Mitigation |
|----------|--------|------------|
| Spoofing | Identity theft via credential leaking | 2FA, OAuth, Secure Passwords |
| Tampering | Modifying transaction history | Database Isolation, Hashed Audit Logs |
| Repudiation | Denying a suspicious transaction | Enhanced Audit Logging, Fixed Meta Data |
| Information Disclosure | Harvesting user emails | Generic login errors (Anti-enumeration) |
| Denial of Service | Brute force login flooding | Rate Limiting, IP Whitelisting |
| Elevation of Privilege | Gaining admin access | Role-Based Access Control (RBAC) |

## 2. OWASP Top 10 Mapping
- **A01:2021-Broken Access Control:** Mitigation via RBAC and strict middleware.
- **A03:2021-Injection:** Mitigation via MongoSanitize and Helmet.
- **A07:2021-Identification and Authentication Failures:** Mitigation via 2FA and secure session management.

## 3. Data Flow Security
- **Frontend ↔ Backend:** Secured via HTTPS (production) and secured cookies.
- **Backend ↔ Database:** Secured via TLS and IP whitelisting.
- **Backend ↔ ML Service:** Internal communication with validation.
