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

-- =====================================================
-- HELPER FUNCTION — le tenantId da sessao
-- =====================================================

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION current_tenant_id() IS 'Retorna o tenantId da sessao atual, ou NULL se nao setado (bypass).';

-- =====================================================
-- ENABLE RLS em todas as tabelas de negocio
-- =====================================================

ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipelines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_knowledge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "followups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_audit_logs" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES — FOR ALL usando current_tenant_id()
-- =====================================================

-- Idempotente: DROP POLICY IF EXISTS antes de CREATE
-- IMPORTANTE: tabelas SEM tenantId (ex: pipeline_stages) usam JOIN

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

DROP POLICY IF EXISTS "pipeline_stages_tenant_isolation" ON "pipeline_stages";
CREATE POLICY "pipeline_stages_tenant_isolation" ON "pipeline_stages"
  FOR ALL
  USING ("pipeline_stages"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("pipeline_stages"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

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

DROP POLICY IF EXISTS "refresh_tokens_tenant_isolation" ON "refresh_tokens";
CREATE POLICY "refresh_tokens_tenant_isolation" ON "refresh_tokens"
  FOR ALL
  USING ("refresh_tokens"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("refresh_tokens"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON "audit_logs";
CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs"
  FOR ALL
  USING ("audit_logs"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("audit_logs"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "applications_tenant_isolation" ON "applications";
CREATE POLICY "applications_tenant_isolation" ON "applications"
  FOR ALL
  USING ("applications"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("applications"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "api_keys_tenant_isolation" ON "api_keys";
CREATE POLICY "api_keys_tenant_isolation" ON "api_keys"
  FOR ALL
  USING ("api_keys"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("api_keys"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "auth_tokens_tenant_isolation" ON "auth_tokens";
CREATE POLICY "auth_tokens_tenant_isolation" ON "auth_tokens"
  FOR ALL
  USING ("auth_tokens"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("auth_tokens"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "webhook_endpoints_tenant_isolation" ON "webhook_endpoints";
CREATE POLICY "webhook_endpoints_tenant_isolation" ON "webhook_endpoints"
  FOR ALL
  USING ("webhook_endpoints"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("webhook_endpoints"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "webhook_deliveries_tenant_isolation" ON "webhook_deliveries";
CREATE POLICY "webhook_deliveries_tenant_isolation" ON "webhook_deliveries"
  FOR ALL
  USING ("webhook_deliveries"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("webhook_deliveries"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "application_audit_logs_tenant_isolation" ON "application_audit_logs";
CREATE POLICY "application_audit_logs_tenant_isolation" ON "application_audit_logs"
  FOR ALL
  USING ("application_audit_logs"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL)
  WITH CHECK ("application_audit_logs"."tenantId" = current_tenant_id() OR current_tenant_id() IS NULL);

-- Special case: pipeline_stages NAO tem tenantId direto (pertence ao pipeline)
DROP POLICY IF EXISTS "pipeline_stages_tenant_isolation" ON "pipeline_stages";
-- Policy via EXISTS no parent (pipeline.tenantId)
CREATE POLICY "pipeline_stages_tenant_isolation" ON "pipeline_stages"
  FOR ALL
  USING (
    current_tenant_id() IS NULL OR
    EXISTS (SELECT 1 FROM pipelines p WHERE p.id = "pipeline_stages"."pipelineId" AND p."tenantId" = current_tenant_id())
  )
  WITH CHECK (
    current_tenant_id() IS NULL OR
    EXISTS (SELECT 1 FROM pipelines p WHERE p.id = "pipeline_stages"."pipelineId" AND p."tenantId" = current_tenant_id())
  );

-- =====================================================
-- ROLLBACK — pra reverter TUDO (se algo quebrar)
-- =====================================================
-- (NAO executar junto — guardar pra emergencia)
-- BEGIN;
-- ALTER TABLE "contacts" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "contacts_tenant_isolation" ON "contacts";
-- ALTER TABLE "companies" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "companies_tenant_isolation" ON "companies";
-- ALTER TABLE "leads" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "leads_tenant_isolation" ON "leads";
-- ALTER TABLE "pipelines" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "pipelines_tenant_isolation" ON "pipelines";
-- ALTER TABLE "pipeline_stages" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "pipeline_stages_tenant_isolation" ON "pipeline_stages";
-- ALTER TABLE "tasks" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "tasks_tenant_isolation" ON "tasks";
-- ALTER TABLE "products" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "products_tenant_isolation" ON "products";
-- ALTER TABLE "services" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "services_tenant_isolation" ON "services";
-- ALTER TABLE "whatsapp_accounts" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "whatsapp_accounts_tenant_isolation" ON "whatsapp_accounts";
-- ALTER TABLE "conversations" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "conversations_tenant_isolation" ON "conversations";
-- ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "messages_tenant_isolation" ON "messages";
-- ALTER TABLE "ai_configs" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "ai_configs_tenant_isolation" ON "ai_configs";
-- ALTER TABLE "ai_messages" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "ai_messages_tenant_isolation" ON "ai_messages";
-- ALTER TABLE "company_knowledge" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "company_knowledge_tenant_isolation" ON "company_knowledge";
-- ALTER TABLE "followups" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "followups_tenant_isolation" ON "followups";
-- ALTER TABLE "appointments" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "appointments_tenant_isolation" ON "appointments";
-- ALTER TABLE "automations" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "automations_tenant_isolation" ON "automations";
-- ALTER TABLE "access_tickets" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "access_tickets_tenant_isolation" ON "access_tickets";
-- ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "notifications_tenant_isolation" ON "notifications";
-- ALTER TABLE "refresh_tokens" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "refresh_tokens_tenant_isolation" ON "refresh_tokens";
-- ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON "audit_logs";
-- ALTER TABLE "applications" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "applications_tenant_isolation" ON "applications";
-- ALTER TABLE "api_keys" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "api_keys_tenant_isolation" ON "api_keys";
-- ALTER TABLE "auth_tokens" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "auth_tokens_tenant_isolation" ON "auth_tokens";
-- ALTER TABLE "webhook_endpoints" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "webhook_endpoints_tenant_isolation" ON "webhook_endpoints";
-- ALTER TABLE "webhook_deliveries" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "webhook_deliveries_tenant_isolation" ON "webhook_deliveries";
-- ALTER TABLE "application_audit_logs" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "application_audit_logs_tenant_isolation" ON "application_audit_logs";
-- COMMIT;

-- =====================================================
-- ENFORCEMENT — pra forçar RLS (após validar que nada quebra)
-- =====================================================
-- psql -c "ALTER ROLE kairos_crm NOBYPASSRLS;"   <- força RLS
-- psql -c "ALTER ROLE kairos_crm BYPASSRLS;"     <- volta a bypass
