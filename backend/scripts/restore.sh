#!/bin/bash
# ============================================
# ChainShield Encrypted Database Restore Script
# ============================================
# Usage: ./restore.sh <backup_file.tar.gz.enc>
# Requires: mongorestore, openssl, tar
# Environment: MONGODB_URI, BACKUP_ENCRYPTION_KEY

set -euo pipefail

# Configuration
TEMP_DIR="./restore_temp_$(date +%s)"
BACKUP_FILE="${1:-}"

# Validate input
if [ -z "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file path is required"
    echo "Usage: $0 <path_to_encrypted_backup>"
    exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Validate required environment
if [ -z "${MONGODB_URI:-}" ]; then
    echo "ERROR: MONGODB_URI environment variable is required"
    exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "ERROR: BACKUP_ENCRYPTION_KEY environment variable is required"
    exit 1
fi

echo "🔄 Starting Restoration from: ${BACKUP_FILE}"

# Create temp directory
mkdir -p "${TEMP_DIR}"

# Step 1: Decrypt
echo "  🔐 Decrypting with AES-256-CBC..."
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -in "${BACKUP_FILE}" \
    -out "${TEMP_DIR}/decrypted.tar.gz" \
    -pass env:BACKUP_ENCRYPTION_KEY

# Step 2: Extract
echo "  📦 Extracting..."
tar -xzf "${TEMP_DIR}/decrypted.tar.gz" -C "${TEMP_DIR}"

# Find the extracted staging directory (it now ends with _staging)
STAGING_DIR=$(find "${TEMP_DIR}" -maxdepth 1 -type d -name "chainshield_backup_*_staging" | head -n 1)

if [ -z "${STAGING_DIR}" ]; then
    echo "ERROR: Could not find extracted staging directory"
    rm -rf "${TEMP_DIR}"
    exit 1
fi

# Step 3: Restore to MongoDB
if [ -d "${STAGING_DIR}/db" ]; then
    echo "  💾 Restoring to MongoDB..."
    mongorestore --uri="${MONGODB_URI}" --drop "${STAGING_DIR}/db/"
else
    echo "  ⚠️  Warning: No database dump found in backup"
fi

# Step 4: Restore Uploads
if [ -d "${STAGING_DIR}/uploads" ]; then
    echo "  📁 Restoring uploads directory..."
    mkdir -p "../uploads"
    cp -rp "${STAGING_DIR}/uploads/." "../uploads/"
else
    echo "  ⚠️  Warning: No uploads directory found in backup"
fi

# Step 5: Cleanup
echo "  🧹 Cleaning up temporary files..."
rm -rf "${TEMP_DIR}"

echo "✅ Restoration complete!"
