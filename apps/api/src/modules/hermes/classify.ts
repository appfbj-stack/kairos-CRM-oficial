/**
 * Classificador determinístico (rules-based).
 *
 * Roda ANTES do LLM pra detectar intenção óbvia sem gastar tokens.
 * Se retornar match com confiança ≥ MIN_CONFIDENCE, o backend usa direto.
 * Senão, chama LLM.
 *
 * Vantagens:
 *   - 0 tokens gastos nos casos óbvios (~60-80% do tráfego real)
 *   - Latência < 1ms
 *   - Determinístico (testável)
 *   - Funciona offline
 *
 * Quando NÃO chamar LLM:
 *   - Saudação simples ("oi", "olá", "bom dia")
 *   - Agradecimento ("obrigado", "valeu")
 *   - Despedida ("tchau", "até mais")
 *   - Pedido de humano ("falar com alguém", "atendente")
 *
 * Quando chamar LLM:
 *   - Mensagens com conteúdo substantivo (orçamento, dúvida técnica, etc)
 *   - Mensagens com entidades a extrair (veículo, produto, valor)
 */

export type Intent =
  | 'greeting'
  | 'thanks'
  | 'goodbye'
  | 'request_human'
  | 'orcamento'
  | 'agendamento'
  | 'reclamacao'
  | 'compra'
  | 'info'
  | 'social'
  | 'unknown';

export interface DeterministicResult {
  intent: Intent;
  confidence: number; // 0..1
  reason: string;     // qual regra bateu (debug)
}

const MIN_CONFIDENCE = 0.85;

interface Rule {
  intent: Intent;
  patterns: RegExp[];
  confidence: number;
}

const RULES: Rule[] = [
  {
    intent: 'greeting',
    patterns: [
      /^(oi|olá|ola|hi|hey|bom dia|boa tarde|boa noite|e ai|eai|salve)\b/i,
    ],
    confidence: 0.92,
  },
  {
    intent: 'thanks',
    patterns: [
      /^(obrigad[ao]|valeu|thanks|vlw|brigad[ao]|muito obrigad[ao])\b/i,
    ],
    confidence: 0.95,
  },
  {
    intent: 'goodbye',
    patterns: [
      /^(tchau|bye|até mais|ate mais|falou|flw|vlw|fui)\b/i,
    ],
    confidence: 0.90,
  },
  {
    intent: 'request_human',
    patterns: [
      /(atendente|humano|pessoa|alguém|alguem|representante|gerente)/i,
      /(quero falar|falar com|me liga|me chama)/i,
      /^(parar|pare|stop|cancelar conversa)$/i,
    ],
    confidence: 0.88,
  },
  {
    intent: 'orcamento',
    patterns: [
      /(orçamento|orcamento|cotação|cotacao|preço|preco|quanto custa|quanto é|quanto e|valor)/i,
      /(\b\d{1,3}(\.\d{3})*,\d{2}\b|\bR\$\s*\d)/i, // R$ ou valor formato BR
    ],
    confidence: 0.90,
  },
  {
    intent: 'agendamento',
    patterns: [
      /(agendar|agendamento|marcar|horário|horario|disponível|disponivel)/i,
      /(próxima semana|proxima semana|amanhã|amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)/i,
    ],
    confidence: 0.85,
  },
  {
    intent: 'reclamacao',
    patterns: [
      /(reclamação|reclamacao|insatisfeito|problema|defeito|errado|errada|reclame)/i,
      /(péssimo|pessimo|horrível|horrivel|absurdo|vergonha)/i,
    ],
    confidence: 0.90,
  },
  {
    intent: 'compra',
    patterns: [
      /(quero comprar|queremos comprar|fechar pedido|fechar negócio|fechar negocio|finalizar compra)/i,
      /(\b\d{4,5}\b.*\b(ano|modelo|versao|versão)\b)/i, // ano + modelo/versão
    ],
    confidence: 0.82,
  },
];

/**
 * Tenta classificar mensagem de forma determinística.
 * Retorna null se nenhuma regra bateu com confiança suficiente.
 */
export function classifyDeterministic(message: string): DeterministicResult | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        return {
          intent: rule.intent,
          confidence: rule.confidence,
          reason: `pattern matched: ${pattern.source}`,
        };
      }
    }
  }

  return null;
}

/**
 * Decide se deve chamar LLM ou usar classificador direto.
 */
export function shouldCallLLM(message: string, minConfidence = MIN_CONFIDENCE): {
  useDirect: boolean;
  deterministic: DeterministicResult | null;
  reason: string;
} {
  const result = classifyDeterministic(message);
  if (result && result.confidence >= minConfidence) {
    return {
      useDirect: true,
      deterministic: result,
      reason: `intenção óbvia (${result.intent}) — sem LLM`,
    };
  }
  return {
    useDirect: false,
    deterministic: result,
    reason: result
      ? `confiança ${result.confidence} abaixo de ${minConfidence} — chamando LLM`
      : 'nenhuma regra bateu — chamando LLM',
  };
}

/**
 * Extração determinística de entidades óbvias (ano de veículo, valores em R$).
 * Complementa o que o LLM extrai, sem custar tokens.
 */
export interface ExtractedEntities {
  vehicleYear?: number;
  vehicleModel?: string;
  currency?: { value: number; currency: 'BRL' };
  phones?: string[];
  emails?: string[];
}

const YEAR_REGEX = /\b(19[5-9]\d|20[0-3]\d)\b/g;
const CURRENCY_REGEX = /R\$\s*([\d.]+(?:,\d{1,2})?)/gi;
// Formato BR: (15) 99272-4313, 15 99272-4313, +55 15 99272-4313, 11992724313
const PHONE_REGEX = /(?:\+?55[\s-]?)?\(?(\d{2})\)?[\s-]?(9?\d{4})[\s-]?(\d{4})/g;
const EMAIL_REGEX = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

export function extractEntities(message: string): ExtractedEntities {
  const entities: ExtractedEntities = {};

  const years = message.match(YEAR_REGEX);
  if (years && years.length) {
    const year = parseInt(years[0], 10);
    if (year >= 1950 && year <= 2030) entities.vehicleYear = year;
  }

  const currencies = message.matchAll(CURRENCY_REGEX);
  for (const m of currencies) {
    const raw = m[1].replace(/\./g, '').replace(',', '.');
    const value = parseFloat(raw);
    if (!isNaN(value) && value > 0) {
      entities.currency = { value, currency: 'BRL' };
      break;
    }
  }

  const phones = message.match(PHONE_REGEX);
  if (phones) entities.phones = phones.map((p) => p.replace(/\D/g, ''));

  const emails = message.match(EMAIL_REGEX);
  if (emails) entities.emails = emails;

  return entities;
}