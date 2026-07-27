-- ===========================================================================
--  Verdict at-least-once ingest  (plan C.5.3 / Faz 0.2)
--
--  Additive only: three new tables, nothing existing is touched. Deploying this
--  ahead of the SDK is harmless — the device does not wait for ACKs yet, so the
--  host simply becomes ready before Faz 2 starts consuming them.
-- ===========================================================================

-- CreateTable
CREATE TABLE "verdict_inbox" (
    "run_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "verdict_inbox_pkey" PRIMARY KEY ("run_id","session_id","seq")
);

-- CreateTable
CREATE TABLE "verdict_gap" (
    "run_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "generation" BIGINT NOT NULL,
    "from_seq" BIGINT NOT NULL,
    "to_seq" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verdict_gap_pkey" PRIMARY KEY ("run_id","session_id","generation")
);

-- CreateTable
CREATE TABLE "verdict_stream" (
    "run_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "contiguous_seq" BIGINT NOT NULL DEFAULT 0,
    "pending_above" BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[],
    "full_rescan_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verdict_stream_pkey" PRIMARY KEY ("run_id","session_id")
);

-- CreateIndex
--  Drives the fan-out worker's `processed_at IS NULL AND seq <= contiguous_seq
--  ORDER BY seq LIMIT 500`. Without it that query seq-scans the stream on every
--  wake-up.
CREATE INDEX "verdict_inbox_pending_idx" ON "verdict_inbox"("run_id", "session_id", "processed_at", "seq");

-- ---------------------------------------------------------------------------
--  CHECK constraints. Prisma cannot express these, so they exist only here.
--  They are not decoration: a gap range with to_seq < from_seq would make the
--  cursor jump BACKWARDS, and a from_seq of 0 would make [1..n] coverage
--  arithmetic meaningless. Rejecting them at the database is the only place the
--  guarantee cannot be bypassed by a future code path.
-- ---------------------------------------------------------------------------
ALTER TABLE "verdict_gap"
  ADD CONSTRAINT "verdict_gap_from_positive" CHECK ("from_seq" >= 1),
  ADD CONSTRAINT "verdict_gap_range_valid"   CHECK ("to_seq" >= "from_seq");

ALTER TABLE "verdict_inbox"
  ADD CONSTRAINT "verdict_inbox_seq_positive" CHECK ("seq" >= 1);

ALTER TABLE "verdict_stream"
  ADD CONSTRAINT "verdict_stream_contiguous_non_negative" CHECK ("contiguous_seq" >= 0);
