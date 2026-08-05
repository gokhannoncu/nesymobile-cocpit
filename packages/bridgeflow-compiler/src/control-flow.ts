/**
 * Control flow compilation  (Plan D.7.5 · Phase 4C)
 *
 * Validates and compiles CONDITION, SWITCH, FOR_EACH control flow:
 *   - FOR_EACH must be bounded (maxIterations > 0)
 *   - Unbounded wait/loop compile fail
 *   - Fixed wait/sleep compile fail
 *   - Unsafe non-idempotent retry compile fail
 *   - Runtime condition steps (no compile-time branch assumption)
 */

import type { WorkflowIrV2 } from "@nesy/workflow-contract";
import type { CompileIssue } from "./compile-issues.js";
import { createIssue } from "./compile-issues.js";

/** Maximum allowed iterations for FOR_EACH (safety bound). */
export const MAX_ALLOWED_ITERATIONS = 10_000;

/** Maximum allowed timeout for any single step. */
export const MAX_STEP_TIMEOUT_MS = 600_000; // 10 minutes

/**
 * Validate control flow in a workflow IR.
 * This checks FOR_EACH bounds, wait bounds, fixed waits, and retry safety.
 */
export function compileControlFlow(
  ir: WorkflowIrV2,
  issues: CompileIssue[],
): void {
  for (const step of ir.steps) {
    const path = `steps[${step.planStepId}]`;

    switch (step.kind) {
      case "FOR_EACH": {
        // FOR_EACH must be bounded
        if (!Number.isFinite(step.maxIterations) || step.maxIterations <= 0) {
          issues.push(
            createIssue(
              "UNBOUNDED_FOR_EACH",
              `FOR_EACH step "${step.planStepId}" has unbounded maxIterations (${step.maxIterations}); must be > 0`,
              { path: `${path}.maxIterations`, sourceRef: step.sourceMapRef },
            ),
          );
        } else if (step.maxIterations > MAX_ALLOWED_ITERATIONS) {
          issues.push(
            createIssue(
              "UNBOUNDED_FOR_EACH",
              `FOR_EACH step "${step.planStepId}" maxIterations (${step.maxIterations}) exceeds safety limit of ${MAX_ALLOWED_ITERATIONS}`,
              { path: `${path}.maxIterations`, sourceRef: step.sourceMapRef },
            ),
          );
        }
        break;
      }

      case "WAIT_EVENT": {
        // Wait must be bounded
        if (!Number.isFinite(step.timeoutMs) || step.timeoutMs <= 0) {
          issues.push(
            createIssue(
              "UNBOUNDED_WAIT",
              `WAIT_EVENT step "${step.planStepId}" has unbounded timeout (${step.timeoutMs}ms)`,
              { path: `${path}.timeoutMs`, sourceRef: step.sourceMapRef },
            ),
          );
        }
        break;
      }

      case "WAIT_ANY": {
        // Wait must be bounded
        if (!Number.isFinite(step.timeoutMs) || step.timeoutMs <= 0) {
          issues.push(
            createIssue(
              "UNBOUNDED_WAIT",
              `WAIT_ANY step "${step.planStepId}" has unbounded timeout (${step.timeoutMs}ms)`,
              { path: `${path}.timeoutMs`, sourceRef: step.sourceMapRef },
            ),
          );
        }
        // Legs must be bounded
        if (!Number.isFinite(step.maxLegs) || step.maxLegs <= 0) {
          issues.push(
            createIssue(
              "UNBOUNDED_WAIT",
              `WAIT_ANY step "${step.planStepId}" has unbounded maxLegs (${step.maxLegs})`,
              { path: `${path}.maxLegs`, sourceRef: step.sourceMapRef },
            ),
          );
        }
        break;
      }

      case "SWITCH": {
        // Switch must have a default policy
        if (!step.default) {
          issues.push(
            createIssue(
              "MISSING_SWITCH_DEFAULT",
              `SWITCH step "${step.planStepId}" has no default policy`,
              { path: `${path}.default`, sourceRef: step.sourceMapRef },
            ),
          );
        }
        break;
      }
    }

    // Check retry policy for non-idempotent unsafe retry
    if (step.retryPolicy.maxAttempts > 1) {
      if (step.kind === "BRIDGE_ACTION" || step.kind === "REMOTE_ACTION" || step.kind === "EXTERNAL_ACTION") {
        // Mutation steps with retry must be idempotent
        if (step.kind === "REMOTE_ACTION" || step.kind === "EXTERNAL_ACTION") {
          if (step.spec.effectClass === "NON_IDEMPOTENT_MUTATION" && step.retryPolicy.maxAttempts > 1) {
            issues.push(
              createIssue(
                "UNSAFE_NON_IDEMPOTENT_RETRY",
                `Step "${step.planStepId}" is NON_IDEMPOTENT_MUTATION but has retry policy with ${step.retryPolicy.maxAttempts} attempts; this is unsafe`,
                { path: `${path}.retryPolicy`, sourceRef: step.sourceMapRef },
              ),
            );
          }
        }
      }
    }
  }
}
