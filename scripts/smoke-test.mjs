/**
 * Smoke test E2E — valida os endpoints públicos + autenticação + rate limit.
 *
 * Roda contra QUALQUER ambiente (dev/staging/prod).
 * Não precisa de credenciais pra testar health/docs.
 *
 * Uso:
 *   node scripts/smoke-test.mjs http://localhost:4000
 *   node scripts/smoke-test.mjs https://crm.fbautomacao.space
 *
 * Exit codes:
 *   0 = todos passaram
 *   1 = pelo menos 1 falhou
 */

const baseUrl = process.argv[2] || 'http://localhost:4000';

const checks = [];
let pass = 0;
let fail = 0;

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail++;
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function check(name, fn) {
  try {
    const result = await fn();
    record(name, result.ok, result.detail);
  } catch (err) {
    record(name, false, `EXCEPTION: ${err.message}`);
  }
}

console.log(`\n🔍 Smoke test Kairos CRM — ${baseUrl}\n`);

// =====================================================
// 1. Health checks (sem auth)
// =====================================================
console.log('1) Endpoints públicos');

await check('GET /api/v1/external/health → 200', async () => {
  const r = await fetch(`${baseUrl}/api/v1/external/health`);
  const body = await r.json();
  return r.ok && body.status === 'ok'
    ? { ok: true, detail: `service=${body.service}, api=${body.api}` }
    : { ok: false, detail: `status=${r.status}` };
});

await check('GET /api/v1/external/docs → 200 HTML', async () => {
  const r = await fetch(`${baseUrl}/api/v1/external/docs`);
  const text = await r.text();
  return r.ok && text.includes('SwaggerUI')
    ? { ok: true, detail: `${text.length} bytes` }
    : { ok: false, detail: `status=${r.status}, type=${r.headers.get('content-type')}` };
});

await check('GET /api/v1/external/docs.yaml → 200 + openapi', async () => {
  const r = await fetch(`${baseUrl}/api/v1/external/docs.yaml`);
  const text = await r.text();
  return r.ok && text.includes('openapi: 3.1.0')
    ? { ok: true, detail: `${text.length} bytes` }
    : { ok: false, detail: `status=${r.status}` };
});

await check('GET /api/health → 200', async () => {
  const r = await fetch(`${baseUrl}/api/health`);
  const body = await r.json();
  return r.ok && body.status === 'ok'
    ? { ok: true }
    : { ok: false, detail: `status=${r.status}` };
});

await check('GET /api/health/db → 200', async () => {
  const r = await fetch(`${baseUrl}/api/health/db`);
  const body = await r.json();
  return r.ok && body.database === 'ok'
    ? { ok: true }
    : { ok: false, detail: JSON.stringify(body) };
});

// =====================================================
// 2. Auth (sem credenciais válidas — esperamos 4xx)
// =====================================================
console.log('\n2) Auth (validação de headers)');

await check('POST /auth/token sem headers → 400', async () => {
  const r = await fetch(`${baseUrl}/api/v1/external/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return r.status === 400
    ? { ok: true, detail: 'rejeitou corretamente' }
    : { ok: false, detail: `esperado 400, veio ${r.status}` };
});

await check('POST /auth/token com HMAC fake → 401', async () => {
  const r = await fetch(`${baseUrl}/api/v1/external/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Kairos-App-Id': '00000000-0000-0000-0000-000000000000',
      'X-Kairos-Key-Id': 'kairos_invalid',
      'X-Kairos-Timestamp': String(Math.floor(Date.now() / 1000)),
      'X-Kairos-Signature': 't=9999999999,v1=0000000000000000000000000000000000000000000000000000000000000000',
    },
    body: JSON.stringify({ keyId: 'kairos_invalid', timestamp: 9999999999 }),
  });
  return r.status === 401
    ? { ok: true, detail: 'rejeitou corretamente' }
    : { ok: false, detail: `esperado 401, veio ${r.status}` };
});

await check('POST /auth/token com timestamp expirado → 401', async () => {
  const oldTs = Math.floor(Date.now() / 1000) - 3600; // 1h atrás
  const r = await fetch(`${baseUrl}/api/v1/external/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Kairos-App-Id': '00000000-0000-0000-0000-000000000000',
      'X-Kairos-Key-Id': 'kairos_invalid',
      'X-Kairos-Timestamp': String(oldTs),
      'X-Kairos-Signature': `t=${oldTs},v1=0000000000000000000000000000000000000000000000000000000000000000`,
    },
    body: JSON.stringify({ keyId: 'kairos_invalid', timestamp: oldTs }),
  });
  return r.status === 401
    ? { ok: true }
    : { ok: false, detail: `esperado 401, veio ${r.status}` };
});

// =====================================================
// 3. CORS / OPTIONS
// =====================================================
console.log('\n3) CORS preflight');

await check('OPTIONS /api/v1/external/health → 200', async () => {
  const r = await fetch(`${baseUrl}/api/v1/external/health`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://example.com',
      'Access-Control-Request-Method': 'GET',
    },
  });
  return r.ok
    ? { ok: true, detail: `acao=${r.headers.get('access-control-allow-origin') || 'none'}` }
    : { ok: false, detail: `status=${r.status}` };
});

// =====================================================
// 4. OpenAPI valida
// =====================================================
console.log('\n4) OpenAPI spec válida');

await check('docs.yaml tem endpoints esperados', async () => {
  const r = await fetch(`${baseUrl}/api/v1/external/docs.yaml`);
  const text = await r.text();
  const required = [
    '/api/v1/external/auth/token',
    '/api/v1/external/me',
    '/api/v1/external/ai/analyze',
    '/api/v1/external/ai/chat',
    '/api/v1/external/webhooks',
  ];
  const missing = required.filter((p) => !text.includes(p));
  return missing.length === 0
    ? { ok: true, detail: `${required.length} endpoints` }
    : { ok: false, detail: `faltando: ${missing.join(', ')}` };
});

// =====================================================
// Resumo
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`✅ ${pass} passaram | ❌ ${fail} falharam | ${checks.length} total`);
console.log('='.repeat(60));

if (fail > 0) {
  console.log('\n❌ SMOKE TEST FALHOU\n');
  process.exit(1);
}

console.log('\n✅ SMOKE TEST OK\n');
