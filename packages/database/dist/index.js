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
exports.getTenantContextDebug = exports.withTenantContext = exports.getTenantContext = exports.setTenantContext = exports.prisma = void 0;
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
// Tenant context — AsyncLocalStorage (Fase 1 refactor)
// Resolve race condition do antigo currentTenantId global.
// API compatível com versões anteriores.
// =====================================================
var context_1 = require("./context");
Object.defineProperty(exports, "setTenantContext", { enumerable: true, get: function () { return context_1.setTenantContext; } });
Object.defineProperty(exports, "getTenantContext", { enumerable: true, get: function () { return context_1.getTenantContext; } });
Object.defineProperty(exports, "withTenantContext", { enumerable: true, get: function () { return context_1.withTenantContext; } });
Object.defineProperty(exports, "getTenantContextDebug", { enumerable: true, get: function () { return context_1.getTenantContextDebug; } });
// =====================================================
// Re-exports
// =====================================================
__exportStar(require("@prisma/client"), exports);
