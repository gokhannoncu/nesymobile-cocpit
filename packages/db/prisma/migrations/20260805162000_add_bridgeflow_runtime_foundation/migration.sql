-- Phase 5 BridgeFlow runtime foundation.
-- Additive only: legacy workflow_runs, yamlContent and maestroOutput remain intact.

CREATE TABLE "bridgeflow_run_runtime" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "engine_type" TEXT NOT NULL DEFAULT 'BRIDGEFLOW',
  "compiled_plan_ref" TEXT,
  "compiled_plan_hash" TEXT,
  "domain_pack_key" TEXT,
  "domain_pack_version" TEXT,
  "domain_pack_digest" TEXT,
  "workflow_ir_schema_version" INTEGER,
  "compiler_version" TEXT,
  "bridge_protocol_version" TEXT,
  "sdk_protocol_version" TEXT,
  "run_session_id" TEXT,
  "run_epoch_ms" BIGINT,
  "run_epoch_unit" TEXT NOT NULL DEFAULT 'MONOTONIC_MS',
  "profile_snapshot" JSONB,
  "campaign_id" TEXT,
  "build_ref" TEXT,
  "dataset_ref" TEXT,
  "device_cell" TEXT,
  "repetition_index" INTEGER,
  "fault_plan_ref" TEXT,
  "telemetry_policy_ref" TEXT,
  "release_gate" BOOLEAN NOT NULL DEFAULT false,
  "lifecycle" TEXT NOT NULL DEFAULT 'PENDING',
  "product_verdict" TEXT NOT NULL DEFAULT 'NOT_EVALUATED',
  "evaluation_failure_class" TEXT NOT NULL DEFAULT 'NONE',
  "termination_reason" TEXT NOT NULL DEFAULT 'NOT_TERMINATED',
  "cleanup_result" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "resource_release_result" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "scheduler_disposition" TEXT NOT NULL DEFAULT 'NOT_SCHEDULED',
  "operational_disposition" TEXT NOT NULL DEFAULT 'OK',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "bridgeflow_run_runtime_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridgeflow_run_runtime_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "bridgeflow_run_runtime_run_id_key" ON "bridgeflow_run_runtime"("run_id");
CREATE INDEX "bridgeflow_run_runtime_engine_created_idx" ON "bridgeflow_run_runtime"("engine_type", "created_at");
CREATE INDEX "bridgeflow_run_runtime_state_idx" ON "bridgeflow_run_runtime"("lifecycle", "scheduler_disposition");

CREATE TABLE "bridgeflow_step_occurrence" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "occurrence_id" TEXT NOT NULL,
  "plan_step_id" TEXT NOT NULL,
  "source_map_ref" TEXT,
  "occurrence_index" INTEGER NOT NULL,
  "iteration_key" TEXT NOT NULL DEFAULT 'root',
  "entity_ref" JSONB,
  "request_id" TEXT,
  "lifecycle" TEXT NOT NULL DEFAULT 'PENDING',
  "action_result" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "continue_gate_result" TEXT NOT NULL DEFAULT 'NOT_EVALUATED',
  "final_oracle_result" TEXT NOT NULL DEFAULT 'NOT_EVALUATED',
  "cleanup_result" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "metadata" JSONB,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "bridgeflow_step_occurrence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridgeflow_step_occurrence_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "bridgeflow_step_occurrence_run_occurrence_key" ON "bridgeflow_step_occurrence"("run_id", "occurrence_id");
CREATE INDEX "bridgeflow_step_occurrence_step_idx" ON "bridgeflow_step_occurrence"("run_id", "plan_step_id", "occurrence_index");
CREATE INDEX "bridgeflow_step_occurrence_iteration_idx" ON "bridgeflow_step_occurrence"("run_id", "iteration_key");

CREATE TABLE "bridgeflow_action_transition" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "occurrence_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "at_ms" BIGINT NOT NULL,
  "evidence_ref" TEXT,
  "terminal" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bridgeflow_action_transition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridgeflow_action_transition_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "bridgeflow_action_transition_phase_key" ON "bridgeflow_action_transition"("run_id", "occurrence_id", "request_id", "phase");
CREATE INDEX "bridgeflow_action_transition_request_idx" ON "bridgeflow_action_transition"("run_id", "occurrence_id", "request_id", "at_ms");

CREATE TABLE "bridgeflow_wait_event" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "occurrence_id" TEXT NOT NULL,
  "wait_plan_id" TEXT,
  "request_id" TEXT,
  "status" TEXT NOT NULL,
  "result_key" TEXT,
  "cancel_status" TEXT,
  "terminal_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "bridgeflow_wait_event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridgeflow_wait_event_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "bridgeflow_wait_event_one_terminal_key" ON "bridgeflow_wait_event"("run_id", "occurrence_id", "wait_plan_id");
CREATE INDEX "bridgeflow_wait_event_status_idx" ON "bridgeflow_wait_event"("run_id", "status");

CREATE TABLE "bridgeflow_evidence_fact" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "occurrence_id" TEXT NOT NULL,
  "iteration_key" TEXT NOT NULL DEFAULT 'root',
  "fact_key" TEXT NOT NULL,
  "plane" TEXT NOT NULL,
  "source_subtype" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "authority" TEXT NOT NULL,
  "delivery_lane" TEXT NOT NULL,
  "raw_event_ref" TEXT,
  "reducer_trace" JSONB,
  "freshness_max_age_ms" INTEGER,
  "correlation_status" TEXT NOT NULL DEFAULT 'PENDING',
  "journey_stage" TEXT NOT NULL DEFAULT 'INBOX',
  "journey_state" TEXT NOT NULL DEFAULT 'PENDING',
  "observed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bridgeflow_evidence_fact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridgeflow_evidence_fact_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "bridgeflow_evidence_fact_correlation_idx" ON "bridgeflow_evidence_fact"("run_id", "occurrence_id", "iteration_key", "fact_key");
CREATE INDEX "bridgeflow_evidence_fact_source_idx" ON "bridgeflow_evidence_fact"("run_id", "plane", "source_subtype");

CREATE TABLE "bridgeflow_oracle_evaluation" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "occurrence_id" TEXT NOT NULL,
  "evaluator_kind" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "product_verdict" TEXT,
  "evaluation_failure_class" TEXT,
  "requirements" JSONB,
  "evidence_refs" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bridgeflow_oracle_evaluation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridgeflow_oracle_evaluation_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "bridgeflow_oracle_evaluation_occurrence_idx" ON "bridgeflow_oracle_evaluation"("run_id", "occurrence_id", "evaluator_kind");

CREATE TABLE "verdict_test_execution" (
  "id" TEXT NOT NULL,
  "execution_id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "lifecycle" TEXT NOT NULL DEFAULT 'PENDING',
  "product_verdict" TEXT NOT NULL DEFAULT 'NOT_EVALUATED',
  "scheduler_disposition" TEXT NOT NULL DEFAULT 'NOT_SCHEDULED',
  "disposition" TEXT NOT NULL DEFAULT 'BLOCKED',
  "recovery_state" TEXT,
  "manifest" JSONB,
  "heartbeat_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "verdict_test_execution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verdict_test_execution_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "verdict_test_execution_execution_id_key" ON "verdict_test_execution"("execution_id");
CREATE INDEX "verdict_test_execution_state_idx" ON "verdict_test_execution"("lifecycle", "scheduler_disposition");

CREATE TABLE "verdict_resource_lease" (
  "id" TEXT NOT NULL,
  "lease_id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "conflict_group" TEXT NOT NULL,
  "exclusive" BOOLEAN NOT NULL DEFAULT true,
  "state" TEXT NOT NULL DEFAULT 'DIRTY',
  "reconciliation_reason" TEXT,
  "leased_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_at" TIMESTAMPTZ(6),
  CONSTRAINT "verdict_resource_lease_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verdict_resource_lease_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "verdict_resource_lease_lease_id_key" ON "verdict_resource_lease"("lease_id");
CREATE INDEX "verdict_resource_lease_conflict_idx" ON "verdict_resource_lease"("conflict_group", "state");
CREATE INDEX "verdict_resource_lease_run_state_idx" ON "verdict_resource_lease"("run_id", "state");

CREATE TABLE "verdict_remote_action_attempt" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "occurrence_id" TEXT NOT NULL,
  "operation_ref" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "effect_class" TEXT NOT NULL,
  "timeout_ms" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "resource_lease_id" TEXT,
  "request_payload" JSONB,
  "response_payload" JSONB,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "verdict_remote_action_attempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verdict_remote_action_attempt_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "verdict_remote_action_idempotency_key" ON "verdict_remote_action_attempt"("run_id", "occurrence_id", "operation_ref", "idempotency_key");
CREATE INDEX "verdict_remote_action_status_idx" ON "verdict_remote_action_attempt"("run_id", "status");
