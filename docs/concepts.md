# System Concepts

This page explains the high-level concepts referenced in the project documentation.

---

**AI Model Evaluation**

This covers how we measure ML model quality and safety. Typical evaluation artifacts include:
- Accuracy, precision, recall, F1, and AUC
- Confusion matrix and classification report
- Validation checks such as bias, stability, and adversarial robustness

It answers: "How good is the model, and can we trust its predictions?"

---

**Blockchain Smart Contract Functions Gas Cost**

Each smart contract function has a gas cost (execution fee). This section explains:
- Which contract functions are most expensive
- How gas usage changes across function variants
- Where optimization is needed to reduce fees

It answers: "How much does it cost to run each on-chain function?"

---

**System Models**

These are the backend data models (schemas) that define what the system stores and how it is structured. Examples include:
- User accounts and security data
- Transactions and risk signals
- Alerts, audit logs, and rate limits

It answers: "What data objects does the system use, and what fields do they contain?"

---

**Current System Report (2026-03-16)**

**Data Source**

MongoDB `chainshield` database (live containers).

**System Models (Document Counts)**

| Collection | Count |
| --- | --- |
| `users` | 3 |
| `alerts` | 32 |
| `inflationrates` | 0 |
| `trusteddevices` | 2 |
| `feedbacks` | 1 |
| `transactions` | 1000 |
| `complaints` | 0 |
| `blacklistedtokens` | 3 |
| `auditlogs` | 993 |
| `modelversions` | 0 |

**AI Model Evaluation (Live Data)**

No `modelversions` records found in MongoDB, so there are no stored evaluation metrics to report yet.

**Blockchain Smart Contract Functions Gas Cost (Live Data)**

Function-level gas usage is not stored in MongoDB. The only on-chain gas data available is per-transaction `gasUsed`.

| Metric | Value |
| --- | --- |
| `gasUsed` transactions | 32 |
| Min gas used | 21,820 |
| Max gas used | 21,844 |
| Avg gas used | 21,841.75 |
