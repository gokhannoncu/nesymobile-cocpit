/**
 * ===========================================================================
 *  OPEN_STOP slice — the canonical macro  (Plan D.6C · RUN_PLAY 4B.18)
 *
 *  This is the reference slice because it is the one that goes wrong most
 *  expensively, and every safeguard in the Domain Pack contract shows up here.
 *
 *  THE FAILURE
 *
 *  A plan says "open row 3". A background sync re-sorts the stop list between
 *  the moment the list was read and the moment the row was tapped. The run opens
 *  someone else's stop, delivers a parcel there *successfully*, and every oracle
 *  in the flow passes. The report is green. A customer's parcel is at the wrong
 *  address, and the suite is the reason nobody noticed.
 *
 *  THE SIX SAFEGUARDS, in the order they appear below
 *
 *  1. TYPED ENTITY INPUT. The macro takes a `STOP` entity, not a row number.
 *     `validateMacroDefinition` refuses an `entityRef` input with no
 *     `entityTypeRef`, so "the third one" cannot be the request.
 *
 *  2. EXISTENCE CHECK FIRST. `read-available` reads `nesy.availableStops` and
 *     `check-present` verifies the requested stop is actually in that projection.
 *     If it is not, the run annotates and stops — WITHOUT TOUCHING ANYTHING.
 *     Tapping first and discovering afterwards is how the wrong stop gets opened.
 *
 *  3. PROVIDER CHAIN, NOT AN INDEX. `nesy.target.stop-row` resolves by
 *     accessibility id, then by the stop's business key, then by structural
 *     fingerprint. `ROW_INDEX_HINT` is last and declares
 *     `establishesIdentity: false`; `validateTargetResolutionPolicy` rejects any
 *     policy where a row index is the identity or is not last.
 *
 *  4. AMBIGUITY FAILS CLOSED. `ambiguityPolicy: "FAIL"` — two matching rows stop
 *     the run instead of picking one. There is deliberately no `FIRST_MATCH`
 *     member in the union to reach for under deadline pressure.
 *
 *  5. WAIT FOR EITHER LEGITIMATE DESTINATION. Opening a stop lands on the task
 *     list OR straight in the delivery flow, depending on the stop's task count.
 *     `WAIT_ANY` waits for whichever arrives; a plan that waited only for the
 *     task list would fail on single-task stops for no product reason.
 *
 *  6. VERIFY WHICH STOP ACTUALLY OPENED. `APP.ACTIVE_STOP_MATCHES` compares the
 *     app's active stop against the requested one. This is the safeguard that
 *     catches safeguards 1–5 having failed, and it is why the macro cannot go
 *     green on the wrong row.
 * ===========================================================================
 */

import type { BridgeFlowPlanSnapshot, MacroDefinition, MacroExpansionSnapshot } from "@nesy/domain-pack-contracts";
import type { WorkflowStepV2 } from "@nesy/workflow-contract";
import { NESY_ADAPTER_QUERY_REFS } from "../registries/application.js";
import { NESY_ENTITIES } from "../registries/entities.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_ACTIONS, NESY_SCREENS, NESY_SURFACES } from "../registries/screens.js";
import { NESY_TARGETS } from "../registries/targets.js";
import type { NesyReferenceSlice } from "../slice.js";
import { NESY_DEFAULT_INTERRUPT_POLICY, NESY_UI_ONLY_RELEASE_ISOLATION } from "./common.js";
import { irDocument, optionally, requires, sourceMapEntry, stepBase } from "./ir-authoring.js";

export const NESY_OPEN_STOP_MACRO_KEY = "nesy.macro.open-stop";

const STEPS: readonly WorkflowStepV2[] = [
  {
    // Safeguard 2, part one: read the projection before touching the screen.
    ...stepBase({
      planStepId: "read-available",
      sourceMapRef: "sm-open-1",
      next: "check-present",
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.availableStops,
    maxRows: 200,
    outputVariable: "availableRows",
  },
  {
    // Safeguard 2, part two. UNKNOWN is FAIL: "we could not tell whether this
    // item is in the list" must not become "tap something and find out".
    ...stepBase({ planStepId: "check-present", sourceMapRef: "sm-open-2", next: null }),
    kind: "CONDITION",
    condition: {
      kind: "comparison",
      operator: "in",
      left: { kind: "operand", source: "run.input", path: "requestedItemCode" },
      right: { kind: "operand", source: "step.output", path: "read-available.codes" },
    },
    onTrue: "resolve-row",
    onFalse: "report-absent",
    unknownPolicy: "FAIL",
  },
  {
    ...stepBase({ planStepId: "report-absent", sourceMapRef: "sm-open-3", next: null }),
    kind: "ANNOTATE",
    message:
      "The requested item is not present in the available projection; nothing on screen was touched. This is a precondition mismatch, not a UI defect.",
  },
  {
    // Safeguards 3 and 4 live in the target's own resolution policy
    // (`nesy.target.stop-row`): accessibility id → entity binding → structural
    // fingerprint → index hint (non-identity, last), ambiguity FAIL,
    // reverifyBeforeAction true.
    ...stepBase({
      planStepId: "resolve-row",
      sourceMapRef: "sm-open-4",
      next: "tap-row",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.stopRow,
    outputVariable: "rowHandle",
    entityBinding: { type: NESY_ENTITIES.stop, id: "run.input.requestedItemCode" },
  },
  {
    ...stepBase({
      planStepId: "tap-row",
      sourceMapRef: "sm-open-5",
      next: "await-destination",
      timeoutMs: 20_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "rowHandle",
    entityBinding: { type: NESY_ENTITIES.stop, id: "run.input.requestedItemCode" },
    // Readiness only, and deliberately `anyOf`: see safeguard 5.
    continueGate: {
      anyOf: [NESY_FACTS.TASK_LIST_READY, NESY_FACTS.DELIVERY_FLOW_READY],
      noneOf: [NESY_FACTS.LOADING_BLOCKER_PRESENT],
      deadlineMs: 20_000,
      unknownPolicy: "RETRY",
    },
  },
  {
    // Safeguard 5. `hostOnlyCancel: true` and the optional capability carry B-13:
    // a Bridge v1 device has no wait_any, so the host runs the legs and the
    // compiler may degrade to sequential legs rather than reject the plan.
    ...stepBase({
      planStepId: "await-destination",
      sourceMapRef: "sm-open-6",
      next: "assert-correct-item",
      timeoutMs: 25_000,
      capabilityRequirements: [optionally("wait_any", "SEQUENTIAL_LEGS")],
    }),
    kind: "WAIT_ANY",
    maxLegs: 2,
    hostOnlyCancel: true,
    legs: [
      { legId: "task-list", factKey: NESY_FACTS.TASK_LIST_READY, onWin: "assert-correct-item" },
      { legId: "delivery", factKey: NESY_FACTS.DELIVERY_FLOW_READY, onWin: "assert-correct-item" },
    ],
  },
  {
    // Safeguard 6. This is the assertion that makes the whole slice trustworthy.
    ...stepBase({ planStepId: "assert-correct-item", sourceMapRef: "sm-open-7", next: null, timeoutMs: 20_000 }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.ACTIVE_STOP_MATCHES,
    expected: true,
    unknownPolicy: "FAIL",
    entityBinding: { type: NESY_ENTITIES.stop, id: "run.input.requestedItemCode" },
    finalOraclePolicy: {
      requirements: [
        { factKey: NESY_FACTS.ACTIVE_STOP_MATCHES, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.ACTIVE_STOP_OBSERVED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.AVAILABLE_STOPS_LOADED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
      ],
    },
  },
];

const GENERIC_IR = irDocument({
  workflowId: "nesy.reference.open-stop",
  name: "Open the requested stop",
  sourceRef: NESY_OPEN_STOP_MACRO_KEY,
  inputs: [{ name: "requestedItemCode", type: "string", required: true }],
  variables: [
    { name: "availableRows", type: "stringList" },
    { name: "rowHandle", type: "string" },
  ],
  steps: STEPS,
  entryStepId: "read-available",
  capabilityRequirements: [
    requires("verdict.core.bridge.tap"),
    requires("verdict.core.bridge.resolve-target"),
    optionally("wait_any", "SEQUENTIAL_LEGS"),
  ],
  sourceMap: [
    sourceMapEntry("sm-open-1", "read-available", NESY_OPEN_STOP_MACRO_KEY, "safeguard 2: read the projection first"),
    sourceMapEntry("sm-open-2", "check-present", NESY_OPEN_STOP_MACRO_KEY, "safeguard 2: verify presence before touching anything"),
    sourceMapEntry("sm-open-3", "report-absent", NESY_OPEN_STOP_MACRO_KEY, "precondition mismatch path"),
    sourceMapEntry("sm-open-4", "resolve-row", NESY_OPEN_STOP_MACRO_KEY, "safeguards 3+4: provider chain, ambiguity fail-closed"),
    sourceMapEntry("sm-open-5", "tap-row", NESY_OPEN_STOP_MACRO_KEY),
    sourceMapEntry("sm-open-6", "await-destination", NESY_OPEN_STOP_MACRO_KEY, "safeguard 5: task list OR delivery flow"),
    sourceMapEntry("sm-open-7", "assert-correct-item", NESY_OPEN_STOP_MACRO_KEY, "safeguard 6: the wrong-row guard"),
  ],
});

const EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_OPEN_STOP_MACRO_KEY,
  authoredBy: "HAND",
  genericIr: GENERIC_IR,
  irSourceMap: GENERIC_IR.sourceMap,
  domainSourceMap: [
    {
      ref: "ds-open-1",
      macroRef: NESY_OPEN_STOP_MACRO_KEY,
      planStepIds: STEPS.map((step) => step.planStepId),
      sliceRef: "OPEN_STOP",
      note: "Guard → resolve → act → await-either → verify. Every generic step traces back to this single macro.",
    },
  ],
};

const BRIDGE_PLAN: BridgeFlowPlanSnapshot = {
  macroRef: NESY_OPEN_STOP_MACRO_KEY,
  authoredBy: "HAND",
  requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.bridge.resolve-target"],
  legs: [
    { planStepId: "resolve-row", bridgeVerb: "resolveTarget", targetRef: NESY_TARGETS.stopRow },
    {
      planStepId: "tap-row",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.stopRow,
      awaitFactKey: NESY_FACTS.TASK_LIST_READY,
    },
    { planStepId: "await-destination", bridgeVerb: "watch", awaitFactKey: NESY_FACTS.DELIVERY_FLOW_READY },
  ],
};

export const NESY_OPEN_STOP_MACRO: MacroDefinition = {
  macroKey: NESY_OPEN_STOP_MACRO_KEY,
  actionRef: NESY_ACTIONS.openStop,
  displayName: "Open stop",
  businessMeaning:
    "A courier opens a specific stop from the route list and the app is then working on THAT stop — identified by its business key, never by its position in the list.",
  notResponsibleFor: [
    "what happens inside the stop once it is open (see PROCESS_PARCEL and COMPLETE_DELIVERY)",
    "the ordering of the stop list",
    "creating the stop — the stop must already exist in the available projection",
    "navigation back out of the stop",
  ],
  input: {
    fields: [
      {
        // Safeguard 1: a typed entity, not an index.
        name: "stop",
        type: "entityRef",
        required: true,
        entityTypeRef: NESY_ENTITIES.stop,
        description: "The stop to open, identified by its business key.",
      },
    ],
  },
  output: {
    fields: [
      { name: "activeStopMatches", type: "boolean", factKey: NESY_FACTS.ACTIVE_STOP_MATCHES },
      { name: "landedOnTaskList", type: "boolean", factKey: NESY_FACTS.TASK_LIST_READY },
    ],
  },
  preconditions: [
    { kind: "SCREEN_READY", ref: NESY_SCREENS.routeStopList, deadlineMs: 25_000, onUnmet: "FAIL" },
    { kind: "FACT_TRUE", ref: NESY_FACTS.AVAILABLE_STOPS_LOADED, deadlineMs: 20_000, onUnmet: "FAIL" },
    { kind: "ENTITY_AVAILABLE", ref: NESY_ENTITIES.stop, deadlineMs: 20_000, onUnmet: "FAIL" },
    { kind: "SURFACE_ABSENT", ref: NESY_SURFACES.mandatoryUpdateDialog, deadlineMs: 5_000, onUnmet: "FAIL" },
  ],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.routeStopList, NESY_SCREENS.stopTaskList, NESY_SCREENS.deliveryFlow],
    surfaceRefs: [NESY_SURFACES.mandatoryUpdateDialog, NESY_SURFACES.networkDialog],
    entityTypeRefs: [NESY_ENTITIES.stop],
    targetRefs: [NESY_TARGETS.stopRow],
    factKeys: [
      NESY_FACTS.AVAILABLE_STOPS_LOADED,
      NESY_FACTS.TASK_LIST_READY,
      NESY_FACTS.DELIVERY_FLOW_READY,
      NESY_FACTS.LOADING_BLOCKER_PRESENT,
      NESY_FACTS.ACTIVE_STOP_OBSERVED,
      NESY_FACTS.ACTIVE_STOP_MATCHES,
    ],
    queryRefs: [NESY_ADAPTER_QUERY_REFS.availableStops, NESY_ADAPTER_QUERY_REFS.stopState],
    adapterOperationRefs: [],
  },
  oracleTemplate: {
    continueGate: {
      anyOf: [NESY_FACTS.TASK_LIST_READY, NESY_FACTS.DELIVERY_FLOW_READY],
      noneOf: [NESY_FACTS.LOADING_BLOCKER_PRESENT],
      deadlineMs: 20_000,
      unknownPolicy: "RETRY",
    },
    finalOracle: {
      requirements: [
        { factKey: NESY_FACTS.ACTIVE_STOP_MATCHES, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.ACTIVE_STOP_OBSERVED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
      ],
    },
    notResponsibleFor: [
      "whether the opened stop's task list is complete — only that the opened stop is the requested one",
    ],
  },
  interruptPolicy: NESY_DEFAULT_INTERRUPT_POLICY,
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.resolve-target",
    "verdict.core.bridge.watch-fact",
    "domain.nesy.adapter.named-query",
    "domain.nesy.adapter.state-projection",
  ],
  expansionSnapshot: EXPANSION,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
};

export const OPEN_STOP_SLICE: NesyReferenceSlice = {
  sliceKey: "OPEN_STOP",
  displayName: "Open stop",
  businessMeaning: NESY_OPEN_STOP_MACRO.businessMeaning,
  notResponsibleFor: NESY_OPEN_STOP_MACRO.notResponsibleFor,
  inputSchema: NESY_OPEN_STOP_MACRO.input,
  outputSchema: NESY_OPEN_STOP_MACRO.output,
  preconditions: NESY_OPEN_STOP_MACRO.preconditions,
  screenRefs: [NESY_SCREENS.routeStopList, NESY_SCREENS.stopTaskList, NESY_SCREENS.deliveryFlow],
  surfaceRefs: [NESY_SURFACES.mandatoryUpdateDialog, NESY_SURFACES.networkDialog],
  entityBindings: [
    {
      entityTypeRef: NESY_ENTITIES.stop,
      targetRef: NESY_TARGETS.stopRow,
      role: "The row is identified by the stop's business key, which survives a background re-sort of the list.",
    },
  ],
  targetResolutionRefs: [NESY_TARGETS.stopRow],
  semanticMacroRef: NESY_OPEN_STOP_MACRO_KEY,
  macroExpansion: EXPANSION,
  genericIrSnapshot: GENERIC_IR,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
  oracle: NESY_OPEN_STOP_MACRO.oracleTemplate,
  interruptPolicy: NESY_OPEN_STOP_MACRO.interruptPolicy,
  requiredCapabilityRefs: NESY_OPEN_STOP_MACRO.requiredCapabilityRefs,
  releaseIsolation: NESY_UI_ONLY_RELEASE_ISOLATION,
  negativeCases: [
    {
      caseKey: "ROW_INDEX_AS_IDENTITY",
      scenario:
        "The plan opens 'row 3'. A background sync re-sorts the list between read and tap, the run opens someone else's stop, delivers there successfully, and every oracle passes.",
      refusedBy:
        "validateTargetResolutionPolicy raises ROW_INDEX_AS_IDENTITY for a rowIndex provider claiming establishesIdentity, and ROW_INDEX_NOT_LAST if the hint precedes a real provider. The chain must carry an identity provider.",
    },
    {
      caseKey: "AMBIGUOUS_TARGET_FIRST_MATCH",
      scenario:
        "Two rows match the selector (a duplicated stop, a stale item). The resolver picks the first and the run operates on the wrong one.",
      refusedBy:
        "ambiguityPolicy is FAIL and the AmbiguityPolicy union has no FIRST_MATCH member, so 'just pick one' is not expressible.",
    },
    {
      caseKey: "TAP_BEFORE_PRECONDITION_CHECK",
      scenario:
        "The requested stop is not on this route at all. The macro taps first and reports a target-resolution failure, having already touched the screen.",
      refusedBy:
        "read-available/check-present run before resolve-row; the not-present path goes to ANNOTATE with next=null and touches nothing.",
    },
    {
      caseKey: "WAITED_ONLY_FOR_TASK_LIST",
      scenario:
        "A single-task stop opens straight into the delivery flow. A plan that waits only for the task list times out and reports a product failure that is not one.",
      refusedBy:
        "The WAIT_ANY step accepts either UI.TASK_LIST_READY or UI.DELIVERY_FLOW_READY, and the Continue Gate uses anyOf for the same reason.",
    },
    {
      caseKey: "OPENED_SOMETHING_UNVERIFIED",
      scenario:
        "All resolution safeguards fail simultaneously and some stop opens. Readiness is satisfied, so the run continues into delivery on the wrong entity.",
      refusedBy:
        "APP.ACTIVE_STOP_MATCHES is a REQUIRED IMMEDIATE oracle requirement, derived with requiresCorrelation:true by comparing the app's active stop to the requested business key.",
    },
    {
      caseKey: "UNTYPED_INDEX_INPUT",
      scenario: "The macro is changed to accept a numeric row position because it is simpler to author.",
      refusedBy:
        "The macro input is an entityRef bound to the STOP entity type; validateMacroDefinition raises MACRO_ENTITY_INPUT_UNTYPED for an entityRef with no entityTypeRef, and the reference test asserts the STOP input specifically.",
    },
  ],
};
