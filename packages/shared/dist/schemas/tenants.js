"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantActionSchema = exports.updateTenantSchema = exports.createTenantSchema = exports.tenantPlanSchema = exports.tenantStatusSchema = void 0;
const zod_1 = require("zod");
const auth_1 = require("./auth");
exports.tenantStatusSchema = zod_1.z.enum([
    'ACTIVE',
    'SUSPENDED',
    'BLOCKED',
    'TRIAL',
]);
exports.tenantPlanSchema = zod_1.z.enum([
    'TRIAL',
    'STARTER',
    'PRO',
    'ENTERPRISE',
]);
exports.createTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    slug: auth_1.slugSchema,
    email: auth_1.emailSchema,
    phone: zod_1.z.string().min(8).max(20).optional(),
    document: zod_1.z.string().min(11).max(20).optional(),
    plan: exports.tenantPlanSchema.default('TRIAL'),
    status: exports.tenantStatusSchema.default('TRIAL'),
});
exports.updateTenantSchema = exports.createTenantSchema.partial();
exports.tenantActionSchema = zod_1.z.object({
    action: zod_1.z.enum(['activate', 'suspend', 'block', 'unblock']),
    reason: zod_1.z.string().max(500).optional(),
});
