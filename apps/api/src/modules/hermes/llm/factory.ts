import type { LLMProvider } from './types';
import { OpenAIProvider } from './openai.adapter';
import { OpenRouterProvider } from './openrouter.adapter';

export interface AIConfigSnapshot {
  provider: 'OPENAI' | 'GEMINI' | 'CLAUDE' | 'DEEPSEEK' | 'GLM' | 'OLLAMA' | 'OPENROUTER';
  model: string | null;
  apiKey: string | null;
  baseUrl?: string | null;
}

/**
 * Constrói o provider de LLM a partir do AIConfig do tenant.
 * V1: só OpenAI, OpenRouter e Ollama são totalmente implementados. Outros retornam erro claro.
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
    case 'OPENROUTER':
      return new OpenRouterProvider({
        apiKey: cfg.apiKey,
        model: cfg.model || 'anthropic/claude-3.5-sonnet',
        siteUrl: process.env.OPENROUTER_SITE_URL || 'https://crm.fbautomacao.space',
        appName: process.env.OPENROUTER_APP_NAME || 'Kairos CRM',
      });
    default:
      throw new Error(`Provider ${cfg.provider} ainda não implementado na V1. Use OPENAI ou OPENROUTER por enquanto.`);
  }
}
