-- G90.2b: durable, canonical pre-action readiness trace per BridgeFlow run.
ALTER TABLE "bridgeflow_run_runtime"
  ADD COLUMN "readiness_status" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "readiness_class" TEXT,
  ADD COLUMN "readiness_trace" JSONB;

ALTER TABLE "bridgeflow_run_runtime"
  ADD CONSTRAINT "bridgeflow_run_runtime_readiness_status_check"
  CHECK ("readiness_status" IN (
    'NOT_REQUIRED',
    'PENDING',
    'INTERACTION_READY',
    'INTERACTION_NOT_READY',
    'NOT_EVALUATED'
  ));

ALTER TABLE "bridgeflow_run_runtime"
  ADD CONSTRAINT "bridgeflow_run_runtime_readiness_class_check"
  CHECK (
    "readiness_class" IS NULL OR "readiness_class" IN (
      'FORCE_STOP_NOT_CONFIRMED',
      'PROCESS_NOT_STARTED',
      'COLD_START_OS_SUSPEND',
      'APP_NOT_READY',
      'A11Y_SYNC_PENDING',
      'UI_NOT_ACTIONABLE',
      'SDK_NOT_READY',
      'UNCLASSIFIED'
    )
  );
