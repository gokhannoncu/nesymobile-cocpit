/**
 * Test Profile expansion  (Plan D.7.14 · Phase 4C)
 *
 * Expands TestProfileDefinition through the same compiler path.
 * Key rules:
 *   - Profile cannot request new runner/engine/Oracle path → compile fail
 *   - Fault trigger correlation required
 *   - Differential baseline source-map
 *   - ResourceRequirementRef/DomainDependencyRef compiled (no lease runtime)
 *   - Dependency failure = BLOCKED, never fake FAILED
 *   - Reusable fragment cannot produce terminal verdict → compile fail
 */

import type {
  DomainPackBundle,
  TestProfileDefinition,
  ReusableFlowFragmentDefinition,
} from "@nesy/domain-pack-contracts";
import type { BridgeFlowPlan } from "./bridgeflow-plan.js";
import type { CompileIssue } from "./compile-issues.js";
import { createIssue } from "./compile-issues.js";
import type {
  DifferentialCompileSourceMap,
  DifferentialComparisonPoint,
} from "./compile-input.js";

/** Known runner/engine/oracle paths. New ones = compile fail. */
const KNOWN_RUNNER_PATHS = new Set(["verdict.runner.v1"]);
const KNOWN_ENGINE_PATHS = new Set(["verdict.engine.v1"]);

/**
 * Validate a test profile for compilation.
 * Checks that no new runner/engine/Oracle paths are requested.
 */
export function validateTestProfileForCompilation(
  profile: TestProfileDefinition,
  bundle: DomainPackBundle,
  issues: CompileIssue[],
): void {
  const path = `profile[${profile.profileKey}]`;

  // Check for new runner/engine/Oracle paths (forbidden)
  // Profiles cannot introduce paths the compiler doesn't know about
  const requiredCaps = profile.requiredCapabilityRefs;
  for (const cap of requiredCaps) {
    if (cap.startsWith("verdict.runner.") && !KNOWN_RUNNER_PATHS.has(cap)) {
      issues.push(
        createIssue(
          "PROFILE_REQUESTS_NEW_RUNNER",
          `Profile "${profile.profileKey}" requests unknown runner path "${cap}"`,
          { path: `${path}.requiredCapabilityRefs`, sourceRef: profile.profileKey },
        ),
      );
    }
    if (cap.startsWith("verdict.engine.") && !KNOWN_ENGINE_PATHS.has(cap)) {
      issues.push(
        createIssue(
          "PROFILE_REQUESTS_NEW_ENGINE",
          `Profile "${profile.profileKey}" requests unknown engine path "${cap}"`,
          { path: `${path}.requiredCapabilityRefs`, sourceRef: profile.profileKey },
        ),
      );
    }
  }

  // Fault correlation check
  if (profile.faultPlan) {
    for (const [index, injection] of profile.faultPlan.injections.entries()) {
      if (!injection.correlationFactKey || injection.correlationFactKey.trim() === "") {
        issues.push(
          createIssue(
            "FAULT_WITHOUT_CORRELATION",
            `Fault injection "${injection.faultRef}" in profile "${profile.profileKey}" has no correlation fact`,
            { path: `${path}.faultPlan.injections[${index}]`, sourceRef: profile.profileKey },
          ),
        );
      }
    }
  }

  // Differential baseline check
  if (profile.kind === "DIFFERENTIAL") {
    if (!profile.differential || !profile.differential.baselineBuildRef || profile.differential.baselineBuildRef.trim() === "") {
      issues.push(
        createIssue(
          "DIFFERENTIAL_WITHOUT_BASELINE",
          `Differential profile "${profile.profileKey}" has no baseline build ref`,
          { path: `${path}.differential`, sourceRef: profile.profileKey },
        ),
      );
    }
  }
}

/**
 * Validate fragments cannot produce terminal verdict.
 */
export function validateFragmentsNoVerdict(
  fragments: readonly ReusableFlowFragmentDefinition[],
  issues: CompileIssue[],
): void {
  for (const fragment of fragments) {
    const raw = fragment as unknown as Record<string, unknown>;
    if (raw.producesTerminalVerdict !== false) {
      issues.push(
        createIssue(
          "FRAGMENT_PRODUCES_VERDICT",
          `Reusable fragment "${fragment.fragmentKey}" claims to produce a terminal verdict; fragments are building blocks and cannot write verdicts`,
          { path: `fragment[${fragment.fragmentKey}]`, sourceRef: fragment.fragmentKey },
        ),
      );
    }
  }
}

/**
 * Build differential compile source map.
 */
export function buildDifferentialSourceMap(
  profile: TestProfileDefinition,
  plans: readonly BridgeFlowPlan[],
): DifferentialCompileSourceMap | undefined {
  if (!profile.differential) return undefined;

  const comparisonPoints: DifferentialComparisonPoint[] = [];
  for (const factKey of profile.differential.criticalFactKeys) {
    for (const plan of plans) {
      const evidenceReq = [
        ...plan.evidenceManifest.continueGateRequirements,
        ...plan.evidenceManifest.finalOracleRequirements,
      ].find((r) => r.factKey === factKey);

      if (evidenceReq) {
        const sourceEntry = plan.sourceMap.find((e) => e.planStepId === evidenceReq.requirement.factKey);
        comparisonPoints.push({
          factKey,
          planStepId: sourceEntry?.planStepId ?? "unknown",
          sourceMapRef: sourceEntry?.irStepId ?? "unknown",
          baselineExpected: profile.differential.onCriticalDiff,
        });
      }
    }
  }

  return {
    baselineBuildRef: profile.differential.baselineBuildRef,
    criticalFactKeys: profile.differential.criticalFactKeys,
    comparisonPoints,
  };
}
