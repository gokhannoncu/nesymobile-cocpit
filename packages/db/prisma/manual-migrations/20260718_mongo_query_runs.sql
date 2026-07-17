-- aras_db: MongoDB Query Generator history
-- Çalıştırma:
--   pnpm --filter @nesy/db exec prisma db execute --file prisma/manual-migrations/20260718_mongo_query_runs.sql --schema prisma/schema.prisma
-- veya:
--   psql -h <host> -p 5432 -U <user> -d aras_db -f packages/db/prisma/manual-migrations/20260718_mongo_query_runs.sql

CREATE TABLE IF NOT EXISTS "mongo_query_runs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "naturalLanguage" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "queryType" TEXT NOT NULL,
    "country" TEXT,
    "status" TEXT NOT NULL,
    "explanation" JSONB NOT NULL,
    "validation" JSONB NOT NULL,
    "estimatedScope" JSONB,
    "safetyToggles" JSONB,
    "model" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "owner" TEXT,
    "relatedTicket" TEXT,
    "relatedIncident" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mongo_query_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mongo_query_runs_lastUsedAt_idx" ON "mongo_query_runs"("lastUsedAt");
CREATE INDEX IF NOT EXISTS "mongo_query_runs_collection_idx" ON "mongo_query_runs"("collection");
CREATE INDEX IF NOT EXISTS "mongo_query_runs_environment_idx" ON "mongo_query_runs"("environment");
