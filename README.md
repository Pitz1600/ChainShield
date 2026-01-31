# 🛡️ ChainShield: Barangay Integrity System

**AI-Powered Audit & Transaction Monitoring for Local Government Units**

ChainShield is a next-generation integrity assurance system designed specifically for **Barangays** and **Local Government Units (LGUs)**. It combines **Artificial Intelligence**, **Blockchain**, and **Graph Analytics** to ensure transparency, detect irregularities in fund usage, and empower citizens.

---

## 🎯 What It Does

ChainShield empowers barangays to modernize their operations and audit processes:

*   **🔍 Automated Audit**: Monitors barangay funds, SK budgets, and procurement for anomalies.
*   **📄 Document Verification**: Verifies the authenticity of Barangay Clearances, Indigency Certificates, and Permits.
*   **📊 Resident Profiling**: Manages resident data securely with role-based access.

---

## 👥 User Roles

### 🏠 **Resident**
*   **Digital Complaints**: Submit reports on infrastructure, peace & order, or other concerns.
*   **Document Verification**: Check if a document is authentic using its ID.
*   **Transaction History**: View their own history of fees and payments.
*   **Profile Management**: Manage personal contact details.

### 🏛️ **Barangay Official** (Captain, Kagawad, Secretary, Treasurer)
*   **Dashboard**: View real-time statistics on constituents and reports.
*   **Complaint Management**: Review, track, and update the status of resident complaints.
*   **Analytics**: Monitor trends in complaints and transaction volume.
*   **CSV Import**: Bulk upload transaction records for analysis.

### 🛡️ **Administrator**
*   **System Management**: Manage user roles, permissions, and system configurations.
*   **Fraud Detection**: Access advanced ML insights and network analysis graphs.
*   **Audit Logs**: detailed view of all system activities.

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
┌──────────────┐      ┌─────────────┐
│   Backend    │◄────►│  MongoDB    │
│  (Node.js)   │      │ (Database)  │
└──────┬───────┘      └─────────────┘
       │
       ├─────► 🤖 ML Service (Python/Flask)
       │       (Anomaly Detection)
       │
       ├─────► 🕸️ Graph Service (Python)
       │       (Network Analysis)
       │
       └─────► ⛓️ Blockchain (Ethereum)
               (Audit Trail)
```

---

## 🚀 Quick Start

**See [docs/SETUP.md](docs/SETUP.md) for complete installation instructions.**

### Prerequisites
*   Docker & Docker Compose

### One-Command Start
```bash
docker compose up
```
Access the application at **http://localhost:5173**

---

## 🔒 Security & Privacy

*   **Role-Based Access Control (RBAC)**: Strict separation between Residents, Officials, and Admins.
*   **Data Minimization**: Only essential data is stored; sensitive fields are encrypted.
*   **No PII on Blockchain**: Only cryptographic hashes are stored on the blockchain, protecting privacy.

---

## 📄 License
Research Prototype - Academic Use Only

---

**ChainShield** - Modernizing Barangay Governance with Technology 🇵🇭
