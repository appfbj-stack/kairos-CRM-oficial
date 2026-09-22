import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export { setTenantContext, getTenantContext, withTenantContext, getTenantContextDebug, } from './context';
export * from '@prisma/client';
