import type { LLMProvider } from './types';
import { OpenAICompatibleProvider, OPENAI_COMPAT_PRESETS } from './openai-compatible.adapter';
import { OpenAIProvider } from './openai.adapter';
import { AnthropicProvider } from './anthropic.adapter';
import { GeminiProvider } from './gemini.adapter';
import { MiniMaxProvider } from './minimax.adapter';

export type LLMProviderId =
  | 'OPENAI'
  | 'OPENROUTER'
  | 'GEMINI'
  | 'CLAUDE'
  | 'DEEPSEEK'
  | 'GLM'
  | 'GROQ'
  | 'OLLAMA'
  | 'MINIMAX';

export interface AIConfigSnapshot {
  provider: LLMProviderId;
  model: string | null;
  apiKey: string | null;
  baseUrl?: string | null;
}

/**
 * Constrói o provider de LLM a partir do AIConfig do tenant.
 *
 * Cobertura:
 *   - OPENAI     → OpenAIProvider (mantido por compat)
 *   - OPENROUTER → OpenAI-compatible com headers extras
 *   - DEEPSEEK   → OpenAI-compatible
 *   - GLM        → OpenAI-compatible
 *   - GROQ       → OpenAI-compatible
 *   - OLLAMA     → OpenAI-compatible (baseUrl custom)
 *   - CLAUDE     → AnthropicProvider (formato próprio)
 *   - GEMINI     → GeminiProvider (OpenAI-compat endpoint)
 *   - MINIMAX    → MiniMaxProvider (OpenAI-compat, fallback api.minimax.chat)
 */
export function buildProvider(cfg: AIConfigSnapshot): LLMProvider {
  if (!cfg.apiKey) {
    throw new Error('AIConfig sem apiKey — configure a chave do provider em /hermes');
  }

  switch (cfg.provider) {
    case 'OPENAI':
      return new OpenAIProvider({
        apiKey: cfg.apiKey,
        model: cfg.model || 'gpt-4o-mini',
        baseUrl: cfg.baseUrl || undefined,
      });

    case 'OPENROUTER':
    case 'DEEPSEEK':
    case 'GLM':
    case 'GROQ':
    case 'OLLAMA': {
      const preset = OPENAI_COMPAT_PRESETS[cfg.provider];
      return new OpenAICompatibleProvider({
        apiKey: cfg.apiKey,
        model: cfg.model || preset?.defaultModel,
        baseUrl: cfg.baseUrl || preset?.baseUrl,
        extraHeaders: preset?.extraHeaders,
        defaultModel: preset?.defaultModel,
      });
    }

    case 'CLAUDE':
      return new AnthropicProvider({
        apiKey: cfg.apiKey,
        model: cfg.model || undefined,
        baseUrl: cfg.baseUrl || undefined,
      });

    case 'GEMINI':
      return new GeminiProvider({
        apiKey: cfg.apiKey,
        model: cfg.model || undefined,
        baseUrl: cfg.baseUrl || undefined,
      });

    case 'MINIMAX':
      return new MiniMaxProvider({
        apiKey: cfg.apiKey,
        model: cfg.model || undefined,
        baseUrl: cfg.baseUrl || undefined,
      });

    default:
      throw new Error(`Provider ${cfg.provider} não reconhecido`);
  }
}