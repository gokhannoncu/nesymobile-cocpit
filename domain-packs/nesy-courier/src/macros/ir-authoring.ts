/**
 * ===========================================================================
 *  Snapshot authoring helpers  (RUN_PLAY 4B.17 · 4B.18)
 *
 *  This file is the domain compiler authoring surface for first-party Nesy
 *  macros. It fills in the boilerplate every compiled IR snapshot needs — a
 *  default retry policy, a run deadline, an artifact policy — so that the
 *  interesting fields of a slice stay readable in the diff.
 *
 *  The expansion logic is intentionally explicit in each macro module and emits
 *  WorkflowIR v2, not free-form runtime code. That makes the deterministic
 *  compiler output reviewable while keeping Nesy vocabulary out of Core.
 *
 *  Every snapshot produced with these helpers is validated against
 *  `validateWorkflowIrV2` by the test suite and labelled
 *  `authoredBy: "COMPILER"` so downstream compile paths no longer treat them as
 *  provisional hand snapshots.
 * ===========================================================================
 */

import type {
  StepRetryPolicy,
  WorkflowCapabilityRequirement,
  WorkflowInputDeclaration,
  WorkflowIrV2,
  WorkflowPolicies,
  WorkflowSourceMapEntry,
  WorkflowStepV2,
  WorkflowVariableDeclaration,
} from "@nesy/workflow-contract";

/** Read-only work is safely retryable, so this is the sane default. */
export const READ_ONLY_RETRY: StepRetryPolicy = { maxAttempts: 1, effectClass: "READ_ONLY" };

/** A mutation is retried only when the adapter suppresses duplicates by key. */
export const KEYED_MUTATION_RETRY: StepRetryPolicy = { maxAttempts: 1, effectClass: "IDEMPOTENT_MUTATION" };

const DEFAULT_POLICIES: WorkflowPolicies = {
  runDeadlineMs: 600_000,
  cleanupDeadlineMs: 60_000,
  defaultRetry: READ_ONLY_RETRY,
  artifactPolicy: { captureOnSuccess: false, captureOnFailure: true, kinds: ["SCREENSHOT", "UI_TREE"] },
  redactionPolicy: { redactPaths: ["run.input.pin", "run.input.password"] },
};

/** Fields shared by every step, so a slice file only shows what differs. */
export interface StepBaseSeed {
  planStepId: string;
  sourceMapRef: string;
  next: string | null;
  timeoutMs?: number;
  retryPolicy?: StepRetryPolicy;
  capabilityRequirements?: readonly WorkflowCapabilityRequirement[];
}

export function stepBase(seed: StepBaseSeed): {
  planStepId: string;
  sourceMapRef: string;
  next: string | null;
  timeoutMs: number;
  retryPolicy: StepRetryPolicy;
  capabilityRequirements: readonly WorkflowCapabilityRequirement[];
} {
  return {
    planStepId: seed.planStepId,
    sourceMapRef: seed.sourceMapRef,
    next: seed.next,
    timeoutMs: seed.timeoutMs ?? 20_000,
    retryPolicy: seed.retryPolicy ?? READ_ONLY_RETRY,
    capabilityRequirements: seed.capabilityRequirements ?? [],
  };
}

/** Declares a hard capability requirement. */
export function requires(capability: string): WorkflowCapabilityRequirement {
  return { capability, optional: false };
}

/**
 * Declares an optional capability with a fallback.
 *
 * This is B-13 in practice: a Bridge v1 device has no `wait_any`, so a plan that
 * hard-required it could not run at all. Declaring the fallback lets the compiler
 * degrade to sequential legs instead of rejecting the workflow.
 */
export function optionally(
  capability: string,
  fallback: NonNullable<WorkflowCapabilityRequirement["fallback"]>,
): WorkflowCapabilityRequirement {
  return { capability, optional: true, fallback };
}

export interface IrDocumentSeed {
  workflowId: string;
  name: string;
  inputs: readonly WorkflowInputDeclaration[];
  variables: readonly WorkflowVariableDeclaration[];
  steps: readonly WorkflowStepV2[];
  entryStepId: string;
  sourceMap: readonly WorkflowSourceMapEntry[];
  capabilityRequirements: readonly WorkflowCapabilityRequirement[];
  /** Domain Pack provenance ref, e.g. the macro key. */
  sourceRef: string;
}

/** Assembles a complete, validatable IR document from a slice's own fields. */
export function irDocument(seed: IrDocumentSeed): WorkflowIrV2 {
  return {
    schemaVersion: 2,
    workflowId: seed.workflowId,
    workflowVersion: 1,
    name: seed.name,
    source: { kind: "DOMAIN_PACK_EXPANSION", ref: seed.sourceRef },
    inputs: seed.inputs,
    variables: seed.variables,
    steps: seed.steps,
    entryStepId: seed.entryStepId,
    policies: DEFAULT_POLICIES,
    capabilityRequirements: seed.capabilityRequirements,
    sourceMap: seed.sourceMap,
  };
}

/** One source-map entry. Keeps the ref/step pairing visible at the call site. */
export function sourceMapEntry(ref: string, planStepId: string, macroKey: string, note?: string): WorkflowSourceMapEntry {
  return { ref, planStepId, domainSourceRef: macroKey, ...(note === undefined ? {} : { note }) };
}
