/**
 * Compile preview  (Plan D.7 · Phase 4C)
 *
 * Generates a human-readable CompilePreviewDto from a CompileResult.
 * This is what the Phase 6 UI will display to the user.
 */

import type { CompileResult } from "./compile-input.js";
import type {
  CompilePreviewDto,
  CompilePreviewWarning,
  CompilePreviewError,
  CompilePreviewBreadcrumb,
  CompilePreviewWait,
  CompilePreviewInterrupt,
  CompilePreviewEvidence,
  CompilePreviewCapabilityGap,
} from "./compile-input.js";

/**
 * Generate a human-readable preview from a compile result.
 */
export function generatePreview(result: CompileResult): CompilePreviewDto {
  const warnings: CompilePreviewWarning[] = result.issues
    .filter((i) => i.severity === "WARNING")
    .map((i) => ({ code: i.code, message: i.message, sourceRef: i.sourceRef }));

  const errors: CompilePreviewError[] = result.issues
    .filter((i) => i.severity === "ERROR")
    .map((i) => ({ code: i.code, message: i.message, sourceRef: i.sourceRef }));

  const sourceMapBreadcrumbs: CompilePreviewBreadcrumb[] = [];
  const expectedWaits: CompilePreviewWait[] = [];
  const expectedInterrupts: CompilePreviewInterrupt[] = [];
  const evidenceRequirements: CompilePreviewEvidence[] = [];
  const capabilityGaps: CompilePreviewCapabilityGap[] = [];

  if (result.plan) {
    // Source map breadcrumbs
    for (const entry of result.plan.sourceMap) {
      if (entry.macroRef) {
        sourceMapBreadcrumbs.push({
          macroRef: entry.macroRef,
          irStepId: entry.irStepId,
          planStepId: entry.planStepId,
          description: `${entry.macroRef} → ${entry.irStepId} → ${entry.planStepId}`,
        });
      }
    }

    // Wait plans
    for (const wp of result.plan.waitPlans) {
      expectedWaits.push({
        waitPlanId: wp.waitPlanId,
        targetDescription: wp.expected.map((t) => t.key).join(", "),
        deadlineMs: wp.deadlineMs,
      });
      for (const interrupt of wp.interrupts) {
        expectedInterrupts.push({
          surfaceRef: interrupt.surfaceRef ?? interrupt.key,
          policy: interrupt.onInterrupt,
        });
      }
    }

    // Evidence
    const allReqs = [
      ...result.plan.evidenceManifest.continueGateRequirements,
      ...result.plan.evidenceManifest.finalOracleRequirements,
    ];
    for (const req of allReqs) {
      evidenceRequirements.push({
        factKey: req.factKey,
        plane: "unknown", // Would need source lookup
        authority: req.sourceAuthority,
        requirement: req.requirement.obligation,
      });
    }

    // Capability gaps
    for (const gap of result.plan.capabilityManifest.gaps) {
      capabilityGaps.push({
        capability: gap.capability,
        reason: gap.reason,
        severity: gap.severity,
      });
    }
  }

  return {
    summary: result.ok
      ? `Compilation successful: ${result.stats.totalSteps} steps, ${result.stats.totalWaitPlans} wait plans`
      : `Compilation failed: ${result.stats.errorCount} errors, ${result.stats.warningCount} warnings`,
    workflowRef: result.plan?.workflowRef ?? "unknown",
    packKey: result.plan?.provenance.packKey ?? "unknown",
    packVersion: result.plan?.provenance.packVersion ?? "unknown",
    totalSteps: result.stats.totalSteps,
    warnings,
    errors,
    sourceMapBreadcrumbs,
    expectedWaits,
    expectedInterrupts,
    evidenceRequirements,
    capabilityGaps,
  };
}
