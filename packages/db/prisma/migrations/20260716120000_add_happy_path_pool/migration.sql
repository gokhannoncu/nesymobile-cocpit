-- CreateTable
CREATE TABLE "happy_path_pools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "shipmentCount" INTEGER NOT NULL DEFAULT 0,
    "assignmentMode" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "happy_path_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "happy_path_pool_entries" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "shipmentId" TEXT,
    "pickupId" TEXT,
    "unloadStatus" TEXT,
    "error" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "happy_path_pool_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "happy_path_pools_country_environment_createdAt_idx" ON "happy_path_pools"("country", "environment", "createdAt");

-- CreateIndex
CREATE INDEX "happy_path_pool_entries_poolId_idx" ON "happy_path_pool_entries"("poolId");

-- CreateIndex
CREATE INDEX "happy_path_pool_entries_shipmentId_idx" ON "happy_path_pool_entries"("shipmentId");

-- CreateIndex
CREATE INDEX "happy_path_pool_entries_pickupId_idx" ON "happy_path_pool_entries"("pickupId");

-- AddForeignKey
ALTER TABLE "happy_path_pool_entries" ADD CONSTRAINT "happy_path_pool_entries_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "happy_path_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
