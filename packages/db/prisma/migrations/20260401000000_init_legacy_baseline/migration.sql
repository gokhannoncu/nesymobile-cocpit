-- ===========================================================================
--  Legacy baseline tables required before later additive migrations
--
--  Why this migration exists:
--  Earlier environments were created with `prisma db push`, then later changes
--  were committed as migrations. A fresh database running `prisma migrate deploy`
--  therefore failed when a later migration tried to alter/reference tables such
--  as `workflow_runs` before any migration had created them.
--
--  This migration is intentionally FIRST and intentionally LIMITED. It creates
--  only the tables that were already part of the Prisma schema but absent from
--  the committed migration history. It does not create tables already created by
--  later migrations, so those migrations can still run unchanged.
--
--  Existing shared/non-disposable databases that already contain these tables
--  must NOT blindly apply this migration. They should first be inspected and,
--  if they match this baseline, marked with `prisma migrate resolve --applied`
--  as an explicit operational decision.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  Workflow Automation Models
-- ---------------------------------------------------------------------------

CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "category" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'Workflow',
    "iconClassName" TEXT NOT NULL DEFAULT '',
    "currentVersionId" TEXT,
    "draftNodes" JSONB,
    "draftEdges" JSONB,
    "draftConfig" JSONB,
    "draftBaseVersionId" TEXT,
    "draftUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_versions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "config" JSONB,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mode" TEXT NOT NULL DEFAULT 'full',
    "targetStepId" TEXT,
    "deviceId" TEXT,
    "country" TEXT,
    "environment" TEXT,
    "runInput" JSONB,
    "yamlContent" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "screenshotDir" TEXT,
    "maestroOutput" TEXT,
    "spans" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_step_results" (
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

CREATE UNIQUE INDEX "workflows_slug_key" ON "workflows"("slug");
CREATE INDEX "workflows_status_idx" ON "workflows"("status");
CREATE INDEX "workflows_slug_idx" ON "workflows"("slug");
CREATE UNIQUE INDEX "workflow_versions_workflowId_version_key"
  ON "workflow_versions"("workflowId", "version");
CREATE INDEX "workflow_versions_workflowId_idx" ON "workflow_versions"("workflowId");
CREATE INDEX "workflow_runs_workflowId_createdAt_idx"
  ON "workflow_runs"("workflowId", "createdAt");
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");
CREATE INDEX "workflow_step_results_runId_order_idx"
  ON "workflow_step_results"("runId", "order");

ALTER TABLE "workflow_versions"
  ADD CONSTRAINT "workflow_versions_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "workflows"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "workflows"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "workflow_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_step_results"
  ADD CONSTRAINT "workflow_step_results_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "workflow_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
--  Data Center / Auth / Engineering history tables that existed in schema but
--  not in migration history.
-- ---------------------------------------------------------------------------

CREATE TABLE "courier_wallets" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "hubName" TEXT NOT NULL,
    "hubId" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'HR',
    "environment" TEXT NOT NULL DEFAULT 'stage',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "courier_wallets_username_hubId_country_environment_key"
  ON "courier_wallets"("username", "hubId", "country", "environment");

CREATE TABLE "field_courier_logins" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_courier_logins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "field_courier_logins_country_environment_courierUserId_key"
  ON "field_courier_logins"("country", "environment", "courierUserId");
CREATE INDEX "field_courier_logins_country_environment_updatedAt_idx"
  ON "field_courier_logins"("country", "environment", "updatedAt");
CREATE INDEX "field_courier_logins_status_idx" ON "field_courier_logins"("status");
CREATE INDEX "field_courier_logins_courierUsername_idx"
  ON "field_courier_logins"("courierUsername");

CREATE TABLE "mongo_query_runs" (
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

CREATE INDEX "mongo_query_runs_lastUsedAt_idx" ON "mongo_query_runs"("lastUsedAt");
CREATE INDEX "mongo_query_runs_collection_idx" ON "mongo_query_runs"("collection");
CREATE INDEX "mongo_query_runs_environment_idx" ON "mongo_query_runs"("environment");

CREATE TABLE "graylog_query_runs" (
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

CREATE INDEX "graylog_query_runs_lastUsedAt_idx" ON "graylog_query_runs"("lastUsedAt");
CREATE INDEX "graylog_query_runs_environment_idx" ON "graylog_query_runs"("environment");
CREATE INDEX "graylog_query_runs_country_idx" ON "graylog_query_runs"("country");
