-- Fase 9: add secretEncrypted to webhook_endpoints (assinar outbound)
-- Aplicar com: psql $DATABASE_URL -f manual.sql (dentro de transacao)

ALTER TABLE "webhook_endpoints" ADD COLUMN "secretEncrypted" TEXT;
