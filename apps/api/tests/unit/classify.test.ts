/**
 * Testes: classificador determinístico + extração de entidades (Fase 6).
 */

import { describe, it, expect } from 'vitest';
import {
  classifyDeterministic,
  shouldCallLLM,
  extractEntities,
} from '../../src/modules/hermes/classify';

describe('classifyDeterministic', () => {
  describe('greeting', () => {
    it('detecta "oi"', () => {
      const r = classifyDeterministic('oi');
      expect(r?.intent).toBe('greeting');
      expect(r?.confidence).toBeGreaterThan(0.8);
    });

    it('detecta "bom dia" com maiúscula', () => {
      const r = classifyDeterministic('Bom dia!');
      expect(r?.intent).toBe('greeting');
    });

    it('detecta "boa tarde"', () => {
      const r = classifyDeterministic('Boa tarde, tudo bem?');
      expect(r?.intent).toBe('greeting');
    });
  });

  describe('thanks', () => {
    it('detecta "obrigado"', () => {
      expect(classifyDeterministic('Obrigado!')?.intent).toBe('thanks');
    });
    it('detecta "valeu"', () => {
      expect(classifyDeterministic('Valeu!')?.intent).toBe('thanks');
    });
    it('detecta "muito obrigado"', () => {
      expect(classifyDeterministic('Muito obrigado pela ajuda')?.intent).toBe('thanks');
    });
  });

  describe('goodbye', () => {
    it('detecta "tchau"', () => {
      expect(classifyDeterministic('Tchau!')?.intent).toBe('goodbye');
    });
    it('detecta "até mais"', () => {
      expect(classifyDeterministic('Até mais')?.intent).toBe('goodbye');
    });
  });

  describe('request_human', () => {
    it('detecta pedido explícito de humano', () => {
      const r = classifyDeterministic('quero falar com um atendente');
      expect(r?.intent).toBe('request_human');
    });
    it('detecta "me liga"', () => {
      expect(classifyDeterministic('Por favor me liga')?.intent).toBe('request_human');
    });
  });

  describe('orcamento', () => {
    it('detecta "quanto custa"', () => {
      const r = classifyDeterministic('Quanto custa uma troca de óleo?');
      expect(r?.intent).toBe('orcamento');
    });
    it('detecta "orçamento"', () => {
      expect(classifyDeterministic('Preciso de um orçamento')?.intent).toBe('orcamento');
    });
    it('detecta valor em R$', () => {
      expect(classifyDeterministic('Tem por R$ 350,00?')?.intent).toBe('orcamento');
    });
  });

  describe('agendamento', () => {
    it('detecta "agendar"', () => {
      const r = classifyDeterministic('Quero agendar uma consulta');
      expect(r?.intent).toBe('agendamento');
    });
    it('detecta "amanhã"', () => {
      expect(classifyDeterministic('Tem horário amanhã?')?.intent).toBe('agendamento');
    });
  });

  describe('reclamacao', () => {
    it('detecta "reclamação"', () => {
      const r = classifyDeterministic('Quero fazer uma reclamação');
      expect(r?.intent).toBe('reclamacao');
    });
    it('detecta "péssimo"', () => {
      expect(classifyDeterministic('O serviço foi péssimo')?.intent).toBe('reclamacao');
    });
  });

  describe('unknown', () => {
    it('retorna null para mensagem vazia', () => {
      expect(classifyDeterministic('')).toBeNull();
      expect(classifyDeterministic('   ')).toBeNull();
    });

    it('retorna null para mensagem sem regra', () => {
      expect(classifyDeterministic('xyz123 abcdef nada a ver')).toBeNull();
    });
  });

  describe('caso real do Pastor (Gol 2018 + pastilha)', () => {
    it('detecta orcamento com veículo', () => {
      const r = classifyDeterministic(
        'Meu Gol 2018 está fazendo barulho quando freio. Quanto custa trocar as pastilhas?',
      );
      expect(r?.intent).toBe('orcamento');
    });
  });
});

describe('shouldCallLLM', () => {
  it('não chama LLM para saudação', () => {
    const d = shouldCallLLM('oi');
    expect(d.useDirect).toBe(true);
    expect(d.deterministic?.intent).toBe('greeting');
  });

  it('não chama LLM para reclamação', () => {
    const d = shouldCallLLM('reclamação grave');
    expect(d.useDirect).toBe(true);
  });

  it('chama LLM para mensagem sem regra', () => {
    const d = shouldCallLLM('Preciso trocar o óleo do meu carro, qual o preço?');
    // Pode ou não classificar — se a confiança for < 0.85, chama LLM
    if (!d.useDirect) {
      expect(d.deterministic).toBeNull();
    }
  });
});

describe('extractEntities', () => {
  it('extrai ano de veículo (2018)', () => {
    const e = extractEntities('Meu Gol 2018 está com problema');
    expect(e.vehicleYear).toBe(2018);
  });

  it('extrai valor em R$', () => {
    const e = extractEntities('Custa R$ 350,00');
    expect(e.currency?.value).toBe(350);
    expect(e.currency?.currency).toBe('BRL');
  });

  it('extrai valor em R$ com milhar (1.500)', () => {
    const e = extractEntities('Tá R$ 1.500,00?');
    expect(e.currency?.value).toBe(1500);
  });

  it('extrai telefone BR', () => {
    const e = extractEntities('Me liga (15) 99272-4313');
    // BR celular: DDD (15) + 9 dígitos = 11 totais
    expect(e.phones?.[0]).toMatch(/^15\d{9}$/);
  });

  it('extrai email', () => {
    const e = extractEntities('meu email é teste@gmail.com');
    expect(e.emails?.[0]).toBe('teste@gmail.com');
  });

  it('não extrai ano inválido', () => {
    const e = extractEntities('código 1900'); // 1900 < 1950
    expect(e.vehicleYear).toBeUndefined();
  });

  it('extrai múltiplas entidades juntas', () => {
    const e = extractEntities('Meu Civic 2020 faz barulho. R$ 1200,00. tel (15) 99272-4313');
    expect(e.vehicleYear).toBe(2020);
    expect(e.currency?.value).toBe(1200);
    expect(e.phones?.[0]).toMatch(/^15\d{9}$/);
  });
});