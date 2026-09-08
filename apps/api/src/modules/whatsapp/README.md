# Módulo WhatsApp (Fase 3)

Integração com WhatsApp via **Evolution API** (provider único na V1).

## Estrutura planejada

```
whatsapp/
├── provider/
│   ├── types.ts                    # interface WhatsAppProvider
│   └── evolution/
│       └── evolution.adapter.ts    # implementação V1
├── whatsapp.routes.ts              # webhook + inbox
├── conversations.routes.ts
├── messages.routes.ts
├── whatsapp.service.ts
├── conversations.service.ts
├── messages.service.ts
└── webhook-handler.ts
```

## Rotas previstas

| Método | Rota                              | Auth | Descrição                       |
|--------|-----------------------------------|------|---------------------------------|
| POST   | `/api/whatsapp/webhook`          | -    | Recebe eventos da Evolution     |
| GET    | `/api/whatsapp/accounts`          | tenant | Lista contas WhatsApp        |
| POST   | `/api/whatsapp/accounts`          | tenant | Cria nova conta               |
| POST   | `/api/whatsapp/accounts/:id/connect` | tenant | Conecta via QR Code        |
| GET    | `/api/inbox`                      | tenant | Lista conversas                |
| GET    | `/api/inbox/:id/messages`         | tenant | Mensagens da conversa          |
| POST   | `/api/inbox/:id/messages`         | tenant | Envia mensagem (humano)        |
| POST   | `/api/inbox/:id/takeover`         | agent  | Pausa IA, assume conversa    |
| POST   | `/api/inbox/:id/return`           | agent  | Devolve pra IA                |
| POST   | `/api/inbox/:id/close`            | agent  | Fecha conversa                |

## Provider interface (V1)

```ts
interface WhatsAppProvider {
  connect(instanceId: string): Promise<{ qrCode: string }>;
  sendMessage(account: WhatsAppAccount, to: string, content: string): Promise<{ externalId: string }>;
  parseWebhook(payload: unknown): WebhookEvent[];
}
```

V1: só `EvolutionAdapter`. Uazapi/Official ficam pra depois.

## Status

⏳ Aguardando Fase 1 + Fase 2.
