import { describe, expect, it } from "vitest";
import { hasLogConditionNodes, planPreflight } from "./preflight-plan.js";

describe("planPreflight", () => {
  it("defers branch resolution when LAUNCH_APP is present (pre-launch GET_STATE is stale)", () => {
    const plan = planPreflight([
      { type: "LAUNCH_APP", data: { config: { clearState: false } } },
      { type: "IF_LOGIN" },
      { type: "AUTH_LOGIN" },
      { type: "VALIDATE_STOPLIST" },
    ]);

    expect(plan).toEqual({
      kind: "defer_to_runtime",
      evidence: expect.stringContaining("LAUNCH_APP"),
    });
  });

  it("forces logged-out when LAUNCH_APP clears state", () => {
    const plan = planPreflight([
      { type: "LAUNCH_APP", data: { config: { clearState: true } } },
      { type: "IF_LOGIN" },
    ]);

    expect(plan.kind).toBe("force_logged_out");
  });

  it("allows immediate GET_STATE when there is no LAUNCH_APP", () => {
    const plan = planPreflight([{ type: "IF_LOGIN" }, { type: "AUTH_LOGIN" }]);
    expect(plan).toEqual({ kind: "pull_now" });
  });
});

describe("hasLogConditionNodes", () => {
  it("detects IF_LOGIN / CHECK_ROUTE", () => {
    expect(hasLogConditionNodes([{ type: "LAUNCH_APP" }])).toBe(false);
    expect(hasLogConditionNodes([{ type: "IF_LOGIN" }])).toBe(true);
    expect(hasLogConditionNodes([{ type: "CHECK_ROUTE" }])).toBe(true);
  });
});
