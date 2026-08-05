/**
 * BridgeFlowCompiler output contract (Plan D.7 · Phase 4C)
 *
 * BridgeFlowPlan is the deterministic, device-action-free compilation product.
 * Phase 5 BridgeFlowExecutor consumes this plan; the compiler never executes it.
 *
 * Three prohibitions enforced by test:
 *   NO EXECUTOR — no executePlan, no dispatchBridgeCommand, no DeviceWorker.
 *   NO DOMAIN — no STOP, PARCEL, COURIER, TOUR in exports.
 *   NO FIXED WAIT — deadlines are upper bounds on event-driven evaluation.
 */

import type {
  WorkflowStepKind,
  EntityRef,
  IterationPath,
  OracleRequirement,
  EvidencePolicy,
  FinalOraclePolicy
} from "@nesy/workflow-contract";

import type {
  DomainPackVersion
} from "@nesy/domain-pack-contracts";

export type BridgeFlowPlanSchemaVersion = 1;
export const BRIDGEFLOW_PLAN_SCHEMA_VERSION: BridgeFlowPlanSchemaVersion = 1;

/** Fact delivery lane — how evidence must be delivered for correctness. */
export type FactDeliveryLane = "RECEIPT_SAFE" | "ORDERED_REQUIRED";
export const FACT_DELIVERY_LANES: readonly FactDeliveryLane[] = ["RECEIPT_SAFE", "ORDERED_REQUIRED"];

/** Ambiguity resolution policy for target matching. */
export type AmbiguityPolicy = "FAIL" | "OPERATOR_ATTENTION" | "BEST_CANDIDATE";
export const AMBIGUITY_POLICIES: readonly AmbiguityPolicy[] = ["FAIL", "OPERATOR_ATTENTION", "BEST_CANDIDATE"];

/** Dependency failure is BLOCKED, never fake-FAILED. */
export type DependencyFailureModel = "BLOCKED";
export const DEPENDENCY_FAILURE_MODEL: DependencyFailureModel = "BLOCKED";

/** How a compiled step maps back to domain/IR/plan layers. */
export interface CompiledSourceMapEntry {
  planStepId: string;
  irStepId: string;
  domainSourceRef?: string;
  macroRef?: string;
  sliceRef?: string;
  note?: string;
}

export type CompiledSourceMap = readonly CompiledSourceMapEntry[];

/** Compiled evidence requirement — unified, no parallel string lists. */
export interface CompiledEvidenceRequirement {
  factKey: string;
  lane: FactDeliveryLane;
  requirement: OracleRequirement;
  sourceAuthority: string;
  correlationRequired: boolean;
  freshnessMaxAgeMs: number;
}

/** Compiled resource requirement ref — compile-time only, no lease runtime. */
export interface CompiledResourceRequirementRef {
  resourceRef: string;
  quantity: number;
  exclusive: boolean;
  sourcePackKey: string;
  note?: string;
}

/** Compiled domain dependency ref — compile-time only, no lease runtime. */
export interface CompiledDomainDependencyRef {
  packKey: string;
  minVersion: string;
  consumedRefs: readonly string[];
  failureModel: DependencyFailureModel;
}

/** One step in the compiled plan. */
export interface BridgeFlowPlanStep {
  planStepId: string;
  kind: WorkflowStepKind;
  sourceMapRef: string;
  timeoutMs: number;
  next: string | null;
  entityBinding?: EntityRef;
  iterationPath?: IterationPath;
  capabilityRequirements: readonly CompiledCapabilityRequirement[];
  continueGate?: EvidencePolicy;
  finalOraclePolicy?: FinalOraclePolicy;
  evidenceRequirements: readonly CompiledEvidenceRequirement[];
  factDeliveryLane?: FactDeliveryLane;
  /** Step-specific parameters, varies by kind. */
  params: Readonly<Record<string, unknown>>;
}

/** Plan-level capability requirement with fallback. */
export interface CompiledCapabilityRequirement {
  capability: string;
  optional: boolean;
  fallback?: string;
  sourceRef?: string;
}

/** Provenance of the compilation — who/what/when/digest chain. */
export interface CompileProvenance {
  compiledAt: string;
  compilerVersion: string;
  packKey: string;
  packVersion: string;
  packDigest: string;
  workflowRef: string;
  workflowVersion: number;
  sourceCommit?: string;
  irHash: string;
  derivedGraphDigest: string;
}

/** The plan hash — deterministic over canonical content. */
export interface BridgeFlowPlanHash {
  algorithm: "sha256";
  digest: string;
}

/** The root compiled plan document. */
export interface BridgeFlowPlan {
  schemaVersion: BridgeFlowPlanSchemaVersion;
  planId: string;
  hash: BridgeFlowPlanHash;
  provenance: CompileProvenance;
  packVersion: DomainPackVersion;
  packDigest: string;
  workflowRef: string;
  workflowVersion: number;
  appCompatibilityRefs: readonly string[];
  adapterCompatibilityRefs: readonly string[];
  steps: readonly BridgeFlowPlanStep[];
  entryStepId: string;
  waitPlans: readonly import("./ui-wait-plan.js").CompiledUiWaitPlan[];
  capabilityManifest: CompiledCapabilityManifest;
  evidenceManifest: CompiledEvidenceManifest;
  resourceRequirements: readonly CompiledResourceRequirementRef[];
  domainDependencies: readonly CompiledDomainDependencyRef[];
  sourceMap: CompiledSourceMap;
}

/** Plan-wide capability manifest. */
export interface CompiledCapabilityManifest {
  required: readonly CompiledCapabilityRequirement[];
  optional: readonly CompiledCapabilityRequirement[];
  gaps: readonly CompiledCapabilityGap[];
}

export interface CompiledCapabilityGap {
  capability: string;
  reason: string;
  severity: "ERROR" | "WARNING";
  fallback?: string;
}

/** Plan-wide evidence manifest. */
export interface CompiledEvidenceManifest {
  continueGateRequirements: readonly CompiledEvidenceRequirement[];
  finalOracleRequirements: readonly CompiledEvidenceRequirement[];
  derivedGraphDigest: string;
  factDeliveryLanes: ReadonlyMap<string, FactDeliveryLane> | readonly [string, FactDeliveryLane][];
}
