import { z } from 'zod';

export const leadStatusSchema = z.enum(['OPEN', 'WON', 'LOST']);
export const leadTemperatureSchema = z.enum(['COLD', 'WARM', 'HOT']);

export const createLeadSchema = z.object({
  contactId: z.string().uuid(),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  title: z.string().min(2).max(200),
  valueCents: z.number().int().min(0).optional(),
  assignedUserId: z.string().uuid().optional(),
  interest: z.string().max(120).optional(),
  origin: z.string().max(40).optional(),
  intention: z.string().max(40).optional(),
});

export const updateLeadSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  valueCents: z.number().int().min(0).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  interest: z.string().max(120).optional(),
  origin: z.string().max(40).optional(),
  intention: z.string().max(40).optional(),
  status: leadStatusSchema.optional(),
  temperature: leadTemperatureSchema.optional(),
  lostReason: z.string().max(500).optional(),
});

export const moveLeadSchema = z.object({
  stageId: z.string().uuid(),
  reason: z.string().max(200).optional(),
});

export const listLeadsQuerySchema = z.object({
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  status: leadStatusSchema.optional(),
  temperature: leadTemperatureSchema.optional(),
  assignedUserId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type MoveLeadInput = z.infer<typeof moveLeadSchema>;
