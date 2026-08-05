/**
 * ===========================================================================
 *  Occurrence / iteration / entity / event correlation  (Plan B.9 · D.5.20)
 *
 *  The failure this file exists to prevent: a fact arrives, some step is
 *  waiting for "that kind of fact", and the step accepts it. In a FOR_EACH
 *  over twenty items the late fact of item 3 will happily close item 7, and
 *  the run goes green on evidence that belongs to a different occurrence.
 *
 *  So every fact and every step occurrence carries the same typed coordinate,
 *  and matching is an explicit, testable predicate rather than "we were
 *  waiting, something came".
 *
 *  DOMAIN-NEUTRAL: `entityRef` is an opaque type/id pair. Core never learns
 *  what those strings mean.
 * ===========================================================================
 */

/**
 * Position inside (possibly nested) loops.
 *
 * A flat index cannot address `FOR_EACH` inside `FOR_EACH`; the path is
 * ordered outermost-first so it also sorts deterministically.
 */
export type IterationPath = readonly IterationSegment[];

export interface IterationSegment {
  /** `planStepId` of the FOR_EACH that produced this level. */
  loopStepId: string;
  /** Zero-based index within that loop. */
  index: number;
}

/**
 * An opaque reference to a business entity.
 *
 * Core stores and compares it; Core never interprets it. `type` is a Domain
 * Pack registry key, not a Verdict Core union — that is exactly why it is a
 * plain string here.
 */
export interface EntityRef {
  type: string;
  id: string;
}

/**
 * The full coordinate of one step occurrence.
 *
 * `attempt` is separate from `occurrenceId` on purpose: retry 2 of item 5 is
 * the same occurrence with new evidence, and folding the two would make
 * "did this retry help?" unanswerable.
 */
export interface OccurrenceCorrelation {
  workflowRunId: string;
  stepId: string;
  occurrenceId: string;
  attempt: number;
  iterationPath: IterationPath;
  entityRef?: EntityRef;
  /** Bridge/host request that carried the action, when there was one. */
  requestId?: string;
  /** Monotonic device event sequence at the time of the observation. */
  eventSeq?: number;
  /** Accessibility tree generation the observation was taken from. */
  treeGen?: number;
  /** Back-reference into {@link WorkflowSourceMap}. */
  sourceMapRef?: string;
}

/** Half-open sequence window an occurrence is allowed to consume facts from. */
export interface EventSeqRange {
  fromSeq: number;
  toSeq: number | null;
}

/** Serializes an iteration path to a stable, sortable, greppable string. */
export function formatIterationPath(path: IterationPath): string {
  if (path.length === 0) return "/";
  return path.map((s) => `/${s.loopStepId}[${s.index}]`).join("");
}

export function iterationPathsEqual(a: IterationPath, b: IterationPath): boolean {
  if (a.length !== b.length) return false;
  return a.every((seg, i) => {
    const other = b[i];
    return other !== undefined && other.loopStepId === seg.loopStepId && other.index === seg.index;
  });
}

export function entityRefsEqual(a: EntityRef | undefined, b: EntityRef | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.type === b.type && a.id === b.id;
}

/** Why a fact was refused for an occurrence. Persisted, never swallowed. */
export type CorrelationMismatchReason =
  | "RUN_MISMATCH"
  | "STEP_MISMATCH"
  | "OCCURRENCE_MISMATCH"
  | "ITERATION_MISMATCH"
  | "ENTITY_MISMATCH"
  | "REQUEST_MISMATCH"
  | "SEQ_OUT_OF_RANGE";

export interface CorrelationMatch {
  matched: boolean;
  reason?: CorrelationMismatchReason;
}

const MATCHED: CorrelationMatch = { matched: true };

/**
 * Decides whether an observed correlation may satisfy a waiting occurrence.
 *
 * Deliberately strict and deliberately ordered: the first mismatch wins so the
 * recorded reason is the most specific one available. An absent field on the
 * observation is *not* treated as a wildcard for run/step/occurrence — a fact
 * that cannot prove which occurrence it belongs to must not close one.
 */
export function correlationMatches(
  expected: OccurrenceCorrelation,
  observed: Partial<OccurrenceCorrelation>,
  options: { seqRange?: EventSeqRange } = {},
): CorrelationMatch {
  if (observed.workflowRunId !== undefined && observed.workflowRunId !== expected.workflowRunId) {
    return { matched: false, reason: "RUN_MISMATCH" };
  }
  if (observed.stepId !== undefined && observed.stepId !== expected.stepId) {
    return { matched: false, reason: "STEP_MISMATCH" };
  }
  if (observed.occurrenceId !== undefined && observed.occurrenceId !== expected.occurrenceId) {
    return { matched: false, reason: "OCCURRENCE_MISMATCH" };
  }
  if (observed.iterationPath !== undefined && !iterationPathsEqual(observed.iterationPath, expected.iterationPath)) {
    return { matched: false, reason: "ITERATION_MISMATCH" };
  }
  // An entity-bound occurrence only accepts facts about that entity. Facts
  // with no entity at all stay acceptable — plenty of UI evidence is not
  // entity-scoped — but a fact naming a *different* entity is always stale.
  if (observed.entityRef !== undefined && expected.entityRef !== undefined && !entityRefsEqual(observed.entityRef, expected.entityRef)) {
    return { matched: false, reason: "ENTITY_MISMATCH" };
  }
  if (observed.requestId !== undefined && expected.requestId !== undefined && observed.requestId !== expected.requestId) {
    return { matched: false, reason: "REQUEST_MISMATCH" };
  }

  const range = options.seqRange;
  if (range !== undefined && observed.eventSeq !== undefined) {
    if (observed.eventSeq < range.fromSeq) return { matched: false, reason: "SEQ_OUT_OF_RANGE" };
    if (range.toSeq !== null && observed.eventSeq > range.toSeq) {
      return { matched: false, reason: "SEQ_OUT_OF_RANGE" };
    }
  }

  return MATCHED;
}

/**
 * Builds the deterministic occurrence id for a step at an iteration path.
 *
 * Determinism matters for resume: after a host restart the same step at the
 * same path must reclaim its own evidence instead of opening a fresh
 * occurrence and waiting forever for facts that already arrived.
 */
export function deriveOccurrenceId(workflowRunId: string, stepId: string, iterationPath: IterationPath): string {
  return `${workflowRunId}::${stepId}${formatIterationPath(iterationPath)}`;
}
