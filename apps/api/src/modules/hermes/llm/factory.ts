import type { LLMProvider } from './types';
import { OpenAIProvider } from './openai.adapter';

export interface AIConfigSnapshot {
  provider: 'OPENAI' | 'GEMINI' | 'CLAUDE' | 'DEEPSEEK' | 'GLM' | 'OLLAMA';
  model: string | null;
  apiKey: string | null;
  baseUrl?: string | null;
}

/**
 * Constrói o provider de LLM a partir do AIConfig do tenant.
 * V1: só OpenAI é totalmente implementado. Outros retornam erro claro.
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
    case 'OLLAMA':
      return new OpenAIProvider({
        apiKey: cfg.apiKey || 'ollama',
        model: cfg.model || 'llama3.1',
        baseUrl: cfg.baseUrl || 'http://localhost:11434/v1',
      });
    default:
      throw new Error(`Provider ${cfg.provider} ainda não implementado na V1. Use OPENAI por enquanto.`);
  }
}
