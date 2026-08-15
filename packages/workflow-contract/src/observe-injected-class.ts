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

/**
 * Classify a backend-timeout observation.
 *
 * `BACKEND_TIMEOUT` is returned only when a deadline abort was actually
 * observed after the injector triggered. A planned fault with no effect,
 * or a transport loss that was not the injector, stays unclassified here.
 */
export function observeInjectedClass(input: {
  actionResult: string | null | undefined;
  provenance: FaultInjectionProvenance;
}): ObservedClass | null {
  const { actionResult, provenance } = input;
  if (actionResult !== "UNKNOWN_EFFECT") return null;
  if (provenance.phase !== "EFFECT_OBSERVED") return null;
  if (!provenance.actuallyFired) return null;
  if (provenance.abortKind !== "DEADLINE") return null;
  if (provenance.effectKind !== "ADAPTER_DEADLINE_ABORT") return null;
  return "BACKEND_TIMEOUT";
}
