/**
 * App Stub — webhook receiver + sender (prova de vida).
 *
 * Uso:
 *   1) Rodar: npx tsx server.ts
 *   2) Em outro terminal: ngrok http 3000
 *   3) Anotar URL do ngrok (ex: https://abc-123.ngrok.io)
 *   4) Criar webhook subscription apontando pra URL do ngrok
 *   5) Disparar evento no CRM (ex: criar lead) → webhook chega aqui
 *
 * Variáveis de ambiente necessárias:
 *   KAIROS_URL=https://crm.fbautomacao.space
 *   KAIROS_APP_ID=...
 *   KAIROS_API_KEY_ID=kairos_...
 *   KAIROS_API_SECRET=...
 *   KAIROS_WEBHOOK_SECRET=whsec_...   (opcional — se já tem webhook configurado)
 *   PORT=3000                          (opcional, default 3000)
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { KairosClient } from '../kairos-client-node/src/client.js';
import { generateSecret } from '../kairos-client-node/src/hmac.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

const client = new KairosClient({
  baseUrl: process.env.KAIROS_URL || 'https://crm.fbautomacao.space',
  appId: process.env.KAIROS_APP_ID!,
  apiKeyId: process.env.KAIROS_API_KEY_ID!,
  apiSecret: process.env.KAIROS_API_SECRET!,
  webhookSecret: process.env.KAIROS_WEBHOOK_SECRET,
});

console.log('🔌 Autenticando no Kairos CRM...');
const auth = await client.authenticate();
console.log(`✅ Autenticado. Tenant: ${auth.tenantId.slice(0, 8)}... | Scopes: ${auth.scopes.join(', ')}`);

// =====================================================
// HTTP server — recebe webhooks
// =====================================================
const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook/kairos') {
    // Lê raw body
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    // Headers em lowercase
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = String(v || '');
    }

    // Valida HMAC
    const valid = await client.verifyWebhook(headers, rawBody);
    if (!valid) {
      console.warn('⚠️  Webhook com assinatura inválida');
      res.writeHead(401);
      res.end('invalid signature');
      return;
    }

    const event = JSON.parse(rawBody);
    console.log('📨 Webhook recebido:', {
      event: event.event,
      tenant: event.tenantId?.slice(0, 8) + '...',
      deliveryId: headers['x-kairos-delivery'],
      attempt: headers['x-kairos-attempt'],
      data: event.data,
    });

    // TODO: processar evento aqui (criar tarefa, notificar humano, etc)
    await handleEvent(event);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

async function handleEvent(event: { event: string; data: any }) {
  switch (event.event) {
    case 'lead.created':
      console.log('  → novo lead:', event.data.title);
      break;
    case 'lead.stage_changed':
      console.log(`  → lead ${event.data.id?.slice(0, 8)}... movido pra ${event.data.stageName}`);
      break;
    case 'message.received':
      console.log(`  → nova mensagem de ${event.data.contactId?.slice(0, 8)}...`);
      break;
    default:
      console.log(`  → evento ${event.event} (sem handler)`);
  }
}

// =====================================================
// Bootstrap
// =====================================================
server.listen(PORT, () => {
  console.log(`🚀 App stub rodando em http://localhost:${PORT}`);
  console.log(`   POST /webhook/kairos  → recebe eventos do CRM`);
  console.log(`   GET  /health           → health check`);
  console.log('');
  console.log('Próximos passos:');
  console.log('1) ngrok http 3000  (em outro terminal)');
  console.log('2) POST /webhooks/create com { url: "<ngrok-url>/webhook/kairos", events: [...] }');
});

// =====================================================
// Setup inicial (criar webhook subscription)
// =====================================================
async function setup() {
  const publicUrl = process.env.PUBLIC_URL;
  if (!publicUrl) {
    console.log('\n💡 Dica: set PUBLIC_URL=https://seu-ngrok.ngrok.io e rode de novo pra auto-criar webhook subscription.');
    return;
  }

  console.log(`\n🔧 Criando webhook subscription em ${publicUrl}/webhook/kairos ...`);

  // Gera secret novo
  const newSecret = generateSecret();
  console.log(`🔐 Novo webhook secret (GUARDE!): ${newSecret}`);

  try {
    const webhook = await client.createWebhook({
      url: `${publicUrl}/webhook/kairos`,
      events: ['lead.created', 'lead.stage_changed', 'message.received'],
      description: 'App Stub dev',
    });
    console.log(`✅ Webhook criado: ${webhook.id}`);
    console.log(`   Events: ${webhook.events.join(', ')}`);
    console.log(`\n⚠️  IMPORTANTE: atualize KAIROS_WEBHOOK_SECRET=${webhook.secret} antes de reiniciar!`);
  } catch (err) {
    console.error('❌ Falha ao criar webhook:', (err as Error).message);
  }
}

setup();
