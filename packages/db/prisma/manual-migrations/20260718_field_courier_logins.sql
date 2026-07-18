-- aras_db: Field Courier Login history
-- Çalıştırma:
--   pnpm --filter @nesy/db exec prisma db execute --file prisma/manual-migrations/20260718_field_courier_logins.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "field_courier_logins" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "courierUserId" TEXT,
    "courierUsername" TEXT,
    "courierFullName" TEXT,
    "hubId" TEXT,
    "hubName" TEXT,
    "waybillNumber" TEXT,
    "legacyBarcode" TEXT,
    "barcode" TEXT,
    "deviceCode" TEXT,
    "adbDeviceId" TEXT,
    "adminUserId" TEXT,
    "adminUsername" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "failedStep" TEXT,
    "maestroRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_courier_logins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "field_courier_logins_country_environment_createdAt_idx"
  ON "field_courier_logins"("country", "environment", "createdAt");
CREATE INDEX IF NOT EXISTS "field_courier_logins_status_idx" ON "field_courier_logins"("status");
CREATE INDEX IF NOT EXISTS "field_courier_logins_courierUsername_idx" ON "field_courier_logins"("courierUsername");
