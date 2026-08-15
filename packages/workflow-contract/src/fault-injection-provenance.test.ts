import { describe, expect, it } from "vitest";

import {
  advanceFaultInjectionPhase,
  emptyFaultInjectionProvenance,
} from "./fault-injection-provenance.js";

describe("fault injection provenance", () => {
  it("starts empty — requested is not fired", () => {
    const empty = emptyFaultInjectionProvenance();
    expect(empty.phase).toBeNull();
    expect(empty.actuallyFired).toBe(false);
    expect(empty.abortKind).toBe("NONE");
  });

  it("does not walk a phase backwards", () => {
    expect(advanceFaultInjectionPhase("TRIGGERED", "ARMED")).toBe("TRIGGERED");
    expect(advanceFaultInjectionPhase(null, "REQUESTED")).toBe("REQUESTED");
    expect(advanceFaultInjectionPhase("REQUESTED", "EFFECT_OBSERVED")).toBe("EFFECT_OBSERVED");
  });
});
