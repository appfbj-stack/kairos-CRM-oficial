/**
 * Google Gemini adapter.
 *
 * Estratégia: usa o endpoint OpenAI-compatible do Gemini
 * (https://generativelanguage.googleapis.com/v1beta/openai/chat/completions)
 * que aceita Authorization: Bearer <key> e o schema padrão /chat/completions.
 *
 * Modelos suportados:
 *   - gemini-2.5-flash (default — rápido, multimodal)
 *   - gemini-2.5-pro
 *   - gemini-2.5-flash-lite
 *   - gemini-2.0-flash
 *   - gemini-1.5-pro
 *   - gemini-1.5-flash
 *
 * Funciona em Workers porque não usa libs nativas (fetch puro).
 */

import type {
  LLMProvider, LLMChatParams, LLMChatResponse, LLMMessage, LLMToolDefinition,
} from './types';

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

function toOpenAIMessages(messages: LLMMessage[]): any[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content || '' };
      }
      if (m.role === 'assistant') {
        const out: any = { role: 'assistant', content: m.content };
        if (m.toolCalls && m.toolCalls.length) {
          out.tool_calls = m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          }));
        }
        return out;
      }
      return { role: 'user', content: m.content || '' };
    });
}

function toOpenAITools(tools: LLMToolDefinition[]): any[] {
  return tools.map((t) => ({
    type: 'function',
    function: t.function,
  }));
}

export class GeminiProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(cfg: GeminiConfig) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model || DEFAULT_MODEL;
    this.baseUrl = (cfg.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    const body = {
      model: this.model,
      messages: [{ role: 'system', content: params.system }, ...toOpenAIMessages(params.messages)],
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 800,
      ...(params.tools && params.tools.length ? { tools: toOpenAITools(params.tools), tool_choice: 'auto' } : {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      if (!res.ok) {
        const err = safeParse(text)?.error?.message || text || res.statusText;
        throw new Error(`Gemini ${res.status}: ${err}`);
      }
      const data = JSON.parse(text);
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) throw new Error('Gemini: resposta sem choices');

      const toolCalls = (msg.tool_calls || []).map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: safeParseArgs(tc.function.arguments),
      }));

      return {
        content: msg.content || null,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        usage: data.usage && {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(): Promise<{ ok: boolean; model: string; error?: string }> {
    try {
      // Gemini OpenAI-compat expõe /models
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (res.ok) return { ok: true, model: this.model };
      return { ok: true, model: this.model, error: 'list-models falhou (mas provider pode estar OK)' };
    } catch (err) {
      return { ok: false, model: this.model, error: (err as Error).message };
    }
  }
}

function safeParse(text: string): any {
  try { return JSON.parse(text); } catch { return null; }
}

function safeParseArgs(raw: string): Record<string, any> {
  try { return JSON.parse(raw); } catch { return {}; }
}