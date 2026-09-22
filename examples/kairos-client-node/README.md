# Kairos CRM — SDK Node.js

SDK mínimo (zero deps) pra integrar apps externos com o Kairos CRM via API `/api/v1/external/*`.

## Instalação

```bash
npm install @kairos/client-node
```

## Uso básico

```typescript
import { KairosClient } from '@kairos/client-node';

const client = new KairosClient({
  baseUrl: 'https://crm.fbautomacao.space',
  appId: '7c9e2f8a-1234-5678-90ab-cdef12345678',    // UUID da Application
  apiKeyId: 'kairos_abc12345',                       // prefixo (não o secret!)
  apiSecret: 'kairos_3f4b...xyz',                    // secret completo (256 bits)
  webhookSecret: 'whsec_abc...',                     // se recebe webhooks
});

// 1) Autentica (cache interno até expirar)
const { authToken, tenantId, scopes } = await client.authenticate();

// 2) Info do app + tenant
const me = await client.me();
console.log(me.tenant.name, me.tenant.slug);

// 3) Classifica mensagem (case real do Pastor — Gol 2018)
const analysis = await client.ai.analyze({
  message: 'Meu Gol 2018 está fazendo barulho quando freio. Quanto custa trocar as pastilhas?',
  context: { channel: 'whatsapp' },
});

console.log(analysis.intent);                // 'orcamento'
console.log(analysis.extracted_entities.vehicleYear);  // 2018
console.log(analysis.suggested_actions);     // [{ type: 'create_lead', ... }]

// 4) Lista webhooks configurados
const webhooks = await client.listWebhooks();
```

## Recebendo webhooks (server-side do seu app)

```typescript
import express from 'express';
import { KairosClient } from '@kairos/client-node';

const client = new KairosClient({
  baseUrl: process.env.KAIROS_URL!,
  appId: process.env.KAIROS_APP_ID!,
  apiKeyId: process.env.KAIROS_API_KEY_ID!,
  apiSecret: process.env.KAIROS_API_SECRET!,
  webhookSecret: process.env.KAIROS_WEBHOOK_SECRET!,
});

const app = express();

// IMPORTANTE: webhook precisa do RAW BODY pra HMAC verificar
app.post('/webhook/kairos', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body.toString('utf8');
  const headers = req.headers as Record<string, string>;

  const valid = await client.verifyWebhook(headers, rawBody);
  if (!valid) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(rawBody);
  console.log('Event:', event.event, '| Tenant:', event.tenantId);

  // Idempotência: X-Kairos-Delivery é único por delivery
  const deliveryId = headers['x-kairos-delivery'];

  // ... processa event ...
  res.status(200).send('ok');
});

app.listen(3000);
```

## Headers que o CRM envia

```
POST https://seu-app.com/webhook
Content-Type: application/json
User-Agent: Kairos-CRM-Webhooks/1.0
X-Kairos-Signature: t=1737043200,v1=<hex-hmac-sha256>
X-Kairos-Event: lead.created
X-Kairos-Delivery: evt_1737043200_a3f1b2c4d5e6f7g8
X-Kairos-Attempt: 1

{
  "event": "lead.created",
  "occurredAt": "2026-09-22T...",
  "tenantId": "...",
  "deliveryId": "evt_...",
  "data": { ... }
}
```

## Como criar uma Application + ApiKey

```typescript
// 1) Admin (você) cria Application via painel super admin
//    OU via seed (idempotente, retorna só 1x):
//
// INSERT INTO applications (id, "tenantId", name, slug, scopes, status)
//   VALUES (gen_random_uuid(), '<tenant-uuid>', 'App Oficina', 'oficina', ...);
// INSERT INTO api_keys (id, "applicationId", prefix, "secretHash", "secretEncrypted", "secretLastFour")
//   VALUES (gen_random_uuid(), '<app-uuid>', 'kairos_a3f1b2', '<hash>', '<encrypted>', 'a3f1');
//
// O secret descriptografado (32 bytes base64url) é entregue ao dev do app 1x só.

// 2) Configurar scopes no Application:
//    ["crm.contact.write", "crm.lead.write", "ai.analyze", "webhooks.write"]

// 3) Configurar webhookSecret: chamar createWebhook() uma vez
//    OU Admin cria manualmente no DB e passa o secret ao dev.
```

## Erros comuns

- **"Assinatura inválida"**: `apiSecret` errado OU `apiKeyId` ≠ prefixo no DB OU timestamp fora de ±300s
- **"Aplicação não está ativa"**: Application.status = PAUSED ou REVOKED
- **"Tenant bloqueado"**: tenant associado foi bloqueado (LGPD ou inadimplência)
- **"IP não autorizado"**: IP do app não está no ipAllowlist da Application
- **"Scope necessário"**: app não tem scope `ai.analyze` ou `webhooks.write` etc

## Próximo passo

Veja `examples/app-stub/` pra um app completo que autentica, recebe webhook via ngrok e cria lead automaticamente.
