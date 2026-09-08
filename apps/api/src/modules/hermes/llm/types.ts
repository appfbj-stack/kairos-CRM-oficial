/**
 * Interface de LLM Provider. V1: só OpenAI. Fácil adicionar Gemini/Claude depois.
 */

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
  name?: string;
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface LLMChatParams {
  system: string;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMChatResponse {
  content: string | null;
  toolCalls?: LLMToolCall[];
  usage?: { promptTokens: number; completionTokens: number };
}

export interface LLMProvider {
  chat(params: LLMChatParams): Promise<LLMChatResponse>;
  testConnection(): Promise<{ ok: boolean; model: string; error?: string }>;
}
