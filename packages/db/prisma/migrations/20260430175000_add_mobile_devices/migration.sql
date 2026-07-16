-- CreateTable
CREATE TABLE IF NOT EXISTS "mobile_devices" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "adbDeviceId" TEXT,
    "modelName" TEXT NOT NULL,
    "product" TEXT,
    "transportId" TEXT,
    "label" TEXT,
    "country" TEXT,
    "environment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "mobile_devices_deviceId_key" ON "mobile_devices"("deviceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mobile_devices_modelName_idx" ON "mobile_devices"("modelName");
