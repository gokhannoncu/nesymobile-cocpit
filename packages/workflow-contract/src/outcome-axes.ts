/**
 * ===========================================================================
 *  Orthogonal outcome axes  (Plan B.8 · D.5.23 · D.5.24)
 *
 *  A single `PASSED | FAILED` enum cannot answer four different questions at
 *  once: where is the run right now, what did the product do, why did it stop,
 *  and did we clean up after ourselves. Collapsing them is not a cosmetic
 *  problem — it actively produces wrong reports:
 *
 *    - a lost worker gets filed as a product bug,
 *    - a failed teardown turns a genuine PASS red,
 *    - "we never got enough evidence" is indistinguishable from "the feature
 *      is broken", so nobody investigates the missing evidence.
 *
 *  So each question is its own persisted axis, and the invariants that tie
 *  them together are enforced here rather than re-derived at every call site.
 * ===========================================================================
 */

/** Where the run is in its own machine. Not a verdict. */
export type RunLifecycleState =
  | "PENDING"
  | "QUEUED"
  | "PREFLIGHT"
  | "AUTHENTICATING"
  | "COMPILING"
  | "RUNNING"
  | "WAITING_EVIDENCE"
  | "RECOVERING_HOST"
  | "RECOVERING_BRIDGE"
  | "RECOVERING_DEVICE"
  | "CLEANING_UP"
  | "CLOSED";

export const RUN_LIFECYCLE_STATES: readonly RunLifecycleState[] = [
  "PENDING",
  "QUEUED",
  "PREFLIGHT",
  "AUTHENTICATING",
  "COMPILING",
  "RUNNING",
  "WAITING_EVIDENCE",
  "RECOVERING_HOST",
  "RECOVERING_BRIDGE",
  "RECOVERING_DEVICE",
  "CLEANING_UP",
  "CLOSED",
];

/**
 * What the product under test did. Only the Final Oracle writes this.
 *
 * `PASS_QUEUED_OFFLINE` is separate from `PASS_ONLINE` because "the app did
 * the right thing and queued it" and "the backend confirmed it" are different
 * guarantees; merging them hides offline regressions behind a green badge.
 */
export type ProductVerdict =
  | "NOT_EVALUATED"
  | "PASS_ONLINE"
  | "PASS_QUEUED_OFFLINE"
  | "FAIL_PRODUCT"
  | "INCONCLUSIVE";

export const PRODUCT_VERDICTS: readonly ProductVerdict[] = [
  "NOT_EVALUATED",
  "PASS_ONLINE",
  "PASS_QUEUED_OFFLINE",
  "FAIL_PRODUCT",
  "INCONCLUSIVE",
];

/**
 * Why the evaluation itself could not produce a product verdict.
 *
 * This axis exists so that a broken emulator or a missing fact never gets
 * reported to the product team as a defect.
 *
 * `ENVIRONMENT_FAILURE` is the persisted name. The D30 histogram reports the
 * same family as `ENV_FAILURE` via `toD30HistogramClass`.
 *
 * D60 adds a separate pair of axes (`injectedFault` / `observedClass`) in
 * `injected-fault.ts`. Do not fold those into this enum.
 */
export type EvaluationFailureClass =
  | "NONE"
  | "AUTOMATION_FAILURE"
  | "ENVIRONMENT_FAILURE"
  | "EVIDENCE_INSUFFICIENT";

/** Why the run stopped. `CANCELLED` is a reason, never a verdict. */
export type RunTerminationReason =
  | "NOT_TERMINATED"
  | "COMPLETED"
  | "CANCELLED"
  | "ABORTED"
  | "PROCESS_CRASH"
  | "DEVICE_DISCONNECTED"
  | "UNKNOWN_ACTION_EFFECT"
  | "STUCK";

/**
 * Teardown result. Never overwrites {@link ProductVerdict}.
 *
 * `NOT_REQUIRED` is terminal and means the executed path owed no teardown —
 * typically a success path that ends before a `runOnFailure` CLEANUP. It is
 * not `NOT_STARTED`, which says a teardown was owed and never began.
 */
export type WorkflowCleanupResult =
  | "NOT_STARTED"
  | "PENDING"
  | "NOT_REQUIRED"
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED";

/**
 * Exclusive resource handback result.
 *
 * Kept apart from cleanup: a workflow can clean its own business state and
 * still leak a leased device or account, and only the second one blocks the
 * next run.
 */
export type ResourceReleaseResult =
  | "NOT_REQUIRED"
  | "PENDING"
  | "RELEASED"
  | "PARTIAL"
  | "LEAKED";

/**
 * Scheduler-side fate of the run. `WORKER_LOST` lives here and nowhere else —
 * it is infrastructure news, not a statement about the product.
 */
export type SchedulerDisposition =
  | "NOT_SCHEDULED"
  | "SCHEDULED"
  | "LEASED"
  | "REQUEUED"
  | "WORKER_LOST"
  | "RELEASED";

/** Does a human need to look at this run, independent of its verdict? */
export type OperationalDisposition = "OK" | "NEEDS_ATTENTION";

// ───────────────────────────────────────────────────────────────────────────
//  Step-level axes
// ───────────────────────────────────────────────────────────────────────────

/**
 * Did the physical/logical action happen?
 *
 * `UNKNOWN_EFFECT` is first-class and deliberately not foldable into `FAILED`:
 * an action whose response was lost may well have taken effect, and retrying
 * it would double the effect. Mirrors `@nesy/bridge-contract`'s terminal
 * states at the IR level without importing transport concerns.
 */
export type StepActionOutcome =
  | "NOT_STARTED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "REJECTED"
  | "UNKNOWN_EFFECT"
  | "CANCELLED"
  | "SKIPPED";

/** Could the executor move on? Readiness only — never a business verdict. */
export type ContinueGateOutcome =
  | "NOT_EVALUATED"
  | "SATISFIED"
  | "UNSATISFIED"
  | "TIMED_OUT"
  | "UNKNOWN"
  | "SKIPPED";

/** Final business ruling for one occurrence. */
export type FinalOracleOutcome =
  | "NOT_EVALUATED"
  | "PENDING"
  | "SATISFIED"
  | "VIOLATED"
  | "INCONCLUSIVE"
  | "NOT_APPLICABLE";

/**
 * A step occurrence is four independent facts, not one `status` column.
 *
 * The pre-v2 model had exactly one column, which is why "UI tapped fine but
 * the business event never came" had to be squeezed into `failed` with a
 * prose message — unqueryable, and impossible to distinguish from a crash.
 */
export interface StepOutcomeAxes {
  actionResult: StepActionOutcome;
  continueGateResult: ContinueGateOutcome;
  finalOracleResult: FinalOracleOutcome;
  cleanupResult: WorkflowCleanupResult;
}

/** The full run-level outcome tuple, persisted axis by axis. */
export interface RunOutcomeAxes {
  lifecycle: RunLifecycleState;
  productVerdict: ProductVerdict;
  evaluationFailureClass: EvaluationFailureClass;
  terminationReason: RunTerminationReason;
  cleanupResult: WorkflowCleanupResult;
  resourceReleaseResult: ResourceReleaseResult;
  schedulerDisposition: SchedulerDisposition;
  operationalDisposition: OperationalDisposition;
}

/** A rejected axis combination, with the invariant that rejected it. */
export interface OutcomeAxesViolation {
  invariant: string;
  message: string;
}

const TERMINAL_CLEANUP: readonly WorkflowCleanupResult[] = [
  "NOT_REQUIRED",
  "SUCCEEDED",
  "PARTIAL",
  "FAILED",
];

const PASSING_VERDICTS: readonly ProductVerdict[] = ["PASS_ONLINE", "PASS_QUEUED_OFFLINE"];

/** True when the product verdict counts as a business success. */
export function isPassingVerdict(verdict: ProductVerdict): boolean {
  return PASSING_VERDICTS.includes(verdict);
}

/**
 * Checks the B.8 binding invariants over one axis tuple.
 *
 * Returns every violation rather than throwing on the first: a caller writing
 * a run row wants the whole list, not a game of whack-a-mole.
 */
export function validateRunOutcomeAxes(axes: RunOutcomeAxes): OutcomeAxesViolation[] {
  const violations: OutcomeAxesViolation[] = [];

  // B.8.3 — CLOSED means teardown actually reached a terminal state. A run
  // closed with cleanup still PENDING silently abandons leased resources.
  if (axes.lifecycle === "CLOSED" && !TERMINAL_CLEANUP.includes(axes.cleanupResult)) {
    violations.push({
      invariant: "B.8.3",
      message: `lifecycle CLOSED requires a terminal cleanupResult, got "${axes.cleanupResult}"`,
    });
  }

  // B.8.1/B.8.2 — cleanup never rewrites the verdict; it raises attention.
  if (isPassingVerdict(axes.productVerdict) && axes.cleanupResult === "FAILED" && axes.operationalDisposition !== "NEEDS_ATTENTION") {
    violations.push({
      invariant: "B.8.2",
      message: "cleanup FAILED on a passing run must surface as NEEDS_ATTENTION, not as a verdict change",
    });
  }

  if (axes.resourceReleaseResult === "LEAKED" && axes.operationalDisposition !== "NEEDS_ATTENTION") {
    violations.push({
      invariant: "B.8.2",
      message: "a LEAKED resource must surface as NEEDS_ATTENTION",
    });
  }

  // B.8.4 — a cancelled/aborted run must not invent a business ruling for
  // occurrences that were never evaluated.
  if ((axes.terminationReason === "CANCELLED" || axes.terminationReason === "ABORTED") && isPassingVerdict(axes.productVerdict)) {
    violations.push({
      invariant: "B.8.4",
      message: `termination "${axes.terminationReason}" cannot carry a passing product verdict`,
    });
  }

  // Infrastructure loss is not a product defect.
  if (axes.schedulerDisposition === "WORKER_LOST" && axes.productVerdict === "FAIL_PRODUCT") {
    violations.push({
      invariant: "B.8.4",
      message: "WORKER_LOST is a scheduler disposition; it cannot produce FAIL_PRODUCT",
    });
  }

  if (axes.productVerdict === "FAIL_PRODUCT" && axes.evaluationFailureClass !== "NONE") {
    violations.push({
      invariant: "B.8.1",
      message: `FAIL_PRODUCT requires evaluationFailureClass "NONE", got "${axes.evaluationFailureClass}" — an environment or automation failure is not a product bug`,
    });
  }

  if (axes.evaluationFailureClass === "EVIDENCE_INSUFFICIENT" && axes.productVerdict !== "INCONCLUSIVE" && axes.productVerdict !== "NOT_EVALUATED") {
    violations.push({
      invariant: "B.8.1",
      message: `EVIDENCE_INSUFFICIENT cannot yield product verdict "${axes.productVerdict}"`,
    });
  }

  return violations;
}

/** Throwing wrapper for call sites that treat a bad tuple as a defect. */
export function assertRunOutcomeAxes(axes: RunOutcomeAxes): void {
  const violations = validateRunOutcomeAxes(axes);
  if (violations.length > 0) {
    throw new Error(
      `invalid run outcome axes:\n${violations.map((v) => `  [${v.invariant}] ${v.message}`).join("\n")}`,
    );
  }
}
