/**
 * Evidence compilation  (Plan D.7.8 · Phase 4C)
 *
 * Compiles evidence requirements from the domain pack:
 *   - Continue Gate and Final Oracle STAY SEPARATE
 *   - Unified OracleRequirement (no parallel string lists)
 *   - Authority/correlation/freshness written to plan
 *   - HTTP 2xx not treated as business success
 *   - Derived fact graph/reducer digest included in plan hash
 *   - Fact delivery lane: RECEIPT_SAFE / ORDERED_REQUIRED
 *   - ORDERED_REQUIRED fact connected to receipt-only gate → compile fail
 */

import type { WorkflowIrV2, OracleRequirement } from "@nesy/workflow-contract";
import type {
  DomainPackRegistries,
  EvidenceSourceDefinition,
  DerivedFactDefinition,
} from "@nesy/domain-pack-contracts";
import type {
  CompiledEvidenceManifest,
  CompiledEvidenceRequirement,
  FactDeliveryLane,
} from "./bridgeflow-plan.js";
import type { CompileIssue } from "./compile-issues.js";
import { createIssue } from "./compile-issues.js";
import { digestPlanDocument } from "./canonical.js";

/**
 * Freshness for a fact synthesized from a remote adapter operation.
 *
 * The operation declares no freshness of its own, and the requirement's own
 * deadline governs how long the executor waits — this bound only says how long
 * an already-observed remote fact stays usable.
 */
const REMOTE_FACT_MAX_AGE_MS = 30_000;

/**
 * Compile evidence requirements from the workflow and pack.
 */
export function compileEvidence(
  ir: WorkflowIrV2,
  registries: DomainPackRegistries,
  issues: CompileIssue[],
): CompiledEvidenceManifest {
  const sourceByKey = new Map<string, EvidenceSourceDefinition>();
  for (const source of registries.evidenceSources) {
    if (source.factKey) sourceByKey.set(source.factKey, source);
  }
  const derivedByKey = new Map<string, DerivedFactDefinition>();
  for (const fact of registries.derivedFacts.facts) {
    derivedByKey.set(fact.factKey, fact);
  }
  // A back-office VALIDATION operation is an evidence source: it exists to
  // answer "did the record really reach this status?". Reading only
  // evidenceSources/derivedFacts made every remotely-sourced fact compile as
  // MISSING_EVIDENCE_SOURCE, which forced packs to either duplicate the
  // declaration or drop the backend check.
  const remoteByKey = new Map<string, EvidenceSourceDefinition>();
  for (const adapter of registries.remoteAdapters) {
    for (const operation of adapter.operations) {
      for (const output of operation.outputs) {
        if (remoteByKey.has(output.factKey) || sourceByKey.has(output.factKey)) continue;
        remoteByKey.set(output.factKey, {
          sourceKey: `${adapter.adapterRef}:${operation.operationRef}`,
          plane: "REMOTE",
          kind: "REMOTE_VALIDATOR",
          // Transport-success-only operations stay non-PRIMARY, so the HTTP-2xx
          // rule below still fires for them.
          authority: operation.transportSuccessOnly === true ? "FALLBACK" : "PRIMARY",
          displayName: operation.displayName,
          factKey: output.factKey,
          observationRef: operation.operationRef,
          freshness: { maxAgeMs: REMOTE_FACT_MAX_AGE_MS, onStale: "REOBSERVE" },
          correlation: {
            // A remote fact with no correlation path cannot say WHICH record it
            // is about, so it must not be treated as entity-matched.
            requireEntityMatch: output.correlationPath !== undefined,
            requireOccurrenceMatch: true,
            correlationPaths: output.correlationPath === undefined ? [] : [output.correlationPath],
            crossPlane: true,
          },
          redaction: { redactPaths: operation.audit.redactFields },
          preservesRawEvidence: operation.audit.recordResponse,
          requiredCapabilityRefs: adapter.requiredCapabilityRefs,
          ...(operation.transportSuccessOnly === undefined
            ? {}
            : { transportSuccessOnly: operation.transportSuccessOnly }),
        });
      }
    }
  }
  for (const [factKey, source] of remoteByKey) sourceByKey.set(factKey, source);

  const continueGateReqs: CompiledEvidenceRequirement[] = [];
  const finalOracleReqs: CompiledEvidenceRequirement[] = [];
  const factLanes = new Map<string, FactDeliveryLane>();

  for (const step of ir.steps) {
    const path = `steps[${step.planStepId}]`;

    // Continue Gate requirements — EvidencePolicy has allOf/anyOf/noneOf fact key arrays
    if (step.continueGate) {
      const gateFactKeys = [
        ...(step.continueGate.allOf ?? []),
        ...(step.continueGate.anyOf ?? []),
        ...(step.continueGate.noneOf ?? []),
      ];
      for (const factKey of gateFactKeys) {
        const compiled = compileEvidenceRequirementFromFactKey(
          factKey, sourceByKey, derivedByKey, "continue-gate", path, step.continueGate.deadlineMs, issues,
        );
        if (compiled) {
          continueGateReqs.push(compiled);
          factLanes.set(factKey, compiled.lane);
        }
      }
    }

    // Final Oracle requirements — FinalOraclePolicy has requirements: OracleRequirement[]
    if (step.finalOraclePolicy) {
      for (const req of step.finalOraclePolicy.requirements) {
        const compiled = compileEvidenceRequirement(
          req, sourceByKey, derivedByKey, "final-oracle", path, issues,
        );
        if (compiled) {
          finalOracleReqs.push(compiled);
          factLanes.set(req.factKey, compiled.lane);

          // ORDERED_REQUIRED fact connected to receipt-only gate = compile fail
          if (compiled.lane === "ORDERED_REQUIRED" && step.continueGate) {
            const gateFactKeys = [
              ...(step.continueGate.allOf ?? []),
              ...(step.continueGate.anyOf ?? []),
              ...(step.continueGate.noneOf ?? []),
            ];
            const isReceiptOnlyGate = gateFactKeys.includes(req.factKey);
            if (isReceiptOnlyGate) {
              issues.push(
                createIssue(
                  "ORDERED_REQUIRED_RECEIPT_ONLY_GATE",
                  `Fact "${req.factKey}" is ORDERED_REQUIRED but connected to a receipt-only continue gate at step "${step.planStepId}"`,
                  { path: `${path}.finalOraclePolicy`, sourceRef: step.sourceMapRef },
                ),
              );
            }
          }
        }
      }
    }
  }

  // Compute derived graph digest
  const derivedGraphDigest = digestPlanDocument(registries.derivedFacts);

  return {
    continueGateRequirements: continueGateReqs,
    finalOracleRequirements: finalOracleReqs,
    derivedGraphDigest,
    factDeliveryLanes: [...factLanes.entries()],
  };
}

function compileEvidenceRequirement(
  req: OracleRequirement,
  sourceByKey: ReadonlyMap<string, EvidenceSourceDefinition>,
  derivedByKey: ReadonlyMap<string, DerivedFactDefinition>,
  authority: string,
  path: string,
  issues: CompileIssue[],
): CompiledEvidenceRequirement | undefined {
  const source = sourceByKey.get(req.factKey);
  const derived = derivedByKey.get(req.factKey);

  if (!source && !derived) {
    issues.push(
      createIssue(
        "MISSING_EVIDENCE_SOURCE",
        `Evidence requirement for fact "${req.factKey}" has no source in the pack`,
        { path, sourceRef: req.factKey },
      ),
    );
    return undefined;
  }

  // HTTP 2xx check
  if (source?.transportSuccessOnly) {
    issues.push(
      createIssue(
        "HTTP_2XX_AS_BUSINESS_SUCCESS",
        `Fact "${req.factKey}" is sourced from a transport-success-only observation; HTTP 2xx is not business evidence`,
        { path, sourceRef: req.factKey },
      ),
    );
  }

  // Determine delivery lane
  const lane: FactDeliveryLane = determineDeliveryLane(req, source, derived);

  const sourceAuthority = source?.authority ?? derived?.authority ?? "UNKNOWN";
  const correlationRequired = source?.correlation?.requireEntityMatch ?? derived?.requiresCorrelation ?? false;
  const freshnessMaxAgeMs = source?.freshness?.maxAgeMs ?? 30_000;

  return {
    factKey: req.factKey,
    lane,
    requirement: req,
    sourceAuthority,
    correlationRequired,
    freshnessMaxAgeMs,
  };
}

function determineDeliveryLane(
  req: OracleRequirement,
  source: EvidenceSourceDefinition | undefined,
  derived: DerivedFactDefinition | undefined,
): FactDeliveryLane {
  // REMOTE sources with correlation are ORDERED_REQUIRED
  if (source?.plane === "REMOTE" && source.correlation?.requireEntityMatch) {
    return "ORDERED_REQUIRED";
  }
  // Cross-plane derived facts with correlation are ORDERED_REQUIRED
  if (derived?.requiresCorrelation && derived.plane === "REMOTE") {
    return "ORDERED_REQUIRED";
  }
  // Default to RECEIPT_SAFE
  return "RECEIPT_SAFE";
}

function compileEvidenceRequirementFromFactKey(
  factKey: string,
  sourceByKey: ReadonlyMap<string, EvidenceSourceDefinition>,
  derivedByKey: ReadonlyMap<string, DerivedFactDefinition>,
  authority: string,
  path: string,
  deadlineMs: number,
  issues: CompileIssue[],
): CompiledEvidenceRequirement | undefined {
  const minimalReq: OracleRequirement = {
    factKey,
    obligation: "REQUIRED",
    timing: "IMMEDIATE",
    onTimeout: "FAIL",
    deadlineMs,
  };
  return compileEvidenceRequirement(minimalReq, sourceByKey, derivedByKey, authority, path, issues);
}
