# 🛡️ ChainShield

**AI-Powered Audit & Transaction Monitoring for Barangays**

ChainShield is a next-generation integrity assurance system designed specifically for **Barangays** (local communities in the Philippines). It combines **Artificial Intelligence**, **Blockchain**, and **Graph Analytics** to ensure transparency, detect irregularities in fund usage, and empower citizens.

---

## 🎯 What It Does

ChainShield empowers barangays to modernize their operations and audit processes:

*   **🔍 Automated Audit**: Monitors barangay funds, SK budgets, and procurement for anomalies.
*   **📄 Document Verification**: Verifies the authenticity of Barangay Clearances, Indigency Certificates, and Permits.
*   **📊 Resident Profiling**: Manages resident data securely with role-based access.

---

## 👥 User Roles

| Role | Description | Key Permissions |
|---|---|---|
| 🏠 **Resident** | Citizens of the barangay | View own records, submit complaints, verify documents |
| 🏛️ **Barangay Official** | Captain, Kagawad, Secretary, Treasurer | Dashboard, complaint management, CSV import, analytics |
| 🔍 **Analyst** | Read-only fraud investigation | View fraud cases, analytics, verification results |
| 🕵️ **Investigator** | Active fraud investigation | All analyst permissions + respond to complaints, generate reports |
| 🛡️ **Administrator** | System management | Full access — user management, audit logs, system config |

> **Note**: Administrators must use local email/password + mandatory TOTP 2FA. Google SSO is available for Residents, Officials, Analysts, and Investigators.

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
│  Resident /  │
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
| OAuth / SSO | ✅ | Google OAuth 2.0 (residents/officials only) |
| Password Policy | ✅ | Min 8 chars, uppercase, lowercase, number, special char |
| RBAC | ✅ | 5 roles with explicit permission matrices |
| Rate Limiting | ✅ | Redis-backed, 5 login attempts/15min (OWASP) |
| CSRF Protection | ✅ | Double-submit cookie pattern (HMAC-signed) |
| Input Validation | ✅ | express-validator + mongoSanitize + XSS filter |
| File Encryption | ✅ | AES-256-CBC per-file encryption at rest |
| Audit Logging | ✅ | All actions logged with IP, user agent, timestamp |
| HTTPS / TLS | ✅ | Enforced in production via Nginx/reverse proxy |
| Container Security | ✅ | Non-root Docker user (nodeuser, UID 1001) |
| CI Security Audit | ✅ | GitHub Actions `npm audit` on every push |

See [`docs/SECURITY.md`](docs/SECURITY.md) for the full security documentation.

---

## 🚀 Quick Start

**See [docs/SETUP.md](docs/SETUP.md) for complete installation instructions.**

### Prerequisites
*   Docker & Docker Compose
*   (Optional) Google Cloud credentials for OAuth

### One-Command Start
```bash
cp .env.example .env
# Edit .env with your credentials
docker compose up
```
Access the application at **http://localhost:5173**

### Google OAuth Setup (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:5000/api/auth/google/callback` as an authorized redirect URI
4. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to your `.env`

---

## 📄 License
Research Prototype - Academic Use Only

---

**ChainShield** - Modernizing Barangay Governance with Technology 🇵🇭
