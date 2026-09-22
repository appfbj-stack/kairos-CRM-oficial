/**
 * OpenAI-compatible adapter — cobre qualquer provider que implementa
 * a API /v1/chat/completions do OpenAI:
 *   - OpenAI oficial (api.openai.com)
 *   - OpenRouter (openrouter.ai/api/v1)
 *   - DeepSeek (api.deepseek.com)
 *   - GLM / Zhipu (open.bigmodel.cn/api/paas/v4)
 *   - Ollama (host local)
 *   - Groq (api.groq.com/openai/v1)
 *   - qualquer clone compatível
 *
 * Diferenças entre providers implementadas via `extraHeaders`:
 *   - OpenRouter: precisa `HTTP-Referer` + `X-Title` (metadata)
 *   - Ollama: não precisa de Authorization (mas aceita)
 *   - Groq: precisa `User-Agent` específico (opcional)
 */

import type {
  LLMProvider, LLMChatParams, LLMChatResponse, LLMMessage, LLMToolDefinition,
} from './types';

export interface OpenAICompatibleConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;        // default https://api.openai.com/v1
  extraHeaders?: Record<string, string>;  // headers adicionais (HTTP-Referer, X-Title, etc)
  defaultModel?: string;
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

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

export class OpenAICompatibleProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private extraHeaders: Record<string, string>;

  constructor(cfg: OpenAICompatibleConfig) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model || cfg.defaultModel || DEFAULT_MODEL;
    this.baseUrl = (cfg.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.extraHeaders = cfg.extraHeaders || {};
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    const body: any = {
      model: this.model,
      messages: [{ role: 'system', content: params.system }, ...toOpenAIMessages(params.messages)],
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 800,
    };
    if (params.tools && params.tools.length) {
      body.tools = toOpenAITools(params.tools);
      body.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...this.extraHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      if (!res.ok) {
        const err = safeParse(text)?.error?.message || text || res.statusText;
        throw new Error(`OpenAI-compat ${this.baseUrl} ${res.status}: ${err}`);
      }
      const data = JSON.parse(text);
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) throw new Error('Resposta sem choices');

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
      // OpenRouter exige POST em /chat/completions pra validar (não tem GET /models)
      // Tentamos GET /models primeiro; se falhar (404), assumimos OK e o app descobre via erro de chat
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}`, ...this.extraHeaders },
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

/**
 * Preset de headers específicos por provider.
 */
export const OPENAI_COMPAT_PRESETS: Record<string, { baseUrl?: string; extraHeaders?: Record<string, string>; defaultModel?: string }> = {
  OPENAI: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  OPENROUTER: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'nex-agi/nex-n2.5-mini:free',
    extraHeaders: {
      'HTTP-Referer': 'https://crm.fbautomacao.space',
      'X-Title': 'Kairos CRM',
    },
  },
  DEEPSEEK: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  GLM: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
  },
  GROQ: {
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  OLLAMA: {
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
  },
};