import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(2).max(120),
  document: z.string().max(40).optional().or(z.literal('')),
  industry: z.string().max(80).optional().or(z.literal('')),
  size: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  website: z.string().url().max(200).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export const updateCompanySchema = createCompanySchema.partial();

export const listCompaniesQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
