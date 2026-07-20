-- Add per-run inputs (barcode, shipmentId, ...) used to parameterize a saved workflow at run time.
ALTER TABLE "workflow_runs" ADD COLUMN IF NOT EXISTS "runInput" JSONB;
