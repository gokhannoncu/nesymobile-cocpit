-- Snapshot the device model onto each run so history does not depend on a live ADB cable.
ALTER TABLE "workflow_runs" ADD COLUMN IF NOT EXISTS "deviceModelName" TEXT;
ALTER TABLE "workflow_runs" ADD COLUMN IF NOT EXISTS "deviceLabel" TEXT;

UPDATE "workflow_runs" wr
SET
  "deviceModelName" = md."modelName",
  "deviceLabel" = COALESCE(NULLIF(md.label, ''), md."modelName")
FROM "mobile_devices" md
WHERE wr."deviceId" IS NOT NULL
  AND wr."deviceModelName" IS NULL
  AND (md."adbDeviceId" = wr."deviceId" OR md."deviceId" = wr."deviceId");
