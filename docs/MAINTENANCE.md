# 🔧 ChainShield Maintenance Guide

## Routine Maintenance

### Daily
- [ ] Verify automated backups completed (`backup.sh` via cron)
- [ ] Monitor error logs: `docker compose logs backend --since 24h | grep ERROR`
- [ ] Check audit logs for suspicious activity (Admin Dashboard)

### Weekly
- [ ] Review rate limit logs for unusual patterns
- [ ] Check disk usage on MongoDB volume
- [ ] Review new audit log entries for anomalies
- [ ] Verify ML and Graph services are responsive

### Monthly
- [ ] Run `npm audit` and update vulnerable dependencies
- [ ] Rotate JWT_SECRET (requires all users to re-login)
- [ ] Review and prune old audit logs (>90 days)
- [ ] Test backup restoration procedure
- [ ] Review RBAC permissions for accuracy

### Quarterly
- [ ] Run security test suite: `node backend/verify_security.js`
- [ ] Review OWASP Top 10 compliance (see `docs/THREAT_MODEL.md`)
- [ ] Update TLS certificates if self-signed
- [ ] Review and update threat model

---

## Dependency Management

```bash
# Check for vulnerabilities
cd backend && npm audit
cd ../frontend && npm audit

# Fix automatically (non-breaking)
npm audit fix

# Update dependencies
npm update

# Check outdated packages
npm outdated
```

---

## Database Maintenance

### Backup
```bash
cd backend/scripts
MONGODB_URI="..." BACKUP_ENCRYPTION_KEY="..." bash backup.sh
```

### Restore from Backup
```bash
# 1. Decrypt
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in backup.tar.gz.enc -out backup.tar.gz \
  -pass env:BACKUP_ENCRYPTION_KEY

# 2. Extract
tar -xzf backup.tar.gz

# 3. Restore
mongorestore --uri="${MONGODB_URI}" backup_dir/
```

### Cleanup Old Rate Limit Records
```bash
# From MongoDB shell or script
db.ratelimits.deleteMany({ date: { $lt: "2025-01-01" } })
```

---

## Log Management

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last N lines
docker compose logs --tail=100 backend
```

### Audit Log Retention
The `AuditLog` collection grows over time. Archive logs older than 1 year:

```javascript
// MongoDB shell
const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
db.auditlogs.deleteMany({ createdAt: { $lt: oneYearAgo } });
```

---

## Incident Response

### Suspected Breach
1. **Contain**: Disable affected user accounts via Admin panel
2. **Investigate**: Review audit logs for the period
3. **Eradicate**: Rotate JWT_SECRET to invalidate all sessions
4. **Recover**: Restore from last known-good backup
5. **Document**: Log incident details and remediation steps

### JWT Secret Rotation
```bash
# Generate new secret
openssl rand -hex 64

# Update in backend/.env
JWT_SECRET=<new-secret>

# Restart backend (all existing tokens will be invalidated)
docker compose restart backend
```

---

## Performance Monitoring

| Metric | Threshold | Action |
|---|---|---|
| API response time | > 2s | Check DB indexes, add caching |
| MongoDB disk usage | > 80% | Archive old data, expand volume |
| Memory usage | > 90% | Check for memory leaks, scale |
| Failed login rate | > 50/hour | Investigate, may indicate attack |

---

*Last Updated: 2026-02-17*
