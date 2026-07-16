-- aras_db: Workflow automation tables (manuel migration)
-- Çalıştırma:
--   pnpm exec prisma db execute --file prisma/manual-migrations/20260518_workflow_tables.sql
-- veya:
--   psql -h 46.225.55.110 -p 5432 -U yaptir_admin -d aras_db -f packages/db/prisma/manual-migrations/20260518_workflow_tables.sql

-- 1. workflows
CREATE TABLE IF NOT EXISTS "workflows" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "category" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'Workflow',
    "iconClassName" TEXT NOT NULL DEFAULT '',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflows_slug_key" ON "workflows"("slug");
CREATE INDEX IF NOT EXISTS "workflows_status_idx" ON "workflows"("status");
CREATE INDEX IF NOT EXISTS "workflows_slug_idx" ON "workflows"("slug");

-- 2. workflow_versions
CREATE TABLE IF NOT EXISTS "workflow_versions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "config" JSONB,
    "yamlPath" TEXT,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_versions_workflowId_version_key" ON "workflow_versions"("workflowId", "version");
CREATE INDEX IF NOT EXISTS "workflow_versions_workflowId_idx" ON "workflow_versions"("workflowId");

ALTER TABLE "workflow_versions"
    DROP CONSTRAINT IF EXISTS "workflow_versions_workflowId_fkey";
ALTER TABLE "workflow_versions"
    ADD CONSTRAINT "workflow_versions_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. workflow_runs
CREATE TABLE IF NOT EXISTS "workflow_runs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mode" TEXT NOT NULL DEFAULT 'full',
    "targetStepId" TEXT,
    "deviceId" TEXT,
    "country" TEXT,
    "environment" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "screenshotDir" TEXT,
    "maestroOutput" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workflow_runs_workflowId_createdAt_idx" ON "workflow_runs"("workflowId", "createdAt");
CREATE INDEX IF NOT EXISTS "workflow_runs_status_idx" ON "workflow_runs"("status");

ALTER TABLE "workflow_runs"
    DROP CONSTRAINT IF EXISTS "workflow_runs_workflowId_fkey";
ALTER TABLE "workflow_runs"
    ADD CONSTRAINT "workflow_runs_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_runs"
    DROP CONSTRAINT IF EXISTS "workflow_runs_versionId_fkey";
ALTER TABLE "workflow_runs"
    ADD CONSTRAINT "workflow_runs_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "workflow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. workflow_step_results
CREATE TABLE IF NOT EXISTS "workflow_step_results" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "nodeTitle" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "output" TEXT,
    "errorMessage" TEXT,
    "screenshotPath" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "workflow_step_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workflow_step_results_runId_order_idx" ON "workflow_step_results"("runId", "order");

ALTER TABLE "workflow_step_results"
    DROP CONSTRAINT IF EXISTS "workflow_step_results_runId_fkey";
ALTER TABLE "workflow_step_results"
    ADD CONSTRAINT "workflow_step_results_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
