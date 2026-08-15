/**
 * G90.10 — observe a class from runtime evidence, not from the input axis.
 *
 * This function must not accept `injectedFault` or `expectedClass`. If those
 * were enough to produce `observedClass`, the D60 confusion matrix would be
 * a copy of the plan.
 */

import type { ObservedClass } from "./injected-fault.js";
import type { FaultInjectionProvenance } from "./fault-injection-provenance.js";
import type { EffectClass } from "./remote-action.js";

export function isBackendTimeoutInjectionTarget(spec: { effectClass: EffectClass }): boolean {
  return spec.effectClass !== "READ_ONLY";
}

export function isNetworkDisconnectInjectionTarget(spec: { effectClass: EffectClass }): boolean {
  return spec.effectClass !== "READ_ONLY";
}

/**
 * Classify an injected-fault observation.
 *
 * This function must not accept `injectedFault` or `expectedClass`. The two
 * orthogonal signatures are:
 *
 *   DEADLINE + ADAPTER_DEADLINE_ABORT → BACKEND_TIMEOUT
 *   TRANSPORT + HOST_TRANSPORT_CUT    → NETWORK_PARTITION
 *
 * A planned fault with no effect, a mixed signature, or a transport loss
 * that was not the injector stays unclassified here.
 */
export function observeInjectedClass(input: {
  actionResult: string | null | undefined;
  provenance: FaultInjectionProvenance;
}): ObservedClass | null {
  const { actionResult, provenance } = input;
  if (actionResult !== "UNKNOWN_EFFECT") return null;
  if (provenance.phase !== "EFFECT_OBSERVED") return null;
  if (!provenance.actuallyFired) return null;
  if (provenance.abortKind === "DEADLINE" && provenance.effectKind === "ADAPTER_DEADLINE_ABORT") {
    return "BACKEND_TIMEOUT";
  }
  if (provenance.abortKind === "TRANSPORT" && provenance.effectKind === "HOST_TRANSPORT_CUT") {
    return "NETWORK_PARTITION";
  }
  return null;
}
