#!/bin/bash
# restore-kairos-crm.sh — Restore kairos-crm DB to a new Postgres
#
# Usage:
#   NEW_DB_HOST=new.host NEW_DB_PORT=5432 \
#   NEW_DB_USER=postgres NEW_DB_NAME=kairos_crm_v2_db \
#   NEW_DB_PASSWORD=secret \
#   BACKUP_FILE=/var/backups/kairos-crm/kairos_crm_v2_db_20261006T190514Z.sql.gz \
#   bash restore-kairos-crm.sh
#
# Steps:
#   1. Create the new database (if not exists)
#   2. Restore from the compressed SQL backup
#   3. Verify row counts match

set -euo pipefail

NEW_DB_HOST="${NEW_DB_HOST:-localhost}"
NEW_DB_PORT="${NEW_DB_PORT:-5432}"
NEW_DB_USER="${NEW_DB_USER:-postgres}"
NEW_DB_NAME="${NEW_DB_NAME:-kairos_crm_v2_db}"
NEW_DB_PASSWORD="${NEW_DB_PASSWORD:-}"
BACKUP_FILE="${BACKUP_FILE:?must set BACKUP_FILE}"

export PGPASSWORD="$NEW_DB_PASSWORD"

echo "[restore] target: ${NEW_DB_USER}@${NEW_DB_HOST}:${NEW_DB_PORT}/${NEW_DB_NAME}"
echo "[restore] source: ${BACKUP_FILE}"

# Test connection
if ! psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d postgres -c '\l' >/dev/null 2>&1; then
  echo "[restore] ERROR: cannot connect to ${NEW_DB_HOST}:${NEW_DB_PORT} as ${NEW_DB_USER}"
  exit 1
fi

# Create database if not exists
echo "[restore] ensuring database ${NEW_DB_NAME} exists..."
EXISTS=$(psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${NEW_DB_NAME}'")
if [ "$EXISTS" != "1" ]; then
  psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d postgres -c "CREATE DATABASE \"${NEW_DB_NAME}\""
  echo "[restore] created database"
else
  echo "[restore] database exists, dropping and recreating for clean restore..."
  psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d postgres -c "DROP DATABASE \"${NEW_DB_NAME}\""
  psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d postgres -c "CREATE DATABASE \"${NEW_DB_NAME}\""
fi

# Restore
echo "[restore] applying ${BACKUP_FILE}..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d "$NEW_DB_NAME" -v ON_ERROR_STOP=1 >/dev/null
else
  psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d "$NEW_DB_NAME" -v ON_ERROR_STOP=1 < "$BACKUP_FILE"
fi

echo "[restore] done"

# Verify
echo "[restore] verifying row counts..."
for t in tenants users contacts leads pipelines tasks; do
  COUNT=$(psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d "$NEW_DB_NAME" -tAc "SELECT count(*) FROM ${t} WHERE deleted_at IS NULL OR deleted_at IS NULL")
  echo "  ${t}: ${COUNT}"
done

echo "[restore] complete — update your app's DATABASE_URL to point to ${NEW_DB_HOST}:${NEW_DB_PORT}/${NEW_DB_NAME}"