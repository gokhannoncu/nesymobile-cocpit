/**
 * ===========================================================================
 *  LOAD_TO_VEHICLE slice — zimmet alma (taking custody of a parcel)
 *
 *  Route selection creates the day's schedule EMPTY. This is the step that puts
 *  work in it: the courier scans a parcel at the branch and the app takes custody
 *  of it. Everything below was measured on the device, not read off a layout.
 *
 *  ### The flow, as the product actually runs it
 *
 *  The parcel is NOT in the schedule yet, so `StopViewModel.getTransaction`
 *  matches nothing and returns `FORCE_LOAD`, which hands the barcode to
 *  `ScanProcessor`. That processor — not the stop list — is the real flow:
 *
 *      FETCH_SHIPMENT   Shipment/GetShipmentCreateInstantTaskServiceData
 *      [dialogs]        hub warning · DELY/DELR/STOR/LOST · network · generic
 *      [RS only]        delivery time-range picker, per waybill
 *      CREATE_TASK      Task/CreateInstantTask
 *      FETCH_SCHEDULE   the schedule is re-read and written to Room
 *
 *  Measured end to end for one parcel: `Loaded Parcels` went 0 → 1, the stop list
 *  gained one stop, `stop_chunk_count` went 0 → 1, and `nesy.parcelState` for that
 *  barcode returned `item_status = 4` (Loaded).
 *
 *  ### TRAP 1 — the country rule is a POLICY here, not an `if`
 *
 *  Serbia asks for a delivery time range before the task is created; nobody else
 *  does. That is expressed as `notFoundPolicy: WAIT_THEN_ABSENT` on the picker's
 *  confirm target: it waits for asynchronous appearance before accepting absence,
 *  and the dependent tap reports `SKIPPED` when the picker remains absent.
 *  A `countryCode == "RS"` branch in the
 *  macro would have put a device-side condition into pack vocabulary, and every
 *  new country would edit the macro.
 *
 *  This cost two host fixes to become true, both of the phase's signature kind.
 *  `notFoundPolicy` had been part of `TargetResolutionPolicy` all along and the
 *  runtime never read it, and the action contract had no way to say "there was
 *  nothing to do" — `SUCCEEDED` with `effectVerified: false` was converted to
 *  `FAILED` + evidenceInsufficient. Measured before the fix: this slice's cleanup
 *  step aborted a run in which nine steps were green and the parcel was loaded.
 *
 *  ### TRAP 2 — the step wire cannot carry the evidence yet
 *
 *  `ScanProcessor` already emits Verdict events for all three steps, and they are
 *  the natural producers for "the load was accepted". They are NOT bound here.
 *  The host's device-event dictionary maps ONE wire name to ONE fact and reads a
 *  boolean from a declared `valueField` on EVERY emit — and refusing a frame is
 *  BLOCKING. `VEHICLE_LOADING_STEP` carries three different meanings under one
 *  name (`data.step` = FETCH_SHIPMENT | CREATE_TASK | FETCH_SCHEDULE) and no
 *  boolean field at all, so registering it would either collapse the three steps
 *  into one fact or stall the run.
 *
 *  So this slice judges the OUTCOME from the query planes, which are proven:
 *  the parcel is in the schedule, and the schedule now has a body. Splitting the
 *  wire into per-step events with a boolean is app-side work, tracked separately.
 *  Declaring a REQUIRED fact with no producer is the one thing this phase exists
 *  to stop.
 *
 *  ### TRAP 3 — a refusal dialog outlives the run
 *
 *  Every refusal path ends in a dialog. An aborted run that leaves one open makes
 *  the NEXT run fail on a screen it never reached — measured with the route
 *  spinner popup, whose leftover state turned the following run's
 *  `resolve-spinner` into `not_found`. `resolve-acknowledge` + `tap-acknowledge`
 *  close it, and both are absent-tolerant so the happy path reports them as
 *  `SKIPPED` and walks on. The refusal ends inside the run that caused it.
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
import { irDocument, requires, sourceMapEntry, stepBase } from "./ir-authoring.js";

export const NESY_LOAD_TO_VEHICLE_MACRO_KEY = "nesy.macro.load-to-vehicle";

const STEPS: readonly WorkflowStepV2[] = [
  {
    ...stepBase({
      planStepId: "wait-stop-list-ready",
      sourceMapRef: "sm-load-1",
      next: "resolve-manual-entry",
      timeoutMs: 20_000,
    }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.ROUTE_LIST_READY,
    sourceLane: "UI",
    stableForMs: 200,
    requireCorrelation: false,
    onTimeout: "FAIL",
  },
  {
    ...stepBase({
      planStepId: "resolve-manual-entry",
      sourceMapRef: "sm-load-2",
      next: "tap-manual-entry",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.manualBarcodeEntry,
    outputVariable: "manualEntryHandle",
  },
  {
    // Typed entry, not the camera. A camera scan needs a physical label in front
    // of a physical lens, which no run can supply; the product's own manual-entry
    // path is the same code path from `onBarcodeRead` onward (`ScanType.INPUT`).
    ...stepBase({
      planStepId: "tap-manual-entry",
      sourceMapRef: "sm-load-3",
      next: "resolve-barcode-field",
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "manualEntryHandle",
  },
  {
    ...stepBase({
      planStepId: "resolve-barcode-field",
      sourceMapRef: "sm-load-4",
      next: "enter-barcode",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.barcodeInputField,
    outputVariable: "inputFieldHandle",
  },
  {
    ...stepBase({
      planStepId: "enter-barcode",
      sourceMapRef: "sm-load-5",
      next: "resolve-input-confirm",
      capabilityRequirements: [requires("verdict.core.bridge.set-text")],
    }),
    kind: "BRIDGE_ACTION",
    action: "setText",
    targetVariable: "inputFieldHandle",
    // ONE value is typed, whatever spelling the author had. The dialog itself
    // validates nothing (its length checks are commented out in the product) and
    // both the device matcher and the projection accept `barcode`,
    // `legacySystemBarcode` and `legacySystemShortBarcode` against this argument.
    args: { valueRef: "run.input.scanValue" },
  },
  {
    ...stepBase({
      planStepId: "resolve-input-confirm",
      sourceMapRef: "sm-load-6",
      next: "tap-input-confirm",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.barcodeInputConfirm,
    outputVariable: "inputConfirmHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-input-confirm",
      sourceMapRef: "sm-load-7",
      next: "resolve-time-slot",
      // The backend round trip lives behind this tap: fetch-shipment, then the
      // task creation, then a schedule re-read. Measured at ~350 ms for the fetch
      // alone against RS staging, and the whole chain is what this budget covers.
      timeoutMs: 40_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "inputConfirmHandle",
  },
  {
    // RS-only, and absent everywhere else — see TRAP 1.
    ...stepBase({
      planStepId: "resolve-time-slot",
      sourceMapRef: "sm-load-8",
      next: "tap-time-slot",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.timeSlotConfirm,
    outputVariable: "timeSlotHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-time-slot",
      sourceMapRef: "sm-load-9",
      next: "resolve-acknowledge",
      timeoutMs: 40_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "timeSlotHandle",
    // The picker's default selection is accepted deliberately: WHICH range the
    // courier picks is a business choice this slice does not judge, and driving
    // the NumberPicker to a specific value would assert something the slice does
    // not claim. Measured: confirming the default completed the load.
    //
    // Outside Serbia this step reports `SKIPPED` — the target was declared
    // absent-tolerant and the picker is not there. Not a success, not a failure:
    // the step had no subject.
  },
  // Cleanup, absent on the happy path. Every refusal path ends in a dialog, and
  // an aborted run that leaves one open makes the NEXT run fail on a screen it
  // never reached — measured with the route spinner popup, whose leftover state
  // turned the following run's `resolve-spinner` into `not_found`. The refusal
  // ends inside the run that caused it.
  {
    ...stepBase({
      planStepId: "resolve-acknowledge",
      sourceMapRef: "sm-load-10",
      next: "tap-acknowledge",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.dialogAcknowledge,
    outputVariable: "dialogHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-acknowledge",
      sourceMapRef: "sm-load-10a",
      next: "check-load-refused",
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "dialogHandle",
  },
  // OBSERVED LAST, immediately before the assert. An SDK observation is
  // republished carrying its ORIGINAL timestamp against a 30 s freshness bound,
  // so a read placed earlier in a long slice is dropped as stale by the time the
  // final oracle asks — measured on select-route, where a fact the device had
  // answered came back as `REQUIRED_TIMEOUT`.
  {
    ...stepBase({
      planStepId: "read-parcel-state",
      sourceMapRef: "sm-load-11",
      next: "read-local-schedule",
      timeoutMs: 40_000,
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.parcelState,
    // The tap starts CreateInstantTask + schedule refresh asynchronously.
    // Wait for THIS barcode's stored row, not the earlier empty-route event.
    waitUntil: { kind: "ROWS_PRESENT" },
    // Narrowed to THIS parcel, which is what makes a row an answer about the
    // requested one rather than about any loaded parcel. `waybillNumber` carries
    // the shipment id when the author had that instead; the projection needs one
    // of the two and refuses with MISSING_PARAM when both are blank.
    params: { barcode: "run.input.scanValue", waybillNumber: "run.input.alternateKey" },
    maxRows: 20,
    outputVariable: "itemRows",
    outputFactBindings: [
      {
        factKey: NESY_FACTS.PARCEL_IN_SCHEDULE,
        // ROWS_PRESENT, not a column: the question is whether the schedule now
        // holds this parcel, and an empty result is a proven no.
        from: { kind: "ROWS_PRESENT" },
        correlationColumn: "barcode",
      },
    ],
  },
  {
    ...stepBase({
      planStepId: "read-local-schedule",
      sourceMapRef: "sm-load-12",
      next: "read-available-stops",
      timeoutMs: 40_000,
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.dbSchedule,
    waitUntil: { kind: "COLUMN", column: "schedule_body_stored" },
    maxRows: 1,
    outputVariable: "loadScheduleRows",
    outputFactBindings: [
      {
        factKey: NESY_FACTS.SCHEDULE_BODY_STORED,
        from: { kind: "COLUMN", column: "schedule_body_stored" },
        correlationColumn: "schedule_id",
      },
    ],
  },
  {
    ...stepBase({
      planStepId: "read-available-stops",
      sourceMapRef: "sm-load-13",
      next: "assert-loaded",
      timeoutMs: 40_000,
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.availableStops,
    waitUntil: { kind: "ROWS_PRESENT" },
    maxRows: 200,
    outputVariable: "loadedRows",
    // REQUIRED here, unlike in select-route. There the schedule is supposed to be
    // empty and demanding stops failed correct behaviour; here loading a parcel is
    // exactly what creates one, so an empty stop list after a load is a real no.
    outputFactBindings: [{ factKey: NESY_FACTS.AVAILABLE_STOPS_LOADED, from: { kind: "ROWS_PRESENT" } }],
  },
  {
    /**
     * DID THE PRODUCT REFUSE, OR DID IT SAY NOTHING?
     *
     * Those are different outcomes and this slice used to report them as one.
     * Measured on run_38810dc0: the canvas still held a barcode whose parcel had
     * been DELIVERED an hour earlier, the app answered
     * `DIALOG_SHOWN {dialog: "DELY_DELR_STOR_LOST", message: "6880051000310910-DELY"}`
     * — its own words for "that parcel is already delivered" — the refusal dialog
     * was tapped away by `tap-acknowledge`, nothing entered the schedule, and the
     * run reported FAIL_PRODUCT. The product had behaved perfectly; the input
     * named a spent parcel. A verdict that blames the app for refusing an
     * impossible request is worse than no verdict, because somebody goes looking
     * for a defect that is not there.
     *
     * The signal was already in the plan and thrown away. `resolve-acknowledge`
     * is `TREAT_AS_ABSENT`, so it answers exactly this question: absent on the
     * happy path, present when the app raised something. So the two outcomes get
     * two terminals — the strict one below, and [assert-load-refused], whose
     * requirements time out INCONCLUSIVE rather than FAIL.
     *
     * EXISTENCE, not equality — the same reasoning `open-stop`'s
     * `check-search-open` records. The runtime writes `{ absentTarget: true }`
     * when an absent-tolerant target is not there and a plain fingerprint when it
     * is, so the marker is either present or missing; comparing it to `true`
     * leaves the PRESENT-dialog case with an operand that resolves to nothing,
     * and a two-state question would be answered UNKNOWN in one of its two
     * states.
     *
     * `onUnknown` still routes to the STRICT terminal. A run that cannot say
     * whether a dialog appeared must not be excused; being unsure is not a
     * refusal, and the honest default is the harsher reading of a load that did
     * not happen.
     */
    ...stepBase({ planStepId: "check-load-refused", sourceMapRef: "sm-load-13a", next: null }),
    kind: "CONDITION",
    condition: {
      kind: "existence",
      operator: "exists",
      operand: { kind: "operand", source: "step.output", path: "dialogHandle.absentTarget" },
    },
    // Marker present → no dialog → judge the load strictly.
    onTrue: "read-parcel-state",
    onFalse: "assert-load-refused",
    unknownPolicy: "BRANCH",
    onUnknown: "read-parcel-state",
  },
  {
    ...stepBase({ planStepId: "assert-loaded", sourceMapRef: "sm-load-14", next: null }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.PARCEL_IN_SCHEDULE,
    expected: true,
    unknownPolicy: "FAIL",
    entityBinding: { type: NESY_ENTITIES.parcel, id: "run.input.scanValue" },
    finalOraclePolicy: {
      requirements: [
        { factKey: NESY_FACTS.PARCEL_IN_SCHEDULE, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.SCHEDULE_BODY_STORED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.AVAILABLE_STOPS_LOADED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
      ],
    },
  },
  {
    /**
     * The same three claims, judged as UNTESTED rather than as a product failure.
     *
     * Reached only when the app raised a dialog on the load path — see
     * [check-load-refused]. The requirements are still REQUIRED, because this
     * slice's job is still to put a parcel in the schedule and it demonstrably
     * did not; what changes is `onTimeout`, from FAIL to INCONCLUSIVE. That is
     * the exact difference between "the app failed to load a loadable parcel"
     * and "the app declined, so loading was never exercised".
     *
     * Not PASS, and deliberately so. A run that ends here loaded nothing, and a
     * green result would hide a spent test parcel until somebody trusted the
     * suite. INCONCLUSIVE is the true answer: go look at the input.
     *
     * The refusal REASON is not asserted here. The app carries it — the
     * `DELY_DELR_STOR_LOST` dialog's message names the barcode and its status —
     * but that frame reaches the host without a BridgeFlow correlation tuple, so
     * it stops at LEGACY_NO_CONTEXT and is not evidence anything may be judged
     * on. Declaring a REQUIRED fact with no producer is the one thing this phase
     * exists to stop, so the reason stays a diagnostic in the inbox until the app
     * stamps that emit path.
     */
    ...stepBase({ planStepId: "assert-load-refused", sourceMapRef: "sm-load-14a", next: null }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.PARCEL_IN_SCHEDULE,
    expected: true,
    unknownPolicy: "INCONCLUSIVE",
    entityBinding: { type: NESY_ENTITIES.parcel, id: "run.input.scanValue" },
    finalOraclePolicy: {
      requirements: [
        { factKey: NESY_FACTS.PARCEL_IN_SCHEDULE, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "INCONCLUSIVE" },
        { factKey: NESY_FACTS.SCHEDULE_BODY_STORED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "INCONCLUSIVE" },
        { factKey: NESY_FACTS.AVAILABLE_STOPS_LOADED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "INCONCLUSIVE" },
      ],
    },
  },
];

const GENERIC_IR = irDocument({
  workflowId: "nesy.reference.load-to-vehicle",
  name: "Take custody of a parcel",
  sourceRef: NESY_LOAD_TO_VEHICLE_MACRO_KEY,
  inputs: [
    // ONE typed value, plus an optional identity for the evidence read. The
    // "provide at least one of barcode / legacy short barcode / shipment id" rule
    // belongs to the authoring node, which resolves the author's choice into
    // `scanValue`; a macro cannot express "one of these four" and pretending
    // otherwise would move the validation somewhere nobody runs it.
    { name: "scanValue", type: "string", required: true },
    { name: "alternateKey", type: "string", required: false },
  ],
  variables: [
    { name: "manualEntryHandle", type: "string" },
    { name: "inputFieldHandle", type: "string" },
    { name: "inputConfirmHandle", type: "string" },
    { name: "timeSlotHandle", type: "string" },
    { name: "dialogHandle", type: "string" },
    { name: "itemRows", type: "stringList" },
    { name: "loadScheduleRows", type: "stringList" },
    { name: "loadedRows", type: "stringList" },
  ],
  steps: STEPS,
  entryStepId: "wait-stop-list-ready",
  capabilityRequirements: [
    requires("verdict.core.bridge.tap"),
    requires("verdict.core.bridge.set-text"),
    requires("verdict.core.bridge.watch-fact"),
  ],
  sourceMap: [
    sourceMapEntry("sm-load-1", "wait-stop-list-ready", NESY_LOAD_TO_VEHICLE_MACRO_KEY),
    sourceMapEntry("sm-load-2", "resolve-manual-entry", NESY_LOAD_TO_VEHICLE_MACRO_KEY),
    sourceMapEntry("sm-load-3", "tap-manual-entry", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "typed entry, not the camera"),
    sourceMapEntry("sm-load-4", "resolve-barcode-field", NESY_LOAD_TO_VEHICLE_MACRO_KEY),
    sourceMapEntry("sm-load-5", "enter-barcode", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "one value, any accepted spelling"),
    sourceMapEntry("sm-load-6", "resolve-input-confirm", NESY_LOAD_TO_VEHICLE_MACRO_KEY),
    sourceMapEntry("sm-load-7", "tap-input-confirm", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "the backend round trip is behind this tap"),
    sourceMapEntry("sm-load-8", "resolve-time-slot", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "RS only; absent elsewhere by policy"),
    sourceMapEntry("sm-load-9", "tap-time-slot", NESY_LOAD_TO_VEHICLE_MACRO_KEY),
    sourceMapEntry("sm-load-10", "resolve-acknowledge", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "absent on the happy path; SKIPPED when so"),
    sourceMapEntry("sm-load-10a", "tap-acknowledge", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "a refusal ends inside the run that caused it"),
    sourceMapEntry("sm-load-11", "read-parcel-state", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "narrowed to THIS parcel"),
    sourceMapEntry("sm-load-12", "read-local-schedule", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "the schedule gained a body"),
    sourceMapEntry("sm-load-13", "read-available-stops", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "REQUIRED here, unlike select-route"),
    sourceMapEntry("sm-load-13a", "check-load-refused", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "did the app refuse, or say nothing?"),
    sourceMapEntry("sm-load-14", "assert-loaded", NESY_LOAD_TO_VEHICLE_MACRO_KEY),
    sourceMapEntry("sm-load-14a", "assert-load-refused", NESY_LOAD_TO_VEHICLE_MACRO_KEY, "refused: untested, not a product failure"),
  ],
});

const EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_LOAD_TO_VEHICLE_MACRO_KEY,
  authoredBy: "COMPILER",
  genericIr: GENERIC_IR,
  irSourceMap: GENERIC_IR.sourceMap,
  domainSourceMap: [
    {
      ref: "ds-load-1",
      macroRef: NESY_LOAD_TO_VEHICLE_MACRO_KEY,
      planStepIds: STEPS.map((step) => step.planStepId),
      sliceRef: "LOAD_TO_VEHICLE",
      note: "Linear. Two steps are absent-tolerant by target policy: the RS time-range picker and the refusal dialog.",
    },
  ],
};

const BRIDGE_PLAN: BridgeFlowPlanSnapshot = {
  macroRef: NESY_LOAD_TO_VEHICLE_MACRO_KEY,
  authoredBy: "COMPILER",
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.set-text",
    "verdict.core.bridge.resolve-target",
  ],
  legs: [
    { planStepId: "wait-stop-list-ready", bridgeVerb: "watch", awaitFactKey: NESY_FACTS.ROUTE_LIST_READY },
    { planStepId: "tap-manual-entry", bridgeVerb: "tap", targetRef: NESY_TARGETS.manualBarcodeEntry },
    { planStepId: "enter-barcode", bridgeVerb: "setText", targetRef: NESY_TARGETS.barcodeInputField },
    {
      planStepId: "tap-input-confirm",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.barcodeInputConfirm,
      awaitFactKey: NESY_FACTS.AVAILABLE_STOPS_LOADED,
    },
    { planStepId: "tap-time-slot", bridgeVerb: "tap", targetRef: NESY_TARGETS.timeSlotConfirm },
  ],
};

export const NESY_LOAD_TO_VEHICLE_MACRO: MacroDefinition = {
  macroKey: NESY_LOAD_TO_VEHICLE_MACRO_KEY,
  actionRef: NESY_ACTIONS.loadToVehicle,
  displayName: "Load parcel to vehicle",
  businessMeaning:
    "A courier takes custody of a parcel at the branch: the app accepts the scanned parcel, the backend creates the task for it, and the parcel appears in the schedule stored on the device.",
  notResponsibleFor: [
    "whether the parcel SHOULD have been loaded on this route — the backend owns that judgement and answers with a refusal",
    "which delivery time range is correct; the RS picker's default is confirmed, not chosen",
    "the stop ordering the loaded parcel produces",
    "the hand-terminal vehicle-loading screen, which is a different flow with its own endpoint (Task/InsertCargoTransaction)",
    "camera scanning; the typed-entry path is driven because a run cannot present a physical label",
  ],
  input: {
    fields: [
      {
        name: "scanValue",
        type: "string",
        required: true,
        description:
          "The value typed into the barcode field: parcel barcode, legacy system barcode or legacy short barcode.",
      },
      {
        name: "alternateKey",
        type: "string",
        required: false,
        description: "Waybill number, used to look the parcel up when the author identified it that way.",
      },
    ],
  },
  output: {
    fields: [
      { name: "parcelLoaded", type: "boolean", factKey: NESY_FACTS.PARCEL_IN_SCHEDULE },
      { name: "scanValue", type: "string" },
    ],
  },
  preconditions: [
    { kind: "FACT_TRUE", ref: NESY_FACTS.USER_SESSION_AVAILABLE_APP, deadlineMs: 10_000, onUnmet: "FAIL" },
    // A route must already be selected: without a schedule there is nothing to
    // load INTO, and `CreateInstantTask` answers "Schedule Not Found".
    { kind: "FACT_TRUE", ref: NESY_FACTS.SELECTED_ROUTE_OBSERVED, deadlineMs: 10_000, onUnmet: "FAIL" },
    { kind: "SURFACE_ABSENT", ref: NESY_SURFACES.mandatoryUpdateDialog, deadlineMs: 5_000, onUnmet: "FAIL" },
  ],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.routeStopList],
    surfaceRefs: [],
    entityTypeRefs: [NESY_ENTITIES.parcel],
    targetRefs: [
      NESY_TARGETS.manualBarcodeEntry,
      NESY_TARGETS.barcodeInputField,
      NESY_TARGETS.barcodeInputConfirm,
      NESY_TARGETS.timeSlotConfirm,
      NESY_TARGETS.dialogAcknowledge,
    ],
    factKeys: [
      NESY_FACTS.ROUTE_LIST_READY,
      NESY_FACTS.PARCEL_IN_SCHEDULE,
      NESY_FACTS.SCHEDULE_BODY_STORED,
      NESY_FACTS.AVAILABLE_STOPS_LOADED,
      NESY_FACTS.SELECTED_ROUTE_OBSERVED,
      NESY_FACTS.USER_SESSION_AVAILABLE_APP,
    ],
    queryRefs: [
      NESY_ADAPTER_QUERY_REFS.parcelState,
      NESY_ADAPTER_QUERY_REFS.dbSchedule,
      NESY_ADAPTER_QUERY_REFS.availableStops,
    ],
    adapterOperationRefs: [],
  },
  oracleTemplate: {
    continueGate: {
      // Readiness only. Whether the parcel landed is the oracle's question, and a
      // gate that demanded it would wait on a fact produced by steps below it —
      // the mistake select-route's confirm gate made and had to unlearn.
      allOf: [NESY_FACTS.ROUTE_LIST_READY],
      deadlineMs: 25_000,
      unknownPolicy: "RETRY",
    },
    finalOracle: {
      requirements: [
        { factKey: NESY_FACTS.PARCEL_IN_SCHEDULE, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.SCHEDULE_BODY_STORED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.AVAILABLE_STOPS_LOADED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
      ],
    },
    notResponsibleFor: [
      "the backend's own custody record; this slice judges the device and the schedule it stores",
    ],
  },
  interruptPolicy: NESY_DEFAULT_INTERRUPT_POLICY,
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.set-text",
    "verdict.core.bridge.resolve-target",
    "verdict.core.bridge.watch-fact",
    "domain.nesy.adapter.named-query",
  ],
  expansionSnapshot: EXPANSION,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
};

export const LOAD_TO_VEHICLE_SLICE: NesyReferenceSlice = {
  sliceKey: "LOAD_TO_VEHICLE",
  displayName: "Load parcel to vehicle",
  businessMeaning: NESY_LOAD_TO_VEHICLE_MACRO.businessMeaning,
  notResponsibleFor: NESY_LOAD_TO_VEHICLE_MACRO.notResponsibleFor,
  inputSchema: NESY_LOAD_TO_VEHICLE_MACRO.input,
  outputSchema: NESY_LOAD_TO_VEHICLE_MACRO.output,
  preconditions: NESY_LOAD_TO_VEHICLE_MACRO.preconditions,
  screenRefs: [NESY_SCREENS.routeStopList],
  surfaceRefs: [],
  entityBindings: [
    {
      entityTypeRef: NESY_ENTITIES.parcel,
      targetRef: NESY_TARGETS.barcodeInputField,
      role: "The parcel is identified by the value typed, and the evidence read is narrowed by the same value.",
    },
  ],
  targetResolutionRefs: [
    NESY_TARGETS.manualBarcodeEntry,
    NESY_TARGETS.barcodeInputField,
    NESY_TARGETS.barcodeInputConfirm,
    NESY_TARGETS.timeSlotConfirm,
    NESY_TARGETS.dialogAcknowledge,
  ],
  semanticMacroRef: NESY_LOAD_TO_VEHICLE_MACRO_KEY,
  macroExpansion: EXPANSION,
  genericIrSnapshot: GENERIC_IR,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
  oracle: NESY_LOAD_TO_VEHICLE_MACRO.oracleTemplate,
  interruptPolicy: NESY_LOAD_TO_VEHICLE_MACRO.interruptPolicy,
  requiredCapabilityRefs: NESY_LOAD_TO_VEHICLE_MACRO.requiredCapabilityRefs,
  releaseIsolation: NESY_UI_ONLY_RELEASE_ISOLATION,
  negativeCases: [
    {
      caseKey: "SOME_PARCEL_COUNTED_AS_THE_PARCEL",
      scenario:
        "The stop list gains a stop and the run passes, but the parcel that landed is not the one the run asked for — a stale queued scan, or the wrong barcode typed.",
      refusedBy:
        "LOCAL.PARCEL_IN_SCHEDULE comes from nesy.parcelState NARROWED by the scanned value, so rows-present is an answer about that parcel; the fact also carries the barcode as its correlation value.",
    },
    {
      caseKey: "REFUSAL_READ_AS_SUCCESS",
      scenario:
        "The backend refuses the parcel (delivered, other hub, zero weight, return document without ENTY) and the run reports success because the taps all landed.",
      refusedBy:
        "No fact is bound to a tap. The oracle requires the parcel to be IN the stored schedule and the schedule to carry a body, and a refusal leaves both false — the taps landing proves only that buttons were pressed.",
    },
    {
      caseKey: "RS_PICKER_TREATED_AS_A_FAILURE",
      scenario:
        "Serbia asks for a delivery time range; a macro that always expects the picker fails in every other country, and one that never expects it hangs in Serbia.",
      refusedBy:
        "The picker's confirm target declares WAIT_THEN_ABSENT: it waits up to its deadline for the asynchronous picker, then accepts absence if it never appears, without a country conditional in the macro.",
    },
    {
      caseKey: "STEP_WIRE_REQUIRED_WITHOUT_A_PRODUCER",
      scenario:
        "The slice requires APP-plane facts for FETCH_SHIPMENT / CREATE_TASK, which read naturally from the LOAD_TO_VEHICLE events — and every run reports EVIDENCE_INSUFFICIENT because one wire name carries three meanings and no boolean field.",
      refusedBy:
        "Those facts are deliberately not declared. The slice judges the query planes, which are measured; splitting the wire is app-side work and is recorded as such rather than assumed.",
    },
    {
      caseKey: "DIALOG_OUTLIVES_THE_RUN",
      scenario:
        "A refusal dialog is left open, and the NEXT run fails resolving a target on a screen the dialog covers — blaming the following run for this one's refusal.",
      refusedBy:
        "resolve-acknowledge and tap-acknowledge close the shared ArasDialog, and both are absent-tolerant (notFoundPolicy TREAT_AS_ABSENT → SKIPPED) so they cost nothing on a clean run. The refusal ends inside the run that caused it instead of being inherited by the next one.",
    },
  ],
};
