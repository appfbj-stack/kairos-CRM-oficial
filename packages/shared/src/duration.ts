/**
 * Converte string de duração ("15m", "7d", "30s", "1h") para milissegundos.
 *
 * Suporta: ms, s, m, h, d
 * Default: 7 dias (se formato inválido)
 *
 * Extraído para evitar duplicação entre auth.service.ts e jwt.ts.
 */

const DEFAULT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function parseDurationToMs(d: string): number {
  const match = d.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return DEFAULT_DURATION_MS;
  const [, n, unit] = match;
  const num = parseInt(n, 10);
  switch (unit) {
    case 'ms': return num;
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return DEFAULT_DURATION_MS;
  }
}

export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}