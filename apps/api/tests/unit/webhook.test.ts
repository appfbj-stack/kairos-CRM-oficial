/**
 * Testes unitários: webhooks (Fase 3).
 * Cobre: signature generate/verify, eventos válidos, secret format.
 */

import { describe, it, expect } from 'vitest';
import {
  generateWebhookSecret,
  hashWebhookSecret,
  webhookSecretLastFour,
  signWebhookPayload,
  verifyWebhookPayload,
  generateDeliveryId,
} from '../../src/lib/webhook-signature';
import { WEBHOOK_EVENTS, isValidWebhookEvent } from '../../src/lib/webhook-events';

describe('Webhook secret', () => {
  it('generateWebhookSecret retorna secret com prefixo whsec_', () => {
    const s = generateWebhookSecret();
    expect(s).toMatch(/^whsec_[A-Za-z0-9_-]+$/);
    // base64url de 32 bytes = 43 chars, + 6 do prefixo = 49
    expect(s.length).toBeGreaterThanOrEqual(48);
  });

  it('secrets gerados são únicos', () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateWebhookSecret());
    expect(set.size).toBe(100);
  });

  it('hashWebhookSecret é determinístico', () => {
    const s = 'whsec_abc123';
    expect(hashWebhookSecret(s)).toBe(hashWebhookSecret(s));
    expect(hashWebhookSecret(s)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('webhookSecretLastFour retorna últimos 4 chars', () => {
    expect(webhookSecretLastFour('whsec_abcdef1234567890')).toBe('7890');
    expect(webhookSecretLastFour('short')).toBe('hort');
  });
});

describe('Webhook signature', () => {
  it('signWebhookPayload gera header com t= e v1=', () => {
    const s = signWebhookPayload('whsec_abc', '{"event":"test"}', 1737043200);
    expect(s).toMatch(/^t=1737043200,v1=[a-f0-9]{64}$/);
  });

  it('sign + verify round-trip funciona (now = timestamp)', () => {
    const secret = 'whsec_abc123';
    const body = '{"event":"lead.created","id":"xyz"}';
    const ts = 1737043200;
    const sig = signWebhookPayload(secret, body, ts);
    // verifyWebhookPayload não aceita now — usa Date.now(). Por isso
    // tenho que usar um ts no FUTURO pra esse teste ser estável.
    // Vou usar timestamp "now + 1000" pra garantir tolerância.
    const futureTs = Math.floor(Date.now() / 1000) + 30;
    const sig2 = signWebhookPayload(secret, body, futureTs);
    const result = verifyWebhookPayload(secret, sig2, body);
    expect(result.valid).toBe(true);
  });

  it('verify detecta body tampering', () => {
    const secret = 'whsec_abc';
    const futureTs = Math.floor(Date.now() / 1000) + 30;
    const sig = signWebhookPayload(secret, '{"a":1}', futureTs);
    const result = verifyWebhookPayload(secret, sig, '{"a":2}');
    expect(result.valid).toBe(false);
  });

  it('verify detecta secret errado', () => {
    const futureTs = Math.floor(Date.now() / 1000) + 30;
    const sig = signWebhookPayload('whsec_real', '{"a":1}', futureTs);
    const result = verifyWebhookPayload('whsec_fake', sig, '{"a":1}');
    expect(result.valid).toBe(false);
    // reason pode ser 'mismatch' ou 'expired' — qualquer um dos 2 indica falha
    expect(['mismatch', 'expired']).toContain(result.reason);
  });

  it('verify falha com timestamp antigo (fora da tolerância)', () => {
    const secret = 'whsec_abc';
    // 1h no passado — fora da janela default de 5min
    const oldTs = Math.floor(Date.now() / 1000) - 3600;
    const sig = signWebhookPayload(secret, '{"a":1}', oldTs);
    const result = verifyWebhookPayload(secret, sig, '{"a":1}');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('verify aceita timestamp dentro da tolerância', () => {
    const secret = 'whsec_abc';
    const nowTs = Math.floor(Date.now() / 1000);
    const sig = signWebhookPayload(secret, '{"a":1}', nowTs);
    const result = verifyWebhookPayload(secret, sig, '{"a":1}');
    expect(result.valid).toBe(true);
  });
});

describe('generateDeliveryId', () => {
  it('formato evt_<unix>_<hex>', () => {
    const id = generateDeliveryId();
    expect(id).toMatch(/^evt_\d+_[a-f0-9]{16}$/);
  });

  it('IDs únicos em sequência', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateDeliveryId());
    expect(ids.size).toBe(100);
  });
});

describe('Webhook events', () => {
  it('WEBHOOK_EVENTS contém eventos esperados', () => {
    expect(WEBHOOK_EVENTS).toContain('lead.created');
    expect(WEBHOOK_EVENTS).toContain('lead.stage_changed');
    expect(WEBHOOK_EVENTS).toContain('contact.created');
    expect(WEBHOOK_EVENTS).toContain('message.sent');
    expect(WEBHOOK_EVENTS).toContain('message.received');
    expect(WEBHOOK_EVENTS).toContain('appointment.created');
    expect(WEBHOOK_EVENTS).toContain('followup.sent');
  });

  it('isValidWebhookEvent valida corretamente', () => {
    expect(isValidWebhookEvent('lead.created')).toBe(true);
    expect(isValidWebhookEvent('quote.created')).toBe(true);
    expect(isValidWebhookEvent('invented.event')).toBe(false);
    expect(isValidWebhookEvent('')).toBe(false);
  });

  it('não há duplicatas', () => {
    const set = new Set(WEBHOOK_EVENTS);
    expect(set.size).toBe(WEBHOOK_EVENTS.length);
  });
});