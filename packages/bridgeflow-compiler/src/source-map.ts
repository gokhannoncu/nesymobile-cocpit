/**
 * Source map compilation  (Plan D.7.15 · Phase 4C)
 *
 * Compiles the full source map chain:
 *   domain macro → generic IR step → BridgeFlowPlan step
 *
 * Also compiles feature/capability/resource/dependency refs into the source map.
 */

import type { WorkflowIrV2 } from "@nesy/workflow-contract";
import type { DomainPackBundle } from "@nesy/domain-pack-contracts";
import type { CompiledSourceMap, CompiledSourceMapEntry } from "./bridgeflow-plan.js";

/**
 * Build the complete compiled source map.
 */
export function compileSourceMap(
  ir: WorkflowIrV2,
  bundle: DomainPackBundle,
  stepEntries: readonly CompiledSourceMapEntry[],
): CompiledSourceMap {
  const entries: CompiledSourceMapEntry[] = [...stepEntries];

  // Enrich with domain source map data from the IR
  for (const entry of entries) {
    const irEntry = ir.sourceMap.find((e) => e.ref === entry.irStepId || e.planStepId === entry.irStepId);
    if (irEntry) {
      entry.domainSourceRef = entry.domainSourceRef ?? irEntry.domainSourceRef;
    }
  }

  // Find macros that own each step via domain source refs
  for (const macro of bundle.registries.macros) {
    if (macro.expansionSnapshot) {
      for (const dsEntry of macro.expansionSnapshot.domainSourceMap) {
        for (const planStepId of dsEntry.planStepIds) {
          const compiledEntry = entries.find((e) => e.irStepId === planStepId);
          if (compiledEntry) {
            compiledEntry.macroRef = compiledEntry.macroRef ?? dsEntry.macroRef;
            compiledEntry.domainSourceRef = compiledEntry.domainSourceRef ?? dsEntry.ref;
          }
        }
      }
    }
  }

  return entries;
}
