-- aras_db: Workflow autosave draft columns
-- Çalıştırma:
--   pnpm exec prisma db execute --file prisma/manual-migrations/20260520_workflow_drafts.sql
-- veya:
--   psql -h 46.225.55.110 -p 5432 -U yaptir_admin -d aras_db -f packages/db/prisma/manual-migrations/20260520_workflow_drafts.sql

ALTER TABLE "workflows"
    ADD COLUMN IF NOT EXISTS "draftNodes" JSONB,
    ADD COLUMN IF NOT EXISTS "draftEdges" JSONB,
    ADD COLUMN IF NOT EXISTS "draftConfig" JSONB,
    ADD COLUMN IF NOT EXISTS "draftBaseVersionId" TEXT,
    ADD COLUMN IF NOT EXISTS "draftUpdatedAt" TIMESTAMP(3);
