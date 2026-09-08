# @kairos-crm/database

Schema Prisma + cliente compartilhado para o Kairos CRM.

## Comandos

```bash
# Gerar cliente Prisma
pnpm generate

# Criar/aplicar migrations (dev)
pnpm migrate

# Aplicar migrations (produção)
pnpm migrate:deploy

# Rodar seed
pnpm seed

# Prisma Studio (GUI)
pnpm studio
```

## Schema

Tabelas (Fase 1):

- `tenants` — empresas cadastradas (multi-tenant)
- `users` — usuários (vinculados a um tenant, exceto SUPER_ADMIN)
- `refresh_tokens` — tokens de refresh (com hash, revogáveis)
- `audit_logs` — trilha de auditoria

Multi-tenant é garantido por:
1. Campo `tenantId` em todas as tabelas de negócio
2. JWT contendo `tenantId` (extraído pelo backend, nunca do body)
3. (Fase 2) PostgreSQL Row Level Security

## Uso

```ts
import { prisma } from '@kairos-crm/database';

const users = await prisma.user.findMany({
  where: { tenantId: 'uuid-do-tenant' },
});
```
