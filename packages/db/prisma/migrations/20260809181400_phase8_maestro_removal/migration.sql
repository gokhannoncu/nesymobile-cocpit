-- Phase 8 direct removal: archive legacy runner payloads into an engine-neutral
-- artifact table, then remove engine-specific columns from active schema.

CREATE TABLE IF NOT EXISTS "workflow_run_archive" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "run_id" TEXT NOT NULL,
  "artifact_kind" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_run_archive_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_run_archive_run_kind_key"
  ON "workflow_run_archive"("run_id", "artifact_kind");

CREATE INDEX IF NOT EXISTS "workflow_run_archive_run_id_idx"
  ON "workflow_run_archive"("run_id");

INSERT INTO "workflow_run_archive" ("id", "run_id", "artifact_kind", "payload")
SELECT
  'archive_' || md5("id" || ':legacy_workflow_source'),
  "id",
  'legacy_workflow_source',
  "yamlContent"
FROM "workflow_runs"
WHERE "yamlContent" IS NOT NULL
ON CONFLICT ("run_id", "artifact_kind") DO NOTHING;

INSERT INTO "workflow_run_archive" ("id", "run_id", "artifact_kind", "payload")
SELECT
  'archive_' || md5("id" || ':legacy_runner_output'),
  "id",
  'legacy_runner_output',
  "maestroOutput"
FROM "workflow_runs"
WHERE "maestroOutput" IS NOT NULL
ON CONFLICT ("run_id", "artifact_kind") DO NOTHING;

ALTER TABLE "workflow_runs" DROP COLUMN IF EXISTS "yamlContent";
ALTER TABLE "workflow_runs" DROP COLUMN IF EXISTS "maestroOutput";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'field_courier_logins'
      AND column_name = 'maestroRunId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'field_courier_logins'
      AND column_name = 'run_id'
  ) THEN
    ALTER TABLE "field_courier_logins" RENAME COLUMN "maestroRunId" TO "run_id";
  END IF;
END $$;
