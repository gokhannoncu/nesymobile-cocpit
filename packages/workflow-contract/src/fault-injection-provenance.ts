/**
 * G90.10 — injector provenance.
 *
 * `injectedFault` is the planned input. These fields record whether the
 * injector actually ran, independently of the class the observer later writes.
 *
 *   requested        start accepted the fault plan
 *   armed            a qualifying step became the trigger point
 *   triggered        the injector took control of that step
 *   effect observed  the runtime saw the injected effect
 *
 * A row that is only `requested` is G90.9 metadata. D60 evidence begins at
 * `triggered` and is only classified after `effect observed`.
 */

export const FAULT_INJECTION_PHASES = [
  "REQUESTED",
  "ARMED",
  "TRIGGERED",
  "EFFECT_OBSERVED",
] as const;

export type FaultInjectionPhase = (typeof FAULT_INJECTION_PHASES)[number];

export const OBSERVED_ABORT_KINDS = ["DEADLINE", "TRANSPORT", "NONE"] as const;

export type ObservedAbortKind = (typeof OBSERVED_ABORT_KINDS)[number];

export const FAULT_EFFECT_KINDS = ["ADAPTER_DEADLINE_ABORT", "HOST_TRANSPORT_CUT"] as const;

export type FaultEffectKind = (typeof FAULT_EFFECT_KINDS)[number];

export interface FaultInjectionProvenance {
  phase: FaultInjectionPhase | null;
  requestedAtMs: number | null;
  armedAtMs: number | null;
  triggeredAtMs: number | null;
  effectObservedAtMs: number | null;
  triggerPoint: string | null;
  occurrenceId: string | null;
  actuallyFired: boolean;
  abortKind: ObservedAbortKind;
  effectKind: FaultEffectKind | null;
  declaredTimeoutMs: number | null;
  injectedTimeoutMs: number | null;
}

export function emptyFaultInjectionProvenance(): FaultInjectionProvenance {
  return {
    phase: null,
    requestedAtMs: null,
    armedAtMs: null,
    triggeredAtMs: null,
    effectObservedAtMs: null,
    triggerPoint: null,
    occurrenceId: null,
    actuallyFired: false,
    abortKind: "NONE",
    effectKind: null,
    declaredTimeoutMs: null,
    injectedTimeoutMs: null,
  };
}

const PHASE_RANK: Record<FaultInjectionPhase, number> = {
  REQUESTED: 1,
  ARMED: 2,
  TRIGGERED: 3,
  EFFECT_OBSERVED: 4,
};

export function advanceFaultInjectionPhase(
  current: FaultInjectionPhase | null,
  next: FaultInjectionPhase,
): FaultInjectionPhase {
  if (current === null) return next;
  return PHASE_RANK[next] >= PHASE_RANK[current] ? next : current;
}

export function isFaultInjectionPhase(value: unknown): value is FaultInjectionPhase {
  return typeof value === "string" && (FAULT_INJECTION_PHASES as readonly string[]).includes(value);
}

/**
 * Pick the provenance that actually advanced. Classification still reads the
 * observation, not `injectedFault` — this only chooses which recorded effect
 * to show the observer when a run owns more than one inert session.
 */
export function selectObservedFaultProvenance(
  ...candidates: readonly FaultInjectionProvenance[]
): FaultInjectionProvenance {
  if (candidates.length === 0) return emptyFaultInjectionProvenance();
  return candidates.reduce((best, next) => {
    const bestRank = best.phase === null ? 0 : PHASE_RANK[best.phase];
    const nextRank = next.phase === null ? 0 : PHASE_RANK[next.phase];
    if (nextRank > bestRank) return next;
    if (nextRank === bestRank && next.actuallyFired && !best.actuallyFired) return next;
    return best;
  });
}
