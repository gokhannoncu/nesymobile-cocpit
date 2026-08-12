import type {
  EvidencePolicy,
  FinalOraclePolicy,
  OracleRequirement,
  ProductVerdict,
  EvaluationFailureClass,
  ContinueGateOutcome,
  FinalOracleOutcome,
} from "@nesy/workflow-contract";
import { evaluateEvidenceExpression } from "@nesy/workflow-contract";

export type EvidencePlane = "UI" | "APP" | "LOCAL" | "REMOTE";
export type EvidenceAuthority = "PRIMARY" | "CONFIRMATORY" | "FALLBACK";
export type EvidenceDeliveryLane = "RECEIPT_SAFE" | "ORDERED_REQUIRED";
export type NormalizedFactValue = boolean | "UNKNOWN" | "NOT_APPLICABLE";

export interface NormalizedEvidenceFact {
  factKey: string;
  occurrenceId: string;
  iterationKey: string;
  observedAtMs: number;
  freshnessMaxAgeMs: number;
  plane: EvidencePlane;
  subtype: string;
  value: NormalizedFactValue;
  authority: EvidenceAuthority;
  deliveryLane: EvidenceDeliveryLane;
  rawEventId?: string;
  reducerTrace?: readonly string[];
  /**
   * The business identity this observation is ABOUT — a shipment id, an approval
   * request code, the stop the app says is active.
   *
   * Carried so a `CORRELATED_ALL_OF` derivation can check that its inputs describe
   * the same thing. Without it "the backend approved a tour" and "the courier
   * requested one" combine into a conclusion about no particular tour, which is
   * the exact mistake `requiresCorrelation` exists to prevent — so a derivation
   * that needs correlation refuses to fire when this is absent rather than
   * assuming the inputs match.
   */
  correlationValue?: string;
}

export interface RawEvidenceEvent {
  rawEventId: string;
  occurrenceId: string;
  iterationKey: string;
  observedAtMs: number;
  source: EvidencePlane;
  subtype: string;
  factKey: string;
  value: NormalizedFactValue;
  authority: EvidenceAuthority;
  deliveryLane: EvidenceDeliveryLane;
  reducerTrace: readonly string[];
}

export interface ContinueGateEvaluationInput {
  policy: EvidencePolicy;
  facts: readonly NormalizedEvidenceFact[];
  occurrenceId: string;
  iterationKey: string;
  nowMs: number;
  startedAtMs: number;
}

export interface ContinueGateEvaluation {
  outcome: ContinueGateOutcome;
  completedAtMs?: number;
  evidenceRefs: readonly string[];
  reason: string;
}

export type RequirementEvaluationState =
  | "SATISFIED"
  | "VIOLATED"
  | "PENDING"
  | "REQUIRED_TIMEOUT"
  | "WARNING_TIMEOUT"
  | "NOT_APPLICABLE"
  | "NOT_MEASURED"
  | "EVIDENCE_CONFLICT"
  | "STALE"
  | "WRONG_OCCURRENCE";

export interface RequirementEvaluation {
  factKey: string;
  state: RequirementEvaluationState;
  requirement: OracleRequirement;
  evidenceRefs: readonly string[];
}

export interface FinalOracleEvaluationInput {
  policy: FinalOraclePolicy;
  facts: readonly NormalizedEvidenceFact[];
  occurrenceId: string;
  iterationKey: string;
  nowMs: number;
  startedAtMs: number;
}

export interface FinalOracleEvaluation {
  outcome: FinalOracleOutcome;
  productVerdict: ProductVerdict;
  evaluationFailureClass: EvaluationFailureClass;
  requirementsByFact: Readonly<Record<string, RequirementEvaluation>>;
  evidenceRefs: readonly string[];
}

export interface DerivedFactNode {
  factKey: string;
  dependsOn: readonly string[];
}

export function normalizeEvidence(events: readonly RawEvidenceEvent[]): readonly NormalizedEvidenceFact[] {
  return events.map((event) => ({
    factKey: event.factKey,
    occurrenceId: event.occurrenceId,
    iterationKey: event.iterationKey,
    observedAtMs: event.observedAtMs,
    freshnessMaxAgeMs: 30_000,
    plane: event.source,
    subtype: event.subtype,
    value: event.value,
    authority: event.authority,
    deliveryLane: event.deliveryLane,
    rawEventId: event.rawEventId,
    reducerTrace: [...event.reducerTrace],
  }));
}

export function evaluateContinueGate(input: ContinueGateEvaluationInput): ContinueGateEvaluation {
  const factsByKey = factMap(input.facts, input);
  const evidenceRefs = [...factsByKey.keys()].sort();
  const allOf = input.policy.allOf ?? [];
  const anyOf = input.policy.anyOf ?? [];
  const noneOf = input.policy.noneOf ?? [];

  const allSatisfied = allOf.every((factKey) => factsByKey.get(factKey)?.value === true);
  const anySatisfied = anyOf.length === 0 || anyOf.some((factKey) => factsByKey.get(factKey)?.value === true);
  const noneSatisfied = noneOf.every((factKey) => factsByKey.get(factKey)?.value !== true);

  if (allSatisfied && anySatisfied && noneSatisfied) {
    return {
      outcome: "SATISFIED",
      completedAtMs: input.nowMs,
      evidenceRefs,
      reason: "continue gate satisfied by current receipt-safe facts",
    };
  }

  const timedOut = input.nowMs - input.startedAtMs >= input.policy.deadlineMs;
  return {
    outcome: timedOut ? "TIMED_OUT" : "UNKNOWN",
    evidenceRefs,
    reason: timedOut ? "continue gate deadline elapsed without required facts" : "continue gate still waiting for facts",
  };
}

export function evaluateFinalOracle(input: FinalOracleEvaluationInput): FinalOracleEvaluation {
  const requirementsByFact: Record<string, RequirementEvaluation> = {};
  const evidenceRefs = new Set<string>();
  let hasConflict = false;
  let hasFailure = false;
  let hasMissingRequired = false;
  let hasQueueOfflinePass = false;

  for (const requirement of input.policy.requirements) {
    const matchingFacts = factsForRequirement(input.facts, requirement.factKey, input).filter(
      (fact) =>
        fact.authority === "PRIMARY" &&
        fact.deliveryLane === "ORDERED_REQUIRED" &&
        (requirement.timing !== "EVENTUAL" ||
          fact.observedAtMs < input.startedAtMs + (requirement.deadlineMs ?? 0)),
    );
    for (const fact of matchingFacts) evidenceRefs.add(fact.factKey);

    const evaluation = evaluateRequirement(requirement, matchingFacts, input);
    requirementsByFact[requirement.factKey] = evaluation;

    if (evaluation.state === "EVIDENCE_CONFLICT" && requirement.obligation === "REQUIRED") hasConflict = true;
    if (evaluation.state === "VIOLATED" && requirement.obligation === "REQUIRED") hasFailure = true;
    if (evaluation.state === "PENDING" && requirement.obligation === "REQUIRED") hasMissingRequired = true;
    if (evaluation.state === "REQUIRED_TIMEOUT") {
      if (requirement.onTimeout === "FAIL") hasFailure = true;
      else if (requirement.onTimeout === "INCONCLUSIVE") hasMissingRequired = true;
    }
    if (
      evaluation.state === "SATISFIED" &&
      matchingFacts.some((fact) => fact.plane === "LOCAL" && fact.subtype === "queue" && fact.value === true)
    ) {
      hasQueueOfflinePass = true;
    }
  }

  if (input.policy.completionExpression) {
    const completion = evaluateEvidenceExpression(input.policy.completionExpression, (factKey) => {
      const state = requirementsByFact[factKey]?.state;
      if (state === "SATISFIED" || state === "NOT_APPLICABLE") return "TRUE";
      if (state === "VIOLATED") return "FALSE";
      return "UNKNOWN";
    });
    if (completion === "FALSE") hasFailure = true;
    if (completion === "UNKNOWN") hasMissingRequired = true;
  }

  if (hasConflict || hasMissingRequired) {
    return {
      outcome: "INCONCLUSIVE",
      productVerdict: "INCONCLUSIVE",
      evaluationFailureClass: "EVIDENCE_INSUFFICIENT",
      requirementsByFact,
      evidenceRefs: [...evidenceRefs].sort(),
    };
  }

  if (hasFailure) {
    return {
      outcome: "VIOLATED",
      productVerdict: "FAIL_PRODUCT",
      evaluationFailureClass: "NONE",
      requirementsByFact,
      evidenceRefs: [...evidenceRefs].sort(),
    };
  }

  return {
    outcome: "SATISFIED",
    productVerdict: hasQueueOfflinePass ? "PASS_QUEUED_OFFLINE" : "PASS_ONLINE",
    evaluationFailureClass: "NONE",
    requirementsByFact,
    evidenceRefs: [...evidenceRefs].sort(),
  };
}

export function detectDerivedFactCycles(graph: readonly DerivedFactNode[]): readonly string[] {
  const byKey = new Map(graph.map((node) => [node.factKey, node]));
  const cycles = new Set<string>();
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(factKey: string, path: readonly string[]): void {
    if (visiting.has(factKey)) {
      const start = path.indexOf(factKey);
      cycles.add([...path.slice(start), factKey].join(" -> "));
      return;
    }
    if (visited.has(factKey)) return;

    const node = byKey.get(factKey);
    if (node === undefined) return;

    visiting.add(factKey);
    for (const dependency of node.dependsOn) {
      visit(dependency, [...path, factKey]);
    }
    visiting.delete(factKey);
    visited.add(factKey);
  }

  for (const node of graph) {
    visit(node.factKey, []);
  }
  return [...cycles].sort();
}

export function replayDerivedFacts(
  graph: readonly DerivedFactNode[],
  observedFactKeys: readonly string[],
): readonly string[] {
  if (detectDerivedFactCycles(graph).length > 0) {
    throw new Error("derived fact graph contains a cycle");
  }

  const known = new Set(observedFactKeys);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of graph) {
      if (!known.has(node.factKey) && node.dependsOn.every((factKey) => known.has(factKey))) {
        known.add(node.factKey);
        changed = true;
      }
    }
  }

  return [...known].sort();
}

function evaluateRequirement(
  requirement: OracleRequirement,
  facts: readonly NormalizedEvidenceFact[],
  input: FinalOracleEvaluationInput,
): RequirementEvaluation {
  if (requirement.applicabilityCondition) {
    const applicability = evaluateEvidenceExpression(requirement.applicabilityCondition, (factKey) => {
      const applicableFacts = factsForRequirement(input.facts, factKey, input);
      const values = new Set(
        applicableFacts
          .filter(
            (fact) =>
              fact.authority === "PRIMARY" &&
              fact.deliveryLane === "ORDERED_REQUIRED",
          )
          .map((fact) => fact.value),
      );
      if (values.has(true) && values.has(false)) return "UNKNOWN";
      if (values.has(true)) return "TRUE";
      if (values.has(false)) return "FALSE";
      return "UNKNOWN";
    });
    if (applicability === "FALSE") {
      return {
        factKey: requirement.factKey,
        state: "NOT_APPLICABLE",
        requirement,
        evidenceRefs: [],
      };
    }
    if (applicability === "UNKNOWN") {
      return {
        factKey: requirement.factKey,
        state: "PENDING",
        requirement,
        evidenceRefs: [],
      };
    }
  }

  if (requirement.obligation === "NOT_APPLICABLE") {
    return {
      factKey: requirement.factKey,
      state: "NOT_APPLICABLE",
      requirement,
      evidenceRefs: [],
    };
  }

  const values = new Set(facts.map((fact) => fact.value));
  if (values.has(true) && values.has(false)) {
    return {
      factKey: requirement.factKey,
      state: "EVIDENCE_CONFLICT",
      requirement,
      evidenceRefs: facts.map((fact) => fact.factKey),
    };
  }

  if (values.has(false)) {
    return {
      factKey: requirement.factKey,
      state: "VIOLATED",
      requirement,
      evidenceRefs: facts.map((fact) => fact.factKey),
    };
  }

  if (values.has(true)) {
    return {
      factKey: requirement.factKey,
      state: "SATISFIED",
      requirement,
      evidenceRefs: facts.map((fact) => fact.factKey),
    };
  }

  const deadlineMs = requirement.deadlineMs ?? 0;
  const timedOut =
    requirement.timing === "IMMEDIATE" ||
    input.nowMs - input.startedAtMs >= deadlineMs;
  if (timedOut && requirement.obligation === "REQUIRED") {
    return {
      factKey: requirement.factKey,
      state: "REQUIRED_TIMEOUT",
      requirement,
      evidenceRefs: [],
    };
  }

  if (timedOut && requirement.obligation === "WARNING") {
    return {
      factKey: requirement.factKey,
      state: "WARNING_TIMEOUT",
      requirement,
      evidenceRefs: [],
    };
  }

  return {
    factKey: requirement.factKey,
    state: requirement.obligation === "OPTIONAL" ? "NOT_MEASURED" : "PENDING",
    requirement,
    evidenceRefs: [],
  };
}

function factsForRequirement(
  facts: readonly NormalizedEvidenceFact[],
  factKey: string,
  input: Pick<FinalOracleEvaluationInput, "occurrenceId" | "iterationKey" | "nowMs">,
): readonly NormalizedEvidenceFact[] {
  return facts.filter(
    (fact) =>
      fact.factKey === factKey &&
      fact.occurrenceId === input.occurrenceId &&
      fact.iterationKey === input.iterationKey &&
      input.nowMs >= fact.observedAtMs &&
      input.nowMs - fact.observedAtMs <= fact.freshnessMaxAgeMs,
  );
}

function factMap(
  facts: readonly NormalizedEvidenceFact[],
  input: Pick<ContinueGateEvaluationInput, "occurrenceId" | "iterationKey" | "nowMs" | "policy">,
): Map<string, NormalizedEvidenceFact> {
  const map = new Map<string, NormalizedEvidenceFact>();
  for (const fact of facts) {
    if (
      fact.occurrenceId === input.occurrenceId &&
      fact.iterationKey === input.iterationKey &&
      fact.deliveryLane === "RECEIPT_SAFE" &&
      input.nowMs >= fact.observedAtMs &&
      input.nowMs - fact.observedAtMs >= (input.policy.stableForMs ?? 0) &&
      input.nowMs - fact.observedAtMs <= fact.freshnessMaxAgeMs
    ) {
      const existing = map.get(fact.factKey);
      map.set(
        fact.factKey,
        existing !== undefined && existing.value !== fact.value
          ? { ...fact, value: "UNKNOWN" }
          : fact,
      );
    }
  }
  return map;
}
