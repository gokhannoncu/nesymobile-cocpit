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
function harness(
  toggleAppearsAfterMs: number,
  tapsNeededToDismiss = 1,
  /** What a shallow screen dump answers; `null` makes the dump itself refuse. */
  dumpNodes: readonly Record<string, unknown>[] | null = [
    { id: "com.example.app:id/rv_notifications" },
    { id: "com.example.app:id/btn_exit" },
    { id: "" },
    { id: "com.example.app:id/rv_notifications" },
  ],
) {
  let dismissedAt: number | undefined;
  let taps = 0;

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
      taps += 1;
      // A tap that lands on a moved control still reports a completed gesture —
      // which is the whole reason the sweep cannot trust this answer.
      if (taps >= tapsNeededToDismiss) dismissedAt = Date.now();
      return { terminalState: "SUCCEEDED", actedBy: "ACCESSIBILITY", manualTouch: false };
    }),
    getScheduler: () => ({ setState: () => {} }),
    dump: vi.fn(async () =>
      dumpNodes === null
        ? { ok: false, error: "root_unavailable" }
        : { ok: true, nodes: [...dumpNodes] },
    ),
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

  return { port, resolve, taps: () => taps, manager };
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
    // The sweep's outcome rides along in the persisted evidence, because the
    // logger is a buffer that rotates and this question keeps being asked after
    // the fact.
    expect(result.evidenceRef).toContain("swept=s.notification-list");
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
    // And the evidence says the overlay WAS closed, so a reader can tell this
    // apart from a sweep that found nothing to close.
    expect(result.evidenceRef).toContain("swept=s.notification-list");
  });

  it("records that the sweep found nothing when no overlay is up", async () => {
    // Without this the two cases read identically: a target genuinely missing on
    // a healthy screen, and one hidden under something nobody dismissed.
    const { port } = harness(Number.POSITIVE_INFINITY);
    // Nothing taps anything here — the exit probe answers NOT_FOUND from the
    // start once the surface is reported absent.
    const result = await port.execute(step, { ...context, requestId: "req-2" });

    expect(result.actionResult).toBe("FAILED");
    expect(result.evidenceRef).toMatch(/swept=/);
  });

  it("taps the exit again when the surface is still up", async () => {
    // The regression, measured on run_125f3b1d: the bridge answered SUCCEEDED,
    // the evidence said `swept=…`, and the dialog was still there — the exit had
    // shifted upward as pushes piled into the list, so the tap hit nothing.
    // Absence of the exit is now the only thing that counts as dismissed.
    const { port, taps } = harness(200, 2);

    const result = await port.execute(step, context);

    expect(taps()).toBe(2);
    expect(result.actionResult).toBe("SUCCEEDED");
    expect(result.evidenceRef).toContain("swept=s.notification-list");
  });

  it("gives up rather than tapping a surface forever", async () => {
    // Three attempts, then the failure is reported honestly. A surface that
    // survives three re-resolved taps is not a moved button.
    const { port, taps } = harness(200, 99);

    const result = await port.execute(step, context);

    expect(taps()).toBe(3);
    expect(result.actionResult).toBe("FAILED");
    // Nothing was dismissed, and the evidence must not claim otherwise.
    expect(result.evidenceRef).toContain("swept=nothing");
  });

  /**
   * A mandatory miss now records WHICH screen it missed on. Measured on
   * run_5b038e00: two resolutions fifteen seconds apart both said
   * `NOT_FOUND:treeGen=12286`, and nothing anywhere said what the tree DID hold,
   * so "the tree is frozen" and "this is not the stop list" stayed
   * indistinguishable until somebody dumped the device by hand.
   */
  it("names the screen when a mandatory target is missing", async () => {
    const { port } = harness(Number.POSITIVE_INFINITY);

    const result = await port.execute(step, context);

    expect(result.actionResult).toBe("FAILED");
    // Ids only, de-duplicated, package prefix stripped — the text of a node is
    // user data and this string is persisted with the run.
    expect(result.evidenceRef).toContain("screen=rv_notifications,btn_exit");
  });

  it("says the screen was unreadable rather than inventing one", async () => {
    // `root_unavailable` is a DIFFERENT failure from a control being absent, and
    // collapsing the two is what sent the last investigation down a blind alley.
    const { port } = harness(Number.POSITIVE_INFINITY, 1, null);

    const result = await port.execute(step, context);

    expect(result.evidenceRef).toContain("screen=unreadable(root_unavailable)");
  });

  it("does not fingerprint the screen when the target resolved", async () => {
    // The probe is for explaining failures. Paying a dump on the happy path
    // would charge every resolved target for a diagnosis nobody asked for.
    const { port, manager } = harness(400);

    const result = await port.execute(step, context);

    expect(result.actionResult).toBe("SUCCEEDED");
    expect((manager as unknown as { dump: { mock: { calls: unknown[] } } }).dump.mock.calls).toHaveLength(0);
    expect(result.evidenceRef).not.toContain("screen=");
  });
});
