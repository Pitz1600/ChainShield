#!/bin/bash
# ============================================
# ChainShield Encrypted Database Backup Script
# ============================================
# Usage: ./backup.sh
# Requires: mongodump, openssl, gzip
# Environment: MONGODB_URI, BACKUP_ENCRYPTION_KEY

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="chainshield_backup_${TIMESTAMP}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Validate required environment
if [ -z "${MONGODB_URI:-}" ]; then
    echo "ERROR: MONGODB_URI environment variable is required"
    exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "ERROR: BACKUP_ENCRYPTION_KEY environment variable is required"
    echo "Generate one with: openssl rand -hex 32"
    exit 1
fi

# Create backup and staging directories
mkdir -p "${BACKUP_DIR}"
STAGING_DIR="${BACKUP_DIR}/${BACKUP_NAME}_staging"
mkdir -p "${STAGING_DIR}"

echo "🔄 Starting full system backup: ${BACKUP_NAME}"

# Step 1: Dump MongoDB
echo "  📦 Dumping MongoDB..."
mongodump --uri="${MONGODB_URI}" --out="${STAGING_DIR}/db" --quiet

# Step 2: Include Uploads
echo "  📁 Including uploads directory..."
# Use -p to preserve permissions, handle case where uploads might be empty
if [ -d "../uploads" ]; then
    cp -rp "../uploads" "${STAGING_DIR}/uploads"
else
    echo "  ⚠️  Warning: uploads directory not found at ../uploads"
fi

# Step 3: Compress everything in staging
echo "  🗜️  Compressing bundle..."
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" -C "${BACKUP_DIR}" "${BACKUP_NAME}_staging"

# Step 4: Encrypt with AES-256-CBC
echo "  🔐 Encrypting with AES-256-CBC..."
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -in "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
    -out "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.enc" \
    -pass env:BACKUP_ENCRYPTION_KEY

# Step 5: Generate SHA-256 checksum
sha256sum "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.enc" > "${BACKUP_DIR}/${BACKUP_NAME}.sha256"

# Step 6: Cleanup unencrypted files
rm -rf "${STAGING_DIR}"
rm -f "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# Step 7: Remove old backups (retention policy)
echo "  🧹 Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "chainshield_backup_*.tar.gz.enc" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "chainshield_backup_*.sha256" -mtime +${RETENTION_DAYS} -delete

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.enc" | cut -f1)
echo "✅ Backup complete: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.enc (${BACKUP_SIZE})"
echo ""
echo "To restore:"
echo "  1. Decrypt:  openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in ${BACKUP_NAME}.tar.gz.enc -out ${BACKUP_NAME}.tar.gz -pass env:BACKUP_ENCRYPTION_KEY"
echo "  2. Extract:  tar -xzf ${BACKUP_NAME}.tar.gz"
echo "  3. Restore:  mongorestore --uri=\${MONGODB_URI} ${BACKUP_NAME}/"
