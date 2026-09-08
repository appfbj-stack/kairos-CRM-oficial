import { z } from 'zod';

export const slugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens');

export const emailSchema = z.string().email('Email inválido').toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter pelo menos 8 caracteres')
  .max(128, 'Senha muito longa')
  .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve ter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve ter pelo menos um número');

export const registerSchema = z.object({
  // Empresa
  tenantName: z.string().min(2).max(120),
  tenantSlug: slugSchema,
  tenantEmail: emailSchema,
  tenantPhone: z.string().min(8).max(20).optional(),

  // Admin
  name: z.string().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  // Slug do tenant. Opcional — se omitido, assume SUPER_ADMIN
  // ou tenta descobrir pelo email.
  tenantSlug: slugSchema.optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
