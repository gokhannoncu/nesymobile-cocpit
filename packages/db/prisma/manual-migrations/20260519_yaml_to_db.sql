-- YAML versiyonlamayi DB'ye tasima
-- Çalıştırma:
--   pnpm exec prisma db execute --file prisma/manual-migrations/20260519_yaml_to_db.sql
-- veya:
--   psql -h 46.225.55.110 -p 5432 -U yaptir_admin -d aras_db -f packages/db/prisma/manual-migrations/20260519_yaml_to_db.sql

-- 1. workflow_runs: yamlContent kolonu ekle (calistirilan YAML icerigini saklar)
ALTER TABLE "workflow_runs" ADD COLUMN IF NOT EXISTS "yamlContent" TEXT;

-- 2. workflow_versions: yamlPath kolonunu kaldir (artik dosya yolu tutmuyoruz)
ALTER TABLE "workflow_versions" DROP COLUMN IF EXISTS "yamlPath";
