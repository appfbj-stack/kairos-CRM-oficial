# Arquitetura — Kairos CRM

> **Status atual:** Fases 1, 2 e 3 entregues em produção.
> Fase 4 (Kairos IA / Hermes) em construção.

## Princípios fundamentais

1. **Multi-tenant por design** — `tenantId` em toda tabela de negócio. Backend **nunca** aceita `tenantId` do frontend. Tenant vem do JWT.
2. **IA nativa, não microsserviço** — Kairos IA (módulo interno) roda dentro do backend. Sem deploy separado, sem fila distribuída no V1.
3. **Banco único** — Uma `kairos_crm_db` para todos os tenants. Isolamento via `tenantId` enforced nas services.
4. **IA opera, humano decide** — Kairos IA faz o trabalho operacional (cadastrar, classificar, mover, follow-up). Humano intervém quando precisa.
5. **Provider abstraction mínima** — Interfaces para LLM e WhatsApp. V1: Evolution Go + OpenAI/Gemini/Claude/DeepSeek. Meta/UazAPI/multiprovider pra depois.
6. **Sem complexidade desnecessária** — RAG, embeddings, vector DB, workflow builder: tudo fica pra depois que existir demanda.
7. **API é a fonte da verdade** — Lógica de negócio no backend. Frontend é fino.
8. **Testes de isolamento são obrigatórios** — Tenant A nunca pode ver dados de Tenant B.

## Stack

- **Backend:** Node 20 + Fastify 5 + Prisma + Postgres 15
- **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind + shadcn/ui
- **Monorepo:** pnpm + turborepo
- **Auth:** JWT (access 15min + refresh 7d) + bcrypt 12
- **WhatsApp:** Evolution Go v0.7.x (fork `appfbj-stack/evolution-go`)
- **LLM (Fase 4):** OpenAI / Gemini / Claude / DeepSeek (router interno)
- **Deploy:** Dokploy (VPS 187.77.229.227) + Caddy (proxy reverso)
- **Banco:** `kairos-shared-pg` (Postgres) com DB dedicado `kairos_crm_db`

---

## Conceito

O Kairos é percebido pelo cliente como **"um CRM que trabalha para mim"**:

```
Conversa do cliente (WhatsApp, chat, formulário)
        ↓
   Hermes (IA) interpreta
        ↓
   Executa ações operacionais:
     - identifica/cadastra contato
     - cria/classifica lead
     - move no funil
     - consulta produtos/serviços
     - cria tarefas, follow-ups, agendamentos
     - responde dúvidas
     - transfere pra humano se necessário
        ↓
   CRM atualizado automaticamente
```

O empresário não cadastra, não move lead, não cria follow-up manualmente. Ele só **revisa** o que a IA fez e **intervém** quando precisa.

---

## Multi-tenant

### Como o tenant é identificado

```
Login (POST /api/auth/login)
        ↓
Backend valida credenciais
        ↓
JWT gerado: { sub, email, tenantId, role }
        ↓
Toda requisição: Authorization: Bearer <jwt>
        ↓
Backend extrai tenantId DO JWT (nunca do body/query)
        ↓
Prisma middleware injeta: WHERE tenantId = jwt.tenantId
        ↓
PostgreSQL RLS reforça
```

### SUPER_ADMIN vs Tenant Admin

| Role           | tenantId | Visão                          |
|----------------|----------|--------------------------------|
| `SUPER_ADMIN`  | `null`   | Todos os tenants               |
| `TENANT_ADMIN` | tenant X | Tudo do X (gerencia usuários)  |
| `MANAGER`      | tenant X | Leads, conversas, funis        |
| `AGENT`        | tenant X | Conversas que estão atribuídas |
| `USER`         | tenant X | Apenas leitura limitada        |

---

## Hermes — IA nativa

Hermes **não é uma aplicação separada**. É um módulo em `apps/api/src/modules/hermes/`.

### Como funciona

```
Mensagem recebida (WhatsApp / chat / API)
        ↓
Salva no banco (mensagem + conversa)
        ↓
Webhook responde 200 OK rápido
        ↓
Hermes worker processa em background (ou inline no V1)
        ↓
LLM recebe contexto:
   - system_prompt do tenant
   - tools disponíveis
   - histórico da conversa
   - dados do contato/lead
        ↓
LLM decide:
   - responde mensagem
   - chama uma tool (createLead, moveLead, etc.)
   - transfere pra humano
        ↓
Tools executam com tenantId do JWT (NUNCA do LLM)
        ↓
Resposta enviada (WhatsApp / chat)
```

### Tools V1

- `get_contact` — busca contato por telefone/email
- `create_contact` — cria novo contato
- `update_contact` — atualiza dados
- `get_lead` — busca lead
- `create_lead` — cria lead a partir da conversa
- `update_lead` — atualiza lead
- `move_lead` — muda de etapa no funil
- `get_products` / `get_services` — consulta catálogo
- `create_task` — cria tarefa para humano
- `create_followup` — agenda follow-up
- `get_appointments` — consulta agenda
- `create_appointment` — marca horário
- `send_whatsapp_message` — envia mensagem
- `handoff_to_human` — transfere para humano

Todas as tools recebem `tenantId` do contexto autenticado. **O LLM nunca informa o tenant.** Se tentar acessar dados de outro tenant, falha.

### LLM Provider

```ts
interface LLMProvider {
  chat(params: {
    system: string;
    messages: Message[];
    tools?: ToolDef[];
    temperature?: number;
  }): Promise<{ content: string; toolCalls?: ToolCall[] }>;
}
```

V1: 1 provider (OpenAI ou Gemini — a definir). Interface pronta pra trocar.

---

## WhatsApp

V1: **1 provider** — Evolution Go v0.7.x (fork `appfbj-stack/evolution-go`, rodando no VPS na porta 8081, container `evogo-api`).

### Auth Evolution Go
- **Admin (criar/deletar instância):** header `apikey: GLOBAL_API_KEY` no `/instance/create` e `/instance/delete/:id`
- **Per-instance (conectar, qr, status, send):** header `apikey: <per-instance-token>` (gerado no create, salvo no campo `apiKey` da nossa `whatsapp_accounts`)

### Fluxo de criação
1. Frontend chama `POST /api/whatsapp/accounts` com `{ name, number? }`
2. Backend gera `instanceId = randomUUID()` e `token = randomHex(48)`
3. Backend chama Evolution `POST /instance/create` com `{ name: instanceId, instanceId, token, webhookUrl }`
4. Evolution cria e persiste. Token é o que vamos usar pra tudo depois.
5. Backend salva `WhatsAppAccount { instanceId, apiKey: token, ... }`

### Webhook (Evolution Go → Kairos)
- URL: `https://crm.fbautomacao.space/api/whatsapp/webhook` (passada no `webhookUrl` do create)
- Evento `Message`: `{ event: "Message", instance: "<uuid>", data: { key: { remoteJid, fromMe, id }, message: {...}, PushName, Chat, ... } }`
- Backend identifica conta por `instance`, normaliza telefone (`split('@')[0]`), faz upsert do Contact e Conversation, salva Message.
- Se conversa está `WITH_AI` e `!aiPaused`, dispara Kairos IA (Fase 4).

### Limitação conhecida
Evolution Go v0.7.1 está com whatsmeow desatualizado — o handshake com WhatsApp retorna "Client outdated (405)". A integração do nosso lado está correta; precisa atualizar whatsmeow no fork do Evolution. Enquanto isso, use o botão "⚡ Forçar conexão" pra testes com webhook simulado.

```
WhatsApp
   ↓
Evolution API (porta 8081)
   ↓
Webhook: POST /api/whatsapp/webhook
   ↓
Backend identifica:
   - qual WhatsApp Account (pela instance)
   - qual tenant (pela account)
   - qual contato (pelo número)
   ↓
Salva conversa + mensagem
   ↓
Dispara Hermes
   ↓
Resposta → Evolution API → WhatsApp
```

Provider interface (`WhatsAppProvider`) já preparado para adicionar Uazapi/oficial/etc. depois.

---

## Estrutura de código

### `apps/api`

```
src/
├── server.ts
├── config/env.ts
├── lib/                 (jwt, password, logger, errors, prisma)
├── middleware/          (auth, tenant, permissions)
└── modules/
    ├── auth/            ✅ Fase 1
    ├── tenants/         ✅ Fase 1
    ├── users/           ✅ Fase 1
    ├── crm/             ✅ Fase 2 — contacts, leads, pipelines, tasks, products, services
    ├── whatsapp/        ✅ Fase 3 — webhook, inbox, conversations, accounts
    ├── hermes/          ⏳ Fase 4 — IA nativa, tools
    ├── knowledge/       ⏳ Fase 5 — company_knowledge
    └── automations/     ⏳ Fase 6 — templates simples
```

### `apps/web`

```
app/
├── (public)/
│   ├── login/           ✅
│   └── register/        ✅
├── (dashboard)/
│   ├── layout.tsx       ✅ (sidebar com placeholder para próximas páginas)
│   ├── dashboard/       ✅
│   ├── conversations/   ⏳ Fase 3
│   ├── leads/           ⏳ Fase 2
│   ├── pipelines/       ⏳ Fase 2
│   ├── inbox/           ⏳ Fase 3
│   ├── hermes/          ⏳ Fase 4 (config da IA por tenant)
│   └── settings/        ⏳ Fase 7
└── page.tsx             ✅ (landing)
```

---

## Schema do banco (planejado para todas as fases)

### Fase 1 ✅
- `tenants` — empresas
- `users` — usuários (multi-tenant)
- `refresh_tokens` — tokens de refresh
- `audit_logs` — trilha de auditoria

### Fase 2 ✅
- `contacts` — pessoas
- `companies` — empresas (diferente de tenant — empresa-cliente do CRM)
- `leads` — oportunidades
- `pipelines` — funis
- `pipeline_stages` — etapas
- `tasks` — tarefas
- `products`, `services` — catálogo

### Fase 3 ✅
- `whatsapp_accounts` — instâncias WhatsApp por tenant
- `conversations` — conversas
- `messages` — mensagens

### Fase 4 ⏳
- `ai_configs` — configuração da IA por tenant
- `ai_messages` — log de interações com IA

### Fase 5 ⏳
- `company_knowledge` — base de conhecimento (perguntas/respostas)

### Fase 6 ⏳
- `followups` — follow-ups agendados
- `appointments` — agenda
- `automations` — templates ativos

### Fase 7 ⏳
- `plans` — definição de planos (FREE, BASIC, PRO, PREMIUM)
- `plan_limits` — limites por plano (usuários, WhatsApps, msgs IA/mês)

---

## Segurança

- Senhas: bcrypt (12 rounds)
- JWT: claims `sub`, `tenantId`, `role`, `iat`, `exp`
- Refresh tokens: hash no banco, rotação, revogação
- Helmet + CORS restrito
- Validação de input com Zod em todo endpoint
- Erros nunca expõem stack trace pro frontend
- Audit log de toda ação sensível
- (Fase 2+) Row Level Security no Postgres

---

## O que fica pra depois (não entra na V1)

- ❌ Vector DB / embeddings / RAG avançado
- ❌ Workflow builder visual
- ❌ Multi-provider LLM/WhatsApp simultâneo
- ❌ Multi-tenant subdomain (atualmente domínio único `crm.fbautomacao.space`)
- ❌ Microsserviços / filas distribuídas (Bull/Redis) — só se webhook travar
- ❌ Cobrança automática (Stripe/etc) — só estrutura de planos

Esses são adicionados **quando existir demanda real**, não antes.
