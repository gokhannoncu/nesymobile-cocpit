/**
 * UiWaitPlan compilation  (Plan B.10D · Phase 4C)
 *
 * Compiles expected/interrupt surfaces from the domain pack into
 * CompiledUiWaitPlan instances. Key rules:
 *   - NO FULL DUMP HOT PATH
 *   - Bounded wait_any request
 *   - stableForMs, deadlineMs, maxLegs, candidateLimit, ambiguity policy
 *   - hostOnlyCancel capability fallback
 *   - wait_any/cancel_request capability check with B-13 fallback
 */

import type { WorkflowIrV2, WorkflowStepV2 } from "@nesy/workflow-contract";
import type { DomainPackRegistries, MacroDefinition } from "@nesy/domain-pack-contracts";
import type { BridgeCapabilityManifest } from "@nesy/bridge-contract";
import type {
  CompiledUiWaitPlan,
  CompiledUiWaitTarget,
  CompiledUiInterruptTarget,
} from "./ui-wait-plan.js";
import type { CompileIssue } from "./compile-issues.js";
import { createIssue } from "./compile-issues.js";
import { resolveWaitAnyCapability } from "./capability.js";

/**
 * Compile UiWaitPlans for all wait-bearing steps in the IR.
 */
export function compileWaitPlans(
  ir: WorkflowIrV2,
  registries: DomainPackRegistries,
  deviceCapabilities: BridgeCapabilityManifest,
  issues: CompileIssue[],
): CompiledUiWaitPlan[] {
  const waitPlans: CompiledUiWaitPlan[] = [];
  const surfaceMap = new Map(registries.surfaces.map((s) => [s.surfaceKey, s]));
  const macroMap = new Map(registries.macros.map((m) => [m.macroKey, m]));

  for (const step of ir.steps) {
    if (step.kind === "WAIT_ANY" || step.kind === "WAIT_EVENT") {
      const plan = compileStepWaitPlan(
        step,
        ir,
        surfaceMap,
        macroMap,
        deviceCapabilities,
        issues,
      );
      if (plan) waitPlans.push(plan);
    }
  }

  return waitPlans;
}

function compileStepWaitPlan(
  step: WorkflowStepV2,
  ir: WorkflowIrV2,
  surfaceMap: ReadonlyMap<string, { surfaceKey: string; kind: string }>,
  macroMap: ReadonlyMap<string, MacroDefinition>,
  deviceCapabilities: BridgeCapabilityManifest,
  issues: CompileIssue[],
): CompiledUiWaitPlan | undefined {
  const path = `steps[${step.planStepId}]`;

  // Build expected targets
  const expected: CompiledUiWaitTarget[] = [];
  const interrupts: CompiledUiInterruptTarget[] = [];

  if (step.kind === "WAIT_ANY") {
    for (const leg of step.legs) {
      expected.push({
        key: leg.legId,
        predicate: {
          selector: { by: "id", value: leg.factKey },
          until: "APPEAR",
        },
        primary: true,
      });
    }
  } else if (step.kind === "WAIT_EVENT") {
    expected.push({
      key: `wait-${step.planStepId}`,
      predicate: {
        selector: { by: "id", value: step.factKey },
        until: "APPEAR",
        stableForMs: step.stableForMs,
      },
      primary: true,
    });
  }

  // Find the macro that owns this step and get interrupt policy
  const domainSourceEntry = ir.sourceMap.find((e) => e.ref === step.sourceMapRef);
  if (domainSourceEntry?.domainSourceRef) {
    const macro = macroMap.get(domainSourceEntry.domainSourceRef);
    if (macro) {
      // Add handled interrupts
      for (const surfaceRef of macro.interruptPolicy.handledSurfaceRefs) {
        const surface = surfaceMap.get(surfaceRef);
        if (!surface) {
          issues.push(
            createIssue(
              "MISSING_INTERRUPT_POLICY",
              `Macro "${macro.macroKey}" references unknown handled interrupt surface "${surfaceRef}"`,
              { path: `${path}.interrupts`, sourceRef: macro.macroKey },
            ),
          );
          continue;
        }
        interrupts.push({
          key: `interrupt-${surfaceRef}`,
          predicate: {
            selector: { by: "id", value: surfaceRef },
            until: "APPEAR",
          },
          expected: false,
          surfaceRef,
          onInterrupt: "HANDLE",
        });
      }

      // Add fatal interrupts
      for (const surfaceRef of macro.interruptPolicy.fatalSurfaceRefs) {
        const surface = surfaceMap.get(surfaceRef);
        if (!surface) {
          issues.push(
            createIssue(
              "MISSING_INTERRUPT_POLICY",
              `Macro "${macro.macroKey}" references unknown fatal interrupt surface "${surfaceRef}"`,
              { path: `${path}.interrupts`, sourceRef: macro.macroKey },
            ),
          );
          continue;
        }
        interrupts.push({
          key: `fatal-${surfaceRef}`,
          predicate: {
            selector: { by: "id", value: surfaceRef },
            until: "APPEAR",
          },
          expected: false,
          surfaceRef,
          onInterrupt: "FATAL",
        });
      }
    }
  }

  // Resolve capability fallbacks
  const capabilityFallbacks = resolveWaitAnyCapability(
    deviceCapabilities,
    step.capabilityRequirements,
    issues,
  );

  const maxLegs = step.kind === "WAIT_ANY" ? step.maxLegs : 1;
  const hostOnlyCancel = step.kind === "WAIT_ANY" ? step.hostOnlyCancel : false;

  // Validate: no full dump hot path
  // The primary evaluation path must never rely on a full accessibility dump

  return {
    waitPlanId: `wp-${step.planStepId}`,
    planStepId: step.planStepId,
    sourceMapRef: step.sourceMapRef,
    expected,
    interrupts,
    deadlineMs: step.timeoutMs,
    stableForMs: step.kind === "WAIT_EVENT" ? step.stableForMs : undefined,
    maxLegs,
    ambiguityPolicy: "FAIL",
    hostOnlyCancel,
    capabilityFallbacks,
  };
}
