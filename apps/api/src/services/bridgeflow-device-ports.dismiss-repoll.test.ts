/**
 * After dismissing an overlay, the target gets its deadline again.
 *
 * Measured on run_2749145c: the sweep tapped the notification list's exit and
 * said so, and the ONE re-resolve that followed landed while the dialog was
 * still animating out — `close_search_bar` came back NOT_FOUND two tree
 * generations later and the run stopped on a control that was about to be there.
 * A dismissal guarantees the screen is mid-change, which is the strongest case
 * for waiting there is; asking exactly once was the same mistake the deadline
 * loop above it exists to correct.
 */
import { describe, expect, it, vi } from "vitest";

import { createGenericStepRuntime } from "./bridgeflow-device-ports.js";

const EXIT_ID = "btn_exit";
const TOGGLE_ID = "close_search_bar";

/**
 * The smallest bundle that makes a sweep possible: one HANDLE surface whose
 * handler macro names the exit target, plus the target the step under test
 * wants. Both are read out of the bundle by the runtime, so neither name is
 * hardcoded there.
 */
function bundle() {
  const target = (targetKey: string, id: string, notFoundPolicy: string) => ({
    targetKey,
    resolution: {
      deadlineMs: 800,
      notFoundPolicy,
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id }, establishesIdentity: true }],
    },
  });

  return {
    registries: {
      applications: [{ packageIdentity: "com.example.app" }],
      targets: [target("t.exit", EXIT_ID, "FAIL"), target("t.toggle", TOGGLE_ID, "FAIL")],
      surfaces: [
        {
          surfaceKey: "s.notification-list",
          defaultPolicy: "HANDLE",
          handlerMacroRef: "m.dismiss",
        },
      ],
      macros: [{ macroKey: "m.dismiss", allowedRegistryRefs: { targetRefs: ["t.exit"] } }],
    },
  } as unknown as Parameters<typeof createGenericStepRuntime>[0]["bundle"];
}

/**
 * @param toggleAppearsAfterMs How long after the dismissal tap the toggle shows
 *   up. The real dialog's exit animation is what this stands for.
 */
function harness(toggleAppearsAfterMs: number) {
  let dismissedAt: number | undefined;

  const resolve = vi.fn(async (fingerprint: { selector: { value: string } }) => {
    const id = fingerprint.selector.value;
    if (id === EXIT_ID) {
      // The list is up until it is tapped, and gone afterwards.
      return dismissedAt === undefined
        ? { outcome: "RESOLVED_UNIQUE", strength: "STRONG", fingerprint, matchedCount: 1 }
        : { outcome: "NOT_FOUND", strength: "STRONG", fingerprint, matchedCount: 0 };
    }
    const visible = dismissedAt !== undefined && Date.now() >= dismissedAt + toggleAppearsAfterMs;
    return visible
      ? { outcome: "RESOLVED_UNIQUE", strength: "STRONG", fingerprint, matchedCount: 1 }
      : { outcome: "NOT_FOUND", strength: "STRONG", fingerprint, matchedCount: 0 };
  });

  const manager = {
    resolve,
    act: vi.fn(async () => {
      dismissedAt = Date.now();
      return { terminalState: "SUCCEEDED", actedBy: "ACCESSIBILITY", manualTouch: false };
    }),
    getScheduler: () => ({ setState: () => {} }),
  } as unknown as Parameters<typeof createGenericStepRuntime>[0]["manager"];

  const port = createGenericStepRuntime({
    manager,
    variables: { get: vi.fn(), set: vi.fn() } as unknown as Parameters<
      typeof createGenericStepRuntime
    >[0]["variables"],
    bundle: bundle(),
    runId: "run-1",
    // Real time on purpose: the runtime sleeps between probes with a real timer,
    // so a virtual clock would either never reach the deadline or take minutes
    // of wall time to do it. The declared deadline below is small to match.
    logger: () => {},
  });

  return { port, resolve };
}

const step = {
  planStepId: "resolve-search-toggle",
  kind: "RESOLVE_TARGET",
  params: { targetRef: "t.toggle", outputVariable: "toggleHandle" },
} as unknown as Parameters<ReturnType<typeof createGenericStepRuntime>["execute"]>[0];

const context = { requestId: "req-1" } as unknown as Parameters<
  ReturnType<typeof createGenericStepRuntime>["execute"]
>[1];

describe("resolving a target behind a dismissible overlay", () => {
  it("waits out the dialog's exit instead of asking once", async () => {
    // 400ms is well inside the target's own deadline and far outside the single
    // immediate re-resolve the old code did.
    const { port } = harness(400);

    const result = await port.execute(step, context);

    expect(result.actionResult).toBe("SUCCEEDED");
    expect(result.evidenceRef).toContain("RESOLVED_UNIQUE");
  });

  it("still fails when the target never appears", async () => {
    // The re-poll must not turn a genuine absence into a hang or a pass: the
    // second wait is bounded by the same declared deadline as the first.
    const { port, resolve } = harness(Number.POSITIVE_INFINITY);

    const result = await port.execute(step, context);

    expect(result.actionResult).toBe("FAILED");
    expect(result.evidenceRef).toContain("NOT_FOUND");
    // And it did keep looking rather than giving up on the first answer.
    expect(resolve.mock.calls.length).toBeGreaterThan(3);
  });
});
