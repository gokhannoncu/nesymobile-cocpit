/**
 * ===========================================================================
 *  WorkflowIR v2 runtime validation  (Plan D.5.11 · D.6.12 · RUN_PLAY 4A.4)
 *
 *  A workflow arrives from a database row, an editor POST or a fixture file —
 *  never from a type-checked call site. So the type system is not the gate; this
 *  file is. It is deliberately fail-fast and deliberately exhaustive: every
 *  issue it reports is a class of run that would otherwise fail confusingly on
 *  a device, minutes later, with a stack trace pointing at the executor instead
 *  of the workflow.
 *
 *  Validation returns ALL issues rather than throwing on the first, because the
 *  consumer is a workflow editor that needs to underline every bad field at
 *  once, and each issue carries a JSON path for exactly that.
 * ===========================================================================
 */

import {
  CONDITION_OPERAND_SOURCES,
  sourceTakesPath,
  UNKNOWN_POLICIES,
  type UnknownPolicy,
} from "./condition.js";
import { findDomainLeakage } from "./domain-leakage.js";
import { ORACLE_OBLIGATIONS, ORACLE_TIMEOUT_ACTIONS, ORACLE_TIMINGS } from "./evidence-policy.js";
import {
  WORKFLOW_IR_VERSION,
  WORKFLOW_STEP_KINDS,
  type WorkflowIrV2,
  type WorkflowStepKind,
} from "./ir-v2.js";
import { EFFECT_CLASSES, validateExternalAction, type ExternalActionSpec } from "./remote-action.js";

export type WorkflowIrIssueCode =
  | "NOT_AN_OBJECT"
  | "MISSING_FIELD"
  | "INVALID_TYPE"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "UNKNOWN_STEP_KIND"
  | "DUPLICATE_STEP_ID"
  | "MISSING_STEP_REFERENCE"
  | "UNREACHABLE_STEP"
  | "INVALID_TIMEOUT"
  | "INVALID_DEADLINE"
  | "UNBOUNDED_LOOP"
  | "FIXED_WAIT_FORBIDDEN"
  | "UNSAFE_RETRY"
  | "UNSUPPORTED_CAPABILITY"
  | "MISSING_UNKNOWN_BRANCH"
  | "INVALID_UNKNOWN_POLICY"
  | "MISSING_SWITCH_DEFAULT"
  | "OVERLAPPING_BRANCHES"
  | "UNKNOWN_OPERAND_SOURCE"
  | "OPERAND_PATH_MISMATCH"
  | "UNDECLARED_VARIABLE"
  | "ORACLE_DUPLICATE_FACT"
  | "ORACLE_MISSING_DEADLINE"
  | "ORACLE_PARALLEL_LISTS"
  | "EXTERNAL_ACTION_INVALID"
  | "MISSING_SOURCE_MAP_ENTRY"
  | "DOMAIN_LEAKAGE";

export interface WorkflowIrIssue {
  /** JSON path into the document, e.g. `steps[2].timeoutMs`. */
  path: string;
  code: WorkflowIrIssueCode;
  message: string;
}

export interface ValidateOptions {
  /**
   * Capabilities the target device/bridge actually has.
   *
   * Carries B-13: on a Bridge v1 device `wait_any` and `cancel_request` are
   * absent, so a plan that *hard*-requires them must be rejected here rather
   * than half-executed there. Optional requirements pass and fall back.
   */
  availableCapabilities?: readonly string[];
}

const MAX_REASONABLE_MS = 24 * 60 * 60 * 1000;

/** The fields a fixed-wait primitive would have to hide in. */
const FORBIDDEN_WAIT_FIELDS = ["sleepMs", "waitMs", "delayMs", "sleep", "pauseMs"];

// ───────────────────────────────────────────────────────────────────────────
//  Public API
// ───────────────────────────────────────────────────────────────────────────

export type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: readonly WorkflowIrIssue[] };

/**
 * Validates an already-typed document.
 *
 * Used by fixtures and by code that built the IR in-process; untrusted input
 * should go through {@link parseWorkflowIrV2} instead.
 */
export function validateWorkflowIrV2(ir: WorkflowIrV2, options: ValidateOptions = {}): WorkflowIrIssue[] {
  return collectIssues(ir as unknown, options);
}

/**
 * Safe parse for untrusted input. Never throws.
 *
 * A throwing parser at an API boundary turns a malformed workflow into a 500
 * and loses the field paths the editor needs.
 */
export function parseWorkflowIrV2(input: unknown, options: ValidateOptions = {}): ParseResult<WorkflowIrV2> {
  const issues = collectIssues(input, options);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: input as WorkflowIrV2 };
}

/** Throwing wrapper for call sites where a bad IR is a programming error. */
export function assertWorkflowIrV2(input: unknown, options: ValidateOptions = {}): WorkflowIrV2 {
  const result = parseWorkflowIrV2(input, options);
  if (!result.ok) {
    throw new Error(
      `invalid WorkflowIR v2:\n${result.issues.map((i) => `  ${i.path}: [${i.code}] ${i.message}`).join("\n")}`,
    );
  }
  return result.value;
}

// ───────────────────────────────────────────────────────────────────────────
//  Implementation
// ───────────────────────────────────────────────────────────────────────────

interface Ctx {
  issues: WorkflowIrIssue[];
  options: ValidateOptions;
  stepIds: Set<string>;
  variableNames: Set<string>;
  sourceMapRefs: Set<string>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function collectIssues(input: unknown, options: ValidateOptions): WorkflowIrIssue[] {
  const issues: WorkflowIrIssue[] = [];

  if (!isObject(input)) {
    return [{ path: "$", code: "NOT_AN_OBJECT", message: "workflow IR must be an object" }];
  }

  if (input.schemaVersion !== WORKFLOW_IR_VERSION) {
    // Bail out immediately: running v2 structural checks over a v1 document
    // produces a wall of misleading errors instead of "migrate this first".
    return [
      {
        path: "schemaVersion",
        code: "UNSUPPORTED_SCHEMA_VERSION",
        message: `expected schemaVersion ${WORKFLOW_IR_VERSION}, got ${JSON.stringify(input.schemaVersion)}; run the legacy migration first`,
      },
    ];
  }

  const ctx: Ctx = {
    issues,
    options,
    stepIds: new Set(),
    variableNames: new Set(),
    sourceMapRefs: new Set(),
  };

  requireString(ctx, input.workflowId, "workflowId");
  requireString(ctx, input.name, "name");
  requirePositiveInt(ctx, input.workflowVersion, "workflowVersion", "INVALID_TYPE");

  validateRoot(ctx, input);
  return issues;
}

function validateRoot(ctx: Ctx, root: Record<string, unknown>): void {
  // Declarations first: later checks resolve variable and step references
  // against these sets, so ordering here is load-bearing.
  for (const [i, decl] of asArray(ctx, root.inputs, "inputs").entries()) {
    if (!isObject(decl)) continue;
    const name = decl.name;
    if (typeof name === "string") {
      ctx.variableNames.add(`run.input.${name}`);
      checkCoreVocabulary(ctx, name, `inputs[${i}].name`);
    }
  }

  for (const [i, decl] of asArray(ctx, root.variables, "variables").entries()) {
    if (!isObject(decl)) continue;
    const name = decl.name;
    if (typeof name === "string") {
      ctx.variableNames.add(name);
      checkCoreVocabulary(ctx, name, `variables[${i}].name`);
    }
  }

  for (const entry of asArray(ctx, root.sourceMap, "sourceMap")) {
    if (isObject(entry) && typeof entry.ref === "string") ctx.sourceMapRefs.add(entry.ref);
  }

  const steps = asArray(ctx, root.steps, "steps");
  for (const [i, step] of steps.entries()) {
    if (!isObject(step)) {
      push(ctx, `steps[${i}]`, "INVALID_TYPE", "step must be an object");
      continue;
    }
    const id = step.planStepId;
    if (typeof id !== "string" || id.trim() === "") {
      push(ctx, `steps[${i}].planStepId`, "MISSING_FIELD", "planStepId must be a non-empty string");
      continue;
    }
    if (ctx.stepIds.has(id)) {
      // Duplicate ids make every `next`/branch target ambiguous, and the
      // executor would silently pick one — usually the first, sometimes not.
      push(ctx, `steps[${i}].planStepId`, "DUPLICATE_STEP_ID", `duplicate planStepId "${id}"`);
      continue;
    }
    ctx.stepIds.add(id);
  }

  validatePolicies(ctx, root.policies);

  for (const [i, capability] of asArray(ctx, root.capabilityRequirements, "capabilityRequirements").entries()) {
    validateCapability(ctx, capability, `capabilityRequirements[${i}]`);
  }

  const entry = root.entryStepId;
  if (typeof entry !== "string" || !ctx.stepIds.has(entry)) {
    push(ctx, "entryStepId", "MISSING_STEP_REFERENCE", `entryStepId ${JSON.stringify(entry)} does not name a declared step`);
  }

  for (const [i, step] of steps.entries()) {
    if (isObject(step)) validateStep(ctx, step, `steps[${i}]`);
  }

  if (typeof entry === "string" && ctx.stepIds.has(entry)) {
    reportUnreachableSteps(ctx, steps, entry);
  }
}

function validatePolicies(ctx: Ctx, policies: unknown): void {
  if (!isObject(policies)) {
    push(ctx, "policies", "MISSING_FIELD", "policies is required");
    return;
  }
  requireDeadline(ctx, policies.runDeadlineMs, "policies.runDeadlineMs");
  requireDeadline(ctx, policies.cleanupDeadlineMs, "policies.cleanupDeadlineMs");
  validateRetry(ctx, policies.defaultRetry, "policies.defaultRetry");
  checkNoFixedWait(ctx, policies, "policies");
}

function validateRetry(ctx: Ctx, retry: unknown, path: string): void {
  if (!isObject(retry)) {
    push(ctx, path, "MISSING_FIELD", "retryPolicy is required");
    return;
  }
  const attempts = retry.maxAttempts;
  if (typeof attempts !== "number" || !Number.isInteger(attempts) || attempts < 1) {
    push(ctx, `${path}.maxAttempts`, "INVALID_TYPE", "maxAttempts must be an integer >= 1 (1 means no retry)");
  }
  const effect = retry.effectClass;
  if (typeof effect !== "string" || !EFFECT_CLASSES.includes(effect as never)) {
    push(ctx, `${path}.effectClass`, "INVALID_TYPE", `effectClass must be one of ${EFFECT_CLASSES.join(", ")}`);
    return;
  }
  // The rule that makes the effectClass field worth having: an author cannot
  // express "retry this mutation and hope it was not applied the first time".
  if (typeof attempts === "number" && attempts > 1) {
    if (effect === "NON_IDEMPOTENT_MUTATION") {
      push(ctx, `${path}.maxAttempts`, "UNSAFE_RETRY", "a NON_IDEMPOTENT_MUTATION cannot declare maxAttempts > 1; use a keyed external action instead");
    }
    if (effect === "UNKNOWN") {
      push(ctx, `${path}.maxAttempts`, "UNSAFE_RETRY", "an UNKNOWN effect class cannot be auto-retried; classify the effect first");
    }
  }
}

function validateCapability(ctx: Ctx, capability: unknown, path: string): void {
  if (!isObject(capability)) {
    push(ctx, path, "INVALID_TYPE", "capability requirement must be an object");
    return;
  }
  const name = capability.capability;
  if (typeof name !== "string" || name.trim() === "") {
    push(ctx, `${path}.capability`, "MISSING_FIELD", "capability must be a non-empty string");
    return;
  }
  checkCoreVocabulary(ctx, name, `${path}.capability`);
  if (typeof capability.optional !== "boolean") {
    // No default. A silent `optional: false` would reject every Bridge v1
    // device; a silent `true` would let a plan run without the thing it needs.
    push(ctx, `${path}.optional`, "MISSING_FIELD", "optional must be stated explicitly");
    return;
  }
  const available = ctx.options.availableCapabilities;
  if (available !== undefined && capability.optional === false && !available.includes(name)) {
    push(
      ctx,
      `${path}.capability`,
      "UNSUPPORTED_CAPABILITY",
      `capability "${name}" is required but unavailable on the target; mark it optional with a fallback (see B-13) or change the plan`,
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
//  Steps
// ───────────────────────────────────────────────────────────────────────────

function validateStep(ctx: Ctx, step: Record<string, unknown>, path: string): void {
  const kind = step.kind;
  if (typeof kind !== "string" || !WORKFLOW_STEP_KINDS.includes(kind as WorkflowStepKind)) {
    push(ctx, `${path}.kind`, "UNKNOWN_STEP_KIND", `unknown step kind ${JSON.stringify(kind)}`);
    return;
  }

  requireTimeout(ctx, step.timeoutMs, `${path}.timeoutMs`);
  validateRetry(ctx, step.retryPolicy, `${path}.retryPolicy`);
  checkNoFixedWait(ctx, step, path);

  const sourceMapRef = step.sourceMapRef;
  if (typeof sourceMapRef !== "string" || !ctx.sourceMapRefs.has(sourceMapRef)) {
    // Without this link a validation error cannot be pointed at anything a
    // human authored, which is the difference between a fixable error and a
    // mystery.
    push(ctx, `${path}.sourceMapRef`, "MISSING_SOURCE_MAP_ENTRY", `sourceMapRef ${JSON.stringify(sourceMapRef)} has no sourceMap entry`);
  }

  for (const [i, capability] of asArray(ctx, step.capabilityRequirements, `${path}.capabilityRequirements`).entries()) {
    validateCapability(ctx, capability, `${path}.capabilityRequirements[${i}]`);
  }

  checkStepRef(ctx, step.next, `${path}.next`, true);

  if (step.continueGate !== undefined) validateContinueGate(ctx, step.continueGate, `${path}.continueGate`);
  if (step.finalOraclePolicy !== undefined) validateFinalOracle(ctx, step.finalOraclePolicy, `${path}.finalOraclePolicy`);

  switch (kind as WorkflowStepKind) {
    case "SDK_QUERY": {
      requireString(ctx, step.queryRef, `${path}.queryRef`);
      requireString(ctx, step.outputVariable, `${path}.outputVariable`);
      const maxRows = step.maxRows;
      if (typeof maxRows !== "number" || !Number.isInteger(maxRows) || maxRows < 1) {
        push(ctx, `${path}.maxRows`, "INVALID_TYPE", "maxRows must be an integer >= 1; an unbounded query is an exfiltration primitive");
      }
      const bindings = step.outputFactBindings;
      if (bindings !== undefined) {
        if (!Array.isArray(bindings)) {
          push(ctx, `${path}.outputFactBindings`, "INVALID_TYPE", "outputFactBindings must be an array");
        } else {
          bindings.forEach((binding: unknown, index: number) => {
            const entry = binding as Record<string, unknown>;
            const at = `${path}.outputFactBindings[${index}]`;
            requireString(ctx, entry?.factKey, `${at}.factKey`);
            const from = entry?.from as Record<string, unknown> | undefined;
            if (from?.kind === "COLUMN") {
              requireString(ctx, from.column, `${at}.from.column`);
            } else if (from?.kind === "COLUMN_NOT_IN") {
              requireString(ctx, from.column, `${at}.from.column`);
              if (!Array.isArray(from.values) || from.values.length === 0 || from.values.some((value) => typeof value !== "string")) {
                push(ctx, `${at}.from.values`, "INVALID_TYPE", "from.values must be a non-empty string array");
              }
            } else if (from?.kind !== "ROWS_PRESENT") {
              push(
                ctx,
                `${at}.from`,
                "INVALID_TYPE",
                "from must be { kind: 'COLUMN', column }, { kind: 'ROWS_PRESENT' }, or { kind: 'COLUMN_NOT_IN', column, values }",
              );
            }
          });
        }
      }
      break;
    }
    case "RESOLVE_TARGET":
      requireString(ctx, step.targetRef, `${path}.targetRef`);
      requireString(ctx, step.outputVariable, `${path}.outputVariable`);
      break;
    case "BRIDGE_ACTION": {
      requireString(ctx, step.action, `${path}.action`);
      if (typeof step.action === "string") checkCoreVocabulary(ctx, step.action, `${path}.action`);
      break;
    }
    case "WAIT_ANY":
      validateWaitAny(ctx, step, path);
      break;
    case "ASSERT_FACT":
      requireString(ctx, step.factKey, `${path}.factKey`);
      if (typeof step.expected !== "boolean") {
        push(ctx, `${path}.expected`, "MISSING_FIELD", "expected must be a boolean");
      }
      requireUnknownPolicy(ctx, step.unknownPolicy, `${path}.unknownPolicy`);
      break;
    case "CONDITION":
      validateConditionStep(ctx, step, path);
      break;
    case "SWITCH":
      validateSwitchStep(ctx, step, path);
      break;
    case "FOR_EACH":
      validateForEachStep(ctx, step, path);
      break;
    case "WAIT_EVENT":
      validateWaitEventStep(ctx, step, path);
      break;
    case "REMOTE_ACTION":
    case "EXTERNAL_ACTION":
      validateActionSpec(ctx, step.spec, `${path}.spec`, true);
      break;
    case "CLEANUP":
      if (typeof step.runOnFailure !== "boolean") {
        push(ctx, `${path}.runOnFailure`, "MISSING_FIELD", "runOnFailure must be stated explicitly");
      }
      for (const [i, ref] of asArray(ctx, step.compensatesStepIds, `${path}.compensatesStepIds`).entries()) {
        checkStepRef(ctx, ref, `${path}.compensatesStepIds[${i}]`, false);
      }
      if (step.spec !== undefined) validateActionSpec(ctx, step.spec, `${path}.spec`, false);
      break;
    case "ANNOTATE":
      requireString(ctx, step.message, `${path}.message`);
      break;
    case "NOOP":
      break;
  }
}

function validateWaitAny(ctx: Ctx, step: Record<string, unknown>, path: string): void {
  const legs = asArray(ctx, step.legs, `${path}.legs`);
  const maxLegs = step.maxLegs;
  if (typeof maxLegs !== "number" || !Number.isInteger(maxLegs) || maxLegs < 1) {
    push(ctx, `${path}.maxLegs`, "UNBOUNDED_LOOP", "maxLegs must be an integer >= 1");
  } else if (legs.length > maxLegs) {
    push(ctx, `${path}.legs`, "UNBOUNDED_LOOP", `${legs.length} legs declared but maxLegs is ${maxLegs}`);
  }
  if (typeof step.hostOnlyCancel !== "boolean") {
    // B-13 made explicit: a Bridge v1 device cannot cancel a request, so the
    // plan must say out loud whose cancel it is relying on.
    push(ctx, `${path}.hostOnlyCancel`, "MISSING_FIELD", "hostOnlyCancel must be stated explicitly (Bridge v1 has no cancel_request — see B-13)");
  }
  for (const [i, leg] of legs.entries()) {
    if (!isObject(leg)) {
      push(ctx, `${path}.legs[${i}]`, "INVALID_TYPE", "leg must be an object");
      continue;
    }
    requireString(ctx, leg.legId, `${path}.legs[${i}].legId`);
    requireString(ctx, leg.factKey, `${path}.legs[${i}].factKey`);
    checkStepRef(ctx, leg.onWin, `${path}.legs[${i}].onWin`, true);
  }
}

function validateConditionStep(ctx: Ctx, step: Record<string, unknown>, path: string): void {
  validateConditionNode(ctx, step.condition, `${path}.condition`);
  checkStepRef(ctx, step.onTrue, `${path}.onTrue`, true);
  checkStepRef(ctx, step.onFalse, `${path}.onFalse`, true);
  const policy = requireUnknownPolicy(ctx, step.unknownPolicy, `${path}.unknownPolicy`);
  if (policy === "BRANCH") {
    // The rule from the acceptance list: UNKNOWN never advances without an
    // explicit policy, and "branch" without a branch is not a policy.
    if (!("onUnknown" in step)) {
      push(ctx, `${path}.onUnknown`, "MISSING_UNKNOWN_BRANCH", "unknownPolicy=BRANCH requires an onUnknown target");
    } else {
      checkStepRef(ctx, step.onUnknown, `${path}.onUnknown`, true);
    }
  }
}

function validateSwitchStep(ctx: Ctx, step: Record<string, unknown>, path: string): void {
  const branches = asArray(ctx, step.branches, `${path}.branches`);
  if (branches.length === 0) {
    push(ctx, `${path}.branches`, "MISSING_FIELD", "a SWITCH needs at least one branch");
  }
  const seen = new Set<string>();
  for (const [i, branch] of branches.entries()) {
    if (!isObject(branch)) {
      push(ctx, `${path}.branches[${i}]`, "INVALID_TYPE", "branch must be an object");
      continue;
    }
    const branchId = branch.branchId;
    if (typeof branchId !== "string" || branchId.trim() === "") {
      push(ctx, `${path}.branches[${i}].branchId`, "MISSING_FIELD", "branchId must be a non-empty string");
    } else if (seen.has(branchId)) {
      push(ctx, `${path}.branches[${i}].branchId`, "OVERLAPPING_BRANCHES", `duplicate branchId "${branchId}"`);
    } else {
      seen.add(branchId);
    }
    validateConditionNode(ctx, branch.condition, `${path}.branches[${i}].condition`);
    checkStepRef(ctx, branch.next, `${path}.branches[${i}].next`, true);
  }

  const fallback = step.default;
  if (!isObject(fallback)) {
    // Mandatory by design: an unmatched switch with no default is a silently
    // skipped step, and a skipped step reads as success in every report.
    push(ctx, `${path}.default`, "MISSING_SWITCH_DEFAULT", "a SWITCH must declare an explicit default policy");
  } else if (fallback.policy === "GOTO") {
    checkStepRef(ctx, fallback.next, `${path}.default.next`, true);
  } else if (fallback.policy !== "FAIL" && fallback.policy !== "OPERATOR_ATTENTION") {
    push(ctx, `${path}.default.policy`, "INVALID_TYPE", "default policy must be GOTO, FAIL or OPERATOR_ATTENTION");
  }

  requireUnknownPolicy(ctx, step.unknownPolicy, `${path}.unknownPolicy`);
}

function validateForEachStep(ctx: Ctx, step: Record<string, unknown>, path: string): void {
  requireString(ctx, step.itemsVariable, `${path}.itemsVariable`);
  if (typeof step.itemsVariable === "string" && ctx.variableNames.size > 0 && !ctx.variableNames.has(step.itemsVariable)) {
    push(ctx, `${path}.itemsVariable`, "UNDECLARED_VARIABLE", `variable "${step.itemsVariable}" is not declared in inputs or variables`);
  }
  requireString(ctx, step.itemVariable, `${path}.itemVariable`);
  requireString(ctx, step.indexVariable, `${path}.indexVariable`);
  checkStepRef(ctx, step.body, `${path}.body`, false);

  const maxIterations = step.maxIterations;
  if (typeof maxIterations !== "number" || !Number.isInteger(maxIterations) || maxIterations < 1) {
    // No default bound anywhere. "The list is usually short" is not a bound,
    // and a runaway loop over device-supplied data burns a device for hours.
    push(ctx, `${path}.maxIterations`, "UNBOUNDED_LOOP", "maxIterations must be an explicit integer >= 1");
  }

  const emptyPolicy = step.emptyPolicy;
  if (emptyPolicy !== "SKIP" && emptyPolicy !== "FAIL" && emptyPolicy !== "OPERATOR_ATTENTION") {
    push(ctx, `${path}.emptyPolicy`, "MISSING_FIELD", "emptyPolicy must be SKIP, FAIL or OPERATOR_ATTENTION; an empty collection is not implicitly a pass");
  }
}

function validateWaitEventStep(ctx: Ctx, step: Record<string, unknown>, path: string): void {
  requireString(ctx, step.factKey, `${path}.factKey`);
  if (typeof step.requireCorrelation !== "boolean") {
    push(ctx, `${path}.requireCorrelation`, "MISSING_FIELD", "requireCorrelation must be stated explicitly; an uncorrelated fact can close the wrong occurrence");
  }
  const onTimeout = step.onTimeout;
  if (onTimeout !== "FAIL" && onTimeout !== "INCONCLUSIVE" && onTimeout !== "CONTINUE") {
    push(ctx, `${path}.onTimeout`, "MISSING_FIELD", "onTimeout must be FAIL, INCONCLUSIVE or CONTINUE");
  }
  if (step.stableForMs !== undefined) requireTimeout(ctx, step.stableForMs, `${path}.stableForMs`);
}

function validateActionSpec(ctx: Ctx, spec: unknown, path: string, required: boolean): void {
  if (!isObject(spec)) {
    if (required) push(ctx, path, "MISSING_FIELD", "spec is required for an action step");
    return;
  }
  requireString(ctx, spec.adapterRef, `${path}.adapterRef`);
  requireString(ctx, spec.operationRef, `${path}.operationRef`);

  // Structural proof that no endpoint can hide in here. The check is on field
  // *names*, not values: adapterRef/operationRef are allowed to be domain
  // words, but `url` must not exist as a field at all.
  for (const forbidden of ["url", "endpoint", "method", "headers", "body", "host", "path", "script", "query"]) {
    if (forbidden in spec) {
      push(ctx, `${path}.${forbidden}`, "EXTERNAL_ACTION_INVALID", `"${forbidden}" is not part of the external action contract; an operation is named by operationRef, never described by transport`);
    }
  }

  const role = spec.role;
  if (role !== "SETUP" && role !== "VALIDATION" && role !== "TEARDOWN") {
    push(ctx, `${path}.role`, "INVALID_TYPE", "role must be SETUP, VALIDATION or TEARDOWN");
  }
  if (typeof spec.effectClass !== "string" || !EFFECT_CLASSES.includes(spec.effectClass as never)) {
    push(ctx, `${path}.effectClass`, "INVALID_TYPE", `effectClass must be one of ${EFFECT_CLASSES.join(", ")}`);
    return;
  }
  const timeoutPolicy = spec.timeoutPolicy;
  if (!isObject(timeoutPolicy)) {
    push(ctx, `${path}.timeoutPolicy`, "MISSING_FIELD", "timeoutPolicy is required");
    return;
  }
  requireTimeout(ctx, timeoutPolicy.timeoutMs, `${path}.timeoutPolicy.timeoutMs`);
  if (typeof timeoutPolicy.maxAttempts !== "number" || !Number.isInteger(timeoutPolicy.maxAttempts) || timeoutPolicy.maxAttempts < 1) {
    push(ctx, `${path}.timeoutPolicy.maxAttempts`, "INVALID_TYPE", "maxAttempts must be an integer >= 1");
    return;
  }
  if (!isObject(spec.auditPolicy)) {
    push(ctx, `${path}.auditPolicy`, "MISSING_FIELD", "auditPolicy is required");
    return;
  }
  if (!Array.isArray(spec.outputFactBindings)) {
    push(ctx, `${path}.outputFactBindings`, "MISSING_FIELD", "outputFactBindings must be an array (possibly empty)");
    return;
  }

  for (const violation of validateExternalAction(spec as unknown as ExternalActionSpec)) {
    push(ctx, path, "EXTERNAL_ACTION_INVALID", `[${violation.code}] ${violation.message}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
//  Policies
// ───────────────────────────────────────────────────────────────────────────

function validateContinueGate(ctx: Ctx, gate: unknown, path: string): void {
  if (!isObject(gate)) {
    push(ctx, path, "INVALID_TYPE", "continueGate must be an object");
    return;
  }
  requireDeadline(ctx, gate.deadlineMs, `${path}.deadlineMs`);
  if (gate.stableForMs !== undefined) requireTimeout(ctx, gate.stableForMs, `${path}.stableForMs`);

  const policy = requireUnknownPolicy(ctx, gate.unknownPolicy, `${path}.unknownPolicy`);
  if (policy === "BRANCH") {
    // A gate is not a branch point. Allowing BRANCH here would quietly turn
    // "not ready" into "go somewhere else" with no declared target.
    push(ctx, `${path}.unknownPolicy`, "INVALID_UNKNOWN_POLICY", "a Continue Gate has no branches; use FAIL, RETRY, OPERATOR_ATTENTION or INCONCLUSIVE");
  }

  const hasAny =
    Array.isArray(gate.allOf) && gate.allOf.length > 0
      ? true
      : Array.isArray(gate.anyOf) && gate.anyOf.length > 0
        ? true
        : Array.isArray(gate.noneOf) && gate.noneOf.length > 0;
  if (!hasAny) {
    // A gate with no facts is a pure deadline — which is a fixed wait wearing
    // a policy costume.
    push(ctx, path, "FIXED_WAIT_FORBIDDEN", "a Continue Gate must reference at least one fact; a deadline with no evidence expression is a fixed wait");
  }
  checkNoFixedWait(ctx, gate, path);
}

function validateFinalOracle(ctx: Ctx, policy: unknown, path: string): void {
  if (!isObject(policy)) {
    push(ctx, path, "INVALID_TYPE", "finalOraclePolicy must be an object");
    return;
  }

  // Refuse the pre-v2 shape outright rather than migrating it silently. A
  // reader that accepts both shapes has to pick one when they disagree, and
  // whichever it picks is somebody's silent downgrade.
  for (const legacyList of ["required", "eventual", "warning", "optional"]) {
    if (legacyList in policy) {
      push(
        ctx,
        `${path}.${legacyList}`,
        "ORACLE_PARALLEL_LISTS",
        `parallel "${legacyList}[]" lists are not part of the v2 contract; obligation and timing belong to one OracleRequirement (use migrateLegacyOracleLists)`,
      );
    }
  }

  const requirements = asArray(ctx, policy.requirements, `${path}.requirements`);
  const seenFacts = new Map<string, number>();

  for (const [i, requirement] of requirements.entries()) {
    const reqPath = `${path}.requirements[${i}]`;
    if (!isObject(requirement)) {
      push(ctx, reqPath, "INVALID_TYPE", "requirement must be an object");
      continue;
    }
    const factKey = requirement.factKey;
    if (typeof factKey !== "string" || factKey.trim() === "") {
      push(ctx, `${reqPath}.factKey`, "MISSING_FIELD", "factKey must be a non-empty string");
    } else {
      const previous = seenFacts.get(factKey);
      if (previous !== undefined) {
        // The same failure the parallel lists produced, now caught inside the
        // unified model: one fact, two truths.
        push(ctx, `${reqPath}.factKey`, "ORACLE_DUPLICATE_FACT", `fact "${factKey}" already has a requirement at index ${previous}; one fact carries exactly one obligation and timing`);
      } else {
        seenFacts.set(factKey, i);
      }
    }

    if (typeof requirement.obligation !== "string" || !ORACLE_OBLIGATIONS.includes(requirement.obligation as never)) {
      push(ctx, `${reqPath}.obligation`, "INVALID_TYPE", `obligation must be one of ${ORACLE_OBLIGATIONS.join(", ")}`);
    }
    if (typeof requirement.timing !== "string" || !ORACLE_TIMINGS.includes(requirement.timing as never)) {
      push(ctx, `${reqPath}.timing`, "INVALID_TYPE", `timing must be one of ${ORACLE_TIMINGS.join(", ")}`);
    }
    if (typeof requirement.onTimeout !== "string" || !ORACLE_TIMEOUT_ACTIONS.includes(requirement.onTimeout as never)) {
      push(ctx, `${reqPath}.onTimeout`, "INVALID_TYPE", `onTimeout must be one of ${ORACLE_TIMEOUT_ACTIONS.join(", ")}`);
    }
    if (requirement.timing === "EVENTUAL") {
      // An eventual requirement with no deadline never resolves, and a run that
      // waits forever is indistinguishable from a hung one.
      if (typeof requirement.deadlineMs !== "number") {
        push(ctx, `${reqPath}.deadlineMs`, "ORACLE_MISSING_DEADLINE", "an EVENTUAL requirement must carry a deadlineMs");
      } else {
        requireDeadline(ctx, requirement.deadlineMs, `${reqPath}.deadlineMs`);
      }
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
//  Conditions
// ───────────────────────────────────────────────────────────────────────────

function validateConditionNode(ctx: Ctx, node: unknown, path: string): void {
  if (!isObject(node)) {
    push(ctx, path, "INVALID_TYPE", "condition must be an object");
    return;
  }
  switch (node.kind) {
    case "and":
    case "or": {
      const operands = asArray(ctx, node.operands, `${path}.operands`);
      if (operands.length === 0) {
        push(ctx, `${path}.operands`, "MISSING_FIELD", `${node.kind} needs at least one operand`);
      }
      for (const [i, operand] of operands.entries()) validateConditionNode(ctx, operand, `${path}.operands[${i}]`);
      return;
    }
    case "not":
      validateConditionNode(ctx, node.operand, `${path}.operand`);
      return;
    case "existence":
      if (node.operator !== "exists" && node.operator !== "notExists") {
        push(ctx, `${path}.operator`, "INVALID_TYPE", "existence operator must be exists or notExists");
      }
      validateOperandRef(ctx, node.operand, `${path}.operand`);
      return;
    case "comparison": {
      const operators = [
        "equals",
        "notEquals",
        "contains",
        "notContains",
        "greaterThan",
        "lessThan",
        "in",
        "notIn",
        "matchesAllowlistedPattern",
      ];
      if (typeof node.operator !== "string" || !operators.includes(node.operator)) {
        push(ctx, `${path}.operator`, "INVALID_TYPE", `comparison operator must be one of ${operators.join(", ")}`);
      }
      validateConditionTerm(ctx, node.left, `${path}.left`);
      validateConditionTerm(ctx, node.right, `${path}.right`);
      return;
    }
    default:
      push(ctx, `${path}.kind`, "INVALID_TYPE", `unknown condition node kind ${JSON.stringify(node.kind)}`);
  }
}

function validateConditionTerm(ctx: Ctx, term: unknown, path: string): void {
  if (!isObject(term)) {
    push(ctx, path, "INVALID_TYPE", "condition term must be an object");
    return;
  }
  if (term.kind === "literal") {
    const value = term.value;
    if (value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      push(ctx, `${path}.value`, "INVALID_TYPE", "literal value must be a string, number, boolean or null");
    }
    return;
  }
  if (term.kind === "literalList") {
    const values = asArray(ctx, term.values, `${path}.values`);
    for (const [i, value] of values.entries()) {
      if (value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        push(ctx, `${path}.values[${i}]`, "INVALID_TYPE", "literal list values must be scalars");
      }
    }
    return;
  }
  if (term.kind === "operand") {
    validateOperandRef(ctx, term, path);
    return;
  }
  push(ctx, `${path}.kind`, "INVALID_TYPE", `unknown condition term kind ${JSON.stringify(term.kind)}`);
}

function validateOperandRef(ctx: Ctx, ref: unknown, path: string): void {
  if (!isObject(ref) || ref.kind !== "operand") {
    push(ctx, path, "INVALID_TYPE", "operand reference must be { kind: \"operand\", source, path? }");
    return;
  }
  const source = ref.source;
  if (typeof source !== "string" || !CONDITION_OPERAND_SOURCES.includes(source as never)) {
    // A closed namespace is the point: a typo must fail at authoring time
    // rather than evaluate to UNKNOWN on a device at 2am.
    push(ctx, `${path}.source`, "UNKNOWN_OPERAND_SOURCE", `operand source ${JSON.stringify(source)} is not in the allowlist: ${CONDITION_OPERAND_SOURCES.join(", ")}`);
    return;
  }
  const takesPath = sourceTakesPath(source as never);
  const hasPath = typeof ref.path === "string" && ref.path.trim() !== "";
  if (takesPath && !hasPath) {
    push(ctx, `${path}.path`, "OPERAND_PATH_MISMATCH", `source "${source}" addresses a namespace and requires a path`);
  }
  if (!takesPath && hasPath) {
    push(ctx, `${path}.path`, "OPERAND_PATH_MISMATCH", `source "${source}" is a single value and must not carry a path`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
//  Reachability
// ───────────────────────────────────────────────────────────────────────────

/**
 * Reports steps no control-flow edge can reach.
 *
 * An unreachable step is not harmless: it usually means a branch target was
 * renamed, so the run silently skips work it was written to do and still
 * reports green.
 */
function reportUnreachableSteps(ctx: Ctx, steps: readonly unknown[], entryStepId: string): void {
  const byId = new Map<string, Record<string, unknown>>();
  for (const step of steps) {
    if (isObject(step) && typeof step.planStepId === "string") byId.set(step.planStepId, step);
  }

  const reached = new Set<string>();
  const queue: string[] = [entryStepId];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined || reached.has(id)) continue;
    reached.add(id);
    const step = byId.get(id);
    if (step === undefined) continue;
    for (const target of outgoingTargets(step)) {
      if (target !== null && !reached.has(target)) queue.push(target);
    }
  }

  for (const [i, step] of steps.entries()) {
    if (!isObject(step) || typeof step.planStepId !== "string") continue;
    // Cleanup runs from the teardown path, not from the main flow, so it is
    // reachable by construction.
    if (step.kind === "CLEANUP") continue;
    if (!reached.has(step.planStepId)) {
      push(ctx, `steps[${i}].planStepId`, "UNREACHABLE_STEP", `step "${step.planStepId}" is not reachable from entryStepId`);
    }
  }
}

function outgoingTargets(step: Record<string, unknown>): (string | null)[] {
  const targets: (string | null)[] = [];
  const add = (value: unknown): void => {
    if (typeof value === "string" || value === null) targets.push(value);
  };
  add(step.next);
  add(step.onTrue);
  add(step.onFalse);
  add(step.onUnknown);
  add(step.body);
  for (const branch of Array.isArray(step.branches) ? step.branches : []) {
    if (isObject(branch)) add(branch.next);
  }
  for (const leg of Array.isArray(step.legs) ? step.legs : []) {
    if (isObject(leg)) add(leg.onWin);
  }
  if (isObject(step.default)) add(step.default.next);
  return targets;
}

// ───────────────────────────────────────────────────────────────────────────
//  Primitives
// ───────────────────────────────────────────────────────────────────────────

function push(ctx: Ctx, path: string, code: WorkflowIrIssueCode, message: string): void {
  ctx.issues.push({ path, code, message });
}

function asArray(ctx: Ctx, value: unknown, path: string): readonly unknown[] {
  if (Array.isArray(value)) return value;
  push(ctx, path, "MISSING_FIELD", `${path} must be an array`);
  return [];
}

function requireString(ctx: Ctx, value: unknown, path: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    push(ctx, path, "MISSING_FIELD", `${path} must be a non-empty string`);
  }
}

function requirePositiveInt(ctx: Ctx, value: unknown, path: string, code: WorkflowIrIssueCode): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    push(ctx, path, code, `${path} must be a positive integer`);
  }
}

function requireTimeout(ctx: Ctx, value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_REASONABLE_MS) {
    push(ctx, path, "INVALID_TIMEOUT", `${path} must be a positive number of milliseconds not exceeding ${MAX_REASONABLE_MS}`);
  }
}

function requireDeadline(ctx: Ctx, value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_REASONABLE_MS) {
    push(ctx, path, "INVALID_DEADLINE", `${path} must be a positive number of milliseconds not exceeding ${MAX_REASONABLE_MS}`);
  }
}

function requireUnknownPolicy(ctx: Ctx, value: unknown, path: string): UnknownPolicy | null {
  if (typeof value !== "string" || !UNKNOWN_POLICIES.includes(value as UnknownPolicy)) {
    push(ctx, path, "INVALID_UNKNOWN_POLICY", `${path} must be one of ${UNKNOWN_POLICIES.join(", ")}; UNKNOWN never advances without an explicit policy`);
    return null;
  }
  return value as UnknownPolicy;
}

function checkStepRef(ctx: Ctx, value: unknown, path: string, nullable: boolean): void {
  if (value === null) {
    if (!nullable) push(ctx, path, "MISSING_STEP_REFERENCE", `${path} must name a step`);
    return;
  }
  if (value === undefined) {
    push(ctx, path, "MISSING_STEP_REFERENCE", `${path} is required (use null to end the flow)`);
    return;
  }
  if (typeof value !== "string" || !ctx.stepIds.has(value)) {
    push(ctx, path, "MISSING_STEP_REFERENCE", `${path} references unknown step ${JSON.stringify(value)}`);
  }
}

/**
 * Rejects any field that would reintroduce a fixed wait.
 *
 * Checking field *names* rather than values is intentional: the ban is on the
 * concept, and a `sleepMs: 0` today becomes `sleepMs: 15000` in the next PR.
 */
function checkNoFixedWait(ctx: Ctx, node: Record<string, unknown>, path: string): void {
  for (const field of FORBIDDEN_WAIT_FIELDS) {
    if (field in node) {
      push(ctx, `${path}.${field}`, "FIXED_WAIT_FORBIDDEN", `"${field}" is a fixed wait; deadlines are upper bounds on event-driven evaluation, not sleeps`);
    }
  }
}

/**
 * Guards Core's own vocabulary against business words.
 *
 * Applied only to Core-level identifiers — variable names, capability ids,
 * bridge verbs. Domain-Pack-owned opaque refs (`factKey`, `queryRef`,
 * `adapterRef`, `operationRef`, `targetRef`) are exempt by design: they are the
 * seam where business language is supposed to live.
 */
function checkCoreVocabulary(ctx: Ctx, text: string, path: string): void {
  for (const hit of findDomainLeakage(text, path)) {
    push(ctx, path, "DOMAIN_LEAKAGE", `"${hit.token}" is business vocabulary and cannot appear in a Core identifier; carry it in a Domain Pack ref instead`);
  }
}
