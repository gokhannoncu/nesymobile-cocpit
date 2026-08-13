-- Read-only Verdict control-plane telemetry sampled during Cockpit workflow runs.
CREATE TABLE "verdict_run_telemetry_snapshot" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "measurement_state" TEXT NOT NULL DEFAULT 'MEASURED',
    "source" TEXT NOT NULL DEFAULT 'VERDICT_CONTROL',

    CONSTRAINT "verdict_run_telemetry_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "verdict_run_telemetry_snapshot_run_time_idx"
  ON "verdict_run_telemetry_snapshot"("run_id", "captured_at");

CREATE INDEX "verdict_run_telemetry_snapshot_run_kind_time_idx"
  ON "verdict_run_telemetry_snapshot"("run_id", "kind", "captured_at");

ALTER TABLE "verdict_run_telemetry_snapshot"
  ADD CONSTRAINT "verdict_run_telemetry_snapshot_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "verdict_run_telemetry_snapshot"
  ADD CONSTRAINT "verdict_run_telemetry_snapshot_kind_check"
  CHECK ("kind" IN ('HEALTH', 'MEMORY'));

ALTER TABLE "verdict_run_telemetry_snapshot"
  ADD CONSTRAINT "verdict_run_telemetry_snapshot_measurement_state_check"
  CHECK ("measurement_state" IN ('MEASURED', 'PARTIAL'));
