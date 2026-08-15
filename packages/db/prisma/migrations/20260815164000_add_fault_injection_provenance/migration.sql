-- G90.10: injector provenance is not observedClass.
-- requested → armed → triggered → effect observed lives here.

ALTER TABLE "bridgeflow_run_runtime"
  ADD COLUMN "fault_provenance" JSONB;
