/**
 * Tenant context no Postgres (Fase 4 — RLS helper).
 *
 * QUANDO USAR:
 *   Quando RLS (Row Level Security) estiver HABILITADO NO BANCO
 *   e ENFORCED (role NÃO tem BYPASSRLS), toda query precisa rodar
 *   num contexto onde `current_setting('app.tenant_id')` retorna o tenantId.
 *
 * COMO USAR:
 *   await withTenantInDb(tenantId, async (tx) => {
 *     return await tx.contact.findMany({ ... }); // RLS filtra automaticamente
 *   });
 *
 * ⚠️ IMPORTANTE:
 *   - Cada chamada `withTenantInDb` abre uma transação Prisma.
 *   - Pra queries que JÁ FAZEM tenant check no service (where: { tenantId }),
 *     você NÃO precisa deste helper. Use só quando quiser defense-in-depth
 *     via RLS.
 *   - Se tenantId é null, NÃO seta a var — policy vira bypass
 *     (usado pra SUPER_ADMIN que tem BYPASSRLS ou pra jobs sem contexto).
 *
 * STATUS ATUAL (2026-09-22):
 *   - Helper criado mas NÃO integrado nos services (decisão de design).
 *   - Services continuam garantindo isolamento via where clause (padrão atual).
 *   - RLS é OPT-IN: Pastor roda migration manualmente + decide quando enforce.
 *   - Ver docs/RLS_ROLLOUT.md pra plano completo.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@kairos-crm/database';
import { logger } from './logger';

/**
 * Helper transacional: seta `app.tenant_id` na sessão Postgres
 * e executa a função passada dentro da mesma transação.
 *
 * - Se `tenantId` for null, NÃO seta (policy bypass automático via `OR IS NULL`).
 * - Se a função throw, a transação faz rollback e o SET é desfeito.
 * - Se a função retorna, faz commit.
 */
export async function withTenantInDb<T>(
  tenantId: string | null,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<T> {
  // SUPER_ADMIN / sem tenant → não seta (policy vira bypass)
  if (!tenantId) {
    return prismaClient.$transaction(fn);
  }

  return prismaClient.$transaction(async (tx) => {
    // SET LOCAL: válido só dentro desta transação.
    // Usa parameterized query pra evitar SQL injection (Prisma raw query).
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}::text, true)`;
    return fn(tx);
  });
}

/**
 * Versão "fora de transação" — usa SET (não LOCAL).
 *
 * ⚠️ NÃO USAR EM PRODUÇÃO com pool de conexões:
 *   - SET afeta TODAS queries na mesma conexão até RESET.
 *   - Prisma pool compartilha conexões entre requests.
 *   - Risco: request A seta tenant=A, request B pega conexão
 *     contaminada e vê dados do tenant A.
 *
 *   Use APENAS em:
 *   - Migrations / seeds (conexão dedicada)
 *   - Testes
 */
export async function setTenantInDbUnsafe(
  tenantId: string | null,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<void> {
  if (tenantId) {
    await prismaClient.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}::text, false)`;
  } else {
    await prismaClient.$executeRaw`SELECT set_config('app.tenant_id', '', false)`;
  }
  logger.warn({ tenantId }, 'setTenantInDbUnsafe — só use em seeds/testes');
}

/**
 * Helper pra testes: roda uma query como se fosse um tenant específico.
 * Usa transação isolada (SET LOCAL) — safe em pool compartilhado.
 */
export async function asTenant<T>(
  tenantId: string | null,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return withTenantInDb(tenantId, fn);
}