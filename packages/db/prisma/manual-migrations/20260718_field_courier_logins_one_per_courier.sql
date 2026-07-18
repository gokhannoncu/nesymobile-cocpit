-- aras_db: Field Courier Login — one row per courier (country + environment + courierUserId)
-- Çalıştırma:
--   pnpm --filter @nesy/db exec prisma db execute --file prisma/manual-migrations/20260718_field_courier_logins_one_per_courier.sql --schema prisma/schema.prisma

-- Drop older duplicates (keep newest createdAt per courier key)
DELETE FROM "field_courier_logins" a
USING "field_courier_logins" b
WHERE a."courierUserId" IS NOT NULL
  AND b."courierUserId" IS NOT NULL
  AND a."courierUserId" = b."courierUserId"
  AND a."country" = b."country"
  AND a."environment" = b."environment"
  AND (
    a."createdAt" < b."createdAt"
    OR (a."createdAt" = b."createdAt" AND a."id" < b."id")
  );

ALTER TABLE "field_courier_logins"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "field_courier_logins"
SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "field_courier_logins"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "field_courier_logins"
  ALTER COLUMN "updatedAt" SET NOT NULL;

DROP INDEX IF EXISTS "field_courier_logins_country_environment_createdAt_idx";

CREATE INDEX IF NOT EXISTS "field_courier_logins_country_environment_updatedAt_idx"
  ON "field_courier_logins"("country", "environment", "updatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "field_courier_logins_country_environment_courierUserId_key"
  ON "field_courier_logins"("country", "environment", "courierUserId");
