/**
 * Target validation  (Plan D.7.7 · Phase 4C)
 *
 * Validates TargetFingerprints for strength, ambiguity, and drift.
 * rowIndexHint/text-only weak targets produce warnings or errors.
 * Ambiguous targets use the pack's AmbiguityPolicy (default: FAIL).
 */

import type { WorkflowIrV2 } from "@nesy/workflow-contract";
import type { DomainPackRegistries } from "@nesy/domain-pack-contracts";
import type { CompileIssue } from "./compile-issues.js";
import { createIssue } from "./compile-issues.js";

/**
 * Validate all target references in the workflow IR against the pack registries.
 */
export function compileTargets(
  ir: WorkflowIrV2,
  registries: DomainPackRegistries,
  issues: CompileIssue[],
): void {
  const targetKeys = new Set(registries.targets.map((t) => t.targetKey));

  for (const step of ir.steps) {
    if (step.kind === "RESOLVE_TARGET") {
      const path = `steps[${step.planStepId}]`;

      if (!targetKeys.has(step.targetRef)) {
        issues.push(
          createIssue(
            "TARGET_FINGERPRINT_MISSING",
            `RESOLVE_TARGET step "${step.planStepId}" references unknown target "${step.targetRef}"`,
            { path: `${path}.targetRef`, sourceRef: step.sourceMapRef },
          ),
        );
        continue;
      }

      const target = registries.targets.find((t) => t.targetKey === step.targetRef)!;

      // Check target resolution policy strength
      validateTargetStrength(target, path, issues);
    }

    // Check BRIDGE_ACTION targets too
    if (step.kind === "BRIDGE_ACTION" && step.targetVariable) {
      // The target variable should have been resolved by a prior RESOLVE_TARGET step
      const resolveStep = ir.steps.find(
        (s) => s.kind === "RESOLVE_TARGET" && s.outputVariable === step.targetVariable,
      );
      if (!resolveStep) {
        issues.push(
          createIssue(
            "TARGET_FINGERPRINT_MISSING",
            `BRIDGE_ACTION step "${step.planStepId}" uses target variable "${step.targetVariable}" without prior RESOLVE_TARGET`,
            { path: `steps[${step.planStepId}].targetVariable`, sourceRef: step.sourceMapRef },
          ),
        );
      }
    }
  }
}

interface TargetLike {
  targetKey: string;
  resolution: {
    ambiguityPolicy: string;
    chain: readonly { kind: string; establishesIdentity: boolean }[];
  };
}

function validateTargetStrength(
  target: TargetLike,
  path: string,
  issues: CompileIssue[],
): void {
  const strategies = target.resolution.chain.map((c) => c.kind);

  // Check if the chain is weak (only ROW_INDEX_HINT or TEXT_MATCH without identity)
  const hasIdentity = strategies.some((s) =>
    s === "ACCESSIBILITY_ID" || s === "ENTITY_BINDING" || s === "STRUCTURAL_FINGERPRINT",
  );

  if (!hasIdentity) {
    // Text-only or row-index-only target
    if (strategies.includes("ROW_INDEX_HINT") && strategies.length === 1) {
      issues.push(
        createIssue(
          "WEAK_TARGET_ROW_INDEX",
          `Target "${target.targetKey}" relies solely on ROW_INDEX_HINT; this is a weak identity that may drift`,
          { path: `${path}.targetRef`, sourceRef: target.targetKey },
        ),
      );
    } else if (strategies.every((s) => s === "TEXT_MATCH" || s === "ROW_INDEX_HINT")) {
      issues.push(
        createIssue(
          "WEAK_TARGET_TEXT_ONLY",
          `Target "${target.targetKey}" uses only text/row-index strategies; consider adding ACCESSIBILITY_ID or ENTITY_BINDING`,
          { path: `${path}.targetRef`, sourceRef: target.targetKey },
        ),
      );
    }
  }

  // Check ambiguity policy
  if (target.resolution.ambiguityPolicy === "FIRST_MATCH") {
    issues.push(
      createIssue(
        "AMBIGUOUS_TARGET",
        `Target "${target.targetKey}" uses FIRST_MATCH ambiguity policy which is not allowed; use FAIL instead`,
        { path: `${path}.targetRef`, sourceRef: target.targetKey },
      ),
    );
  }
}
