-- ===========================================================================
--  Cockpit host diagnostic capture audit (plan B.5.4 / B.5.5)
--
--  Every started, skipped, or failed D1/D2/D3 attempt is auditable. Heap dumps
--  are marked sensitive and retain the actor plus explicit opt-in approval.
-- ===========================================================================

CREATE TABLE "verdict_diagnostic_capture" (
    "id" TEXT NOT NULL,
    "capture_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "operation" TEXT,
    "span_id" TEXT,
    "pid" INTEGER,
    "marker_pre_mono_ts" TEXT,
    "marker_post_mono_ts" TEXT,
    "artifact_ref" TEXT,
    "mapping_file_ref" TEXT,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "skipped_reason" TEXT,
    "error_message" TEXT,
    "build_profile" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "opt_in_approved_by" TEXT,
    "opt_in_approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "verdict_diagnostic_capture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verdict_diagnostic_capture_capture_id_key"
  ON "verdict_diagnostic_capture"("capture_id");

CREATE INDEX "verdict_diagnostic_capture_context_idx"
  ON "verdict_diagnostic_capture"("run_id", "screen", "operation", "span_id");

CREATE INDEX "verdict_diagnostic_capture_run_created_idx"
  ON "verdict_diagnostic_capture"("run_id", "created_at");

CREATE INDEX "verdict_diagnostic_capture_sensitive_idx"
  ON "verdict_diagnostic_capture"("sensitive", "created_at");

ALTER TABLE "verdict_diagnostic_capture"
  ADD CONSTRAINT "verdict_diagnostic_capture_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "verdict_diagnostic_capture"
  ADD CONSTRAINT "verdict_diagnostic_capture_level_check"
  CHECK ("level" IN ('D1_MEMINFO', 'D2_PERFETTO', 'D3_HEAPDUMP'));

ALTER TABLE "verdict_diagnostic_capture"
  ADD CONSTRAINT "verdict_diagnostic_capture_status_check"
  CHECK ("status" IN ('captured', 'skipped', 'failed'));

ALTER TABLE "verdict_diagnostic_capture"
  ADD CONSTRAINT "verdict_diagnostic_capture_skipped_reason_check"
  CHECK (
    "skipped_reason" IS NULL OR
    "skipped_reason" IN (
      'cooldown',
      'quota',
      'critical_span',
      'low_disk',
      'not_profileable',
      'api_too_low',
      'opt_in_missing'
    )
  );

ALTER TABLE "verdict_diagnostic_capture"
  ADD CONSTRAINT "verdict_diagnostic_capture_heap_sensitive_check"
  CHECK ("level" <> 'D3_HEAPDUMP' OR "sensitive" = true);
