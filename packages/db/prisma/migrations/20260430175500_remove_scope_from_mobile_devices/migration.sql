-- AlterTable
ALTER TABLE "mobile_devices"
  DROP COLUMN IF EXISTS "country",
  DROP COLUMN IF EXISTS "environment";
