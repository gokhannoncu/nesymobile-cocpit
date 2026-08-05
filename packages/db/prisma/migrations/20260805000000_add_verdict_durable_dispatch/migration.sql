-- ===========================================================================
--  Verdict durable dispatch state — two lanes, one inbox  (plan B.5 / D.2)
--
--  Additive only. Every new column is nullable or has a default, so a host
--  running the previous code against this schema behaves exactly as before:
--  the ordered fan-out worker reads `processed_at IS NULL` and never looks at
--  the new columns. That property is what makes this migration deployable
--  ahead of the runtime rather than in lockstep with it.
--
--  ## Why receipt state is a SEPARATE column and not a reuse of processed_at
--
--  It was tempting to let one timestamp mean "delivered". It cannot: the two
--  lanes advance at different speeds by design. `processed_at` may only be set
--  after the ORDERED consumer succeeded below the contiguous watermark, while
--  `receipt_dispatched_at` moves as soon as the row is committed — including
--  for rows sitting ABOVE a hole. Sharing one column would either block the
--  receipt lane behind gaps (defeating C.40) or mark rows processed that the
--  ordered consumer never saw (destroying audit authority).
--
--  ## Why retry/poison state lives on the row, not in memory
--
--  An in-memory attempt counter resets on restart, so a genuinely poisonous
--  row is retried forever and the stream never becomes visibly stuck — the
--  worst outcome, because "stalled" is diagnosable and "silently looping" is
--  not. `attempt`, `last_error`, `next_retry_at` and `dead_lettered_at` survive
--  the process on purpose.
-- ===========================================================================

ALTER TABLE "verdict_inbox"
  --  Commit → receipt-lane publish. NULL means the receipt subscriber has not
  --  been handed this row yet; that is the entire restart-recovery state for
  --  the commit-before-publish crash window.
  ADD COLUMN "receipt_dispatched_at" TIMESTAMPTZ(6),
  --  Ordered consumer failure count for THIS row. 0 for a healthy row.
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0,
  --  Last ordered consumer error message. Kept even after a later success is
  --  impossible (dead-letter), because the message is the only diagnosis.
  ADD COLUMN "last_error" TEXT,
  --  Earliest time the ordered consumer may retry. NULL = retry immediately.
  ADD COLUMN "next_retry_at" TIMESTAMPTZ(6),
  --  Set when the retry budget is exhausted. A dead-lettered row STOPS the
  --  ordered lane at its seq — it is never skipped, because skipping would
  --  deliver seq N+1 before N and convert a transient bug into a permanent
  --  ordering violation.
  ADD COLUMN "dead_lettered_at" TIMESTAMPTZ(6);

ALTER TABLE "verdict_inbox"
  ADD CONSTRAINT "verdict_inbox_attempt_non_negative" CHECK ("attempt" >= 0);

-- ---------------------------------------------------------------------------
--  Indexes. Both lanes poll on every post-commit nudge, so both predicates
--  need to be index-driven; a seq scan per nudge is O(rows) per event, i.e.
--  the O(n^2) behaviour the bootstrap scanner is explicitly required not to
--  have.
-- ---------------------------------------------------------------------------

--  Receipt lane: "committed rows for this stream not yet dispatched, in order".
--  No watermark join — that is the point of the lane.
CREATE INDEX "verdict_inbox_receipt_pending_idx"
  ON "verdict_inbox"("run_id", "session_id", "receipt_dispatched_at", "seq");

--  Dead-letter / poison visibility across ALL streams, newest first. Partial
--  so the index stays the size of the problem rather than the size of the
--  inbox.
CREATE INDEX "verdict_inbox_dead_lettered_idx"
  ON "verdict_inbox"("dead_lettered_at")
  WHERE "dead_lettered_at" IS NOT NULL;

-- ===========================================================================
--  Run closure — the late-event policy needs a durable answer
--
--  "Is this run still accepting evidence?" was previously answerable only from
--  in-memory workflow state, which means after a restart the host could not
--  tell a legitimately late event from an event for a run that finished hours
--  ago. Both are then treated the same way, and a closed run's oracle can be
--  re-woken by an event it must ignore.
--
--  Deliberately NOT a foreign key to `workflow_runs`: a stream can be closed
--  for evidence purposes while the run row still exists, and the durable
--  runtime must not gain a dependency on the run lifecycle table's shape.
-- ===========================================================================

CREATE TABLE "verdict_run_closure" (
    "run_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "closed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    --  Counted, not dropped. A run that keeps receiving events after closure
    --  is a real signal (device never learned the run ended); silently
    --  discarding them hides it.
    "late_event_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "verdict_run_closure_pkey" PRIMARY KEY ("run_id","session_id")
);

ALTER TABLE "verdict_run_closure"
  ADD CONSTRAINT "verdict_run_closure_late_non_negative" CHECK ("late_event_count" >= 0);
