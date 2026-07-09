# 🚀 ChainShield Deployment Guide

## Prerequisites

- Docker & Docker Compose v2+
- Node.js 18+ (for local development)
- Python 3.9+ (for ML/Graph services)
- Git

---

## Environment Setup

### 1. Clone & Configure

```bash
git clone <repository-url>
cd ChainShield

# Copy environment files
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with production values:

```bash
# CRITICAL: Change these for production
JWT_SECRET=$(openssl rand -hex 64)
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Update MongoDB URI pointing to your MongoDB Atlas cluster
MONGODB_URI=mongodb+srv://user:password@cluster.g8xlb6j.mongodb.net/chainshield?retryWrites=true&w=majority

# Configure SMTP for OTP emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

---

## Deployment Options

### Option A: Docker Compose (Recommended)

```bash
# Build and start all services (Backend, Redis, Ganache, Frontend, ML, Graph services)
docker compose up -d --build

# Verify services
docker compose ps

# View logs
docker compose logs -f backend
```

**Services started:**
| Service | Port | URL |
|---|---|---|
| Frontend | 5173 | http://localhost:5173 |
| Backend | 5000 | http://localhost:5000 |
| ML Service | 5001 | Internal |
| Graph Service | 5002 | Internal |
| Ganache | 7546 | Internal |

*(MongoDB is hosted on Atlas cloud).*

### Option B: Local Development

```bash
# Terminal 1: Backend
cd backend && npm install && npm run dev

# Terminal 2: Frontend
cd frontend && npm install && npm run dev

# Terminal 3: ML Service
cd ml_service && pip install -r requirements.txt && python app.py

# Terminal 4: Graph Service
cd graph_service && pip install -r requirements.txt && python app.py
```

---

## Post-Deployment Checklist

### Security Hardening (Mandatory)

Before proceeding to production, you MUST review and implement the controls in our security documentation:

1. **[Risk Assessment](../security/risk-assessment.md)** - Review system-specific risks.
2. **[Threat Model](../security/threat-model.md)** - Understand the attack vectors.
3. **[Audit Logging](../security/audit-logging.md)** - Verify log integrity and chain hashing.

- [x] Changed default JWT_SECRET
- [x] Configured MongoDB Atlas with IP Access controls (e.g. only whitelist backend IPs)
- [x] Generated BACKUP_ENCRYPTION_KEY
- [x] Configured SMTP for production email
- [x] Set `NODE_ENV=production`
- [x] Verified CORS origins match production domain
- [x] Verified hash-chaining in `AuditLogs` on startup

### Seeding Default Test Accounts

```bash
cd backend
npm run seed
# This seeds standard test accounts (Admin, Official, Auditor, Resident) on Atlas
```

### Encrypted Backups

```bash
# Manual backup
cd backend/scripts
MONGODB_URI="your-atlas-uri" BACKUP_ENCRYPTION_KEY="your-key" bash backup.sh

# Schedule daily backup (cron)
0 2 * * * cd /path/to/backend/scripts && MONGODB_URI="..." BACKUP_ENCRYPTION_KEY="..." bash backup.sh
```

---

## Monitoring

### Health Check
```
GET http://localhost:5000/health
Response: { "status": "ok", "timestamp": "...", "uptime": ... }
```

### Audit Logs
Admin dashboard → Audit Logs section
Or API: `GET /api/admin/audit-logs`

---

## Troubleshooting

| Issue | Solution |
|---|---|
| MongoDB Connection Failed | Ensure `MONGODB_URI` points to the correct Atlas cluster and that your IP address is whitelisted in Atlas Network Access. |
| CSRF token error | Ensure `withCredentials: true` on frontend requests |
| OTP not received | Check SMTP config; dev mode logs OTP to console |
| Rate limit hit | Wait for window to expire, or adjust in `rateLimiter.js` |

---

*Last Updated: 2026-07-09*
