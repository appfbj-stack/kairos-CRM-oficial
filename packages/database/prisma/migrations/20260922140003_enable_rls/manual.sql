-- =====================================================
-- Fase 9: Row Level Security (RLS) no Postgres
-- Multi-tenant enforcement no BANCO — defesa em profundidade.
--
-- IMPORTANTE: esta migration é OPT-IN.
--   - Por padrão: RLS fica HABILITADO mas BYPASSED (admin role tem BYPASSRLS).
--   - Pra forçar enforcement: ALTER ROLE kairos_crm NOBYPASSRLS;
--   - Pra reverter: ALTER ROLE kairos_crm BYPASSRLS;
--   - Pra desabilitar policies: DROP POLICY ... (script no fim do arquivo)
--
-- Aplicar com: psql $DATABASE_URL -f manual.sql (dentro de transacao)
--
-- CORREÇÕES aplicadas na migração inicial (2026-09-23):
--   1. current_tenant_id() retorna TEXT (não uuid) — todos os IDs são text gen_random_uuid()::text
--   2. 4 tabelas (api_keys, webhook_endpoints, webhook_deliveries, application_audit_logs)
--      não têm tenantId direto — policies usam EXISTS via applications
--   3. refresh_tokens tem userId (não tenantId) — policy via users
--   4. pipeline_stages tem pipelineId — policy via pipelines
--   5. FORCE ROW LEVEL SECURITY aplicado em TODAS — sem isso, owner da tabela ignora RLS
-- =====================================================

-- =====================================================
-- HELPER FUNCTION — le tenantId da sessao
-- =====================================================

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION current_tenant_id() IS 'Retorna o tenantId da sessao atual (text), ou NULL se nao setado (bypass).';

-- =====================================================
-- ENABLE RLS em todas as tabelas de negocio
-- + FORCE ROW LEVEL SECURITY (sem isso, owner ignora)
-- =====================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'contacts','companies','leads','pipelines','pipeline_stages','tasks',
        'products','services','whatsapp_accounts','conversations','messages',
        'ai_configs','ai_messages','company_knowledge','followups','appointments',
        'automations','access_tickets','notifications','refresh_tokens','audit_logs',
        'applications','api_keys','auth_tokens','webhook_endpoints',
        'webhook_deliveries','application_audit_logs'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END
$$;

-- =====================================================
-- POLICIES — FOR ALL usando current_tenant_id()
-- Idempotente: DROP POLICY IF EXISTS antes de CREATE
-- =====================================================

-- Tabelas COM tenantId direto (21 tabelas)
DROP POLICY IF EXISTS "contacts_tenant_isolation" ON "contacts";
CREATE POLICY "contacts_tenant_isolation" ON "contacts"
  FOR ALL
  USING ("contacts"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("contacts"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "companies_tenant_isolation" ON "companies";
CREATE POLICY "companies_tenant_isolation" ON "companies"
  FOR ALL
  USING ("companies"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("companies"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "leads_tenant_isolation" ON "leads";
CREATE POLICY "leads_tenant_isolation" ON "leads"
  FOR ALL
  USING ("leads"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("leads"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "pipelines_tenant_isolation" ON "pipelines";
CREATE POLICY "pipelines_tenant_isolation" ON "pipelines"
  FOR ALL
  USING ("pipelines"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("pipelines"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "tasks_tenant_isolation" ON "tasks";
CREATE POLICY "tasks_tenant_isolation" ON "tasks"
  FOR ALL
  USING ("tasks"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("tasks"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "products_tenant_isolation" ON "products";
CREATE POLICY "products_tenant_isolation" ON "products"
  FOR ALL
  USING ("products"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("products"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "services_tenant_isolation" ON "services";
CREATE POLICY "services_tenant_isolation" ON "services"
  FOR ALL
  USING ("services"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("services"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "whatsapp_accounts_tenant_isolation" ON "whatsapp_accounts";
CREATE POLICY "whatsapp_accounts_tenant_isolation" ON "whatsapp_accounts"
  FOR ALL
  USING ("whatsapp_accounts"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("whatsapp_accounts"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "conversations_tenant_isolation" ON "conversations";
CREATE POLICY "conversations_tenant_isolation" ON "conversations"
  FOR ALL
  USING ("conversations"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("conversations"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "messages_tenant_isolation" ON "messages";
CREATE POLICY "messages_tenant_isolation" ON "messages"
  FOR ALL
  USING ("messages"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("messages"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "ai_configs_tenant_isolation" ON "ai_configs";
CREATE POLICY "ai_configs_tenant_isolation" ON "ai_configs"
  FOR ALL
  USING ("ai_configs"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("ai_configs"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "ai_messages_tenant_isolation" ON "ai_messages";
CREATE POLICY "ai_messages_tenant_isolation" ON "ai_messages"
  FOR ALL
  USING ("ai_messages"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("ai_messages"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "company_knowledge_tenant_isolation" ON "company_knowledge";
CREATE POLICY "company_knowledge_tenant_isolation" ON "company_knowledge"
  FOR ALL
  USING ("company_knowledge"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("company_knowledge"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "followups_tenant_isolation" ON "followups";
CREATE POLICY "followups_tenant_isolation" ON "followups"
  FOR ALL
  USING ("followups"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("followups"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "appointments_tenant_isolation" ON "appointments";
CREATE POLICY "appointments_tenant_isolation" ON "appointments"
  FOR ALL
  USING ("appointments"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("appointments"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "automations_tenant_isolation" ON "automations";
CREATE POLICY "automations_tenant_isolation" ON "automations"
  FOR ALL
  USING ("automations"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("automations"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "access_tickets_tenant_isolation" ON "access_tickets";
CREATE POLICY "access_tickets_tenant_isolation" ON "access_tickets"
  FOR ALL
  USING ("access_tickets"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("access_tickets"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "notifications_tenant_isolation" ON "notifications";
CREATE POLICY "notifications_tenant_isolation" ON "notifications"
  FOR ALL
  USING ("notifications"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("notifications"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "applications_tenant_isolation" ON "applications";
CREATE POLICY "applications_tenant_isolation" ON "applications"
  FOR ALL
  USING ("applications"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("applications"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

-- =====================================================
-- POLICIES COM JOIN — tabelas SEM tenantId direto
-- =====================================================

-- refresh_tokens: via users
DROP POLICY IF EXISTS "refresh_tokens_tenant_isolation" ON "refresh_tokens";
CREATE POLICY "refresh_tokens_tenant_isolation" ON "refresh_tokens"
  FOR ALL
  USING (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = "refresh_tokens"."userId"
        AND u."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = "refresh_tokens"."userId"
        AND u."tenantId" = current_tenant_id()
    )
  );

-- auth_tokens: tem tenantId direto (denormalizado)
DROP POLICY IF EXISTS "auth_tokens_tenant_isolation" ON "auth_tokens";
CREATE POLICY "auth_tokens_tenant_isolation" ON "auth_tokens"
  FOR ALL
  USING ("auth_tokens"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("auth_tokens"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

-- audit_logs: tem tenantId direto
DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON "audit_logs";
CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs"
  FOR ALL
  USING ("audit_logs"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("audit_logs"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

-- api_keys: via applications (só tem applicationId)
DROP POLICY IF EXISTS "api_keys_tenant_isolation" ON "api_keys";
CREATE POLICY "api_keys_tenant_isolation" ON "api_keys"
  FOR ALL
  USING (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = "api_keys"."applicationId"
        AND a."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = "api_keys"."applicationId"
        AND a."tenantId" = current_tenant_id()
    )
  );

-- webhook_endpoints: via applications (só tem applicationId)
DROP POLICY IF EXISTS "webhook_endpoints_tenant_isolation" ON "webhook_endpoints";
CREATE POLICY "webhook_endpoints_tenant_isolation" ON "webhook_endpoints"
  FOR ALL
  USING (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = "webhook_endpoints"."applicationId"
        AND a."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = "webhook_endpoints"."applicationId"
        AND a."tenantId" = current_tenant_id()
    )
  );

-- webhook_deliveries: via webhook_endpoints -> applications
DROP POLICY IF EXISTS "webhook_deliveries_tenant_isolation" ON "webhook_deliveries";
CREATE POLICY "webhook_deliveries_tenant_isolation" ON "webhook_deliveries"
  FOR ALL
  USING (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM webhook_endpoints we
      JOIN applications a ON a.id = we."applicationId"
      WHERE we.id = "webhook_deliveries"."endpointId"
        AND a."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM webhook_endpoints we
      JOIN applications a ON a.id = we."applicationId"
      WHERE we.id = "webhook_deliveries"."endpointId"
        AND a."tenantId" = current_tenant_id()
    )
  );

-- application_audit_logs: via applications
DROP POLICY IF EXISTS "application_audit_logs_tenant_isolation" ON "application_audit_logs";
CREATE POLICY "application_audit_logs_tenant_isolation" ON "application_audit_logs"
  FOR ALL
  USING (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = "application_audit_logs"."applicationId"
        AND a."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = "application_audit_logs"."applicationId"
        AND a."tenantId" = current_tenant_id()
    )
  );

-- pipeline_stages: via pipelines (não tem tenantId direto)
DROP POLICY IF EXISTS "pipeline_stages_tenant_isolation" ON "pipeline_stages";
CREATE POLICY "pipeline_stages_tenant_isolation" ON "pipeline_stages"
  FOR ALL
  USING (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = "pipeline_stages"."pipelineId"
        AND p."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    current_tenant_id() IS NULL OR
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = "pipeline_stages"."pipelineId"
        AND p."tenantId" = current_tenant_id()
    )
  );

-- =====================================================
-- ROLLBACK — pra reverter TUDO (se algo quebrar)
-- =====================================================
-- (NAO executar junto — guardar pra emergencia)
-- BEGIN;
-- DO $$
-- DECLARE r RECORD;
-- BEGIN
--   FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=true LOOP
--     EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
--     EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', r.tablename);
--     EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tablename || '_tenant_isolation', r.tablename);
--   END LOOP;
-- END
-- $$;
-- DROP FUNCTION IF EXISTS current_tenant_id();
-- COMMIT;

-- =====================================================
-- ENFORCEMENT — pra forçar RLS (após validar que nada quebra)
-- =====================================================
-- psql -c "ALTER ROLE kairos_crm NOBYPASSRLS;"   <- força RLS (sem bypass)
-- psql -c "ALTER ROLE kairos_crm BYPASSRLS;"     <- volta a bypass
-- IMPORTANTE: NOBYPASSRLS exige que TODA query Prisma faça
--   SET LOCAL app.tenant_id = '<uuid>' antes — caso contrário,
--   queries vão retornar ZERO rows (current_tenant_id IS NULL
--   mas a policy tem IS NULL OR comparison, então sem SET
--   vê TUDO; com NOBYPASSRLS + sem SET, vê NADA).
