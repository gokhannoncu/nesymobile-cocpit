CREATE TABLE "bridgeflow_reporting_outbox" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "occurrence_id" TEXT,
    "request_id" TEXT,
    "origin_id" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "sequence" BIGINT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "kind" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimed_by" TEXT,
    "claim_expires_at" TIMESTAMPTZ(6),
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bridgeflow_reporting_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bridgeflow_reporting_projection" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "occurrence_id" TEXT,
    "origin_id" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "sequence" BIGINT NOT NULL,
    "revision" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bridgeflow_reporting_projection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bridgeflow_reporting_outbox_event_id_key" ON "bridgeflow_reporting_outbox"("event_id");
CREATE INDEX "bridgeflow_reporting_outbox_pending_idx" ON "bridgeflow_reporting_outbox"("status", "next_attempt_at", "created_at");
CREATE INDEX "bridgeflow_reporting_outbox_run_sequence_idx" ON "bridgeflow_reporting_outbox"("run_id", "sequence");
CREATE UNIQUE INDEX "bridgeflow_reporting_projection_event_id_key" ON "bridgeflow_reporting_projection"("event_id");
CREATE UNIQUE INDEX "bridgeflow_reporting_projection_sequence_key" ON "bridgeflow_reporting_projection"("run_id", "origin_id", "sequence");
CREATE INDEX "bridgeflow_reporting_projection_revision_idx" ON "bridgeflow_reporting_projection"("run_id", "revision");

ALTER TABLE "bridgeflow_reporting_outbox"
ADD CONSTRAINT "bridgeflow_reporting_outbox_run_id_fkey"
FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bridgeflow_reporting_projection"
ADD CONSTRAINT "bridgeflow_reporting_projection_run_id_fkey"
FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
