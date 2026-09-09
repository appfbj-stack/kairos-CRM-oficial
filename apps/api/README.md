# @kairos-crm/api

API REST do Kairos CRM — Fastify + TypeScript + Prisma + JWT.

## Módulos (Fase 1 → 7)

| Módulo      | Fase | Status      | O que faz                                |
|-------------|------|-------------|------------------------------------------|
| `auth`      | 1    | ✅          | register, login, refresh, logout, me     |
| `tenants`   | 1    | ✅          | CRUD + activate/suspend/block            |
| `users`     | 1    | ✅          | CRUD dentro do tenant                    |
| `crm`       | 2    | ⏳ planejado| contacts, leads, pipelines, tasks, products, services |
| `whatsapp`  | 3    | ⏳ planejado| webhook, inbox, conversations, Evolution API |
| `hermes`    | 4    | ⏳ planejado| IA nativa (módulo, não app separada)    |
| `knowledge` | 5    | ⏳ planejado| company_knowledge + busca full-text      |
| `automations` | 6  | ⏳ planejado| templates de automação simples          |

> **Hermes é um módulo dentro desta API, não uma aplicação separada.** Deploy único, mesmo processo, mesmo Postgres.

## Rotas atuais (Fase 1)

### Auth (`/api/auth`)

| Método | Rota              | Auth | Descrição                     |
|--------|-------------------|------|-------------------------------|
| POST   | `/register`       | -    | Cria tenant + admin           |
| POST   | `/login`          | -    | Login (email + senha + slug?) |
| POST   | `/refresh`        | -    | Renova access token           |
| POST   | `/logout`         | -    | Revoga refresh token          |
| GET    | `/me`             | ✓    | Dados do usuário autenticado  |

### Tenants (`/api/tenants`)

| Método | Rota                       | Auth         | Descrição                          |
|--------|----------------------------|--------------|------------------------------------|
| GET    | `/`                        | SUPER_ADMIN  | Lista todos os tenants             |
| GET    | `/:id`                     | SUPER_ADMIN  | Detalhes de um tenant              |
| GET    | `/by-slug/:slug`           | -            | Lookup público (tela de login)     |
| POST   | `/`                        | SUPER_ADMIN  | Cria tenant                        |
| PATCH  | `/:id`                     | SUPER_ADMIN  | Atualiza tenant                    |
| POST   | `/:id/action`              | SUPER_ADMIN  | activate/suspend/block/unblock     |

### Users (`/api/users`)

| Método | Rota      | Auth                          | Descrição              |
|--------|-----------|-------------------------------|------------------------|
| GET    | `/`       | TENANT_ADMIN/MANAGER/SA       | Lista usuários tenant  |
| GET    | `/:id`    | autenticado                   | Detalhes               |
| POST   | `/`       | TENANT_ADMIN/SA               | Cria usuário no tenant |
| PATCH  | `/:id`    | TENANT_ADMIN/SA               | Atualiza               |
| DELETE | `/:id`    | TENANT_ADMIN/SA               | Soft delete            |

### Health

| Método | Rota         | Auth | Descrição                |
|--------|--------------|------|--------------------------|
| GET    | `/health`    | -    | Health check             |
| GET    | `/health/db` | -    | Health check + DB ping   |

## Multi-tenant

Todas as rotas autenticadas recebem `request.user.tenantId` extraído do JWT. O backend **nunca** aceita `tenantId` do body/query.

- TENANT_ADMIN / MANAGER / AGENT / USER: só enxergam dados do seu próprio tenant
- SUPER_ADMIN: enxerga tudo, mas não pode criar usuários via `/api/users` (apenas via tenants)

## Comandos

```bash
pnpm dev           # dev com watch
pnpm build         # build para produção
pnpm start         # roda dist
pnpm test          # roda testes (Vitest)
pnpm test:tenant-isolation  # só o teste de isolamento
pnpm typecheck     # verifica tipos
```
