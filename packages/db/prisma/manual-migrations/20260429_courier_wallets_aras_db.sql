-- aras_db: Courier wallets (manuel migration — nesy-dashboard User Operations ile senkron)
-- Çalıştırma örneği (repo kökünden):
--   set PGPASSWORD=... ; psql -h HOST -p 5432 -U USER -d aras_db -f packages/db/prisma/manual-migrations/20260429_courier_wallets_aras_db.sql
-- veya: pnpm exec prisma db execute --file prisma/manual-migrations/20260429_courier_wallets_aras_db.sql  (cwd: packages/db, DATABASE_URL yüklü)

CREATE TABLE IF NOT EXISTS "courier_wallets" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "hubName" TEXT NOT NULL,
    "hubId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "courier_wallets_username_hubId_key" ON "courier_wallets"("username", "hubId");
