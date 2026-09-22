# Guia de integração — Kairos CRM para apps externos

> Passo-a-passo pra Pastor (ou qualquer dev) conectar um novo app ao Kairos CRM.

## TL;DR

```bash
# 1. Admin cria Application + ApiKey no DB (1x só, retorna secret)
# 2. Dev configura 4 vars: KAIROS_URL, KAIROS_APP_ID, KAIROS_API_KEY_ID, KAIROS_API_SECRET
# 3. App chama POST /auth/token → recebe authToken (15min TTL)
# 4. App usa Authorization: Bearer <authToken> por 15min
# 5. Renova /auth/token quando expirar
```

## Passo 1 — Admin cria Application (no DB, 1x só)

Não tem UI ainda (Fase 9 do plano). Por enquanto, faça via SQL ou peça ao admin.

### Via SQL (recomendado pra primeira vez)

```bash
ssh root@187.77.229.227
docker exec kairos-shared-pg psql -U postgres -d kairos_crm_db
```

```sql
-- 1) Criar Application
INSERT INTO applications (
  id, "tenantId", name, slug, scopes, status, "rateLimitPerMinute"
) VALUES (
  gen_random_uuid(),
  '<tenant-uuid>',                              -- pegar em SELECT id, slug FROM tenants;
  'App Oficina Mechanic',
  'oficina',
  ARRAY['crm.contact.write', 'crm.lead.write', 'ai.analyze', 'webhooks.write'],
  'ACTIVE',
  600
) RETURNING id;

-- Anotar: <application-id-uuid>

-- 2) Gerar secret e criptografar
--    (Pastor gera fora do SQL e passa o valor — ele é descriptografado só pelo backend)
--    Pra simplificar, exemplo com secret hardcoded (TROCAR EM PRODUÇÃO):
\set secret 'kairos_test_master_key_32bytes!!'
\set master_key 'kairos_test_master_key_32bytes!!'  -- mesmo valor do KAIROS_API_MASTER_KEY

-- Encode do secret em base64url
SELECT encode(convert_to(:'secret', 'UTF8'), 'base64') AS secret_b64;

-- Criptografar (AES-256-GCM) — formato: iv.tag.ciphertext
-- (Aqui você gera via script Node.js, SQL é complicado)
-- Vou deixar placeholder:
INSERT INTO api_keys (
  id, "applicationId", prefix, "secretHash", "secretEncrypted", "secretLastFour"
) VALUES (
  gen_random_uuid(),
  '<application-id-uuid>',
  'kairos_ofc01a3f1',
  encode(digest(:'secret', 'sha256'), 'hex'),
  '<encrypted-via-node-script>',                  -- ver /tmp/gen_secret.cjs
  '...a3f1'
) RETURNING id, prefix, "secretLastFour";
```

### Helper script (recomendado) — `/tmp/gen_apikey.cjs`

```js
const { createCipheriv, randomBytes } = require('crypto');
const masterKeyB64 = process.env.KAIROS_API_MASTER_KEY;
const masterKey = Buffer.from(masterKeyB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const secret = process.argv[2]; // passa o secret como argv
if (!secret) { console.error('usage: node gen_apikey.cjs <secret>'); process.exit(1); }

const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
const ct = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const secretEncrypted = [iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');

console.log(JSON.stringify({ secret, secretEncrypted, secretLastFour: secret.slice(-4) }));
```

Rode:
```bash
KAIROS_API_MASTER_KEY=xxx node /tmp/gen_apikey.cjs 'meu-secret-forte-aqui-32-bytes'
```

Output: `{"secret":"meu-secret-forte-aqui-32-bytes","secretEncrypted":"abc.xyz.123","secretLastFour":"tes"}`

Insere no DB com o `secretEncrypted` retornado.

## Passo 2 — Dev configura no app

```bash
# .env do app externo
KAIROS_URL=https://crm.fbautomacao.space
KAIROS_APP_ID=<application-uuid-do-passo-1>
KAIROS_API_KEY_ID=kairos_ofc01a3f1       # prefixo (não o secret!)
KAIROS_API_SECRET=meu-secret-forte-aqui-32-bytes  # secret entregue 1x só
```

⚠️ **NUNCA** commitar `KAIROS_API_SECRET` no git. Use secret manager / env var.

## Passo 3 — App autentica

```typescript
// Node.js (SDK: examples/kairos-client-node)
import { KairosClient } from '@kairos/client-node';

const client = new KairosClient({
  baseUrl: process.env.KAIROS_URL!,
  appId: process.env.KAIROS_APP_ID!,
  apiKeyId: process.env.KAIROS_API_KEY_ID!,
  apiSecret: process.env.KAIROS_API_SECRET!,
});

const { authToken, expiresIn, scopes, tenantId } = await client.authenticate();
// → authToken (válido 15min)
// → scopes: ['crm.contact.write', 'crm.lead.write', 'ai.analyze', 'webhooks.write']
// → tenantId: UUID do tenant que o app atende
```

### Sem SDK (raw HTTP + crypto)

```javascript
const crypto = require('crypto');

const timestamp = Math.floor(Date.now() / 1000);
const body = JSON.stringify({ keyId: process.env.KAIROS_API_KEY_ID, timestamp });
const data = `${timestamp}.${body}`;
const hex = crypto.createHmac('sha256', process.env.KAIROS_API_SECRET).update(data).digest('hex');

const res = await fetch(`${process.env.KAIROS_URL}/api/v1/external/auth/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Kairos-App-Id': process.env.KAIROS_APP_ID,
    'X-Kairos-Key-Id': process.env.KAIROS_API_KEY_ID,
    'X-Kairos-Timestamp': String(timestamp),
    'X-Kairos-Signature': `t=${timestamp},v1=${hex}`,
  },
  body,
});

const { authToken, expiresIn, scopes, tenantId } = await res.json();
```

## Passo 4 — App chama endpoints autenticado

```typescript
// Headers em toda request
const { authToken } = await client.authenticate(); // cacheado por 15min

const res = await fetch(`${KAIROS_URL}/api/v1/external/leads`, {
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  },
});
```

## Passo 5 — App cria webhook subscription

```typescript
const { secret } = await client.createWebhook({
  url: 'https://seu-app.com/webhook/kairos',
  events: ['lead.created', 'lead.stage_changed', 'message.received'],
  description: 'App Oficina — eventos principais',
});
// ⚠️ Guarde `secret` — é ÚNICA vez que o CRM devolve
// Use pra validar HMAC em cada webhook recebido
```

## Passo 6 — App recebe webhook (server-side)

```typescript
import express from 'express';
import { KairosClient } from '@kairos/client-node';

const app = express();

const kairos = new KairosClient({
  baseUrl: process.env.KAIROS_URL!,
  appId: process.env.KAIROS_APP_ID!,
  apiKeyId: process.env.KAIROS_API_KEY_ID!,
  apiSecret: process.env.KAIROS_API_SECRET!,
  webhookSecret: process.env.KAIROS_WEBHOOK_SECRET!, // secret do passo 5
});

// IMPORTANTE: webhook precisa do RAW BODY pra HMAC
app.post('/webhook/kairos',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const rawBody = req.body.toString('utf8');
    const headers = req.headers as Record<string, string>;

    const valid = await kairos.verifyWebhook(headers, rawBody);
    if (!valid) return res.status(401).send('invalid signature');

    const event = JSON.parse(rawBody);
    console.log('Event:', event.event, '| Tenant:', event.tenantId);

    // Idempotência: use headers['x-kairos-delivery'] pra deduplicar
    // Retry: CRM tenta 6x com backoff. Se você retornar 5xx, ele tenta de novo.

    res.status(200).send('ok');
  },
);
```

## Cenário end-to-end (caso real do Pastor)

```
1. Cliente manda WhatsApp: "Meu Gol 2018 faz barulho quando freio. Quanto custa trocar pastilha?"
2. App recebe via webhook WAHA próprio
3. App → CRM: POST /api/v1/external/ai/analyze { message: "..." }
4. CRM devolve: { intent: "orcamento", suggested_actions: [create_lead, search_products] }
5. App → CRM: POST /api/v1/external/contacts/upsert { phone: "5515..." }
6. App → CRM: POST /api/v1/external/leads { contactId, title: "Troca pastilha Gol 2018", ... }
7. CRM dispara webhook lead.created → app processa (cria tarefa, notifica humano)
8. App → CRM: POST /api/v1/external/conversations/:id/messages { text: "..." }  // proxy WAHA
```

## FAQ

### "Onde pego o tenant-uuid?"

- Admin: `SELECT id, slug FROM tenants;`
- Dev: depois de autenticar, `auth.tenantId` na response, ou `GET /api/v1/external/me`.

### "Como sei quais scopes meu app tem?"

- Response do `POST /auth/token` retorna `scopes: [...]`.
- Ou `GET /api/v1/external/me` retorna `application.scopes` (effective).

### "Posso usar a mesma ApiKey em vários apps?"

Não. Cada ApiKey pertence a UMA Application. Pra múltiplos apps, crie múltiplas Applications (ou use a mesma Application com múltiplas ApiKeys — cada uma com prefix/scopes próprios).

### "Como revogo uma ApiKey comprometida?"

- Via API: `POST /api/v1/external/api-keys/:id/revoke` (TODO — Fase 9.2)
- Via SQL: `UPDATE api_keys SET "revokedAt" = now() WHERE id = '<key-uuid>';`

### "Como sei se minha chamada está sendo roteada pro tenant certo?"

- Toda chamada autenticada retorna `tenantId` no token e via `GET /me`.
- `tenantId` SEMPRE vem da credencial — backend ignora body/query.
- Se quiser garantir visualmente: `GET /me` deve retornar o tenant esperado.

### "Quanto custa cada chamada de IA?"

- Classificador determinístico: **0 tokens** (casos óbvios: oi, obrigado, reclamação)
- LLM: depende do modelo (ex: `nex-n2.5-mini:free` = grátis)
- Tracking: cada response de `/ai/analyze` retorna `tokensIn/tokensOut` (LLM only)

### "Como faço load test?"

Ver `examples/app-stub/` — ele cria 1 webhook e fica escutando.
Pra load test real: `k6 run` com 100 RPS em `/ai/analyze`.

### "E se o CRM cair?"

- App recebe webhook 5xx → CRM retenta com backoff (30s, 2min, 10min, 1h, 6h, 24h).
- Após 6 tentativas → delivery vai pra DLQ (status=FAILED no banco).
- Admin pode listar via `GET /api/v1/external/webhooks/:id/deliveries`.

## Próximos passos (Fase 8-10)

- **Fase 8**: testes de contrato (Pact) + k6 + CI
- **Fase 9**: UI admin pra criar Application (hoje é via SQL)
- **Fase 10**: produção final (rate limit Redis, worker separado, dashboards)

---

**Dúvidas?** Roda `examples/app-stub/` e testa tudo localmente antes de pedir acesso ao CRM.
