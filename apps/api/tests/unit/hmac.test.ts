/**
 * Testes unitários: HMAC sign/verify (Fase 2).
 * Cobre: round-trip, tampering, replay window, formato malformado.
 */

import { describe, it, expect } from 'vitest';
import { sign, verify, generateSecret } from '../../src/lib/hmac';

describe('HMAC — sign/verify', () => {
  const secret = generateSecret();
  const timestamp = 1737043200; // 2025-01-16 12:00:00 UTC
  const body = JSON.stringify({ keyId: 'kairos_abc12345', timestamp });

  it('round-trip sign+verify com mesmo secret/body/timestamp', () => {
    const signature = sign({ secret, timestamp, body });
    const result = verify({ secret, signature, body, now: timestamp });
    expect(result.valid).toBe(true);
    expect(result.timestamp).toBe(timestamp);
  });

  it('verify com timestamp dentro da janela (±300s default)', () => {
    const signature = sign({ secret, timestamp, body });
    // 100s no futuro do client
    const result = verify({ secret, signature, body, now: timestamp + 100 });
    expect(result.valid).toBe(true);
  });

  it('verify falha com timestamp fora da janela (expirado)', () => {
    const signature = sign({ secret, timestamp, body });
    // 1h no futuro — fora da janela de 5min
    const result = verify({ secret, signature, body, now: timestamp + 3600 });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('verify falha com timestamp no futuro distante', () => {
    const signature = sign({ secret, timestamp, body });
    const result = verify({ secret, signature, body, now: timestamp - 3600 });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('future');
  });

  it('verify detecta body tampering', () => {
    const signature = sign({ secret, timestamp, body });
    const tamperedBody = body.replace('kairos_abc12345', 'kairos_evil99999');
    const result = verify({ secret, signature, body: tamperedBody, now: timestamp });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('mismatch');
  });

  it('verify detecta secret errado', () => {
    const signature = sign({ secret, timestamp, body });
    const result = verify({ secret: 'wrong-secret-' + 'x'.repeat(30), signature, body, now: timestamp });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('mismatch');
  });

  it('verify falha com header malformado (sem t=)', () => {
    const result = verify({ secret, signature: 'v1=abc', body, now: timestamp });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('malformed');
  });

  it('verify falha com header malformado (v1 não-hex)', () => {
    const result = verify({ secret, signature: `t=${timestamp},v1=not-hex`, body, now: timestamp });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('malformed');
  });

  it('verify falha com v1 de tamanho errado', () => {
    const result = verify({ secret, signature: `t=${timestamp},v1=abc123`, body, now: timestamp });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('malformed');
  });

  it('verify aceita janela customizada', () => {
    const signature = sign({ secret, timestamp, body });
    // 200s no futuro — dentro de 5min default, mas fora de 60s custom
    const result60s = verify({ secret, signature, body, now: timestamp + 200, windowSeconds: 60 });
    expect(result60s.valid).toBe(false);
    expect(result60s.reason).toBe('expired');

    const result500s = verify({ secret, signature, body, now: timestamp + 200, windowSeconds: 500 });
    expect(result500s.valid).toBe(true);
  });

  it('sign gera formato consistente: t=<int>,v1=<64-hex>', () => {
    const signature = sign({ secret, timestamp, body });
    expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });
});