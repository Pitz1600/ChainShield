# ChainShield

ChainShield is a barangay transaction monitoring and audit research prototype. It combines a React interface, a Node.js API, Python risk analysis services, and an Ethereum smart contract to help officials and auditors review public fund records.

## Implemented workflows

- **Transaction management:** Create individual records, process batches, import CSV files, search records, view budget summaries, and approve, archive, or delete transactions according to role.
- **Integrity checking:** Import financial records or enter them manually, inspect risk scores and explanations, and review flagged transactions before approval. CSV imports support automatic column mapping and procurement line items.
- **Audit review:** Auditors can add remarks and update verification statuses; officials and administrators can approve records. Alerts and analytics support follow-up on flagged activity.
- **Risk analysis:** The backend includes statistical and behavioral checks. The Python ML service provides hybrid scoring using ensemble classifiers, Isolation Forest, Z-scores, and Philippine-specific rules. The graph service checks circular transfers, fund convergence, shared connections, and rapid transactions.
- **Blockchain evidence:** The owner-controlled Solidity contract records hashes of suspicious transactions with a compact risk score and timestamp. An optional metadata hash appears in the contract event; full financial records remain in MongoDB.
- **Accounts and administration:** Email verification, approval of registrations, password recovery, TOTP setup, recovery codes, profile management, user administration, session management, and audit/security logs.
- **Complaints and feedback:** Authenticated complaint submissions with attachments and status tracking, plus feedback and reply moderation with optional Akismet integration.
- **Government data ingestion:** Backend endpoints search and import datasets through the data.gov.ph API.

Risk flags are review signals. The source includes synthetic prototype training data and rule-based fallbacks; it does not establish that a flagged record is fraudulent.

## Roles and onboarding

| Role | Main responsibilities |
| --- | --- |
| `barangay_official` | Submit and import transactions, approve records, use the Integrity Checker, and review dashboards and analytics. |
| `auditor` | Review transactions and flagged cases, add auditor remarks, update verification details, and access monitoring/reporting functions. |
| `administrator` | Manage users and security, approve registrations, inspect logs, and access administrative and transaction workflows. |

Officials and auditors can self-register, verify their email, and wait for administrator approval. Administrator-created accounts must change their temporary password and set up 2FA. Administrators must complete TOTP setup before accessing the application. Authorization is enforced by backend route middleware; the permission matrix alone does not describe every route restriction.

Google-related model fields and environment placeholders exist, but Google OAuth routes are not implemented. There is no resident role in the current user schema.

## Architecture

```text
Browser / React + Vite
          |
          v
Express API -------- MongoDB (external to Compose)
    |  |
    |  +------------ Redis (rate limiting)
    |
    +--------------- Flask ML service
    +--------------- Flask / NetworkX graph service
    +--------------- Ethereum RPC / ChainShield contract
```

| Component | Source | Default local address |
| --- | --- | --- |
| Frontend | `frontend/` — React 19, Vite 7, React Router, Recharts | http://localhost:5173 |
| Backend | `backend/` — Express, Mongoose, Web3 | http://localhost:5000 |
| ML service | `ml_service/` — Flask, scikit-learn, XGBoost, SHAP | http://localhost:5001 |
| Graph service | `graph_service/` — Flask, NetworkX | http://localhost:5002 |
| Redis | Docker Compose, Redis 7 | `localhost:6379` |
| Ganache | Docker Compose | http://localhost:7546 |

MongoDB is not included in `docker-compose.yml`. Supply an accessible MongoDB instance or Atlas connection string. Graph state is held in memory and resets when its process restarts. Compose persists Redis data, Ganache chain data, and ML models/datasets in named volumes; backend uploads use the mounted `backend/uploads/` directory.

## Run with Docker Compose

### Prerequisites

- Docker with Docker Compose.
- An accessible MongoDB database.
- Node.js 20.19+ or 22.12+ and npm on the host for the Vite 7 toolchain and contract deployment commands.
- An authenticator app for administrator onboarding.
- SMTP credentials for delivered verification and account emails.

### 1. Configure the environment

Use [.env.example](.env.example) as a variable reference. It currently contains Markdown headings, separators, and checklist text, so **do not copy it unchanged as a dotenv file**. Create a root `.env` containing only comments and `KEY=value` entries, for example:

```dotenv
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb+srv://USER:PASSWORD@YOUR_CLUSTER/chainshield
JWT_SECRET=REPLACE_WITH_A_RANDOM_SECRET
JWT_EXPIRE=24h
TOTP_ENCRYPTION_KEY=REPLACE_WITH_64_HEX_CHARACTERS
BACKUP_ENCRYPTION_KEY=REPLACE_WITH_64_HEX_CHARACTERS
ML_API_SECRET=REPLACE_WITH_A_RANDOM_SHARED_SECRET
ML_SERVICE_URL=http://ml-service:5001
GRAPH_SERVICE_URL=http://graph-service:5002
BLOCKCHAIN_RPC_URL=http://ganache:8545
GANACHE_MNEMONIC=test test test test test test test test test test test junk
GANACHE_NETWORK_ID=1337
CAPTCHA_ENABLED=false
TRUST_PROXY_HOPS=0
AKISMET_ENABLED=false
```

Generate each secret independently with `openssl rand -hex 32`. Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, and `EMAIL_FROM_NAME` for email delivery. Development mode logs email content to the backend console; without a configured transporter, the email service returns a development success response.

For CAPTCHA, configure `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY`, then set `CAPTCHA_ENABLED=true`. Compose propagates the enabled flag to the frontend. Production requires CAPTCHA; see [CAPTCHA setup](docs/CAPTCHA_SETUP.md).

### 2. Deploy the local contract

```bash
docker compose up -d ganache
npm --prefix contracts install
npm --prefix contracts run compile
npm --prefix contracts run migrate:dev
```

The Truffle development network uses host port **7546**, matching Compose. Copy the deployed contract address into `CONTRACT_ADDRESS` in the root `.env`. Add `BLOCKCHAIN_ACCOUNT` and `BLOCKCHAIN_PRIVATE_KEY` for the Ganache account that deployed the contract: only the contract owner can write evidence. Obtain the account details from Ganache startup output (`docker compose logs ganache`). The bundled mnemonic is for local development only.

Use `migrate:dev` for this Compose setup. The separate `contracts/deploy.js` helper is hard-coded to port 7545 and includes a legacy contract check.

### 3. Start the application

```bash
docker compose up --build -d
docker compose logs -f backend ml-service graph-service frontend
```

Open **http://localhost:5173**. Backend and Python services expose `/health` endpoints. Health responses describe the process and are not a complete check of database, email, or blockchain functionality.

Compose runs development servers with bind-mounted source code. It does not supply a production reverse proxy or TLS configuration.

### 4. Create the first administrator

For a development database, set `ADMIN_EMAIL` in the root `.env` to your chosen administrator email, then run:

```bash
docker compose exec backend node add_admin.js
```

The script prints a generated temporary password for a newly created account. Log in, change that password, and complete TOTP setup. If the email already exists, the script promotes the account and resets onboarding flags without replacing its password. This script is disabled when `NODE_ENV=production`.

**The backend `npm run seed` command deletes records from the collections it iterates before creating three development accounts.** Use it only with a disposable database. It is not required for the setup above.

Stop services with `docker compose down`; named volumes remain unless explicitly removed.

## Working on individual services

Install frontend and backend dependencies separately:

```bash
npm --prefix backend install
npm --prefix frontend install
```

For a backend running on the host, provide `backend/.env` or export its variables. `backend/server.js` loads dotenv from its working directory. Replace Docker service names with host addresses: ML on `http://localhost:5001`, graph on `http://localhost:5002`, Redis on `redis://localhost:6379`, and Ganache on `http://localhost:7546`.

Run the API and frontend in separate terminals:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

The frontend API client defaults to `http://localhost:5000/api`. When using a host frontend with that backend, leave `VITE_API_URL` unset or set it to that absolute URL in `frontend/.env.local`. The `/api` Vite proxy currently targets the Docker hostname `chainshield-backend`.

Each Python service has its own `requirements.txt`. Install dependencies in separate Python 3.11 virtual environments and run `python app.py` from each service directory. Export the same `ML_API_SECRET` used by the backend when starting the ML service outside Compose.

## CSV imports and API layout

Download the current CSV template through the Integrity Checker or authenticated `GET /api/transactions/template`. It includes `record_id`, `post_date`, `agency`, `program_name`, `payer_name`, `payee_name`, `debit_amount`, `credit_amount`, `currency`, `description_raw`, `transaction_type`, and up to five procurement line items. Imports accept a `csvFile` multipart field and have a 10 MB upload limit.

The API mounts these route groups:

| Prefix | Purpose |
| --- | --- |
| `/api/auth` | Authentication, onboarding, 2FA, profile, and CSRF token issuance |
| `/api/transactions` | Records, CSV imports, batches, approvals, verification, and budgets |
| `/api/alerts` | Alert and case handling |
| `/api/admin` | User administration, sessions, logs, and security controls |
| `/api/analytics` | Analytics and economic data |
| `/api/evaluation` | Evaluation metrics and model performance |
| `/api/blockchain` | Blockchain status, verification, and legacy test routes |
| `/api/datagovph` | Government dataset search and ingestion |
| `/api/complaints` | Complaint submission and tracking |
| `/api/feedbacks` | Feedback, replies, and moderation |

Browser requests use credentialed cookies and an `X-CSRF-Token` header for writes; the frontend client fetches the token from `/api/auth/csrf-token`. See [API documentation](docs/API_DOCUMENTATION.md) for additional context and the route files in `backend/routes/` for current behavior.

## Security and implementation limits

The backend includes JWT authentication with HttpOnly cookies, password hashing, TOTP, token/session invalidation, role checks, signed double-submit CSRF protection, rate limiting, request validation, sanitization, security headers, and audit logging. Redis supports persistent rate limiting. Uploaded files require authentication to retrieve and remain unencrypted on disk.

Some interfaces and routes are incomplete:

- The Document Verification UI sends a document ID to the data.gov.ph ingestion endpoint. It does not upload or hash the selected file, and the endpoint does not implement certificate authenticity verification.
- Several blockchain HTTP routes still call legacy service methods. The current service supports `recordSuspiciousEvidence` and `verifySuspicious`; its old `recordTransactionHash` method explicitly throws. These routes should not be treated as working blockchain health or verification checks.
- ML use varies by processing path. The batch pipeline supports `INTEGRITY_USE_ML=true` and request options; it is not enabled unconditionally. The ML service checks `X-Internal-Secret` when its secret is configured, but the legacy single-transaction ML client does not send that header.
- Production HTTPS and reverse proxy behavior require separate deployment configuration.

## Checks

```bash
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Contract scripts also provide `npm --prefix contracts test`, which requires a reachable development blockchain. Additional Python and integration scripts are present in the service directories; many require running services or configured data.

## Further documentation

- [Documentation index](docs/README.md)
- [Architecture](docs/architecture.md)
- [Database schema](docs/SCHEMA.md)
- [AI guide](docs/AI_GUIDE.md)
- [Security](docs/SECURITY.md)
- [Account rollout](docs/ACCOUNT_ROLLOUT.md)
- [Containers](docs/containers.md)
- [Deployment](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)

Supporting documents may describe earlier versions; consult the source for current behavior. This repository is an academic research prototype. Package license declarations and the Solidity SPDX identifier are component metadata; there is no repository-wide license file.
