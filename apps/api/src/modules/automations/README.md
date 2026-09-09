# Módulo Automações (Fase 6)

V1: **templates prontos**, sem workflow builder visual.

## Templates disponíveis (V1)

| Template                  | Trigger                   | Ações                                    |
|---------------------------|---------------------------|------------------------------------------|
| **Novo Lead**             | `lead_created`            | `hermes_attend` (classifica + responde)  |
| **Lead sem resposta 24h** | `no_response_24h`         | `send_whatsapp` (follow-up)              |
| **Lead sem resposta 48h** | `no_response_48h`         | `send_whatsapp` (follow-up)              |
| **Pedido de humano**      | `human_request`           | `pause_ai` + `notify_agent`              |
| **Agendamento criado**    | `appointment_created`     | `send_whatsapp` (confirmação)            |
| **Lembrete 1h antes**     | `appointment_1h_before`   | `send_whatsapp` (lembrete)               |

O tenant pode ativar/desativar cada template e customizar a mensagem.

## Estrutura

```
automations/
├── automations.routes.ts
├── automations.service.ts
├── runner.ts              # processa automações pendentes
├── triggers/              # detectores de eventos
│   ├── lead-created.ts
│   ├── no-response.ts
│   ├── human-request.ts
│   └── appointment-reminder.ts
└── templates.ts           # definição dos templates
```

## Endpoints

| Método | Rota                              | Auth   | Descrição                |
|--------|-----------------------------------|--------|--------------------------|
| GET    | `/api/automations`                | tenant | Lista automações ativas  |
| POST   | `/api/automations/:id/toggle`     | tenant | Ativa/desativa           |
| PATCH  | `/api/automations/:id`            | tenant | Customiza mensagem       |

## Status

⏳ Aguardando Fase 1-5.
