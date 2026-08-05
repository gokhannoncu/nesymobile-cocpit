import { describe, expect, it } from "vitest";
import {
  applyWaitTerminalTransition,
  appendActionTransition,
  buildEvidenceRevisionIdempotencyKey,
  buildOracleRevisionIdempotencyKey,
  buildRunManifest,
  EVIDENCE_JOURNEY_STAGES,
  createResourcePool,
  decideSchedulerRecovery,
  finalizeRunOutcome,
  leaseResource,
  markResourceForReconciliation,
  releaseResource,
  type RemoteActionTerminalResult,
} from "./index.js";

describe("execution contract", () => {
  it("pins run manifest inputs and records runEpoch in monotonic milliseconds", () => {
    const manifest = buildRunManifest({
      runId: "run-1",
      workflowRef: "workflow/demo",
      workflowVersion: 7,
      engineType: "BRIDGEFLOW",
      compiledPlanRef: "plan/demo",
      compiledPlanHash: "sha256:plan",
      domainPackKey: "nesy-courier",
      domainPackVersion: "1.0.0",
      domainPackDigest: "sha256:pack",
      workflowIrSchemaVersion: 2,
      compilerVersion: "phase-4c",
      bridgeProtocolVersion: "1",
      sdkProtocolVersion: "1",
      runEpochMs: 123_456,
      profile: {
        profileKey: "preview",
        profileVersion: "2026.08",
        campaignId: "campaign-1",
        buildRef: "apk-debug",
        datasetRef: "dataset-a",
        deviceCell: "pixel-8/api-35",
        repetitionIndex: 2,
        faultPlanRef: "none",
        telemetryPolicyRef: "default",
        releaseGate: false,
      },
      reducerGraphDigest: "sha256:graph",
    });

    expect(manifest.runEpochUnit).toBe("MONOTONIC_MS");
    expect(manifest.profile.profileKey).toBe("preview");
    expect(() => {
      (manifest.profile as { profileKey: string }).profileKey = "hot-reloaded";
    }).toThrow();
  });

  it("records action lifecycle transitions in order and refuses terminal overwrite", () => {
    const received = appendActionTransition([], {
      phase: "RECEIVED",
      requestId: "req-1",
      atMs: 1,
      evidenceRef: "inbox:1",
    });
    const resolved = appendActionTransition(received, {
      phase: "TARGET_RESOLVED",
      requestId: "req-1",
      atMs: 2,
      evidenceRef: "target:1",
    });
    const completed = appendActionTransition(
      appendActionTransition(resolved, {
        phase: "GESTURE_DISPATCHED",
        requestId: "req-1",
        atMs: 3,
        evidenceRef: "bridge:dispatch",
      }),
      {
        phase: "GESTURE_COMPLETED",
        requestId: "req-1",
        atMs: 4,
        evidenceRef: "bridge:gesture",
      },
    );
    const verified = appendActionTransition(completed, {
      phase: "EFFECT_VERIFIED",
      requestId: "req-1",
      atMs: 5,
      evidenceRef: "fact:effect",
      terminal: "SUCCEEDED",
    });

    expect(verified.map((transition) => transition.phase)).toEqual([
      "RECEIVED",
      "TARGET_RESOLVED",
      "GESTURE_DISPATCHED",
      "GESTURE_COMPLETED",
      "EFFECT_VERIFIED",
    ]);
    expect(() =>
      appendActionTransition(verified, {
        phase: "EFFECT_VERIFIED",
        requestId: "req-1",
        atMs: 6,
        evidenceRef: "fact:late",
        terminal: "FAILED",
      }),
    ).toThrow(/already terminal/);
  });

  it("keeps cleanup failure separate from a passing business verdict", () => {
    const outcome = finalizeRunOutcome({
      lifecycle: "CLOSED",
      productVerdict: "PASS_ONLINE",
      evaluationFailureClass: "NONE",
      terminationReason: "COMPLETED",
      cleanupResult: "FAILED",
      resourceReleaseResult: "RELEASED",
      schedulerDisposition: "RELEASED",
      operationalDisposition: "OK",
    });

    expect(outcome.productVerdict).toBe("PASS_ONLINE");
    expect(outcome.operationalDisposition).toBe("NEEDS_ATTENTION");
    expect(outcome.cleanupResult).toBe("FAILED");
  });

  it("prevents parallel exclusive resource mutation and quarantines reconciliation resources", () => {
    const pool = createResourcePool([
      {
        resourceId: "device-1",
        conflictGroup: "device:pixel",
        exclusive: true,
        state: "CLEAN",
      },
    ]);

    const first = leaseResource(pool, {
      leaseId: "lease-1",
      runId: "run-1",
      resourceId: "device-1",
      conflictGroup: "device:pixel",
      exclusive: true,
      leasedAtMs: 10,
    });
    expect(first.ok).toBe(true);

    const second = leaseResource(pool, {
      leaseId: "lease-2",
      runId: "run-2",
      resourceId: "device-1",
      conflictGroup: "device:pixel",
      exclusive: true,
      leasedAtMs: 11,
    });
    expect(second).toMatchObject({ ok: false, reason: "CONFLICT_GROUP_BUSY" });

    markResourceForReconciliation(pool, "device-1", "UNKNOWN_EFFECT");
    expect(releaseResource(pool, "lease-1")).toMatchObject({
      ok: false,
      reason: "RECONCILIATION_REQUIRED",
    });
  });

  it("keeps the canonical nine-stage evidence journey", () => {
    expect(EVIDENCE_JOURNEY_STAGES).toEqual([
      "EMIT",
      "WAL",
      "TRANSPORT",
      "INBOX",
      "RECEIPT",
      "ORDERED",
      "NORMALIZATION",
      "CORRELATION",
      "EVALUATION",
    ]);
  });

  it("keeps the first terminal wait result when a later result races it", () => {
    const first = { status: "EXPECTED_MATCH" as const, key: "ready", elapsedMs: 12 };
    const late = { status: "TIMEOUT" as const, elapsedMs: 1_000 };

    expect(applyWaitTerminalTransition(undefined, first)).toEqual(first);
    expect(applyWaitTerminalTransition(first, late)).toBe(first);
  });

  it("keeps a live scheduler lease while its heartbeat is fresh", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "RUNNING",
        schedulerDisposition: "LEASED",
        disposition: "BLOCKED",
        leaseOwner: "worker-1",
        leaseExpiresAtMs: 1_200,
        heartbeatAtMs: 900,
        heartbeatTimeoutMs: 200,
        nowMs: 1_050,
        occurrenceState: "NOT_STARTED",
      }),
    ).toEqual({
      action: "KEEP_LEASE",
      lifecycle: "RUNNING",
      schedulerDisposition: "LEASED",
      disposition: "BLOCKED",
    });
  });

  it("keeps an in-flight physical effect while its lease and heartbeat are healthy", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "RUNNING",
        schedulerDisposition: "LEASED",
        disposition: "BLOCKED",
        leaseOwner: "worker-1",
        leaseExpiresAtMs: 1_200,
        heartbeatAtMs: 1_000,
        heartbeatTimeoutMs: 200,
        nowMs: 1_050,
        occurrenceState: "PHYSICAL_EFFECT_IN_FLIGHT",
      }),
    ).toEqual({
      action: "KEEP_LEASE",
      lifecycle: "RUNNING",
      schedulerDisposition: "LEASED",
      disposition: "BLOCKED",
    });
  });

  it("requeues an expired lease only when no physical effect started", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "RUNNING",
        schedulerDisposition: "LEASED",
        disposition: "BLOCKED",
        leaseOwner: "worker-1",
        leaseExpiresAtMs: 1_000,
        heartbeatAtMs: 800,
        heartbeatTimeoutMs: 100,
        nowMs: 1_001,
        occurrenceState: "NOT_STARTED",
      }),
    ).toEqual({
      action: "REQUEUE",
      lifecycle: "READY",
      schedulerDisposition: "REQUEUED",
      disposition: "RETRYABLE",
    });
  });

  it("stops with unknown effect when an in-flight physical effect loses its lease", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "RUNNING",
        schedulerDisposition: "LEASED",
        disposition: "BLOCKED",
        leaseOwner: "worker-1",
        leaseExpiresAtMs: 1_000,
        heartbeatAtMs: 800,
        heartbeatTimeoutMs: 100,
        nowMs: 1_001,
        occurrenceState: "PHYSICAL_EFFECT_IN_FLIGHT",
      }),
    ).toEqual({
      action: "STOP_UNKNOWN_EFFECT",
      lifecycle: "TERMINAL",
      schedulerDisposition: "WORKER_LOST",
      disposition: "UNKNOWN_EFFECT",
    });
  });

  it("skips completed occurrences during scheduler recovery", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "RUNNING",
        schedulerDisposition: "LEASED",
        disposition: "BLOCKED",
        leaseOwner: "worker-1",
        leaseExpiresAtMs: 1_000,
        heartbeatAtMs: 800,
        heartbeatTimeoutMs: 100,
        nowMs: 1_001,
        occurrenceState: "COMPLETED",
      }),
    ).toEqual({
      action: "SKIP_COMPLETED",
      lifecycle: "TERMINAL",
      schedulerDisposition: "RELEASED",
      disposition: "COMPLETED",
    });
  });

  it("never reopens an already terminal execution during recovery", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "TERMINAL",
        schedulerDisposition: "RELEASED",
        disposition: "CANCELLED",
        leaseExpiresAtMs: 1_000,
        heartbeatAtMs: 800,
        heartbeatTimeoutMs: 100,
        nowMs: 1_001,
        occurrenceState: "NOT_STARTED",
      }),
    ).toEqual({
      action: "KEEP_TERMINAL",
      lifecycle: "TERMINAL",
      schedulerDisposition: "RELEASED",
      disposition: "CANCELLED",
    });
  });

  it("does not keep a lease when its heartbeat is missing", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "RUNNING",
        schedulerDisposition: "LEASED",
        disposition: "BLOCKED",
        leaseOwner: "worker-1",
        leaseExpiresAtMs: 1_200,
        heartbeatTimeoutMs: 200,
        nowMs: 1_050,
        occurrenceState: "NOT_STARTED",
      }),
    ).toEqual({
      action: "REQUEUE",
      lifecycle: "READY",
      schedulerDisposition: "REQUEUED",
      disposition: "RETRYABLE",
    });
  });

  it("marks a lease with no owner as orphaned", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "RUNNING",
        schedulerDisposition: "LEASED",
        disposition: "BLOCKED",
        leaseExpiresAtMs: 1_200,
        heartbeatAtMs: 1_000,
        heartbeatTimeoutMs: 200,
        nowMs: 1_050,
        occurrenceState: "NOT_STARTED",
      }),
    ).toEqual({
      action: "MARK_ORPHANED",
      lifecycle: "TERMINAL",
      schedulerDisposition: "WORKER_LOST",
      disposition: "ORPHANED",
    });
  });

  it("marks a lease with no expiry as orphaned", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "RUNNING",
        schedulerDisposition: "LEASED",
        disposition: "BLOCKED",
        leaseOwner: "worker-1",
        heartbeatAtMs: 1_000,
        heartbeatTimeoutMs: 200,
        nowMs: 1_050,
        occurrenceState: "NOT_STARTED",
      }),
    ).toEqual({
      action: "MARK_ORPHANED",
      lifecycle: "TERMINAL",
      schedulerDisposition: "WORKER_LOST",
      disposition: "ORPHANED",
    });
  });

  it("marks invalid leased lifecycle combinations as orphaned", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "LEASED",
        schedulerDisposition: "LEASED",
        disposition: "BLOCKED",
        leaseOwner: "worker-1",
        leaseExpiresAtMs: 1_200,
        heartbeatAtMs: 1_000,
        heartbeatTimeoutMs: 200,
        nowMs: 1_050,
        occurrenceState: "NOT_STARTED",
      }),
    ).toEqual({
      action: "MARK_ORPHANED",
      lifecycle: "TERMINAL",
      schedulerDisposition: "WORKER_LOST",
      disposition: "ORPHANED",
    });
  });

  it("marks invalid scheduler disposition combinations as orphaned", () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: "RUNNING",
        schedulerDisposition: "SCHEDULED",
        disposition: "BLOCKED",
        leaseOwner: "worker-1",
        leaseExpiresAtMs: 1_200,
        heartbeatAtMs: 1_000,
        heartbeatTimeoutMs: 200,
        nowMs: 1_050,
        occurrenceState: "NOT_STARTED",
      }),
    ).toEqual({
      action: "MARK_ORPHANED",
      lifecycle: "TERMINAL",
      schedulerDisposition: "WORKER_LOST",
      disposition: "ORPHANED",
    });
  });

  it("represents remote terminal results without collapsing unknown effects", () => {
    const results: readonly RemoteActionTerminalResult[] = [
      { status: "SUCCEEDED" },
      { status: "FAILED", error: "adapter rejected response" },
      { status: "UNKNOWN_EFFECT", error: "response lost" },
      { status: "RECONCILIATION_REQUIRED", reconciliationRef: "reconcile:attempt-1" },
    ];

    expect(results.map((result) => result.status)).toEqual([
      "SUCCEEDED",
      "FAILED",
      "UNKNOWN_EFFECT",
      "RECONCILIATION_REQUIRED",
    ]);
  });

  it("builds stable collision-safe evidence revision idempotency keys", () => {
    const input = {
      runId: "run:1",
      occurrenceId: "occurrence/1",
      iterationKey: "root",
      factKey: "delivery.persisted",
      deliveryLane: "ORDERED_REQUIRED" as const,
      revision: 2,
    };

    expect(buildEvidenceRevisionIdempotencyKey(input)).toBe(
      "evidence-revision:v2:5:run:1:12:occurrence/1:4:root:18:delivery.persisted:16:ORDERED_REQUIRED:1:2",
    );
    expect(buildEvidenceRevisionIdempotencyKey(input)).not.toBe(
      buildEvidenceRevisionIdempotencyKey({ ...input, factKey: "delivery", iterationKey: "root:delivery.persisted" }),
    );
    expect(buildEvidenceRevisionIdempotencyKey(input)).not.toBe(
      buildEvidenceRevisionIdempotencyKey({ ...input, deliveryLane: "RECEIPT_SAFE" }),
    );
  });

  it("builds stable collision-safe Oracle revision idempotency keys", () => {
    const input = {
      runId: "run:1",
      occurrenceId: "occurrence/1",
      evaluatorKind: "FINAL_ORACLE" as const,
      revision: 3,
    };

    expect(buildOracleRevisionIdempotencyKey(input)).toBe(
      "oracle-revision:v1:5:run:1:12:occurrence/1:12:FINAL_ORACLE:1:3",
    );
    expect(buildOracleRevisionIdempotencyKey(input)).toBe(buildOracleRevisionIdempotencyKey({ ...input }));
  });
});
