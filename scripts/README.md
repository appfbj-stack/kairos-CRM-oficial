# kairos-crm scripts

Operational scripts for development, testing, and production maintenance.

## `backup-db.sh`

Daily Postgres `pg_dump` with gzip compression, integrity verification, automatic rotation, and optional S3 upload.

### Requirements

- `pg_dump` (Postgres client)
- `gzip`
- Optional: `aws` CLI (only if `BACKUP_S3_BUCKET` is set)

### Usage

```bash
# Required env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kairos_crm_db
DB_USER=kairos_crm
PGPASSWORD=secret

# Optional env
BACKUP_DIR=/var/backups/kairos-crm        # default
BACKUP_RETENTION_DAYS=7                    # default
BACKUP_S3_BUCKET=my-bucket                 # optional, requires aws cli
BACKUP_S3_PREFIX=kairos-crm/daily          # default

bash scripts/backup-db.sh
```

Output: `BACKUP_DIR/kairos_crm_YYYYMMDDTHHMMSSZ.sql.gz` + `.sha256` checksum file.

### Cron

Daily at 03:00 UTC, with 7-day retention:

```cron
0 3 * * * \
  DB_HOST=localhost \
  DB_NAME=kairos_crm_db \
  DB_USER=kairos_crm \
  PGPASSWORD=your_password_here \
  BACKUP_DIR=/var/backups/kairos-crm \
  BACKUP_RETENTION_DAYS=7 \
  bash /opt/kairos-crm/scripts/backup-db.sh \
  >> /var/log/kairos-crm-backup.log 2>&1
```

### Restore

```bash
# Decompress and pipe to psql
gunzip -c backup.sql.gz | psql -h localhost -U kairos_crm -d kairos_crm_db

# Verify integrity first
sha256sum -c backup.sql.gz.sha256
```

## `smoke-test.mjs`

End-to-end smoke test against any Kairos CRM URL. Verifies health endpoint, OpenAPI docs, auth flow, CORS, and OpenAPI spec validity.

See `--help` for options. No dependencies beyond Node 18+.

## `k6-load-test.js`

Three load test scenarios for k1-k6:

- `health` — 100 RPS sustained
- `auth` — 20 RPS (HMAC-signed token exchange)
- `ai` — 5 RPS (LLM-backed analyze)

Run with `k6 run scripts/k6-load-test.js`.

## Deploy helper (planned)

`scripts/deploy.sh` — pulls latest, rebuilds images, runs migrations, restarts containers. (See `docs/RUNBOOK.md` deploy section.)
