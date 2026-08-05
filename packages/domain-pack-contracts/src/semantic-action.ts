/**
 * ===========================================================================
 *  Semantic actions, macros, source map, oracle template  (D.6B · 4B.8)
 *
 *  A semantic macro is the authoring unit a human recognises — "open this stop"
 *  — and it expands into generic `WorkflowIR v2` steps. The expansion direction
 *  is the load-bearing rule: the macro expands INTO the Core union and never
 *  extends it. If `OPEN_STOP` ever became a Core step kind, the second domain
 *  would require a Core redesign, which is the exact debt Phase 4A/4B exist to
 *  prevent.
 *
 *  What this file is NOT: a compiler. {@link MacroExpansionSnapshot} is a frozen
 *  EXAMPLE of what a correct expansion looks like — a review artifact and a
 *  regression fixture. The real compiler is Phase 4C, and building it here would
 *  hard-code Nesy-shaped expansion into a generic component before the registry
 *  contracts were even settled.
 *
 *  Two more rules that only survive as tests:
 *
 *    A REUSABLE FRAGMENT CANNOT PRODUCE A TERMINAL PRODUCT VERDICT. A fragment
 *    is a building block reused by many flows; if it could write a verdict, one
 *    login helper would emit dozens of unrelated PASSes and the report would
 *    count them as coverage.
 *
 *    AN INDEPENDENT TEST WORKFLOW CARRIES ITS OWN OCCURRENCE AND ORACLE
 *    SNAPSHOT. Otherwise two independent tests that share a fragment share its
 *    evidence, and a failure in one silently taints the other.
 * ===========================================================================
 */

import type {
  EvidencePolicy,
  FinalOraclePolicy,
  WorkflowIrV2,
  WorkflowSourceMapEntry,
} from "@nesy/workflow-contract";

/** Scalar kinds a macro input/output may declare. No `any`, no free-form JSON. */
export type MacroValueType = "string" | "number" | "boolean" | "stringList" | "entityRef";

export const MACRO_VALUE_TYPES: readonly MacroValueType[] = [
  "string",
  "number",
  "boolean",
  "stringList",
  "entityRef",
];

/**
 * One declared macro input.
 *
 * `entityTypeRef` is required when the type is `entityRef`: an untyped entity
 * input is how "open a stop" ends up accepting a parcel and failing three steps
 * later with an unrelated message.
 */
export interface MacroInputField {
  name: string;
  type: MacroValueType;
  required: boolean;
  /** Required when `type` is `entityRef`. Entity Registry key. */
  entityTypeRef?: string;
  secret?: boolean;
  description?: string;
}

export interface MacroInputSchema {
  fields: readonly MacroInputField[];
}

/** One declared macro output, bound to a normalized fact or a variable. */
export interface MacroOutputField {
  name: string;
  type: MacroValueType;
  /** Fact key this output is derived from, when it is evidence-backed. */
  factKey?: string;
  description?: string;
}

export interface MacroOutputSchema {
  fields: readonly MacroOutputField[];
}

/**
 * A precondition the macro requires before it will run.
 *
 * Preconditions are declared as facts/screens rather than as prose so the
 * compiler can insert the readiness wait instead of the author remembering to.
 */
export interface MacroPrecondition {
  kind: "SCREEN_READY" | "SURFACE_ABSENT" | "FACT_TRUE" | "FACT_FALSE" | "ENTITY_AVAILABLE";
  /** Screen key, surface key, fact key or entity type depending on `kind`. */
  ref: string;
  /** Upper bound on the event-driven wait for this precondition. */
  deadlineMs: number;
  /** What happens when the precondition is not met. */
  onUnmet: "FAIL" | "OPERATOR_ATTENTION" | "SKIP";
}

/**
 * What the macro does when an interrupt surface appears mid-execution.
 *
 * `surfaceRefs` is explicit rather than "handle whatever shows up": a macro that
 * silently dismisses any dialog will eventually dismiss the one that was the
 * bug.
 */
export interface InterruptPolicy {
  /** Surfaces this macro is prepared to handle, in declared order. */
  handledSurfaceRefs: readonly string[];
  /** Surfaces that abort the macro and invalidate the product verdict. */
  fatalSurfaceRefs: readonly string[];
  /** Anything not listed above. */
  unlistedSurfacePolicy: "FAIL" | "OPERATOR_ATTENTION";
  /** Bound on interrupt handling attempts, so a dialog loop cannot hang a run. */
  maxHandledInterrupts: number;
}

/**
 * Continue Gate + Final Oracle for one macro.
 *
 * The two are structurally separate for the reason Phase 4A established: "may
 * the executor move on?" and "did the business fact become true?" are different
 * questions, and folding them into one array is why the pre-v2 engine had to
 * report "UI passed but the oracle never confirmed" as a prose string.
 */
export interface DomainOracleTemplate {
  /** Readiness — carries no product verdict weight. */
  continueGate: EvidencePolicy;
  /** The only thing allowed to write a ProductVerdict. */
  finalOracle: FinalOraclePolicy;
  /** Author's note on what this template deliberately does not check. */
  notResponsibleFor?: readonly string[];
}

/**
 * One entry of the domain source map.
 *
 * The chain this must support end to end: domain macro → generic IR step →
 * runtime occurrence. A trace that stops at the IR step cannot answer "which
 * business action failed?", which is the only question an operator asks.
 */
export interface DomainSourceMapEntry {
  /** Stable ref, referenced from `WorkflowSourceMapEntry.domainSourceRef`. */
  ref: string;
  /** Macro that produced the steps. */
  macroRef: string;
  /** Generic IR step ids this macro expanded into. */
  planStepIds: readonly string[];
  /** Slice/feature this macro invocation belongs to. */
  sliceRef?: string;
  note?: string;
}

export type DomainSourceMap = readonly DomainSourceMapEntry[];

/**
 * A frozen example expansion.
 *
 * Explicitly a REVIEW ARTIFACT, not compiler output: `authoredBy: "HAND"` is the
 * honest label until Phase 4C, and naming it that stops a later reader from
 * treating the snapshot as a guarantee the compiler already agrees with.
 */
export interface MacroExpansionSnapshot {
  macroRef: string;
  /** How the snapshot was produced. Phase 4B packs use `HAND`. */
  authoredBy: "HAND" | "COMPILER";
  /** The generic IR the macro is expected to expand into. */
  genericIr: WorkflowIrV2;
  /** Core-side source map of the generic IR. */
  irSourceMap: readonly WorkflowSourceMapEntry[];
  /** Domain-side map tying the macro to those steps. */
  domainSourceMap: DomainSourceMap;
}

/**
 * A reference-only sketch of the device-level plan.
 *
 * Deliberately shallow. The real `BridgeFlowPlan` belongs to Phase 4C/5; what a
 * pack needs at review time is "which bridge verbs and which waits does this
 * macro imply?", so that a macro whose expansion needs a capability the device
 * lacks is caught by a human before a compiler exists.
 */
export interface BridgeFlowPlanSnapshot {
  macroRef: string;
  authoredBy: "HAND" | "COMPILER";
  legs: readonly BridgeFlowPlanLegSnapshot[];
  /** Capability ids the whole sketch needs. */
  requiredCapabilityRefs: readonly string[];
}

export interface BridgeFlowPlanLegSnapshot {
  /** Generic IR step this leg came from. */
  planStepId: string;
  /** Generic bridge verb, e.g. "tap", "setText". Never a business verb. */
  bridgeVerb: string;
  /** Target key resolved before the verb runs, when the verb needs one. */
  targetRef?: string;
  /** Fact the leg waits on afterwards, when it waits. */
  awaitFactKey?: string;
}

/**
 * One semantic action: the smallest business-meaningful unit.
 *
 * `notResponsibleFor` is required for the same reason it is required on the
 * manifest — an action that lists only what it covers reads as covering
 * everything.
 */
export interface SemanticActionDefinition {
  /** Namespaced action key, e.g. "nesy.action.open-stop". */
  actionKey: string;
  applicationRef: string;
  displayName: string;
  businessMeaning: string;
  notResponsibleFor: readonly string[];
  screenRefs: readonly string[];
  surfaceRefs: readonly string[];
  entityTypeRefs: readonly string[];
  targetRefs: readonly string[];
  requiredCapabilityRefs: readonly string[];
}

/**
 * A macro: a semantic action plus everything needed to expand and judge it.
 *
 * `expansionSnapshot` and `bridgeFlowPlanSnapshot` are optional because a macro
 * can be declared before its reference expansion is authored — but the
 * reference pack's slices require them, so the canonical set is never
 * snapshot-less.
 */
export interface MacroDefinition {
  /** Namespaced macro key, e.g. "nesy.macro.open-stop". */
  macroKey: string;
  actionRef: string;
  displayName: string;
  businessMeaning: string;
  notResponsibleFor: readonly string[];
  input: MacroInputSchema;
  output: MacroOutputSchema;
  preconditions: readonly MacroPrecondition[];
  /** Registry refs the macro is allowed to touch. Bounded by construction. */
  allowedRegistryRefs: MacroRegistryRefs;
  oracleTemplate: DomainOracleTemplate;
  interruptPolicy: InterruptPolicy;
  requiredCapabilityRefs: readonly string[];
  expansionSnapshot?: MacroExpansionSnapshot;
  bridgeFlowPlanSnapshot?: BridgeFlowPlanSnapshot;
}

/**
 * The registry entries a macro may reference.
 *
 * An allowlist rather than free-form strings so that a macro cannot quietly
 * reach a screen from another application, and so a missing registry entry is a
 * validation error instead of a runtime resolution failure.
 */
export interface MacroRegistryRefs {
  screenRefs: readonly string[];
  surfaceRefs: readonly string[];
  entityTypeRefs: readonly string[];
  targetRefs: readonly string[];
  factKeys: readonly string[];
  queryRefs: readonly string[];
  adapterOperationRefs: readonly string[];
}

/**
 * A reusable flow fragment.
 *
 * `producesTerminalVerdict` is typed as `false` — not `boolean` — so an author
 * cannot flip it in a diff that looks harmless. Validation checks it too, for
 * data arriving from JSON where the type has no force.
 */
export interface ReusableFlowFragmentDefinition {
  fragmentKey: string;
  displayName: string;
  businessMeaning: string;
  notResponsibleFor: readonly string[];
  /** Macros composed by this fragment, in order. */
  macroRefs: readonly string[];
  /** A fragment never writes a product verdict. See the header. */
  producesTerminalVerdict: false;
  /** Readiness gate only. A fragment has no Final Oracle of its own. */
  continueGate: EvidencePolicy;
}

/**
 * An independent test workflow: a thing that CAN produce a product verdict.
 *
 * `occurrenceScope: "INDEPENDENT"` is the contract that keeps two tests sharing
 * a fragment from sharing its evidence.
 */
export interface IndependentTestWorkflowDefinition {
  workflowKey: string;
  displayName: string;
  businessMeaning: string;
  notResponsibleFor: readonly string[];
  macroRefs: readonly string[];
  fragmentRefs: readonly string[];
  /** Each independent workflow owns its own occurrence space. */
  occurrenceScope: "INDEPENDENT";
  /** Its own oracle snapshot — never inherited from a fragment. */
  oracleTemplate: DomainOracleTemplate;
  producesTerminalVerdict: true;
}

export interface SemanticActionViolation {
  code:
    | "FRAGMENT_PRODUCES_VERDICT"
    | "FRAGMENT_HAS_FINAL_ORACLE"
    | "MACRO_UNDECLARED_REF"
    | "MACRO_ENTITY_INPUT_UNTYPED"
    | "MACRO_MISSING_ORACLE"
    | "EXPANSION_NOT_GENERIC_IR"
    | "EXPANSION_SOURCE_MAP_BROKEN"
    | "WORKFLOW_SHARES_OCCURRENCE";
  message: string;
}

/**
 * Validates a fragment's inability to produce a verdict.
 *
 * Reads the value at runtime rather than trusting the literal type, because the
 * hostile input here is a JSON bundle, not a call site.
 */
export function validateReusableFlowFragment(
  fragment: ReusableFlowFragmentDefinition,
  path: string,
): SemanticActionViolation[] {
  const violations: SemanticActionViolation[] = [];
  const raw = fragment as unknown as Record<string, unknown>;

  if (raw.producesTerminalVerdict !== false) {
    violations.push({
      code: "FRAGMENT_PRODUCES_VERDICT",
      message: `${path}.producesTerminalVerdict must be false; a fragment reused by many flows would otherwise emit one product verdict per reuse`,
    });
  }

  if (raw.finalOracle !== undefined || raw.oracleTemplate !== undefined) {
    violations.push({
      code: "FRAGMENT_HAS_FINAL_ORACLE",
      message: `${path}: a reusable fragment carries a Continue Gate only; a Final Oracle here would write verdicts on behalf of its callers`,
    });
  }

  return violations;
}

/** Validates one macro against the registry keys the pack actually defines. */
export function validateMacroDefinition(
  macro: MacroDefinition,
  known: KnownRegistryKeys,
  path: string,
): SemanticActionViolation[] {
  const violations: SemanticActionViolation[] = [];

  const checkRefs = (refs: readonly string[], pool: ReadonlySet<string>, field: string): void => {
    for (const ref of refs) {
      if (!pool.has(ref)) {
        violations.push({
          code: "MACRO_UNDECLARED_REF",
          message: `${path}.allowedRegistryRefs.${field}: "${ref}" is not defined by this pack`,
        });
      }
    }
  };

  checkRefs(macro.allowedRegistryRefs.screenRefs, known.screenKeys, "screenRefs");
  checkRefs(macro.allowedRegistryRefs.surfaceRefs, known.surfaceKeys, "surfaceRefs");
  checkRefs(macro.allowedRegistryRefs.entityTypeRefs, known.entityTypes, "entityTypeRefs");
  checkRefs(macro.allowedRegistryRefs.targetRefs, known.targetKeys, "targetRefs");
  checkRefs(macro.allowedRegistryRefs.factKeys, known.factKeys, "factKeys");

  for (const [index, field] of macro.input.fields.entries()) {
    if (field.type === "entityRef" && (field.entityTypeRef === undefined || field.entityTypeRef === "")) {
      violations.push({
        code: "MACRO_ENTITY_INPUT_UNTYPED",
        message: `${path}.input.fields[${index}]: entityRef input "${field.name}" must name an entityTypeRef`,
      });
    }
  }

  if (macro.oracleTemplate.finalOracle.requirements.length === 0) {
    violations.push({
      code: "MACRO_MISSING_ORACLE",
      message: `${path}.oracleTemplate.finalOracle: a macro with no oracle requirement can only report that it ran, not that it worked`,
    });
  }

  if (macro.expansionSnapshot !== undefined) {
    violations.push(...validateExpansionSnapshot(macro.expansionSnapshot, macro.macroKey, `${path}.expansionSnapshot`));
  }

  return violations;
}

/** Registry keys a pack defines, used to bound macro references. */
export interface KnownRegistryKeys {
  screenKeys: ReadonlySet<string>;
  surfaceKeys: ReadonlySet<string>;
  entityTypes: ReadonlySet<string>;
  targetKeys: ReadonlySet<string>;
  factKeys: ReadonlySet<string>;
}

/**
 * Validates that an expansion snapshot stays inside the generic IR union and
 * that its source map actually traces back to the macro.
 *
 * The union membership check is what enforces "a macro expands INTO Core": a
 * snapshot containing a business step kind would be the first sign that someone
 * intends to add one.
 */
export function validateExpansionSnapshot(
  snapshot: MacroExpansionSnapshot,
  macroKey: string,
  path: string,
): SemanticActionViolation[] {
  const violations: SemanticActionViolation[] = [];

  if (snapshot.genericIr.schemaVersion !== 2) {
    violations.push({
      code: "EXPANSION_NOT_GENERIC_IR",
      message: `${path}.genericIr.schemaVersion must be 2; a domain macro expands into WorkflowIR v2, it does not define its own IR`,
    });
  }

  // Structural checks stop here when the document is not a step list at all.
  // Reporting a hundred broken step references for a v1 document would bury the
  // one issue that matters: migrate it first.
  if (!Array.isArray(snapshot.genericIr.steps)) {
    violations.push({
      code: "EXPANSION_NOT_GENERIC_IR",
      message: `${path}.genericIr.steps must be an array of WorkflowIR v2 steps`,
    });
    return violations;
  }

  const stepIds = new Set(snapshot.genericIr.steps.map((step) => step.planStepId));
  const mapsToMacro = snapshot.domainSourceMap.some((entry) => entry.macroRef === macroKey);
  if (!mapsToMacro) {
    violations.push({
      code: "EXPANSION_SOURCE_MAP_BROKEN",
      message: `${path}.domainSourceMap: no entry maps back to macro "${macroKey}"; the domain → step → occurrence chain is broken`,
    });
  }

  for (const [index, entry] of snapshot.domainSourceMap.entries()) {
    for (const planStepId of entry.planStepIds) {
      if (!stepIds.has(planStepId)) {
        violations.push({
          code: "EXPANSION_SOURCE_MAP_BROKEN",
          message: `${path}.domainSourceMap[${index}]: step "${planStepId}" does not exist in the snapshot's generic IR`,
        });
      }
    }
  }

  return violations;
}
