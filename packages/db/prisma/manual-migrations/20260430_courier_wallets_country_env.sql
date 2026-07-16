-- courier_wallets: country + environment kolonu ekleme ve unique index güncelleme
-- Çalıştırma:
--   psql -h HOST -p 5432 -U USER -d aras_db -f packages/db/prisma/manual-migrations/20260430_courier_wallets_country_env.sql
-- veya: pnpm exec prisma db execute --file prisma/manual-migrations/20260430_courier_wallets_country_env.sql  (cwd: packages/db)

-- 1. Yeni kolonları ekle (varsa atla)
ALTER TABLE "courier_wallets" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'HR';
ALTER TABLE "courier_wallets" ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'stage';

-- 2. Mevcut kayıtları HR/stage olarak backfill
UPDATE "courier_wallets" SET "country" = 'HR', "environment" = 'stage' WHERE "country" = 'HR' AND "environment" = 'stage';

-- 3. Eski unique index'i kaldır, yenisini oluştur
DROP INDEX IF EXISTS "courier_wallets_username_hubId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "courier_wallets_username_hubId_country_environment_key"
  ON "courier_wallets"("username", "hubId", "country", "environment");
