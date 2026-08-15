import { describe, expect, it } from "vitest";

import {
  advanceFaultInjectionPhase,
  emptyFaultInjectionProvenance,
  selectObservedFaultProvenance,
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

  it("selects the provenance that actually advanced", () => {
    const requested = { ...emptyFaultInjectionProvenance(), phase: "REQUESTED" as const };
    const observed = {
      ...emptyFaultInjectionProvenance(),
      phase: "EFFECT_OBSERVED" as const,
      actuallyFired: true,
      abortKind: "TRANSPORT" as const,
      effectKind: "HOST_TRANSPORT_CUT" as const,
    };
    expect(selectObservedFaultProvenance(requested, observed)).toEqual(observed);
    expect(selectObservedFaultProvenance()).toEqual(emptyFaultInjectionProvenance());
  });
});
