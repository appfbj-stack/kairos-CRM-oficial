# Módulo CRM (Fase 2)

Endpoints REST para Contacts, Leads, Pipelines, Tasks, Products, Services.

## Estrutura planejada

```
crm/
├── contacts/
│   ├── contacts.routes.ts
│   ├── contacts.service.ts
│   └── contacts.schema.ts
├── leads/
├── pipelines/
├── tasks/
├── products/
└── services/
```

## Status

⏳ Aguardando finalização da Fase 1 (deploy + validação).

## Endpoints previstos

| Recurso   | Rotas                                                                 |
|-----------|-----------------------------------------------------------------------|
| Contacts  | `GET/POST /api/crm/contacts`, `GET/PATCH/DELETE /api/crm/contacts/:id`|
| Leads     | `GET/POST /api/crm/leads`, `GET/PATCH/DELETE /api/crm/leads/:id`, `POST /api/crm/leads/:id/move` |
| Pipelines | `GET/POST /api/crm/pipelines`, `POST /api/crm/pipelines/:id/stages`   |
| Tasks     | `GET/POST /api/crm/tasks`, `PATCH/DELETE /api/crm/tasks/:id`          |
| Products  | `GET/POST /api/crm/products`                                          |
| Services  | `GET/POST /api/crm/services`                                          |

Todas as rotas filtram automaticamente por `tenantId` do JWT.
