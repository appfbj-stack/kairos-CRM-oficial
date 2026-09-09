import type {
  LLMProvider, LLMChatParams, LLMChatResponse, LLMMessage, LLMToolDefinition,
} from './types';

export interface OpenAIConfig {
  apiKey: string;
  model?: string; // default gpt-4o-mini
  baseUrl?: string;
}

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

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(cfg: OpenAIConfig) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model || DEFAULT_MODEL;
    this.baseUrl = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    const body = {
      model: this.model,
      messages: [{ role: 'system', content: params.system }, ...toOpenAIMessages(params.messages)],
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 800,
      ...(params.tools && params.tools.length ? { tools: toOpenAITools(params.tools), tool_choice: 'auto' } : {}),
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      const err = text ? JSON.parse(text).error?.message || text : res.statusText;
      throw new Error(`OpenAI ${res.status}: ${err}`);
    }
    const data = JSON.parse(text);
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) throw new Error('OpenAI: resposta sem choices');

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

  async testConnection(): Promise<{ ok: boolean; model: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) {
        return { ok: false, model: this.model, error: `OpenAI ${res.status}` };
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
