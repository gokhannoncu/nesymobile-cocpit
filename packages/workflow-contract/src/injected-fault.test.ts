import { describe, expect, it } from "vitest";

import {
  assertInjectedFaultRecord,
  buildD60ConfusionMatrix,
  emptyInjectedFaultPlan,
  expectedClassForInjectedFault,
  planInjectedFault,
  validateInjectedFaultRecord,
} from "./injected-fault.js";

describe("G90.9 injectedFault vs observedClass", () => {
  it("keeps an uninjected run on null / null", () => {
    expect(planInjectedFault({})).toEqual(emptyInjectedFaultPlan());
    expect(planInjectedFault({ injectedFault: null })).toEqual(emptyInjectedFaultPlan());
  });

  it("derives expectedClass from injectedFault and leaves observedClass null", () => {
    expect(planInjectedFault({ injectedFault: "PROCESS_KILL", injectedFaultHost: "A" })).toEqual({
      injectedFault: "PROCESS_KILL",
      expectedClass: "PROCESS_DEATH",
      observedClass: null,
      injectedFaultHost: "A",
      deathProvenance: null,
    });
    expect(expectedClassForInjectedFault("NETWORK_DISCONNECT")).toBe("NETWORK_PARTITION");
    expect(expectedClassForInjectedFault("BACKEND_TIMEOUT")).toBe("BACKEND_TIMEOUT");
    expect(expectedClassForInjectedFault("DIALOG_OVERLAY")).toBe("DIALOG_INTERRUPT");
    expect(expectedClassForInjectedFault("DUPLICATE_CALLBACK")).toBe("DUPLICATE_SUPPRESSED");
    expect(expectedClassForInjectedFault("OFFLINE_QUEUE")).toBe("OFFLINE_QUEUED");
  });

  it("refuses a D60 observed name as the injected input", () => {
    expect(() =>
      planInjectedFault({
        injectedFault: "PROCESS_DEATH" as never,
        injectedFaultHost: "A",
      }),
    ).toThrow(/unknown injectedFault/);
  });

  it("refuses a host without a fault and a fault without a host", () => {
    expect(() => planInjectedFault({ injectedFaultHost: "A" })).toThrow(/requires injectedFault/);
    expect(() => planInjectedFault({ injectedFault: "PROCESS_KILL" })).toThrow(/injectedFaultHost/);
  });

  it("forbids D60 observed codes on an uninjected row", () => {
    const violations = validateInjectedFaultRecord({
      ...emptyInjectedFaultPlan(),
      observedClass: "NETWORK_PARTITION",
    });
    expect(violations.map((item) => item.invariant)).toContain("G90.9.UNINJECTED");
  });

  it("requires deathProvenance only when PROCESS_DEATH was observed", () => {
    expect(
      validateInjectedFaultRecord({
        injectedFault: "PROCESS_KILL",
        expectedClass: "PROCESS_DEATH",
        observedClass: "PROCESS_DEATH",
        injectedFaultHost: "A",
        deathProvenance: null,
      }),
    ).not.toEqual([]);

    expect(() =>
      assertInjectedFaultRecord({
        injectedFault: "PROCESS_KILL",
        expectedClass: "PROCESS_DEATH",
        observedClass: "PROCESS_DEATH",
        injectedFaultHost: "A",
        deathProvenance: "PROCESS_DEATH_FORCE_STOP",
      }),
    ).not.toThrow();
  });

  it("allows an off-diagonal observation — that is a matrix cell, not a remap", () => {
    expect(
      validateInjectedFaultRecord({
        injectedFault: "PROCESS_KILL",
        expectedClass: "PROCESS_DEATH",
        observedClass: "PRODUCT_PASS",
        injectedFaultHost: "A",
        deathProvenance: null,
      }),
    ).toEqual([]);
  });

  it("excludes uninjected rows from the confusion matrix", () => {
    const matrix = buildD60ConfusionMatrix([
      emptyInjectedFaultPlan(),
      {
        injectedFault: "PROCESS_KILL",
        expectedClass: "PROCESS_DEATH",
        observedClass: "PROCESS_DEATH",
      },
      {
        injectedFault: "PROCESS_KILL",
        expectedClass: "PROCESS_DEATH",
        observedClass: "PRODUCT_PASS",
      },
      {
        injectedFault: "BACKEND_TIMEOUT",
        expectedClass: "BACKEND_TIMEOUT",
        observedClass: "UNCLASSIFIED",
      },
    ]);
    expect(matrix.uninjectedExcluded).toBe(1);
    expect(matrix.byInjected.PROCESS_KILL.PROCESS_DEATH).toBe(1);
    expect(matrix.byInjected.PROCESS_KILL.PRODUCT_PASS).toBe(1);
    expect(matrix.offDiagonal).toBe(2);
    expect(matrix.unclassified).toBe(1);
  });
});
