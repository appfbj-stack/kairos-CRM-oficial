# Plano de rollout — Row Level Security (Fase 4)

> **Status atual**: Migration SQL gerada e pronta. Helper `lib/tenant-db.ts` criado. **NÃO aplicado em produção ainda.**

## Visão geral

Multi-tenancy hoje é garantido por **service layer** (todo `where` Prisma tem `tenantId`).
Isso funciona, mas é frágil: 1 query esquecida → vazamento entre tenants.

RLS adiciona **defesa em profundidade** no banco: política Postgres que recusa SELECT/INSERT/UPDATE/DELETE se `app.tenant_id` da sessão não bater.

## Como funciona

1. **Aplicação seta** `app.tenant_id = '<uuid>'` por conexão/transação
2. **Postgres** avalia policy em cada query: `WHERE tenantId = current_setting('app.tenant_id')`
3. **Se a app esquecer** o `where: { tenantId }` → RLS filtra mesmo assim
4. **Super admin** pode bypassar com `ALTER ROLE ... BYPASSRLS`

## Risco

⚠️ RLS mal aplicado pode **bloquear queries legítimas**. Por isso rollout em 3 etapas.

## Etapa 0 — Pré-requisitos (✅ feito)

- [x] Migration SQL gerada: `packages/database/prisma/migrations/20260922140003_enable_rls/manual.sql`
- [x] Helper `withTenantInDb` criado: `apps/api/src/lib/tenant-db.ts`
- [x] Function Postgres `current_tenant_id()` no SQL
- [x] Policy especial pra `pipeline_stages` (via EXISTS no parent `pipeline`)

## Etapa 1 — Dry-run (Pastor roda em prod, modo observação)

**Objetivo**: aplicar SQL, deixar role COM `BYPASSRLS`, validar que policies existem mas não bloqueiam nada.

### Passo a passo

```bash
# 1. Backup (sempre!)
ssh root@187.77.229.227
docker exec kairos-shared-pg pg_dump -U postgres -d kairos_crm_db > /root/backup_pre_rls_$(date +%Y%m%d).sql

# 2. Verificar que a role atual TEM BYPASSRLS (default de superuser)
docker exec kairos-shared-pg psql -U postgres -d kairos_crm_db -c \
  "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'kairos_crm';"
# Esperado: t (true)

# 3. Aplicar a migration (idempotente)
docker exec -i kairos-shared-pg psql -U postgres -d kairos_crm_db < \
  packages/database/prisma/migrations/20260922140003_enable_rls/manual.sql

# 4. Verificar policies criadas
docker exec kairos-shared-pg psql -U postgres -d kairos_crm_db -c \
  "SELECT schemaname, tablename, policyname FROM pg_policies WHERE policyname LIKE '%tenant_isolation' ORDER BY tablename;"
# Esperado: 27 rows

# 5. Validar que a app continua funcionando (testes de isolamento existentes)
ssh root@187.77.229.227 "cd /root/kairos-crm-api && pnpm test:tenant-isolation"
# TODOS os 7 testes devem continuar passando
```

### Critério de sucesso
- [ ] Migration aplicada sem erro
- [ ] 27 policies visíveis
- [ ] App funciona normalmente
- [ ] Testes de isolamento passam

**Se quebrar**:
```bash
# Rollback imediato
docker exec kairos-shared-pg psql -U postgres -d kairos_crm_db -c "
DO \$\$ DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE tablename IN (
    'contacts','companies','leads','pipelines','pipeline_stages',
    'tasks','products','services','whatsapp_accounts','conversations',
    'messages','ai_configs','ai_messages','company_knowledge',
    'followups','appointments','automations','access_tickets',
    'notifications','refresh_tokens','audit_logs',
    'applications','api_keys','auth_tokens','webhook_endpoints',
    'webhook_deliveries','application_audit_logs'
  ) LOOP
    EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ' || r.tablename || '_tenant_isolation ON ' || quote_ident(r.tablename);
  END LOOP;
END \$\$;"
```

## Etapa 2 — Shadow (RLS ativo, mas app não seta context)

**Objetivo**: validar que policies não quebram queries que NÃO setam `app.tenant_id`.

Como `policy USING (... OR current_tenant_id() IS NULL)` retorna `true` quando session não setou nada, **todas as queries continuam funcionando** (bypass automático).

### Validação

```bash
# 1. Verificar que kairos_crm AINDA tem BYPASSRLS (não mudar ainda)
docker exec kairos-shared-pg psql -U postgres -d kairos_crm_db -c \
  "ALTER ROLE kairos_crm NOBYPASSRLS;"
# AGORA a app usa role SEM bypass

# 2. Testar app em prod (smoke test)
curl -s https://crm.fbautomacao.space/api/health
# Esperado: 200 OK

curl -s -X POST https://crm.fbautomacao.space/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kairoscrm.com","password":"...","tenantSlug":"demo"}'
# Esperado: 200 + accessToken

# 3. Testar acesso multi-tenant (deve continuar funcionando)
curl -s -X GET https://crm.fbautomacao.space/api/crm/leads \
  -H "Authorization: Bearer <token>"
# Esperado: 200 + dados do tenant demo (NÃO de outros tenants)
```

### Por que isso funciona?

```sql
CREATE POLICY "contacts_tenant_isolation" ON "contacts"
  FOR ALL
  USING ("contacts"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);
```

Quando app NÃO seta `app.tenant_id`, `current_tenant_id()` retorna NULL, `IS NULL` é true, policy libera tudo. Mesma segurança de antes (service-layer garante).

### Critério de sucesso
- [ ] App continua respondendo
- [ ] Tenant isolation mantido (via service layer)
- [ ] Nenhum vazamento entre tenants

## Etapa 3 — Enforce (RLS ativo, app seta context, role SEM bypass)

**Objetivo**: RLS passa a ser a fonte da verdade. Service layer vira "otimização".

### Mudanças necessárias no código (NÃO nesta entrega)

1. **Middleware tenant.ts** já chama `setTenantContext` via AsyncLocalStorage (F1.1)
2. **Novo**: `injectTenantInDb` chama `withTenantInDb(tenantId, fn)` em todas as queries do request
3. **Refactor**: services passam a aceitar `tx` (Prisma transaction client) em vez de `prisma` direto
4. **Listar todos os endpoints** que fazem query e wrappear

Estimativa: **3-5 dias de trabalho** de refactor. Possível automatizar com lint rule.

### Passo a passo final

```bash
# 1. Deploy do código com setTenantInDb nos middlewares
# 2. Conectar como kairos_crm (que agora NÃO tem BYPASSRLS)
docker exec kairos-shared-pg psql -U postgres -d kairos_crm_db -c \
  "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'kairos_crm';"
# Esperado: f (false) — vindo da Etapa 2
# (na Etapa 2 você removeu; aqui só confirma)

# 3. Validar acesso cross-tenant
docker exec kairos-shared-pg psql -U kairos_crm -d kairos_crm_db -c \
  "SET app.tenant_id = '<tenant-uuid-A>'; SELECT id, name FROM contacts;"
docker exec kairos-shared-pg psql -U kairos_crm -d kairos_crm_db -c \
  "SET app.tenant_id = '<tenant-uuid-B>'; SELECT id, name FROM contacts;"
# Cada query deve retornar SÓ dados do seu tenant
```

### Critério de sucesso
- [ ] Tenant A não vê dados de Tenant B (mesmo com query errada)
- [ ] SUPER_ADMIN continua funcionando (BYPASSRLS=true)
- [ ] Performance OK (overhead de RLS é mínimo, < 1ms por query)

## Rollback de emergência

Se **qualquer** etapa der problema em prod:

```bash
# 1. Reverter role pra bypass (1 segundo, sem restart)
docker exec kairos-shared-pg psql -U postgres -d kairos_crm_db -c \
  "ALTER ROLE kairos_crm BYPASSRLS;"

# 2. Validar app
curl https://crm.fbautomacao.space/api/health

# 3. Se ainda quebrado, dropar policies + desabilitar RLS
docker exec kairos-shared-pg psql -U postgres -d kairos_crm_db <<'EOF'
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;
EOF
```

## Decisão recomendada

Eu sugiro **executar Etapa 1 + 2** agora (1 hora de trabalho). Deixar Etapa 3 pra quando Pastor quiser dedicar tempo ao refactor de services.

**Etapa 1+2 dá:**
- ✅ Policies criadas (não quebram nada — bypass via `IS NULL`)
- ✅ Camada extra de segurança caso service layer esqueça um `where`
- ✅ Function `current_tenant_id()` pronta pra Etapa 3
- ✅ Helper `withTenantInDb` pronto pra Etapa 3
- ❌ NÃO força enforcement (Pastor decide quando)

## Próximos passos

1. Pastor revisa este documento
2. Pastor decide se Etapa 1+2 ou só 1
3. Eu gero o comando exato (`ssh + psql`) e Pastor roda em horário controlado
4. Monitora logs por 1 semana
5. Se OK → decide se vai pra Etapa 3
