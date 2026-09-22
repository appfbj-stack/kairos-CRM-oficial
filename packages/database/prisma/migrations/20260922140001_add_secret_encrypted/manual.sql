-- Fase 9: add secretEncrypted to api_keys (encryption at rest do secret HMAC)
-- Aplicar com: psql $DATABASE_URL -f manual.sql (dentro de transacao)

ALTER TABLE "api_keys" ADD COLUMN "secretEncrypted" TEXT;
