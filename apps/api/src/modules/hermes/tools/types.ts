import type { AuthenticatedUser } from '@kairos-crm/shared';
import type { LLMToolDefinition } from '../llm/types';

export interface ToolContext {
  actor: AuthenticatedUser;
  conversationId?: string;
  contactId?: string;
  leadId?: string;
}

export interface ToolResult {
  ok: boolean;
  result?: any;
  error?: string;
}

export interface KairosTool {
  name: string;
  description: string;
  definition: LLMToolDefinition;
  execute(ctx: ToolContext, args: any): Promise<ToolResult>;
}
