-- G90.9: injectedFault (input) and observedClass (output) are separate axes.
-- Existing D30 rows stay NULL / uninjected.

ALTER TABLE "bridgeflow_run_runtime"
  ADD COLUMN "injected_fault" TEXT,
  ADD COLUMN "expected_class" TEXT,
  ADD COLUMN "observed_class" TEXT,
  ADD COLUMN "injected_fault_host" TEXT,
  ADD COLUMN "death_provenance" TEXT;

ALTER TABLE "bridgeflow_run_runtime"
  ADD CONSTRAINT "bridgeflow_run_runtime_injected_fault_check"
  CHECK (
    "injected_fault" IS NULL OR "injected_fault" IN (
      'PROCESS_KILL',
      'NETWORK_DISCONNECT',
      'BACKEND_TIMEOUT',
      'DIALOG_OVERLAY',
      'DUPLICATE_CALLBACK',
      'OFFLINE_QUEUE'
    )
  );

ALTER TABLE "bridgeflow_run_runtime"
  ADD CONSTRAINT "bridgeflow_run_runtime_expected_class_check"
  CHECK (
    "expected_class" IS NULL OR "expected_class" IN (
      'PROCESS_DEATH',
      'NETWORK_PARTITION',
      'BACKEND_TIMEOUT',
      'DIALOG_INTERRUPT',
      'DUPLICATE_SUPPRESSED',
      'OFFLINE_QUEUED'
    )
  );

ALTER TABLE "bridgeflow_run_runtime"
  ADD CONSTRAINT "bridgeflow_run_runtime_observed_class_check"
  CHECK (
    "observed_class" IS NULL OR "observed_class" IN (
      'PROCESS_DEATH',
      'NETWORK_PARTITION',
      'BACKEND_TIMEOUT',
      'DIALOG_INTERRUPT',
      'DUPLICATE_SUPPRESSED',
      'OFFLINE_QUEUED',
      'PRODUCT_PASS',
      'PRODUCT_FAIL',
      'ENV_FAILURE',
      'FORCE_STOP_NOT_CONFIRMED',
      'PROCESS_NOT_STARTED',
      'COLD_START_OS_SUSPEND',
      'APP_NOT_READY',
      'A11Y_SYNC_PENDING',
      'UI_NOT_ACTIONABLE',
      'SDK_NOT_READY',
      'AUTH_PENDING',
      'BACKEND_BOOTSTRAP_PENDING',
      'EVIDENCE_TIMEOUT',
      'TEST_DATA_CONTAMINATION',
      'UNCLASSIFIED'
    )
  );

ALTER TABLE "bridgeflow_run_runtime"
  ADD CONSTRAINT "bridgeflow_run_runtime_injected_fault_host_check"
  CHECK (
    "injected_fault_host" IS NULL OR "injected_fault_host" IN ('A', 'B')
  );

ALTER TABLE "bridgeflow_run_runtime"
  ADD CONSTRAINT "bridgeflow_run_runtime_death_provenance_check"
  CHECK (
    "death_provenance" IS NULL OR "death_provenance" IN (
      'PROCESS_DEATH_FORCE_STOP',
      'PROCESS_DEATH_KILL',
      'PROCESS_DEATH_OEM'
    )
  );

CREATE INDEX "bridgeflow_run_runtime_injected_fault_idx"
  ON "bridgeflow_run_runtime" ("injected_fault")
  WHERE "injected_fault" IS NOT NULL;

ALTER TABLE "verdict_run_start"
  ADD COLUMN "injected_fault" TEXT,
  ADD COLUMN "expected_class" TEXT,
  ADD COLUMN "injected_fault_host" TEXT;
