import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare function setTenantContext(tenantId: string | null): void;
export declare function getTenantContext(): string | null;
export declare function withTenantContext<T>(tenantId: string | null, fn: () => Promise<T>): Promise<T>;
export * from '@prisma/client';
