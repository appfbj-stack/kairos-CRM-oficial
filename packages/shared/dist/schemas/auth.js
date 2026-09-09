"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshSchema = exports.loginSchema = exports.registerSchema = exports.passwordSchema = exports.emailSchema = exports.slugSchema = void 0;
const zod_1 = require("zod");
exports.slugSchema = zod_1.z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens');
exports.emailSchema = zod_1.z.string().email('Email inválido').toLowerCase();
exports.passwordSchema = zod_1.z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .max(128, 'Senha muito longa')
    .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve ter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve ter pelo menos um número');
exports.registerSchema = zod_1.z.object({
    // Empresa
    tenantName: zod_1.z.string().min(2).max(120),
    tenantSlug: exports.slugSchema,
    tenantEmail: exports.emailSchema,
    tenantPhone: zod_1.z.string().min(8).max(20).optional(),
    // Admin
    name: zod_1.z.string().min(2).max(120),
    email: exports.emailSchema,
    password: exports.passwordSchema,
});
exports.loginSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: zod_1.z.string().min(1),
    // Slug do tenant. Opcional — se omitido, assume SUPER_ADMIN
    // ou tenta descobrir pelo email.
    tenantSlug: exports.slugSchema.optional(),
});
exports.refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(20),
});
