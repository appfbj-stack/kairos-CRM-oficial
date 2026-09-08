import { PrismaClient } from '@prisma/client';

// Singleton do Prisma (evita múltiplas conexões em dev com HMR)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// =====================================================
// Tenant context — setado por request no Fastify
// para uso com Row Level Security (Fase 2+)
// =====================================================

let currentTenantId: string | null = null;

export function setTenantContext(tenantId: string | null) {
  currentTenantId = tenantId;
}

export function getTenantContext(): string | null {
  return currentTenantId;
}

export async function withTenantContext<T>(
  tenantId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = currentTenantId;
  setTenantContext(tenantId);
  try {
    return await fn();
  } finally {
    setTenantContext(previous);
  }
}

// =====================================================
// Re-exports
// =====================================================

export * from '@prisma/client';
