import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(2).max(80),
  number: z.string().regex(/^\d{10,15}$/).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4096),
});

export const listConversationsQuerySchema = z.object({
  status: z.enum(['OPEN', 'WITH_HUMAN', 'WITH_AI', 'CLOSED']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(100),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
