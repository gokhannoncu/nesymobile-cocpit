/**
 * ===========================================================================
 *  Evidence Source Registry and normalized fact derivation  (D.6E · 4B.9)
 *
 *  Only the CP4B-Core contract slice lives here. The normalization RUNTIME —
 *  the thing that actually watches a device and reduces observations — is Phase
 *  5. What this file fixes is the vocabulary, so the runtime cannot be built
 *  around a broken idea of what evidence is.
 *
 *  Four decisions worth their justification:
 *
 *    FOUR PLANES, NOT SIX. `UI`, `APP`, `LOCAL`, `REMOTE`. An offline queue is
 *    NOT its own plane — it is a `LOCAL` source kind; SDK state is NOT its own
 *    plane — it is an `APP` source kind. Inventing a plane per mechanism means
 *    every new mechanism forces a Core change, and the plane axis stops being
 *    an answer to "who observed this?".
 *
 *    HTTP 2xx IS NOT A BUSINESS FACT. A network operation that only carries
 *    transport success cannot be `PRIMARY` authority and cannot bind a business
 *    fact directly. It must feed a derived fact that also reads an entity status
 *    and a correlation. This is enforced, because "the call returned 200" is the
 *    single most common way a test proves nothing while going green.
 *
 *    RAW EVIDENCE IS PRESERVED. Normalization produces a NEW fact and never
 *    replaces its inputs. Six months later the question is always "what did the
 *    device actually report?", and a reducer that overwrote its input cannot
 *    answer it.
 *
 *    DERIVATION IS A DAG WITH A TRACE. Cycles, self-reference and undefined
 *    inputs are rejected; every derived fact records which reducer, which
 *    version and which inputs produced it.
 * ===========================================================================
 */

/** Who observed the evidence. Four planes, closed union — see the header. */
export type EvidencePlane = "UI" | "APP" | "LOCAL" | "REMOTE";

export const EVIDENCE_PLANES: readonly EvidencePlane[] = ["UI", "APP", "LOCAL", "REMOTE"];

/**
 * Mechanisms that must NOT become planes.
 *
 * Kept as data so the validator can reject a pack that tries, which is more
 * durable than a design note.
 */
export const FORBIDDEN_EVIDENCE_PLANES: readonly string[] = ["QUEUE", "APP_STATE", "OFFLINE", "NETWORK", "DB"];

/**
 * How the evidence is obtained.
 *
 * Each kind is legal on specific planes only ({@link ALLOWED_SOURCE_KINDS_BY_PLANE}):
 * a `BRIDGE_WATCH` is by definition a UI observation, and a `DATABASE_VERIFIER`
 * reading the device's own store is `LOCAL` while one reading a backend store is
 * `REMOTE`. Letting any kind sit on any plane would make the plane field
 * decorative.
 */
export type EvidenceSourceKind =
  | "BRIDGE_WATCH"
  | "SDK_EVENT"
  | "SDK_STATE"
  | "NAMED_QUERY"
  | "OFFLINE_QUEUE_WATCH"
  | "DATABASE_VERIFIER"
  | "NETWORK_OPERATION"
  | "REMOTE_VALIDATOR"
  | "DERIVED_FACT";

export const EVIDENCE_SOURCE_KINDS: readonly EvidenceSourceKind[] = [
  "BRIDGE_WATCH",
  "SDK_EVENT",
  "SDK_STATE",
  "NAMED_QUERY",
  "OFFLINE_QUEUE_WATCH",
  "DATABASE_VERIFIER",
  "NETWORK_OPERATION",
  "REMOTE_VALIDATOR",
  "DERIVED_FACT",
];

/** Which source kinds each plane may carry. */
export const ALLOWED_SOURCE_KINDS_BY_PLANE: Readonly<Record<EvidencePlane, readonly EvidenceSourceKind[]>> = {
  UI: ["BRIDGE_WATCH", "DERIVED_FACT"],
  APP: ["SDK_EVENT", "SDK_STATE", "NAMED_QUERY", "DERIVED_FACT"],
  LOCAL: ["OFFLINE_QUEUE_WATCH", "DATABASE_VERIFIER", "NAMED_QUERY", "DERIVED_FACT"],
  REMOTE: ["NETWORK_OPERATION", "REMOTE_VALIDATOR", "DATABASE_VERIFIER", "DERIVED_FACT"],
};

/**
 * How much weight the fact carries.
 *
 * `PRIMARY` is the only authority allowed to settle a business question alone.
 * `CONFIRMATORY` strengthens an existing conclusion; `FALLBACK` is used when the
 * primary source is unavailable and marks the resulting verdict as weaker.
 */
export type EvidenceAuthority = "PRIMARY" | "CONFIRMATORY" | "FALLBACK";

export const EVIDENCE_AUTHORITIES: readonly EvidenceAuthority[] = ["PRIMARY", "CONFIRMATORY", "FALLBACK"];

/** How long an observation stays usable. */
export interface FreshnessPolicy {
  maxAgeMs: number;
  onStale: "REOBSERVE" | "TREAT_AS_UNKNOWN" | "FAIL";
}

/**
 * What must line up for an observation to belong to this occurrence.
 *
 * `requireEntityMatch` is the guard against a late fact from item 3 closing
 * item 7; `requireOccurrenceMatch` is the guard against a fact from a previous
 * attempt closing the retry.
 */
export interface CorrelationPolicy {
  requireEntityMatch: boolean;
  requireOccurrenceMatch: boolean;
  /** Correlation id paths inside the raw observation. */
  correlationPaths: readonly string[];
  /** Whether the source may be correlated across planes. */
  crossPlane: boolean;
}

export interface EvidenceRedactionPolicy {
  redactPaths: readonly string[];
  hashPaths?: readonly string[];
  /** True for sources whose payload is entirely sensitive (e.g. auth tokens). */
  redactWholePayload?: boolean;
}

/**
 * One raw evidence source.
 *
 * `transportSuccessOnly` is the field that makes the HTTP-2xx rule mechanical:
 * a source that admits it can only see transport success is refused `PRIMARY`
 * authority and refused a direct business fact binding by
 * {@link validateEvidenceSource}.
 */
export interface EvidenceSourceDefinition {
  /** Namespaced source key, e.g. "nesy.remote.delivery-status". */
  sourceKey: string;
  plane: EvidencePlane;
  kind: EvidenceSourceKind;
  authority: EvidenceAuthority;
  displayName: string;
  /**
   * Normalized fact key this source can settle directly.
   *
   * Absent for sources that only feed derived facts.
   */
  factKey?: string;
  /** Opaque observation ref: a watch key, a query id, an operation id. */
  observationRef: string;
  freshness: FreshnessPolicy;
  correlation: CorrelationPolicy;
  redaction: EvidenceRedactionPolicy;
  /**
   * True when the source can only observe transport-level success.
   *
   * A `NETWORK_OPERATION` that does not read a business entity status must
   * declare this.
   */
  transportSuccessOnly?: boolean;
  /**
   * Whether the raw observation is archived verbatim (subject to redaction).
   *
   * Must be true: a normalized fact without its raw input is unauditable.
   */
  preservesRawEvidence: boolean;
  requiredCapabilityRefs: readonly string[];
}

// ───────────────────────────────────────────────────────────────────────────
//  Derived facts
// ───────────────────────────────────────────────────────────────────────────

/**
 * Declarative reducers only.
 *
 * There is no `CUSTOM` member and no expression string. A pack that could ship a
 * reducer body would be shipping code the Cockpit host executes, and §RUNTIME
 * CODE in `manifest.ts` forbids that. Every business combination the reference
 * pack needs is expressible with these.
 */
export type DerivedFactReducerKind =
  | "ALL_OF"
  | "ANY_OF"
  | "NONE_OF"
  | "COUNT_AT_LEAST"
  | "ENTITY_STATUS_EQUALS"
  | "CORRELATED_ALL_OF"
  | "TRANSITION_OBSERVED";

export const DERIVED_FACT_REDUCER_KINDS: readonly DerivedFactReducerKind[] = [
  "ALL_OF",
  "ANY_OF",
  "NONE_OF",
  "COUNT_AT_LEAST",
  "ENTITY_STATUS_EQUALS",
  "CORRELATED_ALL_OF",
  "TRANSITION_OBSERVED",
];

/**
 * Which reducer produced a derived fact, and from what.
 *
 * This is the derivation trace. Without `inputFactKeys` recorded alongside the
 * result, a normalized fact is an assertion with no provenance — and the first
 * disputed verdict has no way to be re-litigated.
 */
export interface ReducerProvenance {
  reducerKind: DerivedFactReducerKind;
  /** Reducer implementation version, so a fixed reducer is distinguishable. */
  reducerVersion: number;
  inputFactKeys: readonly string[];
  /** Reducer parameters, e.g. `{ atLeast: 2 }` or `{ status: "APPROVED" }`. */
  parameters?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * One normalized fact derived from other facts.
 *
 * `preserveInputs` is not configurable to `false` in practice — validation
 * requires it — but it is explicit so the guarantee is visible in the authored
 * document rather than implied by the runtime.
 */
export interface DerivedFactDefinition {
  /** The fact this derivation produces. */
  factKey: string;
  plane: EvidencePlane;
  authority: EvidenceAuthority;
  displayName: string;
  provenance: ReducerProvenance;
  /** Raw inputs are archived, never replaced by the derived result. */
  preserveInputs: boolean;
  /**
   * Whether the derivation requires correlated inputs.
   *
   * True is mandatory for cross-plane business conclusions: "the backend says
   * approved" plus "the app requested approval" is only evidence if the two
   * refer to the same request.
   */
  requiresCorrelation: boolean;
}

/** The pack's whole derivation graph. */
export interface DerivedFactGraph {
  facts: readonly DerivedFactDefinition[];
}

// ───────────────────────────────────────────────────────────────────────────
//  Validation
// ───────────────────────────────────────────────────────────────────────────

export interface EvidenceViolation {
  code:
    | "FORBIDDEN_PLANE"
    | "SOURCE_KIND_PLANE_MISMATCH"
    | "TRANSPORT_SUCCESS_AS_BUSINESS_FACT"
    | "TRANSPORT_SUCCESS_PRIMARY"
    | "RAW_EVIDENCE_DISCARDED"
    | "DERIVED_FACT_SELF_REFERENCE"
    | "DERIVED_FACT_CYCLE"
    | "DERIVED_FACT_UNDEFINED_INPUT"
    | "DERIVED_FACT_NO_INPUTS"
    | "DERIVED_INPUTS_NOT_PRESERVED"
    | "CROSS_PLANE_WITHOUT_CORRELATION"
    | "INVALID_AUTHORITY";
  message: string;
}

/** Validates one raw evidence source. */
export function validateEvidenceSource(source: EvidenceSourceDefinition, path: string): EvidenceViolation[] {
  const violations: EvidenceViolation[] = [];

  if (!EVIDENCE_PLANES.includes(source.plane)) {
    violations.push({
      code: "FORBIDDEN_PLANE",
      message: `${path}.plane: "${String(source.plane)}" is not an evidence plane; queue/app-state/network are source kinds within a plane, not planes`,
    });
    return violations;
  }

  const allowed = ALLOWED_SOURCE_KINDS_BY_PLANE[source.plane];
  if (!allowed.includes(source.kind)) {
    violations.push({
      code: "SOURCE_KIND_PLANE_MISMATCH",
      message: `${path}.kind: ${source.kind} is not observable on the ${source.plane} plane (allowed: ${allowed.join(", ")})`,
    });
  }

  if (source.transportSuccessOnly === true) {
    // The whole point: transport success is not a business truth. It may only
    // feed a derived fact that also reads an entity status.
    if (source.factKey !== undefined) {
      violations.push({
        code: "TRANSPORT_SUCCESS_AS_BUSINESS_FACT",
        message: `${path}: source only observes transport success (HTTP 2xx) and cannot bind business fact "${source.factKey}"; feed an ENTITY_STATUS_EQUALS derived fact instead`,
      });
    }
    if (source.authority === "PRIMARY") {
      violations.push({
        code: "TRANSPORT_SUCCESS_PRIMARY",
        message: `${path}.authority: a transport-success-only source cannot be PRIMARY authority`,
      });
    }
  }

  if (!source.preservesRawEvidence) {
    violations.push({
      code: "RAW_EVIDENCE_DISCARDED",
      message: `${path}.preservesRawEvidence must be true; a normalized fact without its raw observation is unauditable`,
    });
  }

  if (!EVIDENCE_AUTHORITIES.includes(source.authority)) {
    violations.push({
      code: "INVALID_AUTHORITY",
      message: `${path}.authority: "${String(source.authority)}" is not an evidence authority`,
    });
  }

  return violations;
}

/**
 * Validates the derivation graph: DAG shape, defined inputs, preserved raws.
 *
 * `knownFactKeys` are the facts settled by raw sources. A derived fact whose
 * input is neither a raw fact nor another derived fact is a typo that would
 * otherwise evaluate to permanent UNKNOWN — a gate that never closes, reported
 * as a timeout somewhere far away.
 */
export function validateDerivedFactGraph(
  graph: DerivedFactGraph,
  knownFactKeys: readonly string[],
  path: string,
): EvidenceViolation[] {
  const violations: EvidenceViolation[] = [];
  const derivedByKey = new Map<string, DerivedFactDefinition>();
  for (const fact of graph.facts) derivedByKey.set(fact.factKey, fact);
  const raw = new Set(knownFactKeys);

  for (const [index, fact] of graph.facts.entries()) {
    const factPath = `${path}.facts[${index}]`;

    if (fact.provenance.inputFactKeys.length === 0) {
      violations.push({
        code: "DERIVED_FACT_NO_INPUTS",
        message: `${factPath}: derived fact "${fact.factKey}" has no inputs; a derivation from nothing is an assertion, not evidence`,
      });
    }

    if (fact.provenance.inputFactKeys.includes(fact.factKey)) {
      violations.push({
        code: "DERIVED_FACT_SELF_REFERENCE",
        message: `${factPath}: derived fact "${fact.factKey}" reads itself`,
      });
    }

    for (const input of fact.provenance.inputFactKeys) {
      if (!raw.has(input) && !derivedByKey.has(input)) {
        violations.push({
          code: "DERIVED_FACT_UNDEFINED_INPUT",
          message: `${factPath}: input "${input}" of "${fact.factKey}" is not produced by any evidence source or derivation`,
        });
      }
    }

    if (!fact.preserveInputs) {
      violations.push({
        code: "DERIVED_INPUTS_NOT_PRESERVED",
        message: `${factPath}.preserveInputs must be true; normalization adds a fact, it never replaces its raw inputs`,
      });
    }
  }

  violations.push(...findDerivationCycles(derivedByKey, path));
  return violations;
}

/**
 * Depth-first cycle detection over the derivation graph.
 *
 * A cycle is not a theoretical concern: two facts that confirm each other are a
 * plausible authoring mistake ("delivery confirmed" from "queue drained" from
 * "delivery confirmed"), and a runtime evaluating it would either loop or
 * silently settle on UNKNOWN.
 */
function findDerivationCycles(
  derivedByKey: ReadonlyMap<string, DerivedFactDefinition>,
  path: string,
): EvidenceViolation[] {
  const violations: EvidenceViolation[] = [];
  const state = new Map<string, "VISITING" | "DONE">();
  const reported = new Set<string>();

  const visit = (key: string, stack: readonly string[]): void => {
    const current = state.get(key);
    if (current === "DONE") return;
    if (current === "VISITING") {
      const cycle = [...stack.slice(stack.indexOf(key)), key].join(" -> ");
      if (!reported.has(cycle)) {
        reported.add(cycle);
        violations.push({
          code: "DERIVED_FACT_CYCLE",
          message: `${path}: derivation cycle ${cycle}`,
        });
      }
      return;
    }
    state.set(key, "VISITING");
    for (const input of derivedByKey.get(key)?.provenance.inputFactKeys ?? []) {
      if (derivedByKey.has(input)) visit(input, [...stack, key]);
    }
    state.set(key, "DONE");
  };

  for (const key of derivedByKey.keys()) visit(key, []);
  return violations;
}
