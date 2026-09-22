#!/usr/bin/env bash
# backup-db.sh — Daily Postgres backup for kairos-crm
#
# Usage (env-driven, safe to put in cron):
#   DB_HOST=localhost DB_PORT=5432 DB_NAME=kairos_crm_db \
#   DB_USER=kairos_crm PGPASSWORD=secret \
#   BACKUP_DIR=/var/backups/kairos-crm BACKUP_RETENTION_DAYS=7 \
#   bash scripts/backup-db.sh
#
# Cron example (daily at 03:00, BRT):
#   0 3 * * * DB_HOST=localhost DB_NAME=kairos_crm_db DB_USER=kairos_crm PGPASSWORD=xxx BACKUP_DIR=/var/backups/kairos-crm bash /opt/kairos-crm/scripts/backup-db.sh >> /var/log/kairos-crm-backup.log 2>&1
#
# Requirements: pg_dump, gzip. Optional: aws cli (for S3 upload), rclone, restic.

set -euo pipefail

# -------- config --------
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-kairos_crm_db}"
DB_USER="${DB_USER:-kairos_crm}"
DB_SSLMODE="${DB_SSLMODE:-prefer}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/kairos-crm}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/kairos_crm_${TIMESTAMP}.sql.gz"
LOCK_FILE="${BACKUP_DIR}/.backup.lock"
LOG_PREFIX="[backup-db]"

# -------- helpers --------
log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ${LOG_PREFIX} $*"
}

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: required command not found: $1" >&2; exit 1; }
}

cleanup_lock() {
  rm -f "$LOCK_FILE" 2>/dev/null || true
}

# -------- preflight --------
require pg_dump
require gzip

mkdir -p "$BACKUP_DIR"

# Lock to prevent overlapping backups
if [ -e "$LOCK_FILE" ]; then
  log "ERROR: another backup is already running (lock: $LOCK_FILE)"
  exit 1
fi
trap cleanup_lock EXIT
echo "$$" > "$LOCK_FILE"

# Disk space sanity (require at least 200MB free)
FREE_KB="$(df -Pk "$BACKUP_DIR" | tail -1 | awk '{print $4}')"
if [ "${FREE_KB:-0}" -lt 204800 ]; then
  log "WARN: less than 200MB free in $BACKUP_DIR (${FREE_KB}KB available)"
fi

# -------- dump --------
log "starting pg_dump (db=${DB_NAME} host=${DB_HOST}:${DB_PORT} user=${DB_USER})"

START_TIME="$(date +%s)"

if ! pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --quote-all-identifiers \
    --format=plain \
    --encoding=UTF8 \
    2>"${BACKUP_DIR}/last_error.log" \
  | gzip -9 > "$BACKUP_FILE.tmp"; then
  log "ERROR: pg_dump failed — see ${BACKUP_DIR}/last_error.log"
  rm -f "$BACKUP_FILE.tmp"
  exit 1
fi

mv "$BACKUP_FILE.tmp" "$BACKUP_FILE"

ELAPSED=$(( $(date +%s) - START_TIME ))
SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")
SIZE_MB=$(awk "BEGIN { printf \"%.2f\", $SIZE / 1024 / 1024 }")

# Verify gzip integrity
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  log "ERROR: backup file failed gzip integrity check: $BACKUP_FILE"
  exit 1
fi

# Generate SHA256 for integrity verification later
sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"

log "success: ${BACKUP_FILE} (${SIZE_MB} MB in ${ELAPSED}s)"

# -------- rotation --------
log "rotating backups older than ${BACKUP_RETENTION_DAYS} days"
DELETED=0
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'kairos_crm_*.sql.gz' -mtime +"$BACKUP_RETENTION_DAYS" -print -delete | while read -r f; do
  DELETED=$((DELETED + 1))
  log "deleted: $f"
  rm -f "${f}.sha256"
done

# Keep last_error.log from previous run if it failed (don't accumulate)
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'last_error.log' -mtime +1 -delete 2>/dev/null || true

# -------- optional remote upload (S3 via aws cli) --------
if [ -n "${BACKUP_S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  S3_KEY="${BACKUP_S3_PREFIX:-kairos-crm}/$(basename "$BACKUP_FILE")"
  log "uploading to s3://${BACKUP_S3_BUCKET}/${S3_KEY}"
  if aws s3 cp "$BACKUP_FILE" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" --storage-class STANDARD_IA; then
    aws s3 cp "${BACKUP_FILE}.sha256" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}.sha256" || true
    log "s3 upload ok"
  else
    log "WARN: s3 upload failed (continuing — local backup kept)"
  fi
fi

log "done"
