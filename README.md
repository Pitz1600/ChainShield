# 🛡️ ChainShield

**AI-Powered Audit & Transaction Monitoring for Barangays**

ChainShield is a next-generation integrity assurance system designed specifically for **Barangays** (local communities in the Philippines). It combines **Artificial Intelligence**, **Blockchain**, and **Graph Analytics** to ensure transparency, detect irregularities in fund usage, and empower citizens.

---

## 🎯 What It Does

ChainShield empowers barangays to modernize their operations and audit processes:

*   **🔍 Automated Audit**: Monitors barangay funds, SK budgets, and procurement for anomalies.
*   **📄 Document Verification**: Verifies the authenticity of Barangay Clearances, Indigency Certificates, and Permits.

---

## 👥 User Roles

| Role | Description | Key Permissions |
|---|---|---|
| 🏛️ **Barangay Official** | Captain, Kagawad, Secretary, Treasurer | Dashboard, complaint management, CSV import, analytics |
| 🛡️ **Administrator** | System management | Full access — user management, audit logs, system config |

> **Note**: Administrators must use local email/password + mandatory TOTP 2FA. Google SSO is not implemented in this snapshot. Officials and auditors may self-register, verify email, and wait for administrator approval.

---

## ✨ Key Features

### 🤖 **AI-Driven Anomaly Detection**
*   **Smart Auditing**: Flag budget usage that deviates from economic baselines (e.g., overpriced procurement).
*   **Graph Analysis**: Detect collusion networks and irregular fund flows.

### ⚖️ **Immutable Transparency**
*   **Blockchain Logging**: Critical transaction hashes are stored on-chain, preventing record tampering.
*   **Public Trust**: Assures constituents that records are permanent and auditable.

### 📝 **Digital Services**
*   **Secure Submission Form**: Streamlined form for submitting concerns with attachments.
*   **Status Tracking**: Automated updates on resolution status.

---

## 🏗️ Technical Architecture

```
┌──────────────┐
│  Official /  │
│   Official   │
└──────┬───────┘
       │ React (Vite)
       ▼
┌──────────────┐      ┌─────────────┐      ┌─────────────┐
│   Backend    │◄────►│  MongoDB    │      │    Redis    │
│  (Node.js)   │      │ (Database)  │      │ (Rate Limit)│
└──────┬───────┘      └─────────────┘      └─────────────┘
       │
       ├─────► 🤖 ML Service (Python/Flask)
       │       (Anomaly Detection — auth required)
       │
       ├─────► 🕸️ Graph Service (Python)
       │       (Network Analysis)
       │
       └─────► ⛓️ Blockchain (Ethereum)
               (Audit Trail)
```

---

## 🔒 Security Posture

| Control | Status | Details |
|---|---|---|
| Authentication | ✅ | JWT (HttpOnly cookie) + Email OTP + TOTP 2FA |
| OAuth / SSO | ❌ | Not implemented |
| Password Policy | ✅ | Min 8 chars, uppercase, lowercase, number, special char |
| RBAC | ✅ | 5 roles with explicit permission matrices |
| Rate Limiting | ✅ | Redis-backed, 5 login attempts/15min (OWASP) |
| CSRF Protection | ✅ | Double-submit cookie pattern (HMAC-signed) |
| Input Validation | ✅ | express-validator + mongoSanitize + XSS filter |
| File Encryption | ❌ | Upload files are stored as plaintext on disk |
| Audit Logging | ✅ | All actions logged with IP, user agent, timestamp |
| HTTPS / TLS | ✅ | Enforced in production via Nginx/reverse proxy |
| Bot Protection | ✅ | Server-verified Turnstile on login (including TOTP) and registration; production requires CAPTCHA |
| Container Security | ✅ | Non-root Docker user (nodeuser, UID 1001) |
| CI Security Audit | ✅ | GitHub Actions `npm audit` on every push |

See [`docs/SECURITY.md`](docs/SECURITY.md) for the full security documentation.
See [`docs/schema.md`](docs/schema.md) for the database schema overview.
See [`docs/concepts.md`](docs/concepts.md) for AI, blockchain gas cost, and system model definitions.

---

## 🚀 Quick Start

**See [docs/SETUP.md](docs/SETUP.md) for complete installation instructions.**

### Prerequisites
*   Docker & Docker Compose

### One-Command Start
```bash
cp .env.example .env
# Edit .env with your credentials
docker compose up
```
Access the application at **http://localhost:5173**

### Account provisioning
Officials and auditors require email verification and administrator approval. Admin-created accounts receive temporary credentials by email and must change their password and set up 2FA.

---

## 📄 License
Research Prototype - Academic Use Only

---

**ChainShield** - Modernizing Barangay Governance with Technology 🇵🇭

CAPTCHA deployment, development configuration, proxy trust, and manual QA are documented in [docs/CAPTCHA_SETUP.md](docs/CAPTCHA_SETUP.md).
