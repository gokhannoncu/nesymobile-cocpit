/**
 * ===========================================================================
 *  @nesy/bridgeflow-compiler — Verdict BridgeFlowCompiler
 *
 *  Domain Pack semantic macro/action/test profile → generic WorkflowIR v2 →
 *  deterministic BridgeFlowPlan + UiWaitPlan compilation.
 *
 *  Four prohibitions, each enforced by a failing test:
 *
 *    1. NO EXECUTOR. This package produces plans. It never executes them.
 *       No executePlan, no dispatchBridgeCommand, no DeviceWorker, no
 *       RunLease, no TestExecutionQueue, no TestDataBroker, no
 *       WorkerHeartbeat.
 *    2. NO DOMAIN. No STOP, PARCEL, COURIER, TOUR in
 *       type names or exports. Domain vocabulary lives in domain-packs/
 *       only.
 *    3. NO DEVICE ACTION. The compiler never dispatches a Bridge command
 *       or an SDK command. It reads contract types only.
 *    4. NO FIXED WAIT. Deadlines are upper bounds on event-driven
 *       evaluation. Fixed sleep/wait primitives are compile errors.
 * ===========================================================================
 */

// ─── Contract types ─────────────────────────────────────────────────────────
export * from "./bridgeflow-plan.js";
export * from "./ui-wait-plan.js";
export * from "./compile-input.js";
export * from "./compile-issues.js";

// ─── Canonical / provenance / capability ────────────────────────────────────
export * from "./canonical.js";
export * from "./provenance.js";
export * from "./capability.js";

// ─── Compiler passes ────────────────────────────────────────────────────────
export * from "./domain-expansion.js";
export * from "./workflow-ir-compiler.js";
export * from "./control-flow.js";
export * from "./target-validation.js";
export * from "./wait-compiler.js";
export * from "./evidence-compiler.js";
export * from "./profile-compiler.js";
export * from "./source-map.js";

// ─── Preview / leakage ─────────────────────────────────────────────────────
export * from "./preview.js";
export * from "./leakage.js";

// ─── Top-level compile API ─────────────────────────────────────────────────

import type { CompileInput, CompileResult, CompileStats, TestProfileCompileInput, TestProfileCompileResult } from "./compile-input.js";
import type { CompileIssue } from "./compile-issues.js";
import { hasErrors } from "./compile-issues.js";
import { validateDomainMacros, validateCompileInputIr } from "./domain-expansion.js";
import { compileWorkflowIr } from "./workflow-ir-compiler.js";
import { validateTestProfileForCompilation, validateFragmentsNoVerdict, buildDifferentialSourceMap } from "./profile-compiler.js";
import { generatePreview } from "./preview.js";

/**
 * Compile a domain workflow into a BridgeFlowPlan.
 *
 * This is the primary public API. It validates, compiles, and produces
 * a deterministic plan with full source map and provenance.
 */
export function compileDomainWorkflow(input: CompileInput): CompileResult {
  const startMs = Date.now();
  const issues: CompileIssue[] = [];

  // 1. Validate domain macros
  validateDomainMacros(
    input.macros,
    input.bundle.registries.semanticActions,
    input.bundle.registries,
    issues,
  );

  // 2. Validate input IR
  validateCompileInputIr(input.workflowIr, issues);

  // 3. Validate fragments
  validateFragmentsNoVerdict(input.bundle.registries.fragments, issues);

  // 4. Compile if no errors so far
  let plan;
  if (!hasErrors(issues)) {
    plan = compileWorkflowIr(
      input.workflowIr,
      input.bundle,
      input.deviceCapabilities,
      issues,
    );
  }

  const stats: CompileStats = {
    totalSteps: plan?.steps.length ?? 0,
    totalWaitPlans: plan?.waitPlans.length ?? 0,
    totalEvidenceRequirements:
      (plan?.evidenceManifest.continueGateRequirements.length ?? 0) +
      (plan?.evidenceManifest.finalOracleRequirements.length ?? 0),
    totalCapabilityRequirements: plan?.capabilityManifest.required.length ?? 0,
    totalIssues: issues.length,
    errorCount: issues.filter((i) => i.severity === "ERROR").length,
    warningCount: issues.filter((i) => i.severity === "WARNING").length,
    infoCount: issues.filter((i) => i.severity === "INFO").length,
    compileDurationMs: Date.now() - startMs,
  };

  return {
    ok: !hasErrors(issues) && plan !== undefined,
    plan,
    issues,
    stats,
  };
}

/**
 * Compile a single macro expansion snapshot for validation.
 */
export function compileMacroSnapshot(input: CompileInput): CompileResult {
  return compileDomainWorkflow(input);
}

/**
 * Compile a test profile through the same compiler path.
 */
export function compileTestProfile(input: TestProfileCompileInput): TestProfileCompileResult {
  const startMs = Date.now();
  const issues: CompileIssue[] = [];

  // Validate profile
  validateTestProfileForCompilation(input.profile, input.bundle, issues);
  validateFragmentsNoVerdict(input.bundle.registries.fragments, issues);

  // Compile each included workflow
  const plans: import("./bridgeflow-plan.js").BridgeFlowPlan[] = [];

  for (const workflowRef of input.profile.includedWorkflowRefs) {
    // Find workflow in the pack
    const workflow = input.bundle.registries.independentWorkflows.find(
      (w) => w.workflowKey === workflowRef,
    );
    const fragment = input.bundle.registries.fragments.find(
      (f) => f.fragmentKey === workflowRef,
    );

    if (!workflow && !fragment) {
      issues.push({
        code: "UNKNOWN_REGISTRY_REF",
        severity: "ERROR",
        message: `Profile "${input.profile.profileKey}" includes unknown workflow "${workflowRef}"`,
        sourceRef: input.profile.profileKey,
      });
      continue;
    }

    // Find macro snapshots for the workflow's macros
    const macroRefs = workflow?.macroRefs ?? fragment?.macroRefs ?? [];
    const macros = input.bundle.registries.macros.filter((m) =>
      macroRefs.includes(m.macroKey),
    );

    for (const macro of macros) {
      if (macro.expansionSnapshot) {
        const compileInput: CompileInput = {
          bundle: input.bundle,
          workflowIr: macro.expansionSnapshot.genericIr,
          macros,
          expansionSnapshots: [macro.expansionSnapshot],
          deviceCapabilities: input.deviceCapabilities,
          options: input.options,
        };
        const result = compileDomainWorkflow(compileInput);
        issues.push(...result.issues);
        if (result.plan) plans.push(result.plan);
      }
    }
  }

  // Build resource/dependency refs
  const resourceRefs = plans.flatMap((p) => p.resourceRequirements);
  const dependencyRefs = plans.flatMap((p) => p.domainDependencies);
  const differentialSourceMap = buildDifferentialSourceMap(input.profile, plans);

  const stats: CompileStats = {
    totalSteps: plans.reduce((sum, p) => sum + p.steps.length, 0),
    totalWaitPlans: plans.reduce((sum, p) => sum + p.waitPlans.length, 0),
    totalEvidenceRequirements: plans.reduce(
      (sum, p) =>
        sum +
        p.evidenceManifest.continueGateRequirements.length +
        p.evidenceManifest.finalOracleRequirements.length,
      0,
    ),
    totalCapabilityRequirements: plans.reduce(
      (sum, p) => sum + p.capabilityManifest.required.length,
      0,
    ),
    totalIssues: issues.length,
    errorCount: issues.filter((i) => i.severity === "ERROR").length,
    warningCount: issues.filter((i) => i.severity === "WARNING").length,
    infoCount: issues.filter((i) => i.severity === "INFO").length,
    compileDurationMs: Date.now() - startMs,
  };

  return {
    ok: !hasErrors(issues),
    plans,
    issues,
    stats,
    resourceRefs,
    dependencyRefs,
    differentialSourceMap,
  };
}

/**
 * Generate a human-readable compile preview.
 */
export function previewCompile(input: CompileInput): import("./compile-input.js").CompilePreviewDto {
  const result = compileDomainWorkflow(input);
  return generatePreview(result);
}
