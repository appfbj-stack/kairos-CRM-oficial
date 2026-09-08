import { z } from 'zod';

export const createKnowledgeSchema = z.object({
  question: z.string().min(3).max(500),
  answer: z.string().min(3).max(4000),
  category: z.string().max(60).optional(),
  source: z.string().max(60).optional(),
  active: z.boolean().default(true),
});

export const updateKnowledgeSchema = createKnowledgeSchema.partial();

export const listKnowledgeQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const searchKnowledgeSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.coerce.number().min(1).max(10).default(5),
});

export type CreateKnowledgeInput = z.infer<typeof createKnowledgeSchema>;
export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeSchema>;
