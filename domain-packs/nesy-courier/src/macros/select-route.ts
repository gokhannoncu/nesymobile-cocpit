/**
 * ===========================================================================
 *  SELECT_ROUTE slice  (Plan D.6C · RUN_PLAY 4B.18)
 *
 *  A courier picks the route they will work. Small flow, two traps.
 *
 *  TRAP 1 — an empty route dialog looks like a UI bug. It usually is not: the
 *  backend simply offers this account nothing today. So the slice checks
 *  `REMOTE.ROUTES_AVAILABLE` as a WARNING requirement and branches explicitly
 *  when the requested route is not in the projection, instead of tapping a row
 *  that is not there and reporting a resolution failure.
 *
 *  TRAP 2 — the dialog is a SURFACE, not a screen. Declared as a screen it would
 *  need a fabricated entry strategy and every flow would have to remember to
 *  handle it. As a surface with `defaultPolicy: HANDLE` and this macro as its
 *  handler, it is dealt with once wherever it fires.
 * ===========================================================================
 */

import type { BridgeFlowPlanSnapshot, MacroDefinition, MacroExpansionSnapshot } from "@nesy/domain-pack-contracts";
import type { WorkflowStepV2 } from "@nesy/workflow-contract";
import { NESY_BACKOFFICE_ADAPTER_REF, NESY_BACKOFFICE_OPERATIONS } from "../adapters/backoffice.js";
import { NESY_ADAPTER_QUERY_REFS } from "../registries/application.js";
import { NESY_ENTITIES } from "../registries/entities.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_ACTIONS, NESY_SCREENS, NESY_SURFACES } from "../registries/screens.js";
import { NESY_TARGETS } from "../registries/targets.js";
import type { NesyReferenceSlice } from "../slice.js";
import { NESY_DEFAULT_INTERRUPT_POLICY, NESY_UI_ONLY_RELEASE_ISOLATION } from "./common.js";
import { irDocument, requires, sourceMapEntry, stepBase } from "./ir-authoring.js";

export const NESY_SELECT_ROUTE_MACRO_KEY = "nesy.macro.select-route";

const STEPS: readonly WorkflowStepV2[] = [
  {
    ...stepBase({ planStepId: "wait-dialog", sourceMapRef: "sm-route-1", next: "read-offered-routes", timeoutMs: 20_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.ROUTE_DIALOG_READY,
    sourceLane: "UI",
    stableForMs: 200,
    requireCorrelation: false,
    onTimeout: "FAIL",
  },
  {
    ...stepBase({
      planStepId: "read-offered-routes",
      sourceMapRef: "sm-route-2",
      next: "check-offered",
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    // The OFFERED set, not the selected route. This read `nesy.routeState`, which
    // answers which route is already selected — "none" at this point in the flow —
    // so the check below could never pass whatever the backend offered.
    queryRef: NESY_ADAPTER_QUERY_REFS.offeredRoutes,
    // Bounded projection. An unbounded read of the route list would be a
    // data-exfiltration primitive with a UI in front of it — but the bound has to
    // clear the real list, because a truncated projection answers "not offered"
    // for a route that was offered.
    maxRows: 1_000,
    outputVariable: "offeredRouteRows",
  },
  {
    ...stepBase({ planStepId: "check-offered", sourceMapRef: "sm-route-3", next: null }),
    kind: "CONDITION",
    condition: {
      kind: "comparison",
      operator: "in",
      left: { kind: "operand", source: "run.input", path: "routeCode" },
      // `match_key`, not `route_code`: a Serbian fiscal route is SHOWN as "31 *"
      // and an author typing what the courier sees is right to type that, while
      // the same route is plain "31" in every other country. The projection emits
      // a row per addressable name so one `in` accepts both spellings; the rows
      // agree on `route_code`, so nothing downstream cares which arrived.
      right: { kind: "operand", source: "step.output", path: "read-offered-routes.match_key" },
    },
    onTrue: "resolve-row",
    onFalse: "report-not-offered",
    // Not BRANCH: if we cannot tell whether the route is offered, tapping
    // anything would be a guess about which row belongs to this courier.
    unknownPolicy: "FAIL",
  },
  {
    ...stepBase({ planStepId: "report-not-offered", sourceMapRef: "sm-route-4", next: null }),
    kind: "ANNOTATE",
    message: "The requested route is not in the offered projection; no row was tapped.",
  },
  {
    ...stepBase({
      planStepId: "resolve-row",
      sourceMapRef: "sm-route-5",
      next: "tap-row",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.routeRow,
    outputVariable: "rowHandle",
    entityBinding: { type: NESY_ENTITIES.route, id: "run.input.routeCode" },
  },
  {
    ...stepBase({
      planStepId: "tap-row",
      sourceMapRef: "sm-route-6",
      next: "resolve-confirm",
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "rowHandle",
    entityBinding: { type: NESY_ENTITIES.route, id: "run.input.routeCode" },
  },
  {
    ...stepBase({
      planStepId: "resolve-confirm",
      sourceMapRef: "sm-route-7",
      next: "tap-confirm",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.routeDialogConfirm,
    outputVariable: "confirmHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-confirm",
      sourceMapRef: "sm-route-8",
      next: "read-selected-route",
      timeoutMs: 25_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "confirmHandle",
    // Screen readiness ONLY.
    //
    // This gate used to also require `APP.AVAILABLE_STOPS_LOADED`, a fact
    // produced by the projection read two steps BELOW it — so the gate waited for
    // something that could not exist until it had already passed, and timed out
    // every time. Readiness is what a gate can answer; whether the stops actually
    // loaded is a question for the oracle, measured by `read-available-stops`.
    continueGate: {
      allOf: [NESY_FACTS.ROUTE_LIST_READY],
      deadlineMs: 25_000,
      unknownPolicy: "RETRY",
    },
  },
  // The app plane is OBSERVED after the confirmation, not inferred from the tap.
  {
    ...stepBase({
      planStepId: "read-selected-route",
      sourceMapRef: "sm-route-8a",
      next: "read-available-stops",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.state-projection")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.routeState,
    maxRows: 1,
    outputVariable: "selectedRouteRows",
    outputFactBindings: [
      { factKey: NESY_FACTS.SELECTED_ROUTE_OBSERVED, from: { kind: "COLUMN", column: "route_selected" } },
    ],
  },
  {
    ...stepBase({
      planStepId: "read-available-stops",
      sourceMapRef: "sm-route-8b",
      next: "verify-assignment",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.availableStops,
    maxRows: 200,
    outputVariable: "loadedRows",
    // The projection carries stop ids and counts, no boolean — "did any stop
    // load" is a property of the result set, and an empty set is a proven no.
    outputFactBindings: [
      { factKey: NESY_FACTS.AVAILABLE_STOPS_LOADED, from: { kind: "ROWS_PRESENT" } },
    ],
  },
  {
    ...stepBase({
      planStepId: "verify-assignment",
      sourceMapRef: "sm-route-9",
      next: "assert-selection",
      timeoutMs: 30_000,
      capabilityRequirements: [requires("verdict.core.remote.allowlisted-operation")],
    }),
    kind: "REMOTE_ACTION",
    spec: {
      adapterRef: NESY_BACKOFFICE_ADAPTER_REF,
      operationRef: NESY_BACKOFFICE_OPERATIONS.readRouteAssignment,
      role: "VALIDATION",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputBindings: [{ name: "route", source: { kind: "entityRef" } }],
      outputFactBindings: [{ factKey: NESY_FACTS.ROUTE_ASSIGNED, responsePath: "assignment.exists" }],
      timeoutPolicy: { timeoutMs: 20_000, maxAttempts: 2, backoffMs: 1_000 },
      entityBinding: { type: NESY_ENTITIES.route, id: "run.input.routeCode" },
      reconciliationPolicy: "NONE",
      auditPolicy: { recordRequest: true, recordResponse: true, redactFields: ["assignment.assignedCourierName"] },
      allowedEnvironments: ["qa", "staging"],
    },
  },
  {
    ...stepBase({ planStepId: "assert-selection", sourceMapRef: "sm-route-10", next: null }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.SELECTED_ROUTE_OBSERVED,
    expected: true,
    unknownPolicy: "FAIL",
    entityBinding: { type: NESY_ENTITIES.route, id: "run.input.routeCode" },
    finalOraclePolicy: {
      requirements: [
        { factKey: NESY_FACTS.SELECTED_ROUTE_OBSERVED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        {
          factKey: NESY_FACTS.ROUTE_ASSIGNED,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 60_000,
          onTimeout: "INCONCLUSIVE",
        },
        { factKey: NESY_FACTS.AVAILABLE_STOPS_LOADED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        // WARNING, not REQUIRED: this fact diagnoses an empty dialog, it does not
        // decide whether selection worked.
        { factKey: NESY_FACTS.ROUTES_AVAILABLE, obligation: "WARNING", timing: "IMMEDIATE", onTimeout: "WARNING" },
      ],
    },
  },
];

const GENERIC_IR = irDocument({
  workflowId: "nesy.reference.select-route",
  name: "Select the route to work",
  sourceRef: NESY_SELECT_ROUTE_MACRO_KEY,
  inputs: [{ name: "routeCode", type: "string", required: true }],
  variables: [
    { name: "offeredRouteRows", type: "stringList" },
    { name: "selectedRouteRows", type: "stringList" },
    { name: "loadedRows", type: "stringList" },
    { name: "rowHandle", type: "string" },
    { name: "confirmHandle", type: "string" },
  ],
  steps: STEPS,
  entryStepId: "wait-dialog",
  capabilityRequirements: [requires("verdict.core.bridge.tap"), requires("verdict.core.bridge.watch-fact")],
  sourceMap: [
    sourceMapEntry("sm-route-1", "wait-dialog", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-2", "read-offered-routes", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-3", "check-offered", NESY_SELECT_ROUTE_MACRO_KEY, "guards against tapping a row that is not offered"),
    sourceMapEntry("sm-route-4", "report-not-offered", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-5", "resolve-row", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-6", "tap-row", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-7", "resolve-confirm", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-8", "tap-confirm", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-8a", "read-selected-route", NESY_SELECT_ROUTE_MACRO_KEY, "app plane observed, not inferred"),
    sourceMapEntry("sm-route-8b", "read-available-stops", NESY_SELECT_ROUTE_MACRO_KEY, "stops loaded is a result-set property"),
    sourceMapEntry("sm-route-9", "verify-assignment", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-10", "assert-selection", NESY_SELECT_ROUTE_MACRO_KEY),
  ],
});

const EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_SELECT_ROUTE_MACRO_KEY,
  authoredBy: "COMPILER",
  genericIr: GENERIC_IR,
  irSourceMap: GENERIC_IR.sourceMap,
  domainSourceMap: [
    {
      ref: "ds-route-1",
      macroRef: NESY_SELECT_ROUTE_MACRO_KEY,
      planStepIds: STEPS.map((step) => step.planStepId),
      sliceRef: "SELECT_ROUTE",
      note: "One CONDITION branch: the not-offered path annotates and stops instead of tapping.",
    },
  ],
};

const BRIDGE_PLAN: BridgeFlowPlanSnapshot = {
  macroRef: NESY_SELECT_ROUTE_MACRO_KEY,
  authoredBy: "COMPILER",
  requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.bridge.resolve-target"],
  legs: [
    { planStepId: "wait-dialog", bridgeVerb: "watch", awaitFactKey: NESY_FACTS.ROUTE_DIALOG_READY },
    { planStepId: "tap-row", bridgeVerb: "tap", targetRef: NESY_TARGETS.routeRow },
    {
      planStepId: "tap-confirm",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.routeDialogConfirm,
      awaitFactKey: NESY_FACTS.AVAILABLE_STOPS_LOADED,
    },
  ],
};

export const NESY_SELECT_ROUTE_MACRO: MacroDefinition = {
  macroKey: NESY_SELECT_ROUTE_MACRO_KEY,
  actionRef: NESY_ACTIONS.selectRoute,
  displayName: "Select route",
  businessMeaning:
    "A courier selects the route they will work today, and both the app and the backend agree that this route is now assigned to them.",
  notResponsibleFor: [
    "route planning or stop ordering — the pack asserts the route is assigned, not that its content is optimal",
    "reassigning a route already worked by someone else",
    "whether the offered route set is business-correct (only that the backend offered at least one)",
  ],
  input: {
    fields: [{ name: "routeCode", type: "string", required: true, description: "Business key of the route to select." }],
  },
  output: {
    fields: [
      { name: "routeSelected", type: "boolean", factKey: NESY_FACTS.SELECTED_ROUTE_OBSERVED },
      { name: "routeCode", type: "string" },
    ],
  },
  preconditions: [
    { kind: "FACT_TRUE", ref: NESY_FACTS.USER_SESSION_AVAILABLE_APP, deadlineMs: 10_000, onUnmet: "FAIL" },
    { kind: "SURFACE_ABSENT", ref: NESY_SURFACES.mandatoryUpdateDialog, deadlineMs: 5_000, onUnmet: "FAIL" },
  ],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.routeStopList],
    surfaceRefs: [NESY_SURFACES.routeSelectionDialog],
    entityTypeRefs: [NESY_ENTITIES.route],
    targetRefs: [NESY_TARGETS.routeRow, NESY_TARGETS.routeDialogConfirm],
    factKeys: [
      NESY_FACTS.ROUTE_DIALOG_READY,
      NESY_FACTS.ROUTE_LIST_READY,
      NESY_FACTS.AVAILABLE_STOPS_LOADED,
      NESY_FACTS.SELECTED_ROUTE_OBSERVED,
      NESY_FACTS.ROUTE_ASSIGNED,
      NESY_FACTS.ROUTES_AVAILABLE,
    ],
    queryRefs: ["nesy.routeState"],
    adapterOperationRefs: [NESY_BACKOFFICE_OPERATIONS.readRouteAssignment],
  },
  oracleTemplate: {
    continueGate: {
      allOf: [NESY_FACTS.ROUTE_LIST_READY, NESY_FACTS.AVAILABLE_STOPS_LOADED],
      deadlineMs: 25_000,
      unknownPolicy: "RETRY",
    },
    finalOracle: {
      requirements: [
        { factKey: NESY_FACTS.SELECTED_ROUTE_OBSERVED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        {
          factKey: NESY_FACTS.ROUTE_ASSIGNED,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 60_000,
          onTimeout: "INCONCLUSIVE",
        },
        { factKey: NESY_FACTS.ROUTES_AVAILABLE, obligation: "WARNING", timing: "IMMEDIATE", onTimeout: "WARNING" },
      ],
    },
    notResponsibleFor: ["the ordering or completeness of the stop list that loads afterwards"],
  },
  interruptPolicy: NESY_DEFAULT_INTERRUPT_POLICY,
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.resolve-target",
    "verdict.core.bridge.watch-fact",
    "verdict.core.remote.allowlisted-operation",
    "domain.nesy.adapter.named-query",
  ],
  expansionSnapshot: EXPANSION,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
};

export const SELECT_ROUTE_SLICE: NesyReferenceSlice = {
  sliceKey: "SELECT_ROUTE",
  displayName: "Select route",
  businessMeaning: NESY_SELECT_ROUTE_MACRO.businessMeaning,
  notResponsibleFor: NESY_SELECT_ROUTE_MACRO.notResponsibleFor,
  inputSchema: NESY_SELECT_ROUTE_MACRO.input,
  outputSchema: NESY_SELECT_ROUTE_MACRO.output,
  preconditions: NESY_SELECT_ROUTE_MACRO.preconditions,
  screenRefs: [NESY_SCREENS.routeStopList],
  surfaceRefs: [NESY_SURFACES.routeSelectionDialog],
  entityBindings: [
    { entityTypeRef: NESY_ENTITIES.route, targetRef: NESY_TARGETS.routeRow, role: "Identifies the row by route business key rather than by position." },
  ],
  targetResolutionRefs: [NESY_TARGETS.routeRow, NESY_TARGETS.routeDialogConfirm],
  semanticMacroRef: NESY_SELECT_ROUTE_MACRO_KEY,
  macroExpansion: EXPANSION,
  genericIrSnapshot: GENERIC_IR,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
  oracle: NESY_SELECT_ROUTE_MACRO.oracleTemplate,
  interruptPolicy: NESY_SELECT_ROUTE_MACRO.interruptPolicy,
  requiredCapabilityRefs: NESY_SELECT_ROUTE_MACRO.requiredCapabilityRefs,
  releaseIsolation: NESY_UI_ONLY_RELEASE_ISOLATION,
  negativeCases: [
    {
      caseKey: "EMPTY_DIALOG_REPORTED_AS_UI_DEFECT",
      scenario:
        "The backend offers this account no routes. The dialog is empty, target resolution fails, and the report blames the UI for a backend state.",
      refusedBy:
        "The CONDITION at check-offered branches to an explicit ANNOTATE instead of tapping, and REMOTE.ROUTES_AVAILABLE is carried as a WARNING requirement so the diagnosis is in the evidence.",
    },
    {
      caseKey: "DIALOG_MODELLED_AS_SCREEN",
      scenario:
        "The route dialog is registered as a screen, so it needs an invented entry strategy and every other flow has to remember to handle it.",
      refusedBy:
        "validateDomainPackBundle raises DIALOG_DECLARED_AS_SCREEN for any screenKey naming a surface kind; the dialog lives in the Surface Registry with defaultPolicy HANDLE.",
    },
    {
      caseKey: "APP_ONLY_SELECTION",
      scenario:
        "The app shows the route as selected while the backend never recorded the assignment, so the next day's work is attributed to nobody.",
      refusedBy: "REMOTE.ROUTE_ASSIGNED is a REQUIRED EVENTUAL requirement read through an allowlisted back-office operation.",
    },
  ],
};
