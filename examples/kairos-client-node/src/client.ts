/**
 * KairosClient — entry point do SDK.
 *
 * Uso:
 *   const client = new KairosClient({
 *     baseUrl: 'https://crm.fbautomacao.space',
 *     appId: '7c9e2f8a-...',
 *     apiKeyId: 'kairos_abc12345',
 *     apiSecret: 'kairos_test_master_key...',  // 256 bits
 *     webhookSecret: 'whsec_...',               // se recebe webhooks
 *   });
 *
 *   const { authToken, expiresIn } = await client.authenticate();
 *   const analysis = await client.ai.analyze({ message: 'oi' });
 */

import { sign, verify } from './hmac.js';

export interface KairosClientConfig {
  baseUrl: string;           // ex: 'https://crm.fbautomacao.space'
  appId: string;             // UUID da Application
  apiKeyId: string;          // ex: 'kairos_abc12345' (o PREFIXO)
  apiSecret: string;         // secret da ApiKey (32 bytes base64url)
  webhookSecret?: string;    // secret do WebhookEndpoint (se aplicável)
  fetchImpl?: typeof fetch;   // pra testes
}

export interface AuthTokenResponse {
  authToken: string;
  expiresIn: number;
  expiresAt?: string;
  scopes: string[];
  tenantId: string;
}

export interface AnalyzeRequest {
  message: string;
  context?: {
    contactId?: string;
    leadId?: string;
    channel?: 'whatsapp' | 'email' | 'chat' | 'web';
    locale?: string;
  };
}

export interface AnalyzeResponse {
  intent: string;
  category?: string;
  product_or_service?: string;
  vehicle?: { model?: string; year?: number };
  funnel_stage?: string;
  temperature?: 'cold' | 'warm' | 'hot';
  requires_human: boolean;
  extracted_entities: Record<string, any>;
  suggested_actions: Array<{ type: string; params: Record<string, any> }>;
  confidence: number;
  source: 'deterministic' | 'llm';
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export class KairosClient {
  private baseUrl: string;
  private appId: string;
  private apiKeyId: string;
  private apiSecret: string;
  private webhookSecret?: string;
  private fetch: typeof fetch;

  private cachedToken?: { token: string; expiresAt: number };

  constructor(config: KairosClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.appId = config.appId;
    this.apiKeyId = config.apiKeyId;
    this.apiSecret = config.apiSecret;
    this.webhookSecret = config.webhookSecret;
    this.fetch = config.fetchImpl ?? fetch;
  }

  /**
   * Autentica via HMAC e retorna o token opaco (cacheado até expirar).
   */
  async authenticate(): Promise<AuthTokenResponse> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      // Cache válido (com margem de 60s)
      return {
        authToken: this.cachedToken.token,
        expiresIn: Math.floor((this.cachedToken.expiresAt - Date.now()) / 1000),
        scopes: [],
        tenantId: '',
      };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ keyId: this.apiKeyId, timestamp });
    const signature = await sign(this.apiSecret, timestamp, body);

    const res = await this.fetch(`${this.baseUrl}/api/v1/external/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kairos-App-Id': this.appId,
        'X-Kairos-Key-Id': this.apiKeyId,
        'X-Kairos-Timestamp': String(timestamp),
        'X-Kairos-Signature': signature,
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as AuthTokenResponse;
    this.cachedToken = {
      token: data.authToken,
      expiresAt: Date.now() + data.expiresIn * 1000,
    };
    return data;
  }

  /**
   * Helper interno: pega token válido e faz request autenticado.
   */
  private async authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { authToken } = await this.authenticate();
    return this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...(init.headers || {}),
      },
    });
  }

  /**
   * GET /api/v1/external/me
   */
  async me(): Promise<{ application: any; tenant: any }> {
    const res = await this.authedFetch('/api/v1/external/me');
    if (!res.ok) throw new Error(`me failed: ${res.status}`);
    return res.json();
  }

  /**
   * GET /api/v1/external/webhooks — lista endpoints do app
   */
  async listWebhooks(): Promise<{ data: any[] }> {
    const res = await this.authedFetch('/api/v1/external/webhooks');
    if (!res.ok) throw new Error(`listWebhooks failed: ${res.status}`);
    return res.json();
  }

  /**
   * POST /api/v1/external/webhooks — cria endpoint (retorna secret 1x)
   */
  async createWebhook(opts: {
    url: string;
    events: string[];
    description?: string;
  }): Promise<any & { secret: string }> {
    const res = await this.authedFetch('/api/v1/external/webhooks', {
      method: 'POST',
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error(`createWebhook failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  /**
   * Verifica assinatura de webhook recebido.
   */
  async verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<boolean> {
    if (!this.webhookSecret) {
      throw new Error('webhookSecret não configurado no client');
    }
    const sig =
      headers['x-kairos-signature'] ||
      headers['X-Kairos-Signature'] ||
      '';
    const result = await verify(this.webhookSecret, sig, rawBody);
    return result.valid;
  }

  /**
   * Sub-API de IA.
   */
  ai = {
    analyze: async (req: AnalyzeRequest): Promise<AnalyzeResponse> => {
      const res = await this.authedFetch('/api/v1/external/ai/analyze', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`ai.analyze failed: ${res.status} ${err}`);
      }
      return res.json();
    },

    chat: async (req: {
      messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>;
      temperature?: number;
      maxTokens?: number;
    }): Promise<any> => {
      const res = await this.authedFetch('/api/v1/external/ai/chat', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error(`ai.chat failed: ${res.status}`);
      return res.json();
    },
  };
}
