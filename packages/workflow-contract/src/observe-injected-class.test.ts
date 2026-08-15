import { describe, expect, it } from "vitest";

import { emptyFaultInjectionProvenance } from "./fault-injection-provenance.js";
import {
  isBackendTimeoutInjectionTarget,
  isNetworkDisconnectInjectionTarget,
  isOfflineQueueInjectionTarget,
  observeInjectedClass,
} from "./observe-injected-class.js";

function firedDeadline() {
  return {
    ...emptyFaultInjectionProvenance(),
    phase: "EFFECT_OBSERVED" as const,
    actuallyFired: true,
    abortKind: "DEADLINE" as const,
    effectKind: "ADAPTER_DEADLINE_ABORT" as const,
  };
}

describe("observeInjectedClass", () => {
  it("does not take injectedFault — the function signature is the invariant", () => {
    expect(observeInjectedClass).toHaveLength(1);
    expect(observeInjectedClass.toString()).not.toMatch(/injectedFault|expectedClass/);
  });

  it("returns BACKEND_TIMEOUT only from a fired adapter deadline", () => {
    expect(
      observeInjectedClass({
        actionResult: "UNKNOWN_EFFECT",
        provenance: firedDeadline(),
      }),
    ).toBe("BACKEND_TIMEOUT");
  });

  it("refuses to classify a planned fault that never fired", () => {
    expect(
      observeInjectedClass({
        actionResult: "UNKNOWN_EFFECT",
        provenance: {
          ...emptyFaultInjectionProvenance(),
          phase: "REQUESTED",
        },
      }),
    ).toBeNull();
  });

  it("refuses a successful remote call even if provenance was requested", () => {
    expect(
      observeInjectedClass({
        actionResult: "SUCCEEDED",
        provenance: firedDeadline(),
      }),
    ).toBeNull();
  });

  it("refuses a transport loss that was not the injector deadline", () => {
    expect(
      observeInjectedClass({
        actionResult: "UNKNOWN_EFFECT",
        provenance: {
          ...firedDeadline(),
          abortKind: "TRANSPORT",
        },
      }),
    ).toBeNull();
  });

  it("returns NETWORK_PARTITION only from a fired host transport cut", () => {
    expect(
      observeInjectedClass({
        actionResult: "UNKNOWN_EFFECT",
        provenance: {
          ...emptyFaultInjectionProvenance(),
          phase: "EFFECT_OBSERVED",
          actuallyFired: true,
          abortKind: "TRANSPORT",
          effectKind: "HOST_TRANSPORT_CUT",
        },
      }),
    ).toBe("NETWORK_PARTITION");
  });

  it("refuses mixed deadline/transport signatures", () => {
    expect(
      observeInjectedClass({
        actionResult: "UNKNOWN_EFFECT",
        provenance: {
          ...firedDeadline(),
          effectKind: "HOST_TRANSPORT_CUT",
        },
      }),
    ).toBeNull();
    expect(
      observeInjectedClass({
        actionResult: "UNKNOWN_EFFECT",
        provenance: {
          ...emptyFaultInjectionProvenance(),
          phase: "EFFECT_OBSERVED",
          actuallyFired: true,
          abortKind: "TRANSPORT",
          effectKind: "ADAPTER_DEADLINE_ABORT",
        },
      }),
    ).toBeNull();
  });

  it("arms only mutation remotes — READ_ONLY probes stay uninjected at the wire", () => {
    expect(isBackendTimeoutInjectionTarget({ effectClass: "NON_IDEMPOTENT_MUTATION" })).toBe(true);
    expect(isBackendTimeoutInjectionTarget({ effectClass: "IDEMPOTENT_MUTATION" })).toBe(true);
    expect(isBackendTimeoutInjectionTarget({ effectClass: "READ_ONLY" })).toBe(false);
    expect(isNetworkDisconnectInjectionTarget({ effectClass: "IDEMPOTENT_MUTATION" })).toBe(true);
    expect(isNetworkDisconnectInjectionTarget({ effectClass: "READ_ONLY" })).toBe(false);
  });

  it("arms only the process-parcel confirm tap — tour-approval stays remote-mutation", () => {
    expect(isOfflineQueueInjectionTarget({ planStepId: "tap-input-confirm" })).toBe(true);
    expect(isOfflineQueueInjectionTarget({ planStepId: "dispatcher-approves" })).toBe(false);
    expect(isOfflineQueueInjectionTarget({ planStepId: "tap-delivery-confirm" })).toBe(false);
  });

  it("returns OFFLINE_QUEUED only from a fired local-queue persist plus product evidence", () => {
    expect(
      observeInjectedClass({
        actionResult: "SUCCEEDED",
        productVerdict: "PASS_QUEUED_OFFLINE",
        localQueueObserved: true,
        provenance: {
          ...emptyFaultInjectionProvenance(),
          phase: "EFFECT_OBSERVED",
          actuallyFired: true,
          abortKind: "NONE",
          effectKind: "LOCAL_QUEUE_PERSIST",
        },
      }),
    ).toBe("OFFLINE_QUEUED");
  });

  it("refuses OFFLINE_QUEUED when the product verdict is queued but no LOCAL queue fact exists", () => {
    expect(
      observeInjectedClass({
        actionResult: "SUCCEEDED",
        productVerdict: "PASS_QUEUED_OFFLINE",
        localQueueObserved: false,
        provenance: {
          ...emptyFaultInjectionProvenance(),
          phase: "EFFECT_OBSERVED",
          actuallyFired: true,
          abortKind: "NONE",
          effectKind: "LOCAL_QUEUE_PERSIST",
        },
      }),
    ).toBeNull();
  });

  it("refuses OFFLINE_QUEUED from a local persist that the product still called online", () => {
    expect(
      observeInjectedClass({
        actionResult: "SUCCEEDED",
        productVerdict: "PASS_ONLINE",
        localQueueObserved: true,
        provenance: {
          ...emptyFaultInjectionProvenance(),
          phase: "EFFECT_OBSERVED",
          actuallyFired: true,
          abortKind: "NONE",
          effectKind: "LOCAL_QUEUE_PERSIST",
        },
      }),
    ).toBeNull();
  });

  it("does not treat a host transport cut as an offline queue", () => {
    expect(
      observeInjectedClass({
        actionResult: "UNKNOWN_EFFECT",
        productVerdict: "PASS_QUEUED_OFFLINE",
        localQueueObserved: true,
        provenance: {
          ...emptyFaultInjectionProvenance(),
          phase: "EFFECT_OBSERVED",
          actuallyFired: true,
          abortKind: "TRANSPORT",
          effectKind: "HOST_TRANSPORT_CUT",
        },
      }),
    ).toBe("NETWORK_PARTITION");
    expect(
      observeInjectedClass({
        actionResult: "UNKNOWN_EFFECT",
        productVerdict: "PASS_QUEUED_OFFLINE",
        localQueueObserved: true,
        provenance: {
          ...emptyFaultInjectionProvenance(),
          phase: "EFFECT_OBSERVED",
          actuallyFired: true,
          abortKind: "NONE",
          effectKind: "HOST_TRANSPORT_CUT",
        },
      }),
    ).toBeNull();
  });
});
