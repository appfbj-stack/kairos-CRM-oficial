# kairos-crm RUNBOOK

Operational guide for production. Read this before anything that touches prod.

> **Audience**: ops, on-call, dev.
> **Owner**: Fernando Borges / Pastor.
> **Last reviewed**: 2026-09-22.

---

## 1. Architecture at a glance

```
                ┌─────────────────────┐
                │   Caddy (TLS/Wild)  │   *.fbautomacao.space
                └──────────┬──────────┘
                           │
       crm.fbautomacao.space (path-based)
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   /api/v1/external    /api/*            / (Next.js)
   (Fastify :3001)     (Fastify :3001)   (Next.js :3000)
        │                  │                  │
        └──────┬───────────┴──────────┬───────┘
               │                      │
               ▼                      ▼
        Postgres :5432           Supabase (remote)
        kairos_crm_db            auth only
```

| Service        | Container / process    | Port (host)        | Notes                                |
|----------------|------------------------|--------------------|--------------------------------------|
| Web (Next.js)  | `kairos-crm-web`       | `127.0.0.1:3030`   | Reverse-proxied by Caddy            |
| API (Fastify)  | `kairos-crm-api`       | `127.0.0.1:3001`   | All `/api/*` and `/api/v1/*`         |
| Postgres 15    | `kairos-crm-pg`        | `127.0.0.1:5432`   | Backup via `scripts/backup-db.sh`    |
| Redis (opt)    | `kairos-crm-redis`     | `127.0.0.1:6379`   | Only if `REDIS_URL` is set          |
| Caddy          | host (systemd)         | 80 / 443           | Wildcard SSL via DNS challenge       |

---

## 2. Daily operations

### Status check (one-liner)

```bash
ssh -i ~/.ssh/vps root@<vps>
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'kairos-crm|caddy|postgres'
docker logs kairos-crm-api --tail 50 --since 1h
curl -fsS http://127.0.0.1:3001/api/health | jq
curl -fsS https://crm.fbautomacao.space/api/health | jq
```

### Tail logs

```bash
docker logs -f kairos-crm-api
docker logs -f kairos-crm-web

# Last 200 lines with grep
docker logs kairos-crm-api --tail 500 2>&1 | grep -iE 'error|warn|webhook'
```

### Container restart (does NOT reload env!)

```bash
docker restart kairos-crm-api

# When env changed — full recreate:
docker compose -p kairos-crm -f /opt/kairos-crm/docker-compose.prod.yml up -d api web
```

> ⚠️ **`docker restart` does NOT refresh `--env-file`.** If you changed `.env`, you MUST recreate the container (stop + rm + run, or `up -d`).

### Database quick queries

```bash
# Via container
docker exec kairos-crm-pg psql -U kairos_crm -d kairos_crm_db

# One-off query
docker exec kairos-crm-pg psql -U kairos_crm -d kairos_crm_db -c "SELECT count(*) FROM \"Contact\";"

# Active tenants
docker exec kairos-crm-pg psql -U kairos_crm -d kairos_crm_db -c \
  "SELECT id, slug, name, \"isActive\" FROM \"Tenant\";"
```

---

## 3. Deploy

### Standard deploy (git push + auto-deploy via cron)

The VPS polls the repo every 5 minutes. The cron script pulls, builds, and recreates containers.

```bash
# On dev machine — commit + push
git add -A
git commit -m "feat: your change"
git push origin main

# Wait ~5 min, then verify
ssh root@<vps> "docker logs kairos-crm-deploy --tail 50"
ssh root@<vps> "docker ps | grep kairos-crm"
```

### Manual deploy (if auto-deploy is broken)

```bash
ssh root@<vps>
cd /opt/kairos-crm
git pull --ff-only

# Build new images
docker compose -p kairos-crm -f docker-compose.prod.yml build api web

# Apply migrations FIRST (before rolling API)
docker compose -p kairos-crm -f docker-compose.prod.yml run --rm api pnpm prisma migrate deploy

# Roll containers
docker compose -p kairos-crm -f docker-compose.prod.yml up -d api web

# Smoke test
curl -fsS https://crm.fbautomacao.space/api/health | jq
node /opt/kairos-crm/scripts/smoke-test.mjs https://crm.fbautomacao.space
```

### Rollback

```bash
ssh root@<vps>
cd /opt/kairos-crm

# Find last good commit
git log --oneline -10

# Roll back code
git checkout <good_commit_sha>

# Rebuild + restart
docker compose -p kairos-crm -f docker-compose.prod.yml build api web
docker compose -p kairos-crm -f docker-compose.prod.yml up -d api web

# Rollback DB ONLY if migration was destructive and you have a backup:
# gunzip -c /var/backups/kairos-crm/kairos_crm_YYYYMMDDTHHMMSSZ.sql.gz | \
#   docker exec -i kairos-crm-pg psql -U kairos_crm -d kairos_crm_db
```

---

## 4. Backup and restore

### Daily backup (cron-managed)

```bash
# Status
ls -lh /var/backups/kairos-crm/
tail -20 /var/log/kairos-crm-backup.log

# Trigger manually
ssh root@<vps> "DB_HOST=localhost DB_NAME=kairos_crm_db DB_USER=kairos_crm \
  PGPASSWORD=$(grep DB_PASS /opt/kairos-crm/.env | cut -d= -f2) \
  bash /opt/kairos-crm/scripts/backup-db.sh"
```

### Verify integrity

```bash
ssh root@<vps> "cd /var/backups/kairos-crm && sha256sum -c kairos_crm_*.sha256 | tail -5"
```

### Restore from backup

```bash
# 1) Stop API so it doesn't fight us
ssh root@<vps> "cd /opt/kairos-crm && \
  docker compose -p kairos-crm -f docker-compose.prod.yml stop api web"

# 2) Restore
ssh root@<vps> "gunzip -c /var/backups/kairos-crm/kairos_crm_YYYYMMDDTHHMMSSZ.sql.gz | \
  docker exec -i kairos-crm-pg psql -U kairos_crm -d kairos_crm_db -v ON_ERROR_STOP=1"

# 3) Bring services back
ssh root@<vps> "cd /opt/kairos-crm && \
  docker compose -p kairos-crm -f docker-compose.prod.yml up -d api web"

# 4) Verify
curl -fsS https://crm.fbautomacao.space/api/health | jq
```

> **Test restores regularly.** A backup you never restored is a backup you don't have.

---

## 5. Monitoring and alerts

### Health endpoints

| URL                                              | Expected                                    |
|--------------------------------------------------|---------------------------------------------|
| `https://crm.fbautomacao.space/api/health`       | `{"status":"ok","db":"up"}`                 |
| `https://crm.fbautomacao.space/api/v1/external/health` | `{"status":"ok","service":"external-api"}` |
| `https://crm.fbautomacao.space/api/v1/external/docs` | Swagger UI HTML                       |

### What to watch

| Symptom                                | Likely cause                                  | Action                                          |
|----------------------------------------|-----------------------------------------------|-------------------------------------------------|
| `db: down` in `/api/health`            | Postgres container stopped / disk full / OOM  | `docker logs kairos-crm-pg --tail 100`          |
| Web 502/504                            | API down / OOM                                | `docker stats kairos-crm-api` + restart         |
| Webhook deliveries piling up PENDING   | Endpoint unreachable / 5xx                    | Check `webhook_deliveries` table                |
| Auth failures spike                    | Supabase quota / outage                       | Check Supabase status page                      |
| Slow responses                         | DB CPU high / missing index                   | `EXPLAIN ANALYZE` on hot queries                |

### Webhook retry behavior (built-in)

- Backoff: 30s → 2m → 10m → 1h → 6h → 24h (6 attempts total)
- After 6 fails: status = `FAILED`, kept in DB for debugging
- Inspect: `GET /api/v1/external/webhooks/:id/deliveries?status=FAILED`

### Rate limiting

- Per-app, in-memory by default. **Resets on container restart.**
- Switch to Redis for persistence: set `REDIS_URL=redis://...` in `.env`.

---

## 6. Troubleshooting recipes

### "Login fails with 401"

```bash
# Server-side check
curl -fsS https://crm.fbautomacao.space/api/auth/me -i | head -20

# Check proxy logs
docker logs kairos-crm-postgrest-proxy --tail 100

# Confirm NEXT_PUBLIC_SUPABASE_URL is PUBLIC hostname (browser uses it client-side!)
grep NEXT_PUBLIC_SUPABASE_URL /opt/kairos-crm/.env
# Must be: https://crm.fbautomacao.space  (NOT http://localhost or internal IP)

# User browser hard refresh Ctrl+Shift+R (clears stale Server Action hash)
```

### "Webhook keeps failing"

```bash
# Tail API logs during retry
docker logs -f kairos-crm-api | grep -i webhook

# Look at delivery record
docker exec kairos-crm-pg psql -U kairos_crm -d kairos_crm_db -c \
  "SELECT id, event, status, attempts, \"lastError\" FROM \"WebhookDelivery\" ORDER BY \"createdAt\" DESC LIMIT 10;"
```

### "External API returns 401 invalid_signature"

```bash
# Check timestamp window (default 5min skew)
date -u +%s
# X-Kairos-Timestamp must be within 300s

# Verify HMAC body matches exactly what was sent
# String to sign: ${timestamp}.${rawBody}
# No trailing whitespace, no extra newline
```

### "External API returns 403 tenant_mismatch"

Token was issued for one tenant, but the request path targets another. Re-issue token.

### "DB connection pool exhausted"

```bash
# Check current connections
docker exec kairos-crm-pg psql -U kairos_crm -d kairos_crm_db -c \
  "SELECT count(*), state FROM pg_stat_activity WHERE datname='kairos_crm_db' GROUP BY state;"

# Active connections cap in env:
grep -E 'DATABASE_URL|DB_POOL' /opt/kairos-crm/.env
```

### "Migrations fail on deploy"

```bash
# Check what's pending
docker compose -p kairos-crm -f /opt/kairos-crm/docker-compose.prod.yml run --rm api \
  pnpm prisma migrate status

# Manually apply
docker compose -p kairos-crm -f /opt/kairos-crm/docker-compose.prod.yml run --rm api \
  pnpm prisma migrate deploy

# If broken mid-migration: see Backup/Restore section
```

---

## 7. Security

### Required env vars (production)

```bash
# Generated once and never rotated casually
KAIROS_API_MASTER_KEY=<openssl rand -base64 32>     # AES-256-GCM master key
JWT_SECRET=<openssl rand -hex 32>                    # JWT signing
DATABASE_URL=postgresql://...                        # full DSN
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...              # server-only
NEXT_PUBLIC_SUPABASE_URL=https://crm.fbautomacao.space
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

### Rotation

| Secret                          | Rotation impact                                     |
|---------------------------------|-----------------------------------------------------|
| `KAIROS_API_MASTER_KEY`         | All encrypted ApiKey / WebhookEndpoint secrets become unreadable. Rotate only if compromised + plan full re-issue. |
| `JWT_SECRET`                    | All sessions invalidated. Users must re-login.      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Issue new key in Supabase dashboard + redeploy.    |
| `DATABASE_URL` password         | Update Postgres role + container env.               |

### Never commit

- `.env`, `.env.local`, `.env.prod*`
- `*.pem`, `*.key`, `id_rsa*`
- `BACKUP_DIR/*` (any .sql.gz with real data)

### RLS

RLS is **enabled but the API role keeps `BYPASSRLS`**. Tenant isolation is enforced at the service layer (`withTenantContext`). To enforce at the DB layer, follow `docs/RLS_ROLLOUT.md`.

---

## 8. External API quick reference

| Endpoint                              | Auth                | Notes                          |
|---------------------------------------|---------------------|--------------------------------|
| `GET  /api/v1/external/health`        | none                | public                         |
| `POST /api/v1/external/auth/token`    | HMAC                | returns short-lived JWT        |
| `POST /api/v1/external/auth/revoke`   | Bearer              | invalidates token              |
| `GET  /api/v1/external/me`            | Bearer              | app + tenant info              |
| `POST /api/v1/external/ai/analyze`    | Bearer (`ai.analyze`) | deterministic + LLM fallback |
| `POST /api/v1/external/ai/chat`       | Bearer (`ai.chat`)  | agent with tools               |
| `GET  /api/v1/external/webhooks`      | Bearer              | list endpoints                 |
| `POST /api/v1/external/webhooks`      | Bearer              | create (returns secret 1x)     |
| `GET  /api/v1/external/webhooks/:id/deliveries` | Bearer      | debug deliveries               |
| `GET  /api/v1/external/docs`          | none                | Swagger UI                     |

Full spec: `https://crm.fbautomacao.space/api/v1/external/docs.yaml`
SDK: `examples/kairos-client-node/`
Integration guide: `docs/INTEGRATION.md`

---

## 9. Contacts

| Role             | Contact                                  |
|------------------|------------------------------------------|
| Product owner    | Fernando Borges (fernandojaborges@gmail.com) |
| Infra            | VPS `187.77.229.227` (Dokploy UI :3000)  |
| Source of truth  | `github.com/appfbj-stack/kairos-crm`     |

---

## 10. Appendix — Useful one-liners

```bash
# Reset a stuck external API token
docker exec kairos-crm-pg psql -U kairos_crm -d kairos_crm_db -c \
  "UPDATE \"AuthToken\" SET \"revokedAt\" = now() WHERE id = '<token_id>';"

# Re-issue a new API key secret (Application stays, new ApiKey row)
docker exec kairos-crm-pg psql -U kairos_crm -d kairos_crm_db -c \
  "SELECT id, name, slug FROM \"Application\" WHERE status = 'ACTIVE';"

# Trigger webhook retry worker manually (for one delivery)
docker exec kairos-crm-pg psql -U kairos_crm -d kairos_crm_db -c \
  "UPDATE \"WebhookDelivery\" SET status = 'PENDING', \"nextAttemptAt\" = now() WHERE id = '<delivery_id>';"

# Tail specific request by X-Request-Id
docker logs kairos-crm-api --tail 1000 2>&1 | grep '<request_id>'
```
