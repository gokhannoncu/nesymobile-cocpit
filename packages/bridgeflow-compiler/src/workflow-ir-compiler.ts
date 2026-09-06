/**
 * Generic WorkflowIR v2 → BridgeFlowPlan compilation  (Plan D.7.5 · Phase 4C)
 *
 * This is the core compilation pass. It takes validated WorkflowIR v2 and
 * produces BridgeFlowPlanSteps. The compiler:
 *   - Compiles all 14 generic step kinds
 *   - Produces runtime condition steps (no compile-time branch assumptions)
 *   - Rejects fixed wait/sleep hot paths
 *   - Rejects non-idempotent unsafe retry
 *   - Produces bounded FOR_EACH with entity scope
 */

import type {
  WorkflowIrV2,
  WorkflowStepV2,
} from "@nesy/workflow-contract";
import type { BridgeCapabilityManifest } from "@nesy/bridge-contract";
import type { DomainPackBundle } from "@nesy/domain-pack-contracts";
import type {
  BridgeFlowPlan,
  BridgeFlowPlanStep,
  CompiledCapabilityRequirement,
  CompiledEvidenceRequirement,
  CompiledSourceMapEntry,
  CompiledResourceRequirementRef,
  CompiledDomainDependencyRef,
  FactDeliveryLane,
} from "./bridgeflow-plan.js";
import type { CompileIssue } from "./compile-issues.js";
import { hasErrors } from "./compile-issues.js";
import { computePlanHash, buildProvenance, digestPlanDocument } from "./canonical.js";
import { compileControlFlow } from "./control-flow.js";
import { compileWaitPlans } from "./wait-compiler.js";
import { compileEvidence } from "./evidence-compiler.js";
import { compileTargets } from "./target-validation.js";
import { buildCapabilityManifest } from "./provenance.js";
import { compileSourceMap } from "./source-map.js";
import { computeBundleDigest, formatDomainPackVersion } from "@nesy/domain-pack-contracts";
import { hashWorkflowIrV2 } from "@nesy/workflow-contract";

/**
 * Compile a validated WorkflowIR v2 into a BridgeFlowPlan.
 *
 * This is the pure compilation function. Input validation should have
 * already been performed by domain-expansion.ts.
 */
export function compileWorkflowIr(
  ir: WorkflowIrV2,
  bundle: DomainPackBundle,
  deviceCapabilities: BridgeCapabilityManifest,
  issues: CompileIssue[],
): BridgeFlowPlan | undefined {
  // 1. Compile each step
  const steps: BridgeFlowPlanStep[] = [];
  const allCapReqs: CompiledCapabilityRequirement[] = [];
  const sourceMapEntries: CompiledSourceMapEntry[] = [];

  for (const step of ir.steps) {
    const compiled = compileStep(step, ir);
    if (compiled) {
      steps.push(compiled.step);
      allCapReqs.push(...compiled.capabilityReqs);
      sourceMapEntries.push(compiled.sourceMapEntry);
    }
  }

  if (hasErrors(issues)) return undefined;

  // 2. Compile control flow validation
  compileControlFlow(ir, issues);
  if (hasErrors(issues)) return undefined;

  // 3. Compile targets
  compileTargets(ir, bundle.registries, issues);

  // 4. Compile wait plans
  const waitPlans = compileWaitPlans(ir, bundle.registries, deviceCapabilities, issues);

  // 5. Compile evidence
  const evidenceResult = compileEvidence(ir, bundle.registries, issues);

  // 6. Build capability manifest
  const capabilityManifest = buildCapabilityManifest(
    bundle.manifest.capabilityRequirements,
    allCapReqs,
    deviceCapabilities,
    issues,
  );

  // 7. Compile source map
  const sourceMap = compileSourceMap(ir, bundle, sourceMapEntries);

  // 8. Compile resource/dependency refs
  const resourceRequirements = compileResourceRequirements(bundle);
  const domainDependencies = compileDomainDependencies(bundle);

  if (hasErrors(issues)) return undefined;

  // 9. Build provenance
  const packDigest = computeBundleDigest(bundle);
  const irHash = hashWorkflowIrV2(ir);
  const derivedGraphDigest = digestPlanDocument(bundle.registries.derivedFacts);

  const provenance = buildProvenance({
    packKey: bundle.manifest.packKey,
    packVersion: formatDomainPackVersion(bundle.manifest.version),
    packDigest,
    workflowRef: ir.workflowId,
    workflowVersion: ir.workflowVersion,
    irHash,
    derivedGraphDigest,
  });

  // 10. Build the plan (without hash first)
  const planWithoutHash: Omit<BridgeFlowPlan, "hash"> = {
    schemaVersion: 1 as const,
    planId: `bfp-${ir.workflowId}-${ir.workflowVersion}`,
    provenance,
    packVersion: bundle.manifest.version,
    packDigest,
    workflowRef: ir.workflowId,
    workflowVersion: ir.workflowVersion,
    appCompatibilityRefs: bundle.manifest.applicationRefs,
    adapterCompatibilityRefs: bundle.registries.remoteAdapters.map((a) => a.adapterRef),
    steps,
    entryStepId: ir.entryStepId,
    waitPlans,
    capabilityManifest,
    evidenceManifest: evidenceResult,
    resourceRequirements,
    domainDependencies,
    sourceMap,
  };

  // 11. Compute deterministic hash
  const hash = computePlanHash(planWithoutHash);

  return { ...planWithoutHash, hash };
}

interface CompiledStepResult {
  step: BridgeFlowPlanStep;
  capabilityReqs: CompiledCapabilityRequirement[];
  sourceMapEntry: CompiledSourceMapEntry;
}

function compileStep(
  step: WorkflowStepV2,
  ir: WorkflowIrV2,
): CompiledStepResult | undefined {
  const capReqs: CompiledCapabilityRequirement[] = step.capabilityRequirements.map((r) => ({
    capability: r.capability,
    optional: r.optional,
    fallback: r.fallback,
    sourceRef: step.planStepId,
  }));

  // Build evidence requirements for this step
  const evidenceReqs: CompiledEvidenceRequirement[] = [];
  if (step.continueGate) {
    const gateFactKeys = [
      ...(step.continueGate.allOf ?? []),
      ...(step.continueGate.anyOf ?? []),
      ...(step.continueGate.noneOf ?? []),
    ];
    for (const factKey of gateFactKeys) {
      evidenceReqs.push({
        factKey,
        lane: "RECEIPT_SAFE" as FactDeliveryLane,
        requirement: { factKey, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL", deadlineMs: step.continueGate.deadlineMs },
        sourceAuthority: "continue-gate",
        correlationRequired: true,
        freshnessMaxAgeMs: step.continueGate.deadlineMs,
      });
    }
  }

  // Build step params based on kind
  const params = buildStepParams(step);

  const planStep: BridgeFlowPlanStep = {
    planStepId: step.planStepId,
    kind: step.kind,
    sourceMapRef: step.sourceMapRef,
    timeoutMs: step.timeoutMs,
    next: step.next,
    entityBinding: step.entityBinding,
    capabilityRequirements: capReqs,
    continueGate: step.continueGate,
    finalOraclePolicy: step.finalOraclePolicy,
    evidenceRequirements: evidenceReqs,
    params,
  };

  const sourceMapEntry: CompiledSourceMapEntry = {
    planStepId: step.planStepId,
    irStepId: step.planStepId,
    domainSourceRef: findDomainSourceRef(step.sourceMapRef, ir),
  };

  return { step: planStep, capabilityReqs: capReqs, sourceMapEntry };
}

function buildStepParams(step: WorkflowStepV2): Readonly<Record<string, unknown>> {
  const params: Record<string, unknown> = {};

  switch (step.kind) {
    case "SDK_QUERY":
      params.queryRef = step.queryRef;
      params.maxRows = step.maxRows;
      params.outputVariable = step.outputVariable;
      if (step.params !== undefined) params.queryParams = step.params;
      if (step.waitUntil !== undefined) params.waitUntil = step.waitUntil;
      if (step.outputFactBindings !== undefined) {
        params.outputFactBindings = step.outputFactBindings;
      }
      break;
    case "RESOLVE_TARGET":
      params.targetRef = step.targetRef;
      params.outputVariable = step.outputVariable;
      break;
    case "BRIDGE_ACTION":
      params.action = step.action;
      params.targetVariable = step.targetVariable;
      params.args = step.args;
      break;
    case "WAIT_ANY":
      params.legs = step.legs;
      params.maxLegs = step.maxLegs;
      params.hostOnlyCancel = step.hostOnlyCancel;
      break;
    case "ASSERT_FACT":
      params.factKey = step.factKey;
      params.expected = step.expected;
      params.unknownPolicy = step.unknownPolicy;
      break;
    case "CONDITION":
      params.condition = step.condition;
      params.onTrue = step.onTrue;
      params.onFalse = step.onFalse;
      params.unknownPolicy = step.unknownPolicy;
      params.onUnknown = step.onUnknown;
      break;
    case "SWITCH":
      params.branches = step.branches;
      params.default = step.default;
      params.unknownPolicy = step.unknownPolicy;
      break;
    case "FOR_EACH":
      params.itemsVariable = step.itemsVariable;
      params.maxIterations = step.maxIterations;
      params.itemVariable = step.itemVariable;
      params.indexVariable = step.indexVariable;
      params.body = step.body;
      params.emptyPolicy = step.emptyPolicy;
      break;
    case "WAIT_EVENT":
      params.factKey = step.factKey;
      params.sourceLane = step.sourceLane;
      params.stableForMs = step.stableForMs;
      params.requireCorrelation = step.requireCorrelation;
      params.onTimeout = step.onTimeout;
      break;
    case "REMOTE_ACTION":
    case "EXTERNAL_ACTION":
      params.spec = step.spec;
      break;
    case "CLEANUP":
      params.compensatesStepIds = step.compensatesStepIds;
      params.runOnFailure = step.runOnFailure;
      params.spec = step.spec;
      break;
    case "ANNOTATE":
      params.message = step.message;
      break;
    case "NOOP":
      params.reason = step.reason;
      break;
  }

  return params;
}

function findDomainSourceRef(sourceMapRef: string, ir: WorkflowIrV2): string | undefined {
  const entry = ir.sourceMap.find((e) => e.ref === sourceMapRef);
  return entry?.domainSourceRef;
}

function compileResourceRequirements(bundle: DomainPackBundle): CompiledResourceRequirementRef[] {
  return bundle.manifest.resourceRequirementRefs.map((r) => ({
    resourceRef: r.resourceRef,
    quantity: r.quantity,
    exclusive: r.exclusive,
    sourcePackKey: bundle.manifest.packKey,
    note: r.note,
  }));
}

function compileDomainDependencies(bundle: DomainPackBundle): CompiledDomainDependencyRef[] {
  return bundle.manifest.dependencies.map((d) => ({
    packKey: d.packKey,
    minVersion: formatDomainPackVersion(d.minVersion),
    consumedRefs: d.consumedRefs,
    failureModel: "BLOCKED" as const,
  }));
}
