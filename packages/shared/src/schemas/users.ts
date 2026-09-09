import { z } from 'zod';
import { emailSchema, passwordSchema } from './auth';

export const userRoleSchema = z.enum([
  'SUPER_ADMIN',
  'TENANT_ADMIN',
  'MANAGER',
  'AGENT',
  'USER',
]);

export const userStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'PENDING',
  'SUSPENDED',
]);

export const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  role: userRoleSchema.default('USER'),
  phone: z.string().min(8).max(20).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: emailSchema.optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  phone: z.string().min(8).max(20).optional(),
  password: passwordSchema.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
