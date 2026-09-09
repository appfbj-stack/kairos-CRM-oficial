import { z } from 'zod';
import { emailSchema, slugSchema } from './auth';

export const tenantStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'BLOCKED',
  'TRIAL',
]);

export const tenantPlanSchema = z.enum([
  'TRIAL',
  'STARTER',
  'PRO',
  'ENTERPRISE',
]);

export const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: slugSchema,
  email: emailSchema,
  phone: z.string().min(8).max(20).optional(),
  document: z.string().min(11).max(20).optional(),
  plan: tenantPlanSchema.default('TRIAL'),
  status: tenantStatusSchema.default('TRIAL'),
});

export const updateTenantSchema = createTenantSchema.partial();

export const tenantActionSchema = z.object({
  action: z.enum(['activate', 'suspend', 'block', 'unblock']),
  reason: z.string().max(500).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type TenantActionInput = z.infer<typeof tenantActionSchema>;
