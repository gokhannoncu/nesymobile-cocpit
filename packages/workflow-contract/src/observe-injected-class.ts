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
 * Does this call belong to the step the injector armed?
 *
 * `operationRef` alone is not identity: the same back-office operation can be
 * declared at several plan steps, and firing at an unarmed one would put an
 * effect where no provenance says it belongs. A call that cannot name its
 * step is not matched — the injector stays inert rather than guessing.
 */
export function matchesArmedTarget(
  armed: { operationRef: string; planStepId: string } | null,
  call: { operationRef: string; planStepId?: string | undefined },
): boolean {
  if (armed === null) return false;
  if (armed.operationRef !== call.operationRef) return false;
  return armed.planStepId === call.planStepId;
}

/**
 * First BD.6 live-qual arm point. This is a LOCAL durable-queue step, not a
 * remote mutation. tour-approval stays in the BD.2/BD.3 family.
 */
export function isOfflineQueueInjectionTarget(target: { planStepId: string }): boolean {
  return target.planStepId === "tap-input-confirm";
}

/**
 * Classify an injected-fault observation.
 *
 * This function must not accept `injectedFault` or `expectedClass`. The
 * orthogonal signatures are:
 *
 *   DEADLINE + ADAPTER_DEADLINE_ABORT → BACKEND_TIMEOUT
 *   TRANSPORT + HOST_TRANSPORT_CUT    → NETWORK_PARTITION
 *   NONE + LOCAL_QUEUE_PERSIST
 *     + PASS_QUEUED_OFFLINE
 *     + local queue evidence           → OFFLINE_QUEUED
 *
 * A planned fault with no effect, a mixed signature, a transport loss that
 * was not the injector, or a network cut without a LOCAL queue write stays
 * unclassified here.
 */
export function observeInjectedClass(input: {
  actionResult: string | null | undefined;
  provenance: FaultInjectionProvenance;
  productVerdict?: string | null;
  localQueueObserved?: boolean;
}): ObservedClass | null {
  const { actionResult, provenance, productVerdict, localQueueObserved } = input;
  if (provenance.phase !== "EFFECT_OBSERVED") return null;
  if (!provenance.actuallyFired) return null;
  if (
    productVerdict === "PASS_QUEUED_OFFLINE" &&
    localQueueObserved === true &&
    provenance.abortKind === "NONE" &&
    provenance.effectKind === "LOCAL_QUEUE_PERSIST"
  ) {
    return "OFFLINE_QUEUED";
  }
  if (actionResult !== "UNKNOWN_EFFECT") return null;
  if (provenance.abortKind === "DEADLINE" && provenance.effectKind === "ADAPTER_DEADLINE_ABORT") {
    return "BACKEND_TIMEOUT";
  }
  if (provenance.abortKind === "TRANSPORT" && provenance.effectKind === "HOST_TRANSPORT_CUT") {
    return "NETWORK_PARTITION";
  }
  return null;
}
