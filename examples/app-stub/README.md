# App Stub — Prova de vida

App mínimo (Node 20+, zero deps externas além do SDK) que:

1. **Autentica** no Kairos CRM via HMAC
2. **Recebe webhooks** (`POST /webhook/kairos`)
3. **Valida assinatura** HMAC de cada webhook
4. **Loga** os eventos recebidos

## Setup

```bash
cd examples/app-stub
npm install  # ou pnpm install

export KAIROS_URL=https://crm.fbautomacao.space
export KAIROS_APP_ID=<uuid-da-application>
export KAIROS_API_KEY_ID=kairos_abc12345
export KAIROS_API_SECRET=<secret-completo>
export KAIROS_WEBHOOK_SECRET=<secret-do-webhook>  # se já criou webhook

# Opção A: usar ngrok pra expor local
ngrok http 3000
export PUBLIC_URL=https://abc-123.ngrok.io
```

## Rodar

```bash
npm start
```

## O que acontece

1. App autentica no CRM (1x, cacheado)
2. Cria webhook subscription apontando pra `${PUBLIC_URL}/webhook/kairos`
3. Inicia HTTP server em `:3000`
4. Quando você cria um lead no CRM (via UI ou API), webhook chega aqui:

```
📨 Webhook recebido: {
  event: 'lead.created',
  tenant: 'a3f1b2c4...',
  deliveryId: 'evt_1737043200_a3f1b2c4d5e6f7g8',
  attempt: '1',
  data: { id: '...', title: 'Interesse em pastilha Gol 2018', ... }
}
  → novo lead: Interesse em pastilha Gol 2018
```

## Criar lead de teste

```bash
# Via curl (precisa de auth token primeiro)
TOKEN=$(curl -s -X POST $KAIROS_URL/api/v1/external/auth/token \
  -H "X-Kairos-App-Id: $KAIROS_APP_ID" \
  -H "X-Kairos-Key-Id: $KAIROS_API_KEY_ID" \
  -H "X-Kairos-Timestamp: $(date +%s)" \
  -H "X-Kairos-Signature: $(...)" \
  -d "{\"keyId\":\"$KAIROS_API_KEY_ID\",\"timestamp\":$(date +%s)}" | jq -r .authToken)

curl -X POST $KAIROS_URL/api/v1/external/contacts/upsert \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "5515999998888", "name": "João Teste"}'

curl -X POST $KAIROS_URL/api/v1/external/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contactId": "...", "pipelineId": "...", "stageId": "...", "title": "Lead teste"}'
```

## Estrutura

```
app-stub/
├── package.json
├── server.ts          # Entry point (este arquivo)
└── README.md          # Este arquivo

Usa SDK: ../kairos-client-node/src/
```

## Limpar / desinstalar webhook

```bash
# Listar webhooks do app
curl $KAIROS_URL/api/v1/external/webhooks \
  -H "Authorization: Bearer $TOKEN"

# Deletar (soft — desativa)
curl -X DELETE $KAIROS_URL/api/v1/external/webhooks/<id> \
  -H "Authorization: Bearer $TOKEN"
```
