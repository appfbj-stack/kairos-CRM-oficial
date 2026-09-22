/**
 * Tenant Context — propagado via AsyncLocalStorage.
 *
 * Substitui a antiga variável global de módulo (`currentTenantId`) que sofria
 * race condition quando várias requisições eram processadas em paralelo
 * (especialmente com workers de IA que disparam após o response).
 *
 * `enterWith` seta o contexto para a continuation async atual e todas as
 * descendentes — cada request handler do Fastify roda em sua própria
 * continuation, então requests paralelos não se sobrescrevem.
 *
 * API mantida 100% compatível com a versão anterior (setTenantContext /
 * getTenantContext / withTenantContext).
 */

import { AsyncLocalStorage } from 'async_hooks';

interface TenantStore {
  tenantId: string | null;
}

const als = new AsyncLocalStorage<TenantStore>();

/**
 * Define o tenantId no contexto da continuation async atual.
 * Use no início de cada request handler (após autenticar).
 */
export function setTenantContext(tenantId: string | null): void {
  als.enterWith({ tenantId });
}

/**
 * Lê o tenantId do contexto atual. Retorna null se não houver
 * (ex: SUPER_ADMIN ou antes do middleware rodar).
 */
export function getTenantContext(): string | null {
  return als.getStore()?.tenantId ?? null;
}

/**
 * Executa `fn` dentro de um escopo com tenantId fixo, restaurando
 * o valor anterior ao final (mesmo se `fn` throw).
 */
export async function withTenantContext<T>(
  tenantId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  return als.run({ tenantId }, fn);
}

/**
 * Helper de debug — útil pra logs.
 */
export function getTenantContextDebug(): { tenantId: string | null; active: boolean } {
  const store = als.getStore();
  return { tenantId: store?.tenantId ?? null, active: store !== undefined };
}