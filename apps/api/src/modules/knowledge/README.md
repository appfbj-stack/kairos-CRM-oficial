# Módulo Knowledge (Fase 5)

Base de conhecimento do tenant. V1 é simples: lista de perguntas e respostas com busca full-text.

**Sem RAG, sem embeddings, sem vector DB.** Só Postgres + ILIKE.

## Estrutura

```
knowledge/
├── knowledge.routes.ts
├── knowledge.service.ts
└── search.ts                        # busca full-text
```

## Endpoints

| Método | Rota                              | Auth   | Descrição                  |
|--------|-----------------------------------|--------|----------------------------|
| GET    | `/api/knowledge`                  | tenant | Lista entradas             |
| POST   | `/api/knowledge`                  | tenant | Cria entrada               |
| PATCH  | `/api/knowledge/:id`              | tenant | Atualiza                   |
| DELETE | `/api/knowledge/:id`              | tenant | Remove                     |
| POST   | `/api/knowledge/search`           | -      | Busca (usado pelo Hermes)  |

## Modelo

```prisma
model CompanyKnowledge {
  id        String   @id @default(uuid())
  tenantId  String
  question  String
  answer    String
  category  String?
  active    Boolean  @default(true)
  // ...
}
```

## Busca

```sql
SELECT * FROM company_knowledge
WHERE tenant_id = $1
  AND active = true
  AND (question ILIKE '%' || $2 || '%' OR answer ILIKE '%' || $2 || '%')
ORDER BY
  CASE WHEN question ILIKE '%' || $2 || '%' THEN 0 ELSE 1 END,
  updated_at DESC
LIMIT 5;
```

(Se precisar de busca melhor no futuro, adicionar índice GIN com `pg_trgm`. Mas por enquanto, ILIKE resolve.)

## Status

⏳ Aguardando Fase 1.
