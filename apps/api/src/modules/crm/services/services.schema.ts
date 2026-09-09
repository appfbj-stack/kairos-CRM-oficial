import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(5).max(720).default(60),
  priceCents: z.number().int().min(0),
  category: z.string().max(60).optional(),
  active: z.boolean().default(true),
});

export const updateServiceSchema = createServiceSchema.partial();

export const listServicesQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
