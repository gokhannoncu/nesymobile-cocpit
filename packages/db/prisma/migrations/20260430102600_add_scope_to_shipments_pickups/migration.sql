-- AlterTable
ALTER TABLE "Shipment"
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "environment" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Pickup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickupType" TEXT NOT NULL DEFAULT 'remote',
    "shipmentId" TEXT NOT NULL,
    "assignStatus" TEXT NOT NULL DEFAULT 'Pending',
    "taskId" TEXT,
    "branchId" TEXT,
    "courierZoneCode" TEXT,
    "country" TEXT,
    "environment" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "Pickup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Pickup"
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "environment" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shipment_country_environment_createdAt_idx"
  ON "Shipment"("country", "environment", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Pickup_country_environment_createdAt_idx"
  ON "Pickup"("country", "environment", "createdAt");
