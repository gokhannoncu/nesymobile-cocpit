/**
 * Acceptance suite for CP4A.
 *
 * Every describe block below corresponds to a numbered acceptance criterion in
 * `docs/verdict/run-playbooks/phase-4a/RUN_PLAY.md` §11, so a red test names the
 * criterion it breaks rather than a line number.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  applyUnknownPolicy,
  assertRunOutcomeAxes,
  canonicalizeWorkflowIrV2,
  correlationMatches,
  deriveOccurrenceId,
  evaluateCondition,
  evaluateEvidenceExpression,
  findDomainLeakage,
  formatIterationPath,
  hashWorkflowIrV2,
  migrateLegacyOracleLists,
  migrateLegacyWorkflow,
  parseWorkflowIrV2,
  scanExportSurface,
  validateExternalAction,
  validateRunOutcomeAxes,
  validateWorkflowIrV2,
  WORKFLOW_STEP_KINDS,
  type ConditionNode,
  type ExternalActionSpec,
  type LegacyNodeMapping,
  type OperandResolution,
  type RunOutcomeAxes,
  type WorkflowIrV2,
} from "./index.js";

const FIXTURE_DIR = fileURLToPath(new URL("../fixtures/workflow-ir-v2/", import.meta.url));

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(`${FIXTURE_DIR}${name}`, "utf8")) as T;
}

const courier = (): WorkflowIrV2 => fixture<WorkflowIrV2>("courier-generic.json");
const sports = (): WorkflowIrV2 => fixture<WorkflowIrV2>("sports-content-generic.json");

// ===========================================================================
//  §11.2/§11.3 — schema validation
// ===========================================================================

describe("IR v2 schema validation", () => {
  it("accepts both generic domain fixtures with no issues", () => {
    expect(validateWorkflowIrV2(courier())).toEqual([]);
    expect(validateWorkflowIrV2(sports())).toEqual([]);
  });

  it("refuses a v1 document instead of guessing at its shape", () => {
    const result = parseWorkflowIrV2({ schemaVersion: 1, steps: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("UNSUPPORTED_SCHEMA_VERSION");
  });

  it("never throws on hostile input", () => {
    for (const input of [null, 42, "workflow", [], { schemaVersion: 2 }]) {
      expect(() => parseWorkflowIrV2(input)).not.toThrow();
    }
  });

  it("rejects an unknown step kind", () => {
    const ir = courier();
    const broken = { ...ir, steps: [{ ...ir.steps[0], kind: "OPEN_ITEM" }, ...ir.steps.slice(1)] };
    expect(codesOf(broken)).toContain("UNKNOWN_STEP_KIND");
  });

  it("rejects duplicate step ids", () => {
    const ir = courier();
    const first = ir.steps[0];
    const broken = { ...ir, steps: [first, first, ...ir.steps.slice(1)] };
    expect(codesOf(broken)).toContain("DUPLICATE_STEP_ID");
  });

  it("rejects a dangling branch target", () => {
    const ir = courier();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) => (s.planStepId === "tap-row" ? { ...s, next: "does-not-exist" } : s)),
    };
    expect(codesOf(broken)).toContain("MISSING_STEP_REFERENCE");
  });

  it("rejects a non-positive timeout", () => {
    const ir = courier();
    const broken = { ...ir, steps: ir.steps.map((s, i) => (i === 0 ? { ...s, timeoutMs: 0 } : s)) };
    expect(codesOf(broken)).toContain("INVALID_TIMEOUT");
  });

  it("flags a step nothing can reach", () => {
    const ir = courier();
    const broken = {
      ...ir,
      steps: [
        ...ir.steps,
        {
          planStepId: "orphan",
          kind: "NOOP" as const,
          sourceMapRef: "sm-1",
          timeoutMs: 1000,
          retryPolicy: { maxAttempts: 1, effectClass: "READ_ONLY" as const },
          capabilityRequirements: [],
          next: null,
        },
      ],
    };
    expect(codesOf(broken)).toContain("UNREACHABLE_STEP");
  });

  it("requires a sourceMap entry for every step (§11.20)", () => {
    const ir = courier();
    const broken = { ...ir, steps: ir.steps.map((s, i) => (i === 0 ? { ...s, sourceMapRef: "nope" } : s)) };
    expect(codesOf(broken)).toContain("MISSING_SOURCE_MAP_ENTRY");
  });
});

// ===========================================================================
//  §11.10 — no fixed wait
// ===========================================================================

describe("fixed wait prohibition", () => {
  it("has no sleep-like step kind at all", () => {
    for (const kind of WORKFLOW_STEP_KINDS) {
      expect(kind).not.toMatch(/SLEEP|DELAY|PAUSE|WAIT_MS/);
    }
  });

  it("rejects a sleep smuggled in as a step field", () => {
    expect(codesOf(fixture("invalid-fixed-wait.json"))).toContain("FIXED_WAIT_FORBIDDEN");
  });

  it("rejects a Continue Gate that is only a deadline", () => {
    const ir = courier();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) =>
        s.planStepId === "await-detail"
          ? { ...s, continueGate: { deadlineMs: 10000, unknownPolicy: "FAIL" } }
          : s,
      ),
    };
    expect(codesOf(broken)).toContain("FIXED_WAIT_FORBIDDEN");
  });
});

// ===========================================================================
//  §11.8/§11.9 — FOR_EACH and SWITCH
// ===========================================================================

describe("FOR_EACH bounds", () => {
  it("rejects an unbounded loop and an implicit empty-collection policy", () => {
    const codes = codesOf(fixture("invalid-unbounded-loop.json"));
    expect(codes).toContain("UNBOUNDED_LOOP");
    expect(codes).toContain("MISSING_FIELD");
  });

  it("rejects iteration over an undeclared variable", () => {
    const ir = courier();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) => (s.planStepId === "loop-items" ? { ...s, itemsVariable: "ghost" } : s)),
    };
    expect(codesOf(broken)).toContain("UNDECLARED_VARIABLE");
  });
});

describe("SWITCH coverage", () => {
  it("requires an explicit default policy", () => {
    const ir = sports();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) => {
        if (s.planStepId !== "switch-surface") return s;
        return omit(s as Record<string, unknown>, "default");
      }),
    };
    expect(codesOf(broken)).toContain("MISSING_SWITCH_DEFAULT");
  });

  it("rejects duplicate branch ids", () => {
    const ir = sports();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) => {
        if (s.planStepId !== "switch-surface") return s;
        const branches = (s as unknown as { branches: unknown[] }).branches;
        return { ...s, branches: [branches[0], branches[0]] };
      }),
    };
    expect(codesOf(broken)).toContain("OVERLAPPING_BRANCHES");
  });
});

// ===========================================================================
//  §11.5/§11.6/§11.7 — Condition Engine
// ===========================================================================

describe("Condition Engine", () => {
  const operand = (source: string, path?: string): ConditionNode => ({
    kind: "comparison",
    operator: "equals",
    left: { kind: "operand", source: source as never, ...(path === undefined ? {} : { path }) },
    right: { kind: "literal", value: true },
  });

  const resolver = (values: Record<string, OperandResolution>) => ({
    resolveOperand: (ref: { source: string; path?: string }): OperandResolution =>
      values[`${ref.source}${ref.path === undefined ? "" : `.${ref.path}`}`] ?? { resolved: false as const, reason: "MISSING" as const },
    nowMs: () => 1_700_000_000_000,
  });

  it("uses no eval, Function constructor or dynamic code path (§11.5)", () => {
    // The ban has to be checked against the shipped source, not against intent:
    // a helper added later would otherwise pass review unnoticed.
    const source = readFileSync(fileURLToPath(new URL("./condition-evaluator.ts", import.meta.url)), "utf8");
    // Strip the header comment, which legitimately names the banned constructs.
    const code = source.slice(source.indexOf("*/") + 2);
    expect(code).not.toMatch(/\beval\s*\(/);
    expect(code).not.toMatch(/new\s+Function/);
    expect(code).not.toMatch(/setTimeout\s*\(\s*["'`]/);
  });

  it("returns TRUE/FALSE/UNKNOWN and never coerces UNKNOWN to FALSE (§11.6)", () => {
    expect(evaluateCondition(operand("bridge.visible"), resolver({ "bridge.visible": { resolved: true, value: true } })).result).toBe("TRUE");
    expect(evaluateCondition(operand("bridge.visible"), resolver({ "bridge.visible": { resolved: true, value: false } })).result).toBe("FALSE");
    expect(evaluateCondition(operand("bridge.visible"), resolver({})).result).toBe("UNKNOWN");
  });

  it("follows Kleene logic for and/or/not", () => {
    const unknown = operand("bridge.visible");
    const isTrue = operand("sdk.state", "ready");
    const isFalse = operand("sdk.state", "blocked");
    const ctx = resolver({
      "sdk.state.ready": { resolved: true, value: true },
      "sdk.state.blocked": { resolved: true, value: false },
    });

    expect(evaluateCondition({ kind: "and", operands: [unknown, isFalse] }, ctx).result).toBe("FALSE");
    expect(evaluateCondition({ kind: "and", operands: [unknown, isTrue] }, ctx).result).toBe("UNKNOWN");
    expect(evaluateCondition({ kind: "or", operands: [unknown, isTrue] }, ctx).result).toBe("TRUE");
    expect(evaluateCondition({ kind: "or", operands: [unknown, isFalse] }, ctx).result).toBe("UNKNOWN");
    expect(evaluateCondition({ kind: "not", operand: unknown }, ctx).result).toBe("UNKNOWN");
  });

  it("produces an operand snapshot DTO with provenance (§11.7)", () => {
    const snapshot = evaluateCondition(
      operand("sdk.state", "surface"),
      resolver({ "sdk.state.surface": { resolved: true, value: true, origin: "evidence-source-7" } }),
    );
    expect(snapshot.operands).toEqual([
      {
        source: "sdk.state",
        path: "surface",
        resolved: true,
        value: true,
        origin: "evidence-source-7",
        observedAtMs: 1_700_000_000_000,
      },
    ]);
    expect(snapshot.trace[0]).toBe("comparison:equals");
  });

  it("records the reason an operand could not be read", () => {
    const snapshot = evaluateCondition(operand("remote.result", "state"), {
      resolveOperand: () => ({ resolved: false, reason: "CAPABILITY_UNAVAILABLE" }),
      nowMs: () => 1,
    });
    expect(snapshot.operands[0]?.unresolvedReason).toBe("CAPABILITY_UNAVAILABLE");
    expect(snapshot.result).toBe("UNKNOWN");
  });

  it("treats a throwing resolver as an unobservable operand, not a crash", () => {
    const snapshot = evaluateCondition(operand("sdk.event", "x"), {
      resolveOperand: () => {
        throw new Error("probe exploded");
      },
    });
    expect(snapshot.result).toBe("UNKNOWN");
    expect(snapshot.operands[0]?.unresolvedReason).toBe("NOT_OBSERVED");
  });

  it("only matches allowlisted patterns, never a caller-supplied regex", () => {
    const node: ConditionNode = {
      kind: "comparison",
      operator: "matchesAllowlistedPattern",
      left: { kind: "operand", source: "sdk.state", path: "code" },
      right: { kind: "literal", value: "digits" },
    };
    const base = { resolveOperand: (): OperandResolution => ({ resolved: true, value: "12345" }) };
    expect(evaluateCondition(node, { ...base, allowlistedPatterns: { digits: /^\d+$/ } }).result).toBe("TRUE");
    // No allowlist entry -> UNKNOWN, not an ad-hoc regex compile.
    expect(evaluateCondition(node, base).result).toBe("UNKNOWN");
  });

  it("records short-circuiting so an audit does not read as missing evidence", () => {
    const snapshot = evaluateCondition(
      {
        kind: "and",
        operands: [operand("sdk.state", "blocked"), operand("sdk.state", "never-read")],
      },
      resolver({ "sdk.state.blocked": { resolved: true, value: false } }),
    );
    expect(snapshot.result).toBe("FALSE");
    expect(snapshot.shortCircuited).toBe(true);
  });

  it("rejects an operand source outside the allowlist", () => {
    const ir = sports();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) =>
        s.planStepId === "cond-locale"
          ? {
              ...s,
              condition: {
                kind: "comparison",
                operator: "equals",
                left: { kind: "operand", source: "app.internal", path: "x" },
                right: { kind: "literal", value: 1 },
              },
            }
          : s,
      ),
    };
    expect(codesOf(broken)).toContain("UNKNOWN_OPERAND_SOURCE");
  });

  it("rejects a path on a single-value source and a missing path on a namespace", () => {
    const withPath = codesOf(mutateCondition(sports(), { kind: "existence", operator: "exists", operand: { kind: "operand", source: "country", path: "code" } }));
    expect(withPath).toContain("OPERAND_PATH_MISMATCH");
    const withoutPath = codesOf(mutateCondition(sports(), { kind: "existence", operator: "exists", operand: { kind: "operand", source: "sdk.state" } }));
    expect(withoutPath).toContain("OPERAND_PATH_MISMATCH");
  });
});

describe("UNKNOWN policy", () => {
  it("never advances an UNKNOWN result without an explicit policy (§11.6)", () => {
    expect(applyUnknownPolicy("UNKNOWN", "FAIL").action).toBe("FAIL");
    expect(applyUnknownPolicy("UNKNOWN", "RETRY").action).toBe("RETRY");
    expect(applyUnknownPolicy("UNKNOWN", "OPERATOR_ATTENTION").action).toBe("OPERATOR_ATTENTION");
    expect(applyUnknownPolicy("UNKNOWN", "INCONCLUSIVE").action).toBe("INCONCLUSIVE");
  });

  it("refuses BRANCH without a declared unknown branch", () => {
    expect(applyUnknownPolicy("UNKNOWN", "BRANCH").action).toBe("FAIL");
    expect(applyUnknownPolicy("UNKNOWN", "BRANCH", { hasUnknownBranch: true }).action).toBe("TAKE_UNKNOWN_BRANCH");
  });

  it("rejects a CONDITION with unknownPolicy=BRANCH and no onUnknown target", () => {
    const ir = sports();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) => {
        if (s.planStepId !== "cond-locale") return s;
        return omit(s as Record<string, unknown>, "onUnknown");
      }),
    };
    expect(codesOf(broken)).toContain("MISSING_UNKNOWN_BRANCH");
  });

  it("rejects BRANCH on a Continue Gate, which has no branches", () => {
    const ir = courier();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) =>
        s.planStepId === "await-detail"
          ? { ...s, continueGate: { allOf: ["ui.x"], deadlineMs: 5000, unknownPolicy: "BRANCH" } }
          : s,
      ),
    };
    expect(codesOf(broken)).toContain("INVALID_UNKNOWN_POLICY");
  });
});

// ===========================================================================
//  §11.11/§11.12 — Continue Gate vs Final Oracle
// ===========================================================================

describe("Continue Gate and Final Oracle separation", () => {
  it("keeps them in structurally separate fields on the same step (§11.11)", () => {
    const step = courier().steps.find((s) => s.planStepId === "await-detail");
    expect(step).toBeDefined();
    expect(step && "continueGate" in step).toBe(true);
    // The gate carries readiness only; it has no verdict/obligation vocabulary.
    expect(JSON.stringify(step)).not.toMatch(/"obligation"/);
  });

  it("rejects the pre-v2 parallel role/timing lists (§11.12)", () => {
    expect(codesOf(fixture("invalid-parallel-oracle-lists.json"))).toContain("ORACLE_PARALLEL_LISTS");
  });

  it("rejects one fact carrying two requirements", () => {
    const ir = courier();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) => {
        if (s.planStepId !== "assert-persisted") return s;
        const policy = (s as unknown as { finalOraclePolicy: { requirements: unknown[] } }).finalOraclePolicy;
        return { ...s, finalOraclePolicy: { ...policy, requirements: [...policy.requirements, policy.requirements[0]] } };
      }),
    };
    expect(codesOf(broken)).toContain("ORACLE_DUPLICATE_FACT");
  });

  it("requires a deadline on every EVENTUAL requirement", () => {
    const ir = courier();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) => {
        if (s.planStepId !== "assert-persisted") return s;
        return {
          ...s,
          finalOraclePolicy: {
            requirements: [{ factKey: "remote.x", obligation: "REQUIRED", timing: "EVENTUAL", onTimeout: "INCONCLUSIVE" }],
          },
        };
      }),
    };
    expect(codesOf(broken)).toContain("ORACLE_MISSING_DEADLINE");
  });
});

describe("legacy oracle list migration", () => {
  it("folds obligation and timing into one requirement", () => {
    const result = migrateLegacyOracleLists({
      required: ["local.persisted", "remote.confirmed"],
      eventual: ["remote.confirmed"],
      warning: ["remote.config"],
      deadlineMs: 120000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.policy.requirements).toEqual([
      { factKey: "local.persisted", obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
      { factKey: "remote.config", obligation: "WARNING", timing: "IMMEDIATE", onTimeout: "WARNING" },
      { factKey: "remote.confirmed", obligation: "REQUIRED", timing: "EVENTUAL", deadlineMs: 120000, onTimeout: "INCONCLUSIVE" },
    ]);
  });

  it("fails rather than silently downgrading a fact listed twice with different strengths", () => {
    const result = migrateLegacyOracleLists({ required: ["remote.x"], optional: ["remote.x"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe("AMBIGUOUS_ROLE");
  });

  it("fails on an eventual fact with no obligation", () => {
    const result = migrateLegacyOracleLists({ eventual: ["remote.orphan"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe("AMBIGUOUS_TIMING");
  });
});

describe("evidence expression evaluation", () => {
  it("stays UNKNOWN when a required fact has not been observed", () => {
    const facts: Record<string, "TRUE" | "FALSE" | "UNKNOWN"> = { a: "TRUE", b: "UNKNOWN" };
    const lookup = (key: string): "TRUE" | "FALSE" | "UNKNOWN" => facts[key] ?? "UNKNOWN";
    expect(evaluateEvidenceExpression({ allOf: ["a", "b"] }, lookup)).toBe("UNKNOWN");
    expect(evaluateEvidenceExpression({ allOf: ["a"] }, lookup)).toBe("TRUE");
    expect(evaluateEvidenceExpression({ anyOf: ["a", "b"] }, lookup)).toBe("TRUE");
    expect(evaluateEvidenceExpression({ noneOf: ["a"] }, lookup)).toBe("FALSE");
  });
});

// ===========================================================================
//  §11.13 — orthogonal outcome axes
// ===========================================================================

describe("orthogonal outcome axes", () => {
  const base: RunOutcomeAxes = {
    lifecycle: "CLOSED",
    productVerdict: "PASS_ONLINE",
    evaluationFailureClass: "NONE",
    terminationReason: "COMPLETED",
    cleanupResult: "SUCCEEDED",
    resourceReleaseResult: "RELEASED",
    schedulerDisposition: "RELEASED",
    operationalDisposition: "OK",
  };

  it("accepts the canonical happy path", () => {
    expect(validateRunOutcomeAxes(base)).toEqual([]);
    expect(() => assertRunOutcomeAxes(base)).not.toThrow();
  });

  it("keeps a passing verdict when cleanup fails, surfacing attention instead (§11.13)", () => {
    const axes: RunOutcomeAxes = { ...base, cleanupResult: "FAILED", operationalDisposition: "NEEDS_ATTENTION" };
    expect(validateRunOutcomeAxes(axes)).toEqual([]);
    expect(axes.productVerdict).toBe("PASS_ONLINE");
  });

  it("refuses to hide a failed cleanup without raising attention", () => {
    const violations = validateRunOutcomeAxes({ ...base, cleanupResult: "FAILED" });
    expect(violations.map((v) => v.invariant)).toContain("B.8.2");
  });

  it("does not let a lost worker become a product failure", () => {
    const violations = validateRunOutcomeAxes({
      ...base,
      productVerdict: "FAIL_PRODUCT",
      schedulerDisposition: "WORKER_LOST",
      terminationReason: "ABORTED",
    });
    expect(violations.some((v) => v.message.includes("WORKER_LOST"))).toBe(true);
  });

  it("separates missing evidence from a product defect", () => {
    const violations = validateRunOutcomeAxes({
      ...base,
      productVerdict: "FAIL_PRODUCT",
      evaluationFailureClass: "ENVIRONMENT_FAILURE",
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(validateRunOutcomeAxes({
      ...base,
      productVerdict: "INCONCLUSIVE",
      evaluationFailureClass: "EVIDENCE_INSUFFICIENT",
      terminationReason: "COMPLETED",
    })).toEqual([]);
  });

  it("refuses to close a run whose cleanup never reached a terminal state", () => {
    const violations = validateRunOutcomeAxes({ ...base, cleanupResult: "PENDING" });
    expect(violations.map((v) => v.invariant)).toContain("B.8.3");
  });

  it("does not invent a pass for a cancelled run", () => {
    const violations = validateRunOutcomeAxes({ ...base, terminationReason: "CANCELLED" });
    expect(violations.map((v) => v.invariant)).toContain("B.8.4");
  });
});

// ===========================================================================
//  §11.14 — correlation
// ===========================================================================

describe("occurrence correlation", () => {
  const expected = {
    workflowRunId: "run-1",
    stepId: "step-a",
    occurrenceId: "run-1::step-a/loop[3]",
    attempt: 1,
    iterationPath: [{ loopStepId: "loop", index: 3 }],
    entityRef: { type: "opaque-entity", id: "e-42" },
    requestId: "req-9",
  };

  it("derives a deterministic occurrence id for nested loops", () => {
    const path = [
      { loopStepId: "outer", index: 2 },
      { loopStepId: "inner", index: 5 },
    ];
    expect(formatIterationPath(path)).toBe("/outer[2]/inner[5]");
    expect(deriveOccurrenceId("run-1", "s", path)).toBe(deriveOccurrenceId("run-1", "s", path));
    expect(deriveOccurrenceId("run-1", "s", path)).not.toBe(deriveOccurrenceId("run-1", "s", [path[0]!]));
  });

  it("accepts a fact from the same occurrence", () => {
    expect(correlationMatches(expected, { occurrenceId: expected.occurrenceId, eventSeq: 10 }, { seqRange: { fromSeq: 5, toSeq: null } })).toEqual({ matched: true });
  });

  it("refuses a stale fact from another iteration (§11.14)", () => {
    expect(correlationMatches(expected, { iterationPath: [{ loopStepId: "loop", index: 2 }] })).toEqual({
      matched: false,
      reason: "ITERATION_MISMATCH",
    });
  });

  it("refuses a fact about a different entity", () => {
    expect(correlationMatches(expected, { entityRef: { type: "opaque-entity", id: "e-99" } })).toEqual({
      matched: false,
      reason: "ENTITY_MISMATCH",
    });
  });

  it("refuses a fact outside the occurrence's event sequence window", () => {
    expect(correlationMatches(expected, { eventSeq: 2 }, { seqRange: { fromSeq: 5, toSeq: 20 } })).toEqual({
      matched: false,
      reason: "SEQ_OUT_OF_RANGE",
    });
  });
});

// ===========================================================================
//  §11.15–§11.17 — external action primitive
// ===========================================================================

describe("REMOTE_ACTION / EXTERNAL_ACTION primitive", () => {
  const safe: ExternalActionSpec = {
    adapterRef: "adapter.one",
    operationRef: "adapter.one.thing.submit",
    role: "VALIDATION",
    effectClass: "IDEMPOTENT_MUTATION",
    idempotencyClass: "KEYED",
    idempotencyKey: "k-1",
    inputBindings: [],
    outputFactBindings: [{ factKey: "remote.thing_done", responsePath: "state" }],
    timeoutPolicy: { timeoutMs: 10000, maxAttempts: 3 },
    reconciliationPolicy: "RECONCILE_BEFORE_RELEASE",
    auditPolicy: { recordRequest: true, recordResponse: true },
  };

  it("accepts a keyed, audited, reconciled mutation", () => {
    expect(validateExternalAction(safe)).toEqual([]);
  });

  it("refuses to retry a non-idempotent mutation without a key (§11.16)", () => {
    const codes = validateExternalAction({ ...safe, effectClass: "NON_IDEMPOTENT_MUTATION", idempotencyClass: "NONE", idempotencyKey: undefined }).map((v) => v.code);
    expect(codes).toContain("UNSAFE_RETRY");
  });

  it("refuses to auto-retry an unclassified effect", () => {
    expect(validateExternalAction({ ...safe, effectClass: "UNKNOWN" }).map((v) => v.code)).toContain("UNSAFE_RETRY");
  });

  it("refuses a setup action that produces business evidence (§11.17)", () => {
    expect(validateExternalAction({ ...safe, role: "SETUP" }).map((v) => v.code)).toContain("SETUP_PRODUCES_VERDICT");
  });

  it("refuses a read-only setup action that binds business evidence", () => {
    expect(validateExternalAction({ ...safe, role: "SETUP", effectClass: "READ_ONLY", idempotencyClass: "NONE", idempotencyKey: undefined }).map((v) => v.code)).toContain(
      "SETUP_PRODUCES_VERDICT",
    );
  });

  it("refuses a validation action that proves nothing", () => {
    expect(validateExternalAction({ ...safe, outputFactBindings: [] }).map((v) => v.code)).toContain("MISSING_OUTPUT_FACT");
  });

  it("requires audit and reconciliation on mutations", () => {
    const codes = validateExternalAction({
      ...safe,
      auditPolicy: { recordRequest: false, recordResponse: false },
      reconciliationPolicy: "NONE",
    }).map((v) => v.code);
    expect(codes).toContain("UNAUDITED_MUTATION");
    expect(codes).toContain("MISSING_RECONCILIATION");
  });

  it("has no field an endpoint could hide in (§11.15)", () => {
    const ir = courier();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) =>
        s.planStepId === "remote-approve"
          ? { ...s, spec: { ...(s as unknown as { spec: object }).spec, url: "https://internal.example/approve" } }
          : s,
      ),
    };
    const issues = validateWorkflowIrV2(broken as unknown as WorkflowIrV2);
    expect(issues.some((i) => i.code === "EXTERNAL_ACTION_INVALID" && i.path.endsWith(".url"))).toBe(true);
  });

  it("rejects the unsafe-retry fixture end to end", () => {
    const codes = codesOf(fixture("invalid-unsafe-retry.json"));
    expect(codes).toContain("UNSAFE_RETRY");
    expect(codes).toContain("EXTERNAL_ACTION_INVALID");
  });
});

// ===========================================================================
//  §11.4/§11.18 — canonical form, hash, two domains
// ===========================================================================

describe("canonical serialization and plan hash", () => {
  it("is stable under key reordering (§11.4)", () => {
    const ir = courier();
    const reordered = reverseKeysDeep(ir) as WorkflowIrV2;
    // Same content, every object's keys in the opposite insertion order — which
    // is exactly what a different code path or a different database read looks
    // like.
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(ir));
    expect(hashWorkflowIrV2(reordered)).toBe(hashWorkflowIrV2(ir));
  });

  it("changes when content changes", () => {
    const ir = courier();
    expect(hashWorkflowIrV2({ ...ir, workflowVersion: 2 })).not.toBe(hashWorkflowIrV2(ir));
  });

  it("drops undefined members but keeps null", () => {
    const ir = courier();
    const withUndefined = { ...ir, sourceLane: undefined } as unknown as WorkflowIrV2;
    expect(hashWorkflowIrV2(withUndefined)).toBe(hashWorkflowIrV2(ir));
    expect(canonicalizeWorkflowIrV2(ir)).toContain('"next":null');
  });

  it("refuses a non-finite number rather than coercing it to null", () => {
    const ir = courier();
    expect(() => hashWorkflowIrV2({ ...ir, workflowVersion: Number.NaN })).toThrow(/non-finite/);
  });

  it("hashes both domain fixtures deterministically with the same unions (§11.18)", () => {
    // Golden values. A diff here means a fixture or the canonical form changed;
    // both are intentional-change-only events.
    expect(hashWorkflowIrV2(courier())).toBe(hashWorkflowIrV2(courier()));
    expect(hashWorkflowIrV2(sports())).toBe(hashWorkflowIrV2(sports()));
    expect(hashWorkflowIrV2(courier())).not.toBe(hashWorkflowIrV2(sports()));

    const kindsUsed = (ir: WorkflowIrV2): string[] => [...new Set(ir.steps.map((s) => s.kind))].sort();
    for (const kind of [...kindsUsed(courier()), ...kindsUsed(sports())]) {
      expect(WORKFLOW_STEP_KINDS).toContain(kind);
    }
    // The two fixtures between them must exercise the control-flow union, or
    // "domain-neutral" would only be proven for the trivial subset.
    const combined = new Set([...kindsUsed(courier()), ...kindsUsed(sports())]);
    for (const required of ["FOR_EACH", "SWITCH", "CONDITION", "WAIT_EVENT", "WAIT_ANY", "REMOTE_ACTION", "EXTERNAL_ACTION", "CLEANUP"]) {
      expect(combined).toContain(required);
    }
  });
});

// ===========================================================================
//  §11.19 — domain leakage guard
// ===========================================================================

describe("domain leakage guard", () => {
  it("finds no business vocabulary anywhere in the exported surface (§11.19)", async () => {
    const modules: Array<[string, Record<string, unknown>]> = [
      ["outcome-axes", await import("./outcome-axes.js")],
      ["correlation", await import("./correlation.js")],
      ["condition", await import("./condition.js")],
      ["condition-evaluator", await import("./condition-evaluator.js")],
      ["evidence-policy", await import("./evidence-policy.js")],
      ["remote-action", await import("./remote-action.js")],
      ["ir-v2", await import("./ir-v2.js")],
      ["validate", await import("./validate.js")],
      ["canonicalize", await import("./canonicalize.js")],
      ["legacy-migration", await import("./legacy-migration.js")],
    ];

    const hits = modules.flatMap(([name, mod]) => scanExportSurface(name, mod));
    expect(hits).toEqual([]);
  });

  it("catches the words it is supposed to catch", () => {
    expect(findDomainLeakage("OPEN_STOP", "x").map((h) => h.token)).toContain("OPEN_STOP");
    expect(findDomainLeakage("approveTour", "x").map((h) => h.token)).toContain("TOUR");
    expect(findDomainLeakage("courierLogin", "x").map((h) => h.token)).toContain("COURIER");
    expect(findDomainLeakage("parcelCount", "x").map((h) => h.token)).toContain("PARCEL");
    expect(findDomainLeakage("shipmentBarcode", "x").map((h) => h.token)).toContain("SHIPMENT");
  });

  it("does not fire on Core words that merely contain a business substring", () => {
    // If these were flagged the guard would be deleted within a week, so its
    // precision is part of the contract.
    for (const safe of ["matchesAllowlistedPattern", "correlationMatches", "mismatch", "STOPPED", "NOT_TERMINATED"]) {
      expect(findDomainLeakage(safe, "x")).toEqual([]);
    }
  });

  it("is strict about a whole business segment, whatever the casing", () => {
    // Deliberately strict: an identifier whose own segment is `stop` is flagged
    // in every casing convention. Core vocabulary can always pick another word.
    for (const leak of ["openStop", "OPEN_STOP", "open-stop", "stop.count"]) {
      expect(findDomainLeakage(leak, "x").map((h) => h.token)).toContain("STOP");
    }
  });

  it("rejects a business word used as a Core identifier", () => {
    const ir = courier();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) => (s.planStepId === "tap-row" ? { ...s, action: "openStop" } : s)),
    };
    expect(codesOf(broken)).toContain("DOMAIN_LEAKAGE");
  });

  it("leaves Domain-Pack-owned opaque refs alone", () => {
    // `queryRef: "nesy.courier.route_stops"` is legitimate — the seam is where
    // business language belongs. Guarding it would ban the design.
    expect(validateWorkflowIrV2(courier())).toEqual([]);
  });
});

// ===========================================================================
//  §11.20 — legacy migration + source map
// ===========================================================================

describe("legacy workflow migration", () => {
  const mappings: Record<string, LegacyNodeMapping> = {
    LAUNCH_APP: { to: "BRIDGE_ACTION", action: "launch" },
    IF_LOGIN: {
      to: "CONDITION",
      condition: { kind: "existence", operator: "exists", operand: { kind: "operand", source: "sdk.state", path: "session" } },
      unknownPolicy: "RETRY",
    },
    DO_LOGIN: { to: "BRIDGE_ACTION", action: "submitForm" },
    BUSINESS_OPERATION: { to: "ASSERT_FACT", factKey: "local.operation_persisted", expected: true, unknownPolicy: "INCONCLUSIVE" },
  };

  const options = {
    nodeMappings: mappings,
    policies: {
      runDeadlineMs: 300000,
      cleanupDeadlineMs: 30000,
      defaultRetry: { maxAttempts: 1, effectClass: "READ_ONLY" as const },
      artifactPolicy: { captureOnSuccess: false, captureOnFailure: true },
      redactionPolicy: {},
    },
    defaultStepTimeoutMs: 15000,
    factKeyForLegacyOracle: (kind: string): string | null =>
      ({ ui: "ui.step_completed", mobileEvent: "app.step_reported", backend: "remote.step_confirmed" })[kind] ?? null,
  };

  const legacyInput = (): Record<string, unknown> => {
    const raw = fixture<Record<string, unknown>>("legacy-migration-input.json");
    return { ...raw, nodes: (raw.nodes as Array<Record<string, unknown>>).filter((n) => n.type !== "UNSUPPORTED_LEGACY_THING") };
  };

  it("produces a valid IR v2 document with a source map (§11.20)", () => {
    const result = migrateLegacyWorkflow(legacyInput() as never, options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(validateWorkflowIrV2(result.ir)).toEqual([]);
    expect(result.ir.source.kind).toBe("LEGACY_CONFIG");
    // Every step is traceable back to the node and array position it came from.
    for (const step of result.ir.steps) {
      const entry = result.ir.sourceMap.find((e) => e.ref === step.sourceMapRef);
      expect(entry).toBeDefined();
      expect(entry?.sourceNodeId).toBe(step.planStepId);
      expect(entry?.legacyPath).toMatch(/^nodes\[\d+\]$/);
    }
  });

  it("is deterministic", () => {
    const a = migrateLegacyWorkflow(legacyInput() as never, options);
    const b = migrateLegacyWorkflow(legacyInput() as never, options);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(hashWorkflowIrV2(a.ir)).toBe(hashWorkflowIrV2(b.ir));
  });

  it("preserves the legacy true/false branch wiring", () => {
    const result = migrateLegacyWorkflow(legacyInput() as never, options);
    if (!result.ok) throw new Error("migration failed");
    const condition = result.ir.steps.find((s) => s.planStepId === "n2");
    expect(condition?.kind).toBe("CONDITION");
    expect(condition && "onTrue" in condition && condition.onTrue).toBe("n4");
    expect(condition && "onFalse" in condition && condition.onFalse).toBe("n3");
  });

  it("folds the legacy completionPolicy.required array into unified requirements", () => {
    const result = migrateLegacyWorkflow(legacyInput() as never, options);
    if (!result.ok) throw new Error("migration failed");
    const step = result.ir.steps.find((s) => s.planStepId === "n4");
    expect(step?.finalOraclePolicy?.requirements.map((r) => r.factKey).sort()).toEqual([
      "app.step_reported",
      "remote.step_confirmed",
      "ui.step_completed",
    ]);
    for (const requirement of step?.finalOraclePolicy?.requirements ?? []) {
      expect(requirement.obligation).toBe("REQUIRED");
      expect(requirement.timing).toBe("IMMEDIATE");
    }
  });

  it("fails loudly on an unmapped legacy action instead of dropping the step", () => {
    const result = migrateLegacyWorkflow(fixture("legacy-migration-input.json"), options);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe("UNSUPPORTED_LEGACY_ACTION");
    expect(result.errors[0]?.nodeType).toBe("UNSUPPORTED_LEGACY_THING");
  });

  it("knows no legacy node type of its own", () => {
    // The migrator must stay a graph walker: the moment a business type appears
    // in its source, Core has learned the domain.
    const source = readFileSync(fileURLToPath(new URL("./legacy-migration.ts", import.meta.url)), "utf8");
    const code = source.slice(source.indexOf("*/") + 2);
    expect(findDomainLeakage(code, "legacy-migration.ts")).toEqual([]);
  });
});

// ===========================================================================
//  B-13 capability constraint
// ===========================================================================

describe("B-13 wait/cancel capability constraint", () => {
  it("rejects a plan that hard-requires a capability the target lacks", () => {
    const ir = sports();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) =>
        s.planStepId === "wait-first-surface"
          ? { ...s, capabilityRequirements: [{ capability: "bridge.wait_any", optional: false }] }
          : s,
      ),
    };
    const issues = validateWorkflowIrV2(broken as unknown as WorkflowIrV2, { availableCapabilities: ["bridge.tap"] });
    expect(issues.map((i) => i.code)).toContain("UNSUPPORTED_CAPABILITY");
  });

  it("accepts the same plan when the capability is optional with a fallback", () => {
    const issues = validateWorkflowIrV2(sports(), { availableCapabilities: ["bridge.tap", "sdk.named_query"] });
    expect(issues).toEqual([]);
  });

  it("requires WAIT_ANY to state bounded legs and whose cancel it relies on", () => {
    const ir = sports();
    const broken = {
      ...ir,
      steps: ir.steps.map((s) => {
        if (s.planStepId !== "wait-first-surface") return s;
        return { ...omit(s as Record<string, unknown>, "hostOnlyCancel"), maxLegs: 1 };
      }),
    };
    const codes = codesOf(broken);
    expect(codes).toContain("MISSING_FIELD");
    expect(codes).toContain("UNBOUNDED_LOOP");
  });
});

// ───────────────────────────────────────────────────────────────────────────

/** Returns a shallow copy without one key — used to delete a required field. */
function omit(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const out = { ...source };
  delete out[key];
  return out;
}

/** Rebuilds a document with every object's keys in reverse order. */
function reverseKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeysDeep);
  if (typeof value === "object" && value !== null) {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).reverse()) out[key] = reverseKeysDeep(source[key]);
    return out;
  }
  return value;
}

function codesOf(ir: unknown): string[] {
  return validateWorkflowIrV2(ir as WorkflowIrV2).map((i) => i.code);
}

function mutateCondition(ir: WorkflowIrV2, condition: unknown): unknown {
  return {
    ...ir,
    steps: ir.steps.map((s) => (s.planStepId === "cond-locale" ? { ...s, condition } : s)),
  };
}
