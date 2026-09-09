"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.createUserSchema = exports.userStatusSchema = exports.userRoleSchema = void 0;
const zod_1 = require("zod");
const auth_1 = require("./auth");
exports.userRoleSchema = zod_1.z.enum([
    'SUPER_ADMIN',
    'TENANT_ADMIN',
    'MANAGER',
    'AGENT',
    'USER',
]);
exports.userStatusSchema = zod_1.z.enum([
    'ACTIVE',
    'INACTIVE',
    'PENDING',
    'SUSPENDED',
]);
exports.createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    email: auth_1.emailSchema,
    password: auth_1.passwordSchema,
    role: exports.userRoleSchema.default('USER'),
    phone: zod_1.z.string().min(8).max(20).optional(),
});
exports.updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120).optional(),
    email: auth_1.emailSchema.optional(),
    role: exports.userRoleSchema.optional(),
    status: exports.userStatusSchema.optional(),
    phone: zod_1.z.string().min(8).max(20).optional(),
    password: auth_1.passwordSchema.optional(),
});
