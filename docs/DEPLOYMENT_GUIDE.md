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
cp backend/.env.example backend/.env
```

### 2. Configure Environment Variables

Edit `backend/.env` with production values:

```bash
# CRITICAL: Change these for production
JWT_SECRET=$(openssl rand -hex 64)
MONGO_ROOT_USERNAME=chainshield_admin
MONGO_ROOT_PASSWORD=$(openssl rand -hex 32)
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Update MongoDB URI with auth
MONGODB_URI=mongodb://chainshield_admin:YOUR_PASSWORD@mongodb:27017/chainshield?authSource=admin

# Enable TLS for production
MONGODB_TLS=true
MONGODB_TLS_CA_FILE=/path/to/ca.pem

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
# Build and start all services
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
| MongoDB | 27017 | Internal |
| ML Service | 5001 | Internal |
| Graph Service | 5002 | Internal |
| Ganache | 7546 | Internal |

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

### Security Hardening

- [ ] Changed default JWT_SECRET
- [ ] Changed default MongoDB password
- [ ] Generated BACKUP_ENCRYPTION_KEY
- [ ] Configured SMTP for production email
- [ ] Enabled MONGODB_TLS for production
- [ ] Set `NODE_ENV=production`
- [ ] Changed Ganache mnemonic/keys
- [ ] Created initial admin account: `node backend/create-admin.js`
- [ ] Verified CORS origins match production domain
- [ ] Reviewed and disabled unused ports

### First Admin Account

```bash
cd backend
node create-admin.js
# Follow prompts to create the initial administrator
```

### Encrypted Backups

```bash
# Manual backup
cd backend/scripts
MONGODB_URI="your-uri" BACKUP_ENCRYPTION_KEY="your-key" bash backup.sh

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
| MongoDB connection refused | Check `MONGODB_URI`, ensure MongoDB is running |
| CSRF token error | Ensure `withCredentials: true` on frontend requests |
| OTP not received | Check SMTP config; dev mode logs OTP to console |
| Rate limit hit | Wait for window to expire, or adjust in `rateLimiter.js` |

---

*Last Updated: 2026-02-17*
