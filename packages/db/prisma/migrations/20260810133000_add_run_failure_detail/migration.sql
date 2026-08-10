-- Free-text diagnosis for runs that never executed or crashed mid-flight.
--
-- `termination_reason` is a closed axis (NOT_TERMINATED / COMPLETED / ABORTED / …)
-- and cannot carry a thrown executor message or an adb failure string. Before this
-- column the execution queue logged that text to stdout and nowhere else, so a
-- `failed` run carried no readable cause in the database or the cockpit.

ALTER TABLE "bridgeflow_run_runtime" ADD COLUMN "failure_detail" TEXT;
