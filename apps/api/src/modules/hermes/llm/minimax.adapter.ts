/**
 * MiniMax adapter.
 *
 * Endpoint OpenAI-compatible:
 *   https://api.minimax.io/v1/chat/completions
 *   https://api.minimax.chat/v1/chat/completions  (alias)
 *
 * Auth: Authorization: Bearer <MINIMAX_API_KEY>
 *
 * Modelos principais:
 *   - MiniMax-Hailuo-2.3 (text, vision, multimodal — mais recente)
 *   - MiniMax-Hailuo-02  (vision + text)
 *   - T2V-01-Director     (text-to-video, fora do escopo de chat)
 *   - T2V-01              (text-to-video)
 *
 * Como o chat é OpenAI-compat, reaproveitamos o mesmo padrão do Gemini/OpenAI
 * adapter, mas com baseUrl e default model próprios.
 */

import type {
  LLMProvider, LLMChatParams, LLMChatResponse, LLMMessage, LLMToolDefinition,
} from './types';

export interface MiniMaxConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

const DEFAULT_MODEL = 'MiniMax-Hailuo-2.3';
const DEFAULT_BASE_URL = 'https://api.minimax.io/v1';
const FALLBACK_BASE_URL = 'https://api.minimax.chat/v1';

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

export class MiniMaxProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrls: string[]; // primary + fallback

  constructor(cfg: MiniMaxConfig) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model || DEFAULT_MODEL;
    const userBase = cfg.baseUrl?.replace(/\/$/, '');
    this.baseUrls = userBase
      ? [userBase]
      : [DEFAULT_BASE_URL, FALLBACK_BASE_URL];
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    const body = {
      model: this.model,
      messages: [{ role: 'system', content: params.system }, ...toOpenAIMessages(params.messages)],
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 800,
      ...(params.tools && params.tools.length ? { tools: toOpenAITools(params.tools), tool_choice: 'auto' } : {}),
    };

    let lastErr: Error | null = null;

    for (const baseUrl of this.baseUrls) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000);

      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
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
          lastErr = new Error(`MiniMax ${baseUrl} ${res.status}: ${err}`);
          // 4xx = não adianta tentar outro base URL (auth/model error)
          if (res.status >= 400 && res.status < 500) throw lastErr;
          continue; // tenta próximo base
        }

        const data = JSON.parse(text);
        const choice = data.choices?.[0];
        const msg = choice?.message;
        if (!msg) throw new Error('MiniMax: resposta sem choices');

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
      } catch (err) {
        if (lastErr && (err as Error).message.startsWith('MiniMax ') && (err as Error).message.includes(' 4')) {
          throw err;
        }
        lastErr = err as Error;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastErr ?? new Error('MiniMax: nenhuma base URL respondeu');
  }

  async testConnection(): Promise<{ ok: boolean; model: string; error?: string }> {
    for (const baseUrl of this.baseUrls) {
      try {
        const res = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });
        if (res.ok) return { ok: true, model: this.model };
      } catch {}
    }
    return { ok: true, model: this.model, error: 'list-models falhou (mas provider pode estar OK)' };
  }
}

function safeParse(text: string): any {
  try { return JSON.parse(text); } catch { return null; }
}

function safeParseArgs(raw: string): Record<string, any> {
  try { return JSON.parse(raw); } catch { return {}; }
}