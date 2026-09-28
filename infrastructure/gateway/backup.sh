#!/usr/bin/env bash
# ==============================================================================
# BharatTunnel 🇮🇳 - Automated Gateway & Database Backup Script
# ==============================================================================
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/bharattunnel}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

echo "[+] Creating backup at ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

# 1. Backup WireGuard interface and peer configs
if [[ -d /etc/wireguard ]]; then
  echo "[+] Backing up WireGuard configuration..."
  tar -czf "${BACKUP_DIR}/wireguard_etc_${TIMESTAMP}.tar.gz" -C /etc wireguard
fi

# 2. Backup PostgreSQL if pg_dump is available
if command -v pg_dump >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  echo "[+] Dumping PostgreSQL database..."
  pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_DIR}/bharattunnel_db_${TIMESTAMP}.sql.gz"
fi

# 3. Rotate old backups (retain last 14 days)
echo "[+] Pruning backups older than 14 days..."
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +

echo "[✓] Backup completed successfully at ${BACKUP_DIR}."
