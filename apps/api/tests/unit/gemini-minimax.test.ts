/**
 * Smoke tests para os novos adapters Gemini + MiniMax.
 * Não faz chamada de rede — só verifica que instanciam e exportam corretamente.
 */

import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '../../src/modules/hermes/llm/gemini.adapter';
import { MiniMaxProvider } from '../../src/modules/hermes/llm/minimax.adapter';
import { buildProvider } from '../../src/modules/hermes/llm/factory';

describe('GeminiProvider', () => {
  it('instanicia com apiKey + model default', () => {
    const p = new GeminiProvider({ apiKey: 'test' });
    expect(p).toBeDefined();
  });

  it('aceita model e baseUrl customizados', () => {
    const p = new GeminiProvider({ apiKey: 'test', model: 'gemini-2.5-pro', baseUrl: 'https://example.com/v1' });
    expect(p).toBeDefined();
  });
});

describe('MiniMaxProvider', () => {
  it('instanicia com apiKey + model default', () => {
    const p = new MiniMaxProvider({ apiKey: 'test' });
    expect(p).toBeDefined();
  });

  it('aceita model e baseUrl customizados', () => {
    const p = new MiniMaxProvider({ apiKey: 'test', model: 'T2V-01-Director', baseUrl: 'https://custom.io/v1' });
    expect(p).toBeDefined();
  });
});

describe('buildProvider', () => {
  it('retorna GeminiProvider quando provider=GEMINI', () => {
    const p = buildProvider({ provider: 'GEMINI', apiKey: 'test', model: null });
    expect(p).toBeInstanceOf(GeminiProvider);
  });

  it('retorna MiniMaxProvider quando provider=MINIMAX', () => {
    const p = buildProvider({ provider: 'MINIMAX', apiKey: 'test', model: null });
    expect(p).toBeInstanceOf(MiniMaxProvider);
  });

  it('lança erro se apiKey não fornecido', () => {
    expect(() =>
      buildProvider({ provider: 'GEMINI', apiKey: null, model: null }),
    ).toThrow('sem apiKey');
  });
});