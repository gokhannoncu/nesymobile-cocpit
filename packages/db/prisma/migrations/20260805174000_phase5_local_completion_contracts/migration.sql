-- Phase 5 local-completion contracts.
-- Additive only: no legacy Maestro table or column is removed or rewritten.

ALTER TABLE "bridgeflow_run_runtime"
  ADD COLUMN "recovery_lease_token" TEXT,
  ADD COLUMN "recovery_lease_epoch" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "recovery_lease_owner" TEXT,
  ADD COLUMN "recovery_lease_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "recovery_lease_renewed_at" TIMESTAMPTZ(6),
  ADD COLUMN "recovery_checkpoint_revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recovery_checkpoint" JSONB;

CREATE UNIQUE INDEX "bridgeflow_run_runtime_recovery_token_key"
  ON "bridgeflow_run_runtime"("recovery_lease_token");
CREATE INDEX "bridgeflow_run_runtime_recovery_lease_idx"
  ON "bridgeflow_run_runtime"("recovery_lease_expires_at", "recovery_lease_epoch");

ALTER TABLE "bridgeflow_evidence_fact"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "idempotency_key" TEXT;

UPDATE "bridgeflow_evidence_fact"
SET "idempotency_key" = 'legacy:' || "id"
WHERE "idempotency_key" IS NULL;

WITH ranked AS (
  SELECT
    "id",
    (ROW_NUMBER() OVER (
      PARTITION BY "run_id", "occurrence_id", "iteration_key", "fact_key", "delivery_lane"
      ORDER BY "observed_at", "id"
    ))::INTEGER AS "logical_revision"
  FROM "bridgeflow_evidence_fact"
)
UPDATE "bridgeflow_evidence_fact" AS fact
SET "revision" = ranked."logical_revision"
FROM ranked
WHERE fact."id" = ranked."id";

ALTER TABLE "bridgeflow_evidence_fact"
  ALTER COLUMN "idempotency_key" SET NOT NULL;

CREATE UNIQUE INDEX "bridgeflow_evidence_fact_idempotency_key"
  ON "bridgeflow_evidence_fact"("run_id", "idempotency_key");
CREATE UNIQUE INDEX "bridgeflow_evidence_fact_revision_key"
  ON "bridgeflow_evidence_fact"("run_id", "occurrence_id", "iteration_key", "fact_key", "delivery_lane", "revision");

CREATE TABLE "bridgeflow_evidence_run_block" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence_ref" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bridgeflow_evidence_run_block_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bridgeflow_evidence_run_block_idempotency_key"
  ON "bridgeflow_evidence_run_block"("run_id", "idempotency_key");
CREATE INDEX "bridgeflow_evidence_run_block_run_idx"
  ON "bridgeflow_evidence_run_block"("run_id", "created_at");
ALTER TABLE "bridgeflow_evidence_run_block"
  ADD CONSTRAINT "bridgeflow_evidence_run_block_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bridgeflow_oracle_evaluation"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "idempotency_key" TEXT;

UPDATE "bridgeflow_oracle_evaluation"
SET "idempotency_key" = 'legacy:' || "id"
WHERE "idempotency_key" IS NULL;

WITH ranked AS (
  SELECT
    "id",
    (ROW_NUMBER() OVER (
      PARTITION BY "run_id", "occurrence_id", "evaluator_kind"
      ORDER BY "created_at", "id"
    ))::INTEGER AS "logical_revision"
  FROM "bridgeflow_oracle_evaluation"
)
UPDATE "bridgeflow_oracle_evaluation" AS evaluation
SET "revision" = ranked."logical_revision"
FROM ranked
WHERE evaluation."id" = ranked."id";

ALTER TABLE "bridgeflow_oracle_evaluation"
  ALTER COLUMN "idempotency_key" SET NOT NULL;

CREATE UNIQUE INDEX "bridgeflow_oracle_evaluation_idempotency_key"
  ON "bridgeflow_oracle_evaluation"("run_id", "idempotency_key");
CREATE UNIQUE INDEX "bridgeflow_oracle_evaluation_revision_key"
  ON "bridgeflow_oracle_evaluation"("run_id", "occurrence_id", "evaluator_kind", "revision");

ALTER TABLE "verdict_test_execution"
  ADD COLUMN "lease_owner" TEXT,
  ADD COLUMN "lease_expires_at" TIMESTAMPTZ(6);

CREATE INDEX "verdict_test_execution_recovery_idx"
  ON "verdict_test_execution"("lease_expires_at", "heartbeat_at");

CREATE TABLE "verdict_domain_pack" (
  "id" TEXT NOT NULL,
  "pack_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "verdict_domain_pack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verdict_domain_pack_pack_key_key"
  ON "verdict_domain_pack"("pack_key");

CREATE TABLE "verdict_domain_pack_version" (
  "id" TEXT NOT NULL,
  "domain_pack_id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "bundle_digest" TEXT NOT NULL,
  "publication_state" TEXT NOT NULL DEFAULT 'DRAFT',
  "bundle" JSONB NOT NULL,
  "immutable_at" TIMESTAMPTZ(6),
  "published_at" TIMESTAMPTZ(6),
  "published_by" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verdict_domain_pack_version_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verdict_domain_pack_version_published_immutable"
    CHECK ("publication_state" <> 'PUBLISHED' OR "immutable_at" IS NOT NULL),
  CONSTRAINT "verdict_domain_pack_version_domain_pack_id_fkey"
    FOREIGN KEY ("domain_pack_id") REFERENCES "verdict_domain_pack"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "verdict_domain_pack_version_key"
  ON "verdict_domain_pack_version"("domain_pack_id", "version");
CREATE UNIQUE INDEX "verdict_domain_pack_digest_key"
  ON "verdict_domain_pack_version"("domain_pack_id", "bundle_digest");
CREATE INDEX "verdict_domain_pack_publication_idx"
  ON "verdict_domain_pack_version"("publication_state", "created_at");

CREATE FUNCTION "protect_published_verdict_domain_pack_version"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."publication_state" = 'PUBLISHED' THEN
    RAISE EXCEPTION
      'published Domain Pack version % is immutable; create a new version',
      OLD."id"
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "verdict_domain_pack_version_immutable_trigger"
BEFORE UPDATE OR DELETE ON "verdict_domain_pack_version"
FOR EACH ROW
EXECUTE FUNCTION "protect_published_verdict_domain_pack_version"();

CREATE TABLE "verdict_test_profile_version" (
  "id" TEXT NOT NULL,
  "profile_key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "domain_pack_version_id" TEXT,
  "definition" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verdict_test_profile_version_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verdict_test_profile_version_domain_pack_version_id_fkey"
    FOREIGN KEY ("domain_pack_version_id") REFERENCES "verdict_domain_pack_version"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "verdict_test_profile_version_key"
  ON "verdict_test_profile_version"("profile_key", "version");
CREATE INDEX "verdict_test_profile_pack_version_idx"
  ON "verdict_test_profile_version"("domain_pack_version_id");

CREATE TABLE "verdict_test_campaign" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "campaign_key" TEXT NOT NULL,
  "campaign_version" INTEGER NOT NULL,
  "domain_pack_version_id" TEXT,
  "definition" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "failed_cells" JSONB,
  "release_gate_result" TEXT,
  "evidence_summary_ref" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "verdict_test_campaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verdict_test_campaign_domain_pack_version_id_fkey"
    FOREIGN KEY ("domain_pack_version_id") REFERENCES "verdict_domain_pack_version"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "verdict_test_campaign_campaign_id_key"
  ON "verdict_test_campaign"("campaign_id");
CREATE INDEX "verdict_test_campaign_version_idx"
  ON "verdict_test_campaign"("campaign_key", "campaign_version");
CREATE INDEX "verdict_test_campaign_status_idx"
  ON "verdict_test_campaign"("status", "created_at");

CREATE TABLE "verdict_campaign_cell" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "cell_key" TEXT NOT NULL,
  "profile_key" TEXT NOT NULL,
  "profile_version" INTEGER NOT NULL,
  "build_ref" TEXT,
  "environment" TEXT,
  "device_cell" TEXT,
  "repetition_index" INTEGER NOT NULL DEFAULT 0,
  "run_ids" JSONB NOT NULL,
  "result" TEXT NOT NULL DEFAULT 'PENDING',
  "blocked_reason" TEXT,
  "evidence_summary_ref" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "verdict_campaign_cell_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verdict_campaign_cell_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "verdict_test_campaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "verdict_campaign_cell_key"
  ON "verdict_campaign_cell"("campaign_id", "cell_key");
CREATE INDEX "verdict_campaign_cell_profile_idx"
  ON "verdict_campaign_cell"("profile_key", "profile_version");
CREATE INDEX "verdict_campaign_cell_result_idx"
  ON "verdict_campaign_cell"("result", "updated_at");
