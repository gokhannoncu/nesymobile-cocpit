-- ===========================================================================
--  Durable run-start idempotency and interaction cursor.
--
--  WorkflowRunService and DurableInteractionSubscription kept these in memory,
--  so a retried run start queued a second execution after any API restart and
--  the Run Detail live cursor reset to zero.
--
--  `verdict_run_start` is intentionally separate from `bridgeflow_run_runtime`:
--  that table is keyed to an existing `workflow_runs` row by foreign key, but a
--  run start is accepted before such a row exists.
--
--  Both tables are new; nothing existing is altered.
-- ===========================================================================

CREATE TABLE "verdict_run_start" (
  "id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "execution_id" TEXT NOT NULL,
  "workflow_ref" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "compiled_plan_ref" TEXT NOT NULL,
  "compiled_plan_hash" TEXT NOT NULL,
  "domain_pack_key" TEXT NOT NULL,
  "domain_pack_version" TEXT NOT NULL,
  "domain_pack_digest" TEXT NOT NULL,
  "release_gate" BOOLEAN NOT NULL DEFAULT false,
  "profile_key" TEXT,
  "profile_version" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "engine_type" TEXT NOT NULL DEFAULT 'BRIDGEFLOW',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verdict_run_start_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verdict_run_start_idempotency_key"
  ON "verdict_run_start"("idempotency_key");

CREATE UNIQUE INDEX "verdict_run_start_run_id_key"
  ON "verdict_run_start"("run_id");

CREATE INDEX "verdict_run_start_workflow_device_idx"
  ON "verdict_run_start"("workflow_ref", "device_id");

CREATE TABLE "verdict_run_interaction" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "origin" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL,
  "occurred_at_ms" BIGINT NOT NULL,
  "summary" TEXT NOT NULL,
  "secret_redacted" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verdict_run_interaction_pkey" PRIMARY KEY ("id")
);

-- The revision uniqueness is what makes the cursor safe: two concurrent appends
-- cannot both claim the same revision for one run.
CREATE UNIQUE INDEX "verdict_run_interaction_revision_key"
  ON "verdict_run_interaction"("run_id", "revision");

CREATE UNIQUE INDEX "verdict_run_interaction_event_key"
  ON "verdict_run_interaction"("run_id", "event_id");

CREATE INDEX "verdict_run_interaction_cursor_idx"
  ON "verdict_run_interaction"("run_id", "revision");
