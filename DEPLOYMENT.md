# Deploy — Kairos CRM

## Ambientes

| Ambiente | Domínio                          | Banco                                 |
|----------|----------------------------------|---------------------------------------|
| Dev local| `localhost:3000` (web) / `4000` (api) | Docker Compose (`kairos_crm_db`)      |
| Produção | `crm.fbautomacao.space`          | `kairos_crm_db` no `kairos-shared-pg` |

---

## Deploy em produção (VPS Dokploy)

### 1. Banco de dados

Já existe o `kairos-shared-pg` no VPS. Criar o database dedicado:

```bash
ssh -i C:\Users\ferna\.ssh\vps root@187.77.229.227 \
  "docker exec kairos-shared-pg psql -U postgres -d postgres \
   -c \"CREATE DATABASE kairos_crm_db OWNER kairos_igreja_user ENCODING 'UTF8';\""
```

### 2. Variáveis de ambiente no Dokploy

**API (`kairos-crm-api`):**
```env
NODE_ENV=production
API_PORT=4000
DATABASE_URL=postgresql://kairos_igreja_user:SENHA@kairos-shared-pg:5432/kairos_crm_db?schema=public
JWT_SECRET=<openssl rand -base64 64>
JWT_REFRESH_SECRET=<openssl rand -base64 64>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
WEB_ORIGIN=https://crm.fbautomacao.space
LOG_LEVEL=info
```

**Web (`kairos-crm-web`):**
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://crm.fbautomacao.space
```

### 3. Caddy (subdomínio)

Adicionar bloco no `/etc/caddy/Caddyfile`:

```caddyfile
crm.fbautomacao.space {
    reverse_proxy kairos-crm-api:4000
    encode gzip
}

# Quando o web (Next.js) entrar em produção:
# crm.fbautomacao.space {
#     reverse_proxy kairos-crm-web:3000
#     encode gzip
# }
```

Recarregar:
```bash
ssh -i C:\Users\ferna\.ssh\vps root@187.77.229.227 \
  "caddy reload --config /etc/caddy/Caddyfile"
```

### 4. Migrations e seed (primeira vez)

```bash
ssh -i C:\Users\ferna\.ssh\vps root@187.77.229.227 \
  "docker exec kairos-crm-api sh -c 'npx prisma migrate deploy'"

ssh -i C:\Users\ferna\.ssh\vps root@187.77.229.227 \
  "docker exec kairos-crm-api sh -c 'npx tsx prisma/seed.ts'"
```

### 5. Verificação

```bash
# Health
curl https://crm.fbautomacao.space/health
# Esperado: {"status":"ok","service":"kairos-crm-api"}

# DB
curl https://crm.fbautomacao.space/health/db
# Esperado: {"status":"ok","database":"ok"}
```

---

## Build das imagens (local)

```bash
# API
docker build -t kairos-crm-api:latest -f apps/api/Dockerfile .

# Web
docker build -t kairos-crm-web:latest -f apps/web/Dockerfile .
```

---

## Estrutura de pastas (VPS)

Os containers Dokploy ficam em:
- `/etc/dokploy/compose/kairos-crm-api/code/`
- `/etc/dokploy/compose/kairos-crm-web/code/`

---

## Backup

```bash
# Diário às 03h
0 3 * * * docker exec kairos-shared-pg pg_dump -U postgres kairos_crm_db | gzip > /backups/kairos_crm_$(date +\%Y\%m\%d).sql.gz
```
