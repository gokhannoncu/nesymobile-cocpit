-- Durable store for BridgeFlow compiled plans.
--
-- Run starts pin (compiled_plan_ref, compiled_plan_hash); execution workers use
-- this table to recover the immutable plan body after API restart or across
-- multiple API processes.

CREATE TABLE "verdict_compiled_plan" (
    "id" TEXT NOT NULL,
    "plan_ref" TEXT NOT NULL,
    "plan_hash" TEXT NOT NULL,
    "workflow_ref" TEXT NOT NULL,
    "domain_pack_key" TEXT NOT NULL,
    "domain_pack_version" TEXT NOT NULL,
    "domain_pack_digest" TEXT NOT NULL,
    "compiler_version" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verdict_compiled_plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verdict_compiled_plan_ref_key" ON "verdict_compiled_plan"("plan_ref");
CREATE UNIQUE INDEX "verdict_compiled_plan_hash_key" ON "verdict_compiled_plan"("plan_hash");
CREATE INDEX "verdict_compiled_plan_workflow_idx" ON "verdict_compiled_plan"("workflow_ref", "created_at");
CREATE INDEX "verdict_compiled_plan_pack_idx" ON "verdict_compiled_plan"("domain_pack_key", "domain_pack_version");
