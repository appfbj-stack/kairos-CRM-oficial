/**
 * Anthropic Claude adapter — API Messages (formato próprio, NÃO OpenAI-compat).
 *
 * Diferenças vs OpenAI:
 *   - Endpoint: POST /v1/messages (não /chat/completions)
 *   - Headers: `x-api-key` + `anthropic-version: 2023-06-01`
 *   - System message vai em campo separado `system`, não em messages
 *   - Tools: formato `tools: [{name, description, input_schema}]`
 *   - Tool calls: `content[].type === "tool_use"` com `id`, `name`, `input`
 *   - Tool results: `role: "user", content: [{type: "tool_result", tool_use_id, content}]`
 *   - max_tokens é OBRIGATÓRIO
 */

import type {
  LLMProvider, LLMChatParams, LLMChatResponse, LLMMessage, LLMToolDefinition,
} from './types';

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(cfg: AnthropicConfig) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model || DEFAULT_MODEL;
    this.baseUrl = (cfg.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    const messages = params.messages.map(toAnthropicMessage);
    const body: any = {
      model: this.model,
      system: params.system,
      messages,
      max_tokens: params.maxTokens ?? 800,
      temperature: params.temperature ?? 0.7,
    };
    if (params.tools && params.tools.length) {
      body.tools = params.tools.map(toAnthropicTool);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      if (!res.ok) {
        const err = safeParse(text)?.error?.message || text || res.statusText;
        throw new Error(`Anthropic ${res.status}: ${err}`);
      }
      const data = JSON.parse(text);

      // Extrai conteúdo
      let content: string | null = null;
      const toolCalls: any[] = [];

      for (const block of data.content || []) {
        if (block.type === 'text') {
          content = (content || '') + block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input || {},
          });
        }
      }

      return {
        content,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        usage: data.usage && {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(): Promise<{ ok: boolean; model: string; error?: string }> {
    try {
      // Anthropic não tem GET /models; só testamos via um chat mínimo
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (res.ok) return { ok: true, model: this.model };
      const err = safeParse(await res.text())?.error?.message || `HTTP ${res.status}`;
      return { ok: false, model: this.model, error: err };
    } catch (err) {
      return { ok: false, model: this.model, error: (err as Error).message };
    }
  }
}

function toAnthropicMessage(m: LLMMessage): any {
  if (m.role === 'tool') {
    return {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: m.toolCallId,
        content: m.content || '',
      }],
    };
  }
  if (m.role === 'assistant') {
    if (m.toolCalls && m.toolCalls.length) {
      return {
        role: 'assistant',
        content: m.toolCalls.map((tc) => ({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        })),
      };
    }
    return { role: 'assistant', content: m.content || '' };
  }
  return { role: 'user', content: m.content || '' };
}

function toAnthropicTool(t: LLMToolDefinition): any {
  return {
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  };
}

function safeParse(text: string): any {
  try { return JSON.parse(text); } catch { return null; }
}