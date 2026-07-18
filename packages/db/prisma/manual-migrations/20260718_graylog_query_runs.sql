-- aras_db: Graylog Query Generator history
-- Çalıştırma:
--   pnpm --filter @nesy/db exec prisma db execute --file prisma/manual-migrations/20260718_graylog_query_runs.sql --schema prisma/schema.prisma
-- veya:
--   psql -h <host> -p 5432 -U <user> -d aras_db -f packages/db/prisma/manual-migrations/20260718_graylog_query_runs.sql

CREATE TABLE IF NOT EXISTS "graylog_query_runs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "naturalLanguage" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "country" TEXT,
    "application" TEXT NOT NULL,
    "service" TEXT,
    "logLevel" TEXT,
    "timeRange" TEXT NOT NULL,
    "device" TEXT,
    "appVersion" TEXT,
    "identifiers" JSONB,
    "sources" JSONB,
    "status" TEXT NOT NULL,
    "explanation" JSONB NOT NULL,
    "validation" JSONB NOT NULL,
    "quality" JSONB,
    "expectedSignals" JSONB,
    "summary" TEXT,
    "model" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "relatedIncident" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graylog_query_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "graylog_query_runs_lastUsedAt_idx" ON "graylog_query_runs"("lastUsedAt");
CREATE INDEX IF NOT EXISTS "graylog_query_runs_environment_idx" ON "graylog_query_runs"("environment");
CREATE INDEX IF NOT EXISTS "graylog_query_runs_country_idx" ON "graylog_query_runs"("country");
