# Módulo Kairos IA (Fase 4) — ex-Hermes

**Kairos IA** é o coração operacional do Kairos CRM. **Não é uma aplicação separada** — é um módulo dentro desta API. (Internamente ainda usamos "hermes" como nome técnico de pasta, mas o nome visível para o usuário é **Kairos IA**.)

> ⚠️ Nota: o nome técnico da pasta continua `hermes` por compatibilidade com a arquitetura. O que importa é o que o usuário vê.

## O que a Kairos IA faz

Recebe uma mensagem e decide:
- Responde sozinho
- Cria/atualiza contato, lead, agendamento, follow-up
- Move lead no funil
- Consulta produtos/serviços
- Transfere pra humano

## Estrutura planejada

```
hermes/  (nome técnico interno)
├── hermes.service.ts                # orquestrador principal
├── llm/
│   ├── types.ts                     # LLMProvider interface
│   ├── openai.adapter.ts            # V1
│   └── prompt-builder.ts            # monta system_prompt com contexto do tenant
├── tools/
│   ├── types.ts                     # ToolDefinition
│   ├── registry.ts                  # registro de tools disponíveis
│   ├── get-contact.tool.ts
│   ├── create-contact.tool.ts
│   ├── create-lead.tool.ts
│   ├── move-lead.tool.ts
│   ├── get-products.tool.ts
│   ├── create-task.tool.ts
│   ├── create-followup.tool.ts
│   ├── create-appointment.tool.ts
│   ├── send-whatsapp.tool.ts
│   └── handoff-to-human.tool.ts
├── context-builder.ts               # monta contexto: tenant + contact + lead + histórico
└── classifier.ts                    # identifica intent (novo lead, dúvida, agendamento, etc)
```

## Fluxo

```
Mensagem chega (WhatsApp / API)
        ↓
Salva no banco (Mensagem + atualiza Conversa)
        ↓
Webhook responde 200 OK rápido
        ↓
Kairos IA processa (background ou inline)
        ↓
1. Carrega contexto do tenant (AIConfig, knowledge base, produtos)
2. Carrega histórico da conversa
3. Monta system_prompt dinâmico
4. Chama LLM com tools
5. LLM retorna: texto + tool_calls
6. Executa tools (com tenantId do JWT)
7. Se tool retorna erro: tenta novamente ou pede humano
8. Salva resposta + log em AIMessage
9. Envia via WhatsApp
10. Atualiza lead (status, temperature, stage) se aplicável
```

## LLM Provider (V1)

```ts
interface LLMProvider {
  chat(params: {
    system: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string; toolCallId?: string; name?: string }>;
    tools?: ToolDefinition[];
    temperature?: number;
  }): Promise<{
    content: string | null;
    toolCalls?: Array<{ id: string; name: string; args: any }>;
  }>;
}
```

V1: OpenAI (`gpt-4o-mini`). Interface pronta pra trocar.

## Princípio de segurança

> **O LLM nunca informa o tenant.** Toda tool recebe `tenantId` do contexto autenticado (request.user.tenantId). Se o LLM tentar acessar dados de outro tenant via tool, falha.

## Tools V1

| Tool                    | O que faz                          |
|-------------------------|------------------------------------|
| `get_contact`           | Busca contato por telefone         |
| `create_contact`        | Cria novo contato                  |
| `update_contact`        | Atualiza tags/notas                |
| `get_lead`              | Busca lead ativo do contato        |
| `create_lead`           | Cria lead a partir da conversa     |
| `update_lead`           | Atualiza temperatura, interesse    |
| `move_lead`             | Move lead pra outra etapa          |
| `get_products`          | Lista produtos do tenant           |
| `get_services`          | Lista serviços do tenant           |
| `create_task`           | Cria tarefa pra humano             |
| `create_followup`       | Agenda follow-up                   |
| `get_appointments`      | Consulta horários disponíveis      |
| `create_appointment`    | Marca horário                      |
| `send_whatsapp_message` | Envia mensagem pelo WhatsApp       |
| `handoff_to_human`      | Pausa IA, notifica atendente       |

## Status

⏳ Aguardando Fase 1 + 2 + 3.
