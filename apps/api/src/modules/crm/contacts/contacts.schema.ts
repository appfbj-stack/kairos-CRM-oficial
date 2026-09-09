import { z } from 'zod';
import { emailSchema } from '@kairos-crm/shared';

const phoneSchema = z
  .string()
  .min(8, 'Telefone deve ter pelo menos 8 dígitos')
  .max(20)
  .regex(/^[\d+\-\s()]+$/, 'Telefone inválido')
  .optional()
  .or(z.literal(''));

export const createContactSchema = z.object({
  name: z.string().min(2).max(120),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  companyId: z.string().uuid().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  notes: z.string().max(2000).optional(),
  source: z.string().max(40).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const listContactsQuerySchema = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
