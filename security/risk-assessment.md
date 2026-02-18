# ChainShield Risk Assessment

## 1. Asset Identification
| Asset ID | Asset Name | Description | Sensitivity |
|----------|------------|-------------|-------------|
| A001 | User Credentials | Passwords, 2FA secrets, Recovery codes | Critical |
| A002 | Transaction Data | History of financial/crypto transactions | High |
| A003 | ML Models | Weights and training data for fraud detection | Medium |
| A004 | Audit Logs | Security and operational event logs | High |
| A005 | API Keys | External service keys (Google, Blockchain) | High |

## 2. Threat & Vulnerability Mapping
| Threat ID | Threat Source | Vulnerability | Impact | Mitigation |
|-----------|---------------|---------------|--------|------------|
| T001 | External Hacker | Weak/Stolen Credentials | High | Enforced 2FA, OAuth, Anti-enumeration |
| T002 | Bot / Brute Force | No rate limits | Medium | Login Rate Limiting (implemented) |
| T003 | MiTM Attack | Plaintext DB connections | High | Enforced TLS/SSL (planned) |
| T004 | Insider Threat | Access to raw DB | High | Database Hardening, Least-privilege (planned) |
| T005 | Data Tampering | Mutable audit logs | High | Tamper-resistant Hashed Logging (planned) |

## 3. Risk Matrix
| Likelihood \ Impact | Low | Medium | High |
|---------------------|-----|--------|------|
| **Frequent** | Medium | High | Critical |
| **Occasional** | Low | Medium | High |
| **Rare** | Low | Low | Medium |

## 4. Mitigation Plan
| Risk Level | Mitigation Strategy | Status |
|------------|---------------------|--------|
| Critical | Implement 2FA and OAuth secure flows | **COMPLETED** |
| High | Enforce database TLS and hardening | **IN-PROGRESS** |
| High | Implement tamper-resistant audit logs | **IN-PROGRESS** |
| Medium | Generic login error messages | **PLANNED** |

## 5. Monthly Update Policy
This risk assessment MUST be reviewed and updated on the **first Monday of every month** by the lead security engineer or system administrator. All changes must be recorded in the `update-log.md`.
