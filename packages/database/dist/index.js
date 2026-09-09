"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.setTenantContext = setTenantContext;
exports.getTenantContext = getTenantContext;
exports.withTenantContext = withTenantContext;
const client_1 = require("@prisma/client");
// Singleton do Prisma (evita múltiplas conexões em dev com HMR)
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
    });
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
// =====================================================
// Tenant context — setado por request no Fastify
// para uso com Row Level Security (Fase 2+)
// =====================================================
let currentTenantId = null;
function setTenantContext(tenantId) {
    currentTenantId = tenantId;
}
function getTenantContext() {
    return currentTenantId;
}
async function withTenantContext(tenantId, fn) {
    const previous = currentTenantId;
    setTenantContext(tenantId);
    try {
        return await fn();
    }
    finally {
        setTenantContext(previous);
    }
}
// =====================================================
// Re-exports
// =====================================================
__exportStar(require("@prisma/client"), exports);
