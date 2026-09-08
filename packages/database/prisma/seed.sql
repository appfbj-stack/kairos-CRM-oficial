-- =====================================================================
-- Kairos CRM — Seed SQL (idempotente)
-- Senha padrão de todos os usuários: Troque@Senha123
-- Hash bcrypt (12 rounds): $2a$12$dIDS.cTdZPauNfhkyUOnYO/DuLmTJ/uC4HCMgFjV95wm1.2Jw1Q7y
-- =====================================================================

-- Super Admin
INSERT INTO users (id, "tenantId", email, "passwordHash", name, role, status, "createdAt", "updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'admin@kairoscrm.com',
  '$2a$12$dIDS.cTdZPauNfhkyUOnYO/DuLmTJ/uC4HCMgFjV95wm1.2Jw1Q7y',
  'Super Admin Kairos',
  'SUPER_ADMIN',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Tenant Demo
INSERT INTO tenants (id, name, slug, email, phone, "primaryColor", plan, status, "createdAt", "updatedAt")
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Empresa Demonstração',
  'demo',
  'contato@demo.com',
  '11999990000',
  '#10b981',
  'PRO',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, "tenantId", email, "passwordHash", name, role, status, "createdAt", "updatedAt")
VALUES (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111111',
  'admin@demo.com',
  '$2a$12$dIDS.cTdZPauNfhkyUOnYO/DuLmTJ/uC4HCMgFjV95wm1.2Jw1Q7y',
  'Admin Demo',
  'TENANT_ADMIN',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Tenant A (Salão) — para teste de isolamento
INSERT INTO tenants (id, name, slug, email, "primaryColor", plan, status, "createdAt", "updatedAt")
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Salão Beleza Pura',
  'salao-beleza',
  'contato@salao.com',
  '#ec4899',
  'BASIC',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, "tenantId", email, "passwordHash", name, role, status, "createdAt", "updatedAt")
VALUES (
  '22222222-2222-2222-2222-222222222201',
  '22222222-2222-2222-2222-222222222222',
  'admin@salao.com',
  '$2a$12$dIDS.cTdZPauNfhkyUOnYO/DuLmTJ/uC4HCMgFjV95wm1.2Jw1Q7y',
  'Admin Salão',
  'TENANT_ADMIN',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Tenant B (Energia Solar) — para teste de isolamento
INSERT INTO tenants (id, name, slug, email, "primaryColor", plan, status, "createdAt", "updatedAt")
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Solar Energia Pro',
  'solar-energia',
  'contato@solar.com',
  '#f59e0b',
  'BASIC',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, "tenantId", email, "passwordHash", name, role, status, "createdAt", "updatedAt")
VALUES (
  '33333333-3333-3333-3333-333333333301',
  '33333333-3333-3333-3333-333333333333',
  'admin@solar.com',
  '$2a$12$dIDS.cTdZPauNfhkyUOnYO/DuLmTJ/uC4HCMgFjV95wm1.2Jw1Q7y',
  'Admin Solar',
  'TENANT_ADMIN',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- AIConfig padrão para cada tenant
INSERT INTO ai_configs (id, "tenantId", provider, model, "assistantName", personality, objectives, "transferToHumanOn", temperature, enabled, "autoReply", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  'OPENAI',
  'gpt-4o-mini',
  'Kairos IA',
  'Amigável e profissional',
  ARRAY['Atender clientes','Passar preços','Qualificar leads']::text[],
  ARRAY['reclamação','pagamento']::text[],
  0.7,
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO ai_configs (id, "tenantId", provider, model, "assistantName", personality, objectives, "transferToHumanOn", temperature, enabled, "autoReply", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222222',
  'OPENAI',
  'gpt-4o-mini',
  'Kairos IA',
  'Acolhedor e gentil',
  ARRAY['Agendar horários','Mostrar serviços','Cadastrar clientes']::text[],
  ARRAY['reclamação']::text[],
  0.8,
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO ai_configs (id, "tenantId", provider, model, "assistantName", personality, objectives, "transferToHumanOn", temperature, enabled, "autoReply", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '33333333-3333-3333-3333-333333333333',
  'OPENAI',
  'gpt-4o-mini',
  'Kairos IA',
  'Técnico e consultivo',
  ARRAY['Qualificar leads','Enviar orçamentos','Agendar visitas técnicas']::text[],
  ARRAY['proposta comercial']::text[],
  0.6,
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("tenantId") DO NOTHING;
