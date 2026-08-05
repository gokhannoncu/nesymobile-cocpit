/**
 * ===========================================================================
 *  Reference vertical slice shape  (RUN_PLAY 4B.17 · 4B.18)
 *
 *  A slice is one reviewable business capability, described completely enough
 *  that a reviewer can answer four questions without reading any code:
 *
 *    What does this prove?            → businessMeaning, finalOracle
 *    What does it NOT prove?          → notResponsibleFor, negativeCases
 *    How does it reach the device?    → macroExpansion, bridgeFlowPlan
 *    What could make it lie?          → negativeCases, releaseIsolation
 *
 *  `notResponsibleFor` and `negativeCases` are required fields rather than
 *  optional documentation. A slice that lists only what it covers reads as
 *  covering everything, and the first escaped bug then becomes an argument about
 *  scope instead of a triage. A slice with no negative cases has no recorded way
 *  of going green while proving nothing — which never means there isn't one.
 * ===========================================================================
 */

import type {
  BridgeFlowPlanSnapshot,
  DomainOracleTemplate,
  InterruptPolicy,
  MacroExpansionSnapshot,
  MacroInputSchema,
  MacroOutputSchema,
  MacroPrecondition,
  ReleaseIsolationContract,
} from "@nesy/domain-pack-contracts";
import type { WorkflowIrV2 } from "@nesy/workflow-contract";

/** How a slice binds a business entity to the target it acts on. */
export interface SliceEntityBinding {
  entityTypeRef: string;
  targetRef?: string;
  /** Why this binding exists — read by reviewers, not by code. */
  role: string;
}

/** A way this slice could report success while proving nothing. */
export interface SliceNegativeCase {
  caseKey: string;
  /** What would go wrong. */
  scenario: string;
  /** What in the contract refuses it. */
  refusedBy: string;
}

export interface NesyReferenceSlice {
  /** Canonical slice key, e.g. "OPEN_STOP". */
  sliceKey: string;
  displayName: string;
  businessMeaning: string;
  notResponsibleFor: readonly string[];
  inputSchema: MacroInputSchema;
  outputSchema: MacroOutputSchema;
  preconditions: readonly MacroPrecondition[];
  screenRefs: readonly string[];
  surfaceRefs: readonly string[];
  entityBindings: readonly SliceEntityBinding[];
  /** Target keys whose provider chain this slice depends on. */
  targetResolutionRefs: readonly string[];
  /** The macro key this slice is authored as. */
  semanticMacroRef: string;
  macroExpansion: MacroExpansionSnapshot;
  genericIrSnapshot: WorkflowIrV2;
  bridgeFlowPlanSnapshot: BridgeFlowPlanSnapshot;
  oracle: DomainOracleTemplate;
  interruptPolicy: InterruptPolicy;
  requiredCapabilityRefs: readonly string[];
  releaseIsolation: ReleaseIsolationContract;
  negativeCases: readonly SliceNegativeCase[];
}
