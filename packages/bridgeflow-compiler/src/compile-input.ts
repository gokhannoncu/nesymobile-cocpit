/**
 * Compile input/output contract  (Plan D.7 · Phase 4C)
 *
 * CompileInput is what the compiler receives.
 * CompileResult is what the compiler produces — always, even on failure.
 * CompilePreviewDto is the human-readable preview for Phase 6 UI.
 */

import type { WorkflowIrV2 } from "@nesy/workflow-contract";
import type {
  DomainPackBundle,
  MacroDefinition,
  MacroExpansionSnapshot,
  TestProfileDefinition,
  LaunchProfile,
} from "@nesy/domain-pack-contracts";
import type { BridgeCapabilityManifest } from "@nesy/bridge-contract";
import type { BridgeFlowPlan } from "./bridgeflow-plan.js";
import type { CompileIssue } from "./compile-issues.js";

/** What the compiler receives. */
export interface CompileInput {
  /** The domain pack bundle to compile against. */
  bundle: DomainPackBundle;
  /** The workflow IR to compile (from macro expansion or editor). */
  workflowIr: WorkflowIrV2;
  /** Macro definitions involved in this compilation. */
  macros: readonly MacroDefinition[];
  /** Hand-authored expansion snapshots for validation. */
  expansionSnapshots: readonly MacroExpansionSnapshot[];
  /** Bridge device capability manifest. */
  deviceCapabilities: BridgeCapabilityManifest;
  /** Compiler options. */
  options?: CompileOptions;
}

export interface CompileOptions {
  /** Strict mode — all warnings become errors. */
  strict?: boolean;
  /** Maximum issues before aborting (no first-error-only). */
  maxIssues?: number;
  /** Include source-map breadcrumbs in preview. */
  includeSourceMap?: boolean;
}

/** What the compiler always produces — success or failure. */
export interface CompileResult {
  /** Whether compilation succeeded without errors. */
  ok: boolean;
  /** The compiled plan, present only when ok === true. */
  plan?: BridgeFlowPlan;
  /** All issues collected during compilation. Never first-error-only. */
  issues: readonly CompileIssue[];
  /** Summary statistics. */
  stats: CompileStats;
}

export interface CompileStats {
  totalSteps: number;
  totalWaitPlans: number;
  totalEvidenceRequirements: number;
  totalCapabilityRequirements: number;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  compileDurationMs: number;
}

/** Test profile compile input. */
export interface TestProfileCompileInput {
  bundle: DomainPackBundle;
  profile: TestProfileDefinition;
  launchProfile: LaunchProfile;
  deviceCapabilities: BridgeCapabilityManifest;
  options?: CompileOptions;
}

/** Test profile compile result. */
export interface TestProfileCompileResult {
  ok: boolean;
  /** One plan per included workflow. */
  plans: readonly BridgeFlowPlan[];
  issues: readonly CompileIssue[];
  stats: CompileStats;
  /** Resource/dependency refs compiled (no lease runtime). */
  resourceRefs: readonly import("./bridgeflow-plan.js").CompiledResourceRequirementRef[];
  dependencyRefs: readonly import("./bridgeflow-plan.js").CompiledDomainDependencyRef[];
  /** Differential baseline source-map, when profile is DIFFERENTIAL. */
  differentialSourceMap?: DifferentialCompileSourceMap;
}

export interface DifferentialCompileSourceMap {
  baselineBuildRef: string;
  criticalFactKeys: readonly string[];
  /** Source-map entries for baseline comparison points. */
  comparisonPoints: readonly DifferentialComparisonPoint[];
}

export interface DifferentialComparisonPoint {
  factKey: string;
  planStepId: string;
  sourceMapRef: string;
  baselineExpected: string;
}

/** Human-readable compile preview for Phase 6 UI. */
export interface CompilePreviewDto {
  summary: string;
  workflowRef: string;
  packKey: string;
  packVersion: string;
  totalSteps: number;
  warnings: readonly CompilePreviewWarning[];
  errors: readonly CompilePreviewError[];
  sourceMapBreadcrumbs: readonly CompilePreviewBreadcrumb[];
  expectedWaits: readonly CompilePreviewWait[];
  expectedInterrupts: readonly CompilePreviewInterrupt[];
  evidenceRequirements: readonly CompilePreviewEvidence[];
  capabilityGaps: readonly CompilePreviewCapabilityGap[];
}

export interface CompilePreviewWarning {
  code: string;
  message: string;
  sourceRef?: string;
}

export interface CompilePreviewError {
  code: string;
  message: string;
  sourceRef?: string;
}

export interface CompilePreviewBreadcrumb {
  macroRef: string;
  irStepId: string;
  planStepId: string;
  description: string;
}

export interface CompilePreviewWait {
  waitPlanId: string;
  targetDescription: string;
  deadlineMs: number;
}

export interface CompilePreviewInterrupt {
  surfaceRef: string;
  policy: string;
}

export interface CompilePreviewEvidence {
  factKey: string;
  plane: string;
  authority: string;
  requirement: string;
}

export interface CompilePreviewCapabilityGap {
  capability: string;
  reason: string;
  severity: string;
}
