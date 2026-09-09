import { z } from 'zod';

export const createAutomationSchema = z.object({
  name: z.string().min(2).max(120),
  trigger: z.enum(['lead_created', 'message_received', 'no_response_24h', 'appointment_created']),
  conditions: z.record(z.string(), z.any()).optional().nullable(),
  actions: z.array(z.object({
    type: z.enum(['send_whatsapp', 'create_task', 'move_lead', 'handoff_to_human', 'send_whatsapp_ai']),
    params: z.record(z.string(), z.any()),
  })).min(1),
  isTemplate: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const updateAutomationSchema = createAutomationSchema.partial();

export const listAutomationsQuerySchema = z.object({
  trigger: z.string().optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;

// ===== FollowUps =====

export const createFollowUpSchema = z.object({
  contactId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  messageTemplate: z.string().min(1).max(2000),
  scheduledAt: z.coerce.date(),
  assignedUserId: z.string().uuid().optional(),
});

export const listFollowUpsQuerySchema = z.object({
  status: z.enum(['SCHEDULED', 'SENT', 'CANCELLED', 'FAILED']).optional(),
  assignedUserId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// ===== Appointments =====

export const createAppointmentSchema = z.object({
  contactId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  notes: z.string().max(2000).optional(),
  source: z.string().max(40).optional(),
  assignedUserId: z.string().uuid().optional(),
});

export const updateAppointmentSchema = z.object({
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'DONE', 'CANCELLED', 'NO_SHOW']).optional(),
  notes: z.string().max(2000).optional(),
  assignedUserId: z.string().uuid().optional().nullable(),
});

export const listAppointmentsQuerySchema = z.object({
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'DONE', 'CANCELLED', 'NO_SHOW']).optional(),
  contactId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
