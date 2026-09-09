import type {
  LLMProvider, LLMChatParams, LLMChatResponse, LLMMessage, LLMToolDefinition,
} from './types';

export interface OpenRouterConfig {
  apiKey: string;
  model?: string; // default: anthropic/claude-3.5-sonnet
  siteUrl?: string; // HTTP-Referer (recomendado pela OpenRouter)
  appName?: string; // X-Title (recomendado pela OpenRouter)
}

const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

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

export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private siteUrl?: string;
  private appName?: string;

  constructor(cfg: OpenRouterConfig) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model || DEFAULT_MODEL;
    this.baseUrl = DEFAULT_BASE_URL;
    this.siteUrl = cfg.siteUrl;
    this.appName = cfg.appName;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.siteUrl) h['HTTP-Referer'] = this.siteUrl;
    if (this.appName) h['X-Title'] = this.appName;
    return h;
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    const body = {
      model: this.model,
      messages: [{ role: 'system', content: params.system }, ...toOpenAIMessages(params.messages)],
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1500,
      ...(params.tools && params.tools.length ? { tools: toOpenAITools(params.tools), tool_choice: 'auto' } : {}),
    };

    // Retry com backoff em caso de 429/503/504 (rate limit ou instabilidade)
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const text = await res.text();
        const data = JSON.parse(text);
        const choice = data.choices?.[0];
        const msg = choice?.message;
        if (!msg) throw new Error('OpenRouter: resposta sem choices');

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
      }

      // 429/503/504 → retry com backoff
      const text = await res.text();
      const err = text ? safeJsonError(text) || text : res.statusText;
      lastErr = new Error(`OpenRouter ${res.status}: ${err}`);
      if (res.status === 429 || res.status === 503 || res.status === 504) {
        if (attempt < 2) {
          const wait = 1500 * Math.pow(2, attempt); // 1.5s, 3s
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
      }
      break;
    }
    throw lastErr || new Error('OpenRouter: erro desconhecido');
  }

  async testConnection(): Promise<{ ok: boolean; model: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, { headers: this.headers() });
      if (!res.ok) {
        return { ok: false, model: this.model, error: `OpenRouter ${res.status}` };
      }
      return { ok: true, model: this.model };
    } catch (err) {
      return { ok: false, model: this.model, error: (err as Error).message };
    }
  }
}

function safeParseArgs(raw: string): Record<string, any> {
  try { return JSON.parse(raw); } catch { return {}; }
}

function safeJsonError(text: string): string | null {
  try {
    const j = JSON.parse(text);
    return j?.error?.message || j?.message || null;
  } catch {
    return null;
  }
}
