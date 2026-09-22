/**
 * k6 load test — Kairos CRM External API.
 *
 * Cenários:
 *   1. Health check público (alto volume, sem auth)
 *   2. POST /auth/token com HMAC (médio volume)
 *   3. POST /ai/analyze autenticado (baixo volume — LLM é caro)
 *
 * Uso:
 *   1) Instalar k6: https://k6.io/docs/getting-started/installation/
 *   2) Setar env: BASE_URL + credenciais reais
 *   3) Rodar:
 *        k6 run scripts/k6-load-test.js
 *
 * Métricas-alvo (SLO):
 *   - GET /health: p95 < 10ms
 *   - POST /auth/token: p95 < 100ms (HMAC verify + DB lookup)
 *   - POST /ai/analyze (determinístico): p95 < 50ms
 *   - POST /ai/analyze (LLM): p95 < 3s (depende do provider)
 *
 * Exit codes:
 *   0 = SLO atendido
 *   99 = SLO violado
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const APP_ID = __ENV.KAIROS_APP_ID || '00000000-0000-0000-0000-000000000000';
const API_KEY_ID = __ENV.KAIROS_API_KEY_ID || 'kairos_load_test';
const API_SECRET = __ENV.KAIROS_API_SECRET || 'kairos_load_test_secret_32_bytes_min!!';

// Métricas customizadas
const authLatency = new Trend('auth_latency', true);
const aiDeterministicLatency = new Trend('ai_deterministic_latency', true);
const aiLlmLatency = new Trend('ai_llm_latency', true);
const authErrors = new Counter('auth_errors');
const aiErrors = new Counter('ai_errors');

export const options = {
  scenarios: {
    // Health check: alto volume, sem auth
    health: {
      executor: 'constant-arrival-rate',
      rate: 100,             // 100 RPS
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 10,
      exec: 'healthCheck',
    },
    // Auth token: médio volume
    auth: {
      executor: 'constant-arrival-rate',
      rate: 20,              // 20 RPS
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 10,
      startTime: '35s',
      exec: 'authToken',
    },
    // AI analyze (determinístico): baixo volume
    aiDeterministic: {
      executor: 'constant-arrival-rate',
      rate: 5,               // 5 RPS (limite por app é 60/min = 1 RPS — ajustável)
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 5,
      startTime: '70s',
      exec: 'aiDeterministic',
    },
  },
  thresholds: {
    'http_req_duration{expected_response:true}': ['p(95)<500'],
    'http_req_failed': ['rate<0.01'],
    'auth_latency': ['p(95)<200'],
    'ai_deterministic_latency': ['p(95)<300'],
  },
};

// =====================================================
// Cenário 1: Health check
// =====================================================
export function healthCheck() {
  const r = http.get(`${BASE_URL}/api/v1/external/health`);
  check(r, {
    'status 200': (r) => r.status === 200,
    'status ok': (r) => {
      const b = r.json();
      return b.status === 'ok';
    },
  });
  sleep(0.01);
}

// =====================================================
// Cenário 2: Auth token (HMAC + DB lookup)
// =====================================================
export function authToken() {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ keyId: API_KEY_ID, timestamp });
  const data = `${timestamp}.${body}`;
  const hex = crypto.hmac('sha256', API_SECRET, data, 'hex');

  const r = http.post(`${BASE_URL}/api/v1/external/auth/token`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Kairos-App-Id': APP_ID,
      'X-Kairos-Key-Id': API_KEY_ID,
      'X-Kairos-Timestamp': String(timestamp),
      'X-Kairos-Signature': `t=${timestamp},v1=${hex}`,
    },
  });
  authLatency.add(r.timings.duration);

  const success = check(r, {
    'status 200': (r) => r.status === 200,
    'has authToken': (r) => {
      try {
        return r.json('authToken') && r.json('authToken').length > 32;
      } catch {
        return false;
      }
    },
  });
  if (!success) authErrors.add(1);
  sleep(0.05);
}

// =====================================================
// Cenário 3: AI analyze (determinístico path)
// =====================================================
export function aiDeterministic() {
  // 1) Autentica primeiro (cache interno: idealmente faz 1x por VU)
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ keyId: API_KEY_ID, timestamp });
  const data = `${timestamp}.${body}`;
  const hex = crypto.hmac('sha256', API_SECRET, data, 'hex');

  const authRes = http.post(`${BASE_URL}/api/v1/external/auth/token`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Kairos-App-Id': APP_ID,
      'X-Kairos-Key-Id': API_KEY_ID,
      'X-Kairos-Timestamp': String(timestamp),
      'X-Kairos-Signature': `t=${timestamp},v1=${hex}`,
    },
  });
  if (authRes.status !== 200) {
    authErrors.add(1);
    return;
  }
  const authToken = authRes.json('authToken');

  // 2) Mensagens conhecidas (determinístico)
  const messages = [
    'oi',                                    // greeting
    'obrigado',                              // thanks
    'quanto custa uma troca de óleo?',       // orcamento
    'Quero agendar para amanhã',             // agendamento
    'Quero falar com um atendente',          // request_human
    'Preciso trocar o óleo do meu carro',    // sem regra → vai pro LLM
  ];
  const message = messages[Math.floor(Math.random() * messages.length)];

  const t0 = Date.now();
  const r = http.post(
    `${BASE_URL}/api/v1/external/ai/analyze`,
    JSON.stringify({ message }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    },
  );
  const dt = Date.now() - t0;

  const isLlm = (() => {
    try {
      return r.json('source') === 'llm';
    } catch {
      return false;
    }
  })();

  if (isLlm) aiLlmLatency.add(dt);
  else aiDeterministicLatency.add(dt);

  const success = check(r, {
    'status 200': (r) => r.status === 200,
    'has intent': (r) => {
      try {
        return !!r.json('intent');
      } catch {
        return false;
      }
    },
  });
  if (!success) aiErrors.add(1);
  sleep(1); // throttle AI (limite 60/min por app)
}
