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
// Tenant context — AsyncLocalStorage (Fase 1 refactor)
// Resolve race condition do antigo currentTenantId global.
// API compatível com versões anteriores.
// =====================================================

export {
  setTenantContext,
  getTenantContext,
  withTenantContext,
  getTenantContextDebug,
} from './context';

// =====================================================
// Re-exports
// =====================================================

export * from '@prisma/client';
