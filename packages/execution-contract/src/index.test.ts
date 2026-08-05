import { describe, expect, it } from "vitest";
import {
  appendActionTransition,
  buildRunManifest,
  createResourcePool,
  finalizeRunOutcome,
  leaseResource,
  markResourceForReconciliation,
  releaseResource,
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
});
