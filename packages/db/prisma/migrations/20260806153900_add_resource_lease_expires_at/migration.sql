-- Device-command admission needs TTL on resource leases, and BridgeFlow run
-- ids are not rows in workflow_runs. Drop the FK so lease.run_id is an opaque
-- owner id; add expires_at for durable TTL/renewal.

ALTER TABLE "verdict_resource_lease"
  DROP CONSTRAINT IF EXISTS "verdict_resource_lease_run_id_fkey";

ALTER TABLE "verdict_resource_lease"
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "verdict_resource_lease_resource_conflict_idx"
  ON "verdict_resource_lease"("resource_id", "conflict_group", "state");
