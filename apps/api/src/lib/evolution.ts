/**
 * Cliente HTTP para Evolution Go v0.7.x (fork appfbj-stack).
 *
 * Autenticação:
 *   - ADMIN (criar/deletar instância): header apikey = GLOBAL_API_KEY
 *   - INSTANCE (conectar, qr, status, send): header apikey = per-instance token
 *
 * Rotas usadas:
 *   POST   /instance/create                  (admin)  body: { name, token, ... }
 *   DELETE /instance/delete/:instanceId      (admin)
 *   GET    /instance/connect                (instance) — inicia conexão
 *   GET    /instance/qr                      (instance) — obtém QR
 *   GET    /instance/status                  (instance) — status
 *   POST   /instance/disconnect              (instance)
 *   POST   /instance/pair                    (instance) body: { phone } — pairing code
 *   DELETE /instance/logout                  (instance)
 *   POST   /send/text                       (instance) body: { number, text }
 *   POST   /send/media                      (instance)
 */

import { env } from '../config/env';
import { logger } from './logger';

const BASE = env.EVOLUTION_BASE_URL.replace(/\/$/, '');
const ADMIN_KEY = env.EVOLUTION_API_KEY;

async function req<T = any>(opts: {
  method: string;
  path: string;
  body?: any;
  apiKey: string;        // per-instance token, OR admin key
  timeoutMs?: number;
}): Promise<T> {
  const url = `${BASE}${opts.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: opts.method,
      headers: {
        'Content-Type': 'application/json',
        apikey: opts.apiKey,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? safeParse(text) : null;
    if (!res.ok) {
      const msg = (data && (data.error || data.response?.message)) || text || res.statusText;
      throw new Error(`Evolution ${res.status}: ${msg}`);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

function safeParse(text: string): any {
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const evolution = {
  /** Cria instância na Evolution (usa GLOBAL_API_KEY). */
  async createInstance(opts: { instanceName: string; number?: string; webhookUrl?: string }) {
    const token = randomToken();
    const data = await req<any>({
      method: 'POST',
      path: '/instance/create',
      apiKey: ADMIN_KEY,
      body: {
        name: opts.instanceName,
        instanceId: opts.instanceName,
        token,
        ...(opts.webhookUrl ? { webhookUrl: opts.webhookUrl } : {}),
      },
    });
    const created = (data && (data.data || data)) as any;
    return { token, instance: created };
  },

  async deleteInstance(instanceName: string) {
    return req({ method: 'DELETE', path: `/instance/delete/${encodeURIComponent(instanceName)}`, apiKey: ADMIN_KEY });
  },

  /** Inicia conexão + retorna QR. */
  async connect(instanceToken: string) {
    try {
      await req({ method: 'POST', path: '/instance/connect', apiKey: instanceToken, body: {} });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'connect: chamada inicial falhou (pode já estar conectado)');
    }
    // Evolution Go: após o POST /connect, o QR demora ~2-5s pra ficar disponível.
    // Retry com backoff pra capturar o QR antes de desistir.
    return this.getQrWithRetry(instanceToken, 6, 1500);
  },

  async getQrWithRetry(instanceToken: string, attempts: number, delayMs: number) {
    let lastErr: string | null = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const r = await this.getQr(instanceToken);
        if (r.qrCode) return r;
        lastErr = 'qrCode null';
      } catch (err) {
        lastErr = (err as Error).message;
        logger.warn({ attempt: i + 1, err: lastErr }, 'getQr retry');
      }
      if (i < attempts - 1) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
    return { qrCode: null, pairingCode: null, error: lastErr };
  },

  async getQr(instanceToken: string) {
    const data = await req<{ data: { qrcode: string; code?: string } }>({
      method: 'GET',
      path: '/instance/qr',
      apiKey: instanceToken,
    });
    return {
      qrCode: data?.data?.qrcode || null,
      pairingCode: data?.data?.code || null,
    };
  },

  async getStatus(instanceToken: string) {
    const data = await req<{ data: { Connected: boolean; LoggedIn: boolean; jid?: string; name?: string } }>({
      method: 'GET',
      path: '/instance/status',
      apiKey: instanceToken,
    });
    return data?.data;
  },

  async disconnect(instanceToken: string) {
    return req({ method: 'POST', path: '/instance/disconnect', apiKey: instanceToken, body: {} });
  },

  async logout(instanceToken: string) {
    return req({ method: 'DELETE', path: '/instance/logout', apiKey: instanceToken });
  },

  async sendText(instanceToken: string, number: string, text: string) {
    return req<{ data: any }>({
      method: 'POST',
      path: '/send/text',
      apiKey: instanceToken,
      body: { number, text },
    });
  },

  async sendMedia(instanceToken: string, number: string, mediaUrl: string, mediatype = 'image', caption?: string) {
    return req({
      method: 'POST',
      path: '/send/media',
      apiKey: instanceToken,
      body: { number, media: mediaUrl, mediatype, ...(caption ? { fileName: caption, caption } : {}) },
    });
  },
};

export interface EvolutionEvent {
  event: string;
  instanceId?: string;
  instanceName?: string;
  data: any;
}

export function isEvolutionEvent(body: any): body is EvolutionEvent {
  return body && typeof body === 'object' && typeof body.event === 'string';
}
