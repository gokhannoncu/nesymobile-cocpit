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
 *
 *  TRAP 3 — the schedule this slice produces is EMPTY, and that is correct.
 *  Selecting a route creates the day's schedule with no stops; the courier then
 *  loads the vehicle and the schedule fills itself from what was loaded. So the
 *  question here is whether TODAY'S schedule exists, is stored, belongs to the
 *  selected route and is the one the session is using — never whether it has
 *  work in it yet. Requiring stops turned the product's designed behaviour into
 *  `FAIL_PRODUCT`.
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
    ...stepBase({
      planStepId: "read-current-route",
      sourceMapRef: "sm-route-0a",
      next: "check-already-selected",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.state-projection")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.routeState,
    maxRows: 1,
    outputVariable: "currentRouteRows",
  },
  {
    ...stepBase({ planStepId: "check-already-selected", sourceMapRef: "sm-route-0b", next: null }),
    kind: "CONDITION",
    condition: {
      kind: "and",
      operands: [
        {
          kind: "comparison",
          operator: "in",
          left: { kind: "literal", value: "true" },
          right: { kind: "operand", source: "step.output", path: "read-current-route.route_selected" },
        },
        {
          kind: "comparison",
          operator: "in",
          left: { kind: "operand", source: "run.input", path: "routeCode" },
          right: { kind: "operand", source: "step.output", path: "read-current-route.route_name" },
        },
      ],
    },
    onTrue: "read-local-schedule",
    onFalse: "wait-dialog",
    unknownPolicy: "BRANCH",
    onUnknown: "wait-dialog",
  },
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
    // Narrowed to the requested route, which turns a list read into an answer:
    // the row carries the LABEL the dialog renders and the INDEX it sits at.
    // Measured: 353 rows unfiltered, one row for `matchKey`, and `31 *` resolves
    // to the same row as `31`.
    params: { matchKey: "run.input.routeCode" },
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
    onTrue: "resolve-spinner",
    onFalse: "report-not-offered",
    // Not BRANCH: if we cannot tell whether the route is offered, tapping
    // anything would be a guess about which row belongs to this courier.
    unknownPolicy: "FAIL",
  },
  {
    ...stepBase({ planStepId: "report-not-offered", sourceMapRef: "sm-route-4", next: null }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.ROUTES_AVAILABLE,
    expected: true,
    unknownPolicy: "FAIL",
  },
  // The offered list is inside a Spinner popup, so it does not exist until the
  // spinner is tapped. Resolving a row before that is resolving against a screen
  // the row is not on yet.
  {
    ...stepBase({
      planStepId: "resolve-spinner",
      sourceMapRef: "sm-route-4a",
      next: "tap-spinner",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.routeSpinner,
    outputVariable: "spinnerHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-spinner",
      sourceMapRef: "sm-route-4b",
      next: "scroll-to-row",
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "spinnerHandle",
  },
  {
    ...stepBase({
      planStepId: "scroll-to-row",
      sourceMapRef: "sm-route-4c",
      next: "resolve-row",
      // The popup is a window the platform still has to attach: measured, a
      // scroll issued in the same breath as the spinner tap answers `not_found`
      // and the same scroll succeeds a second later. This budget is how long the
      // surface is allowed to take — a statement about the product, which is why
      // it lives here and not in the host.
      timeoutMs: 15_000,
      capabilityRequirements: [requires("verdict.core.bridge.scroll-to-item")],
    }),
    kind: "BRIDGE_ACTION",
    // Positions the list; establishes NOTHING. A virtualized row is absent from
    // the accessibility tree, so `resolve-row` below would honestly answer
    // `not_found` for any route past the first screenful — measured: the list
    // shows 9 of 253 rows, and route 31 sits at index 29.
    //
    // `listClass`, not `listId`: Android builds the Spinner dropdown from its own
    // layout, so the ListView carries no application id to name it by.
    action: "scrollToItem",
    args: {
      listClass: "android.widget.ListView",
      rowIndex: "var.offeredRouteRows.route_index",
    },
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
    // The LABEL, not `routeCode`: a Serbian fiscal route renders as "31 *" while
    // its code is "31". The row identity has to be what the product draws, and
    // the projection is what knows the difference. Scrolling put the row on
    // screen; this step is what decides WHICH row is tapped, and it still fails
    // closed if two rows carry the same label.
    entityBinding: { type: NESY_ENTITIES.route, id: "var.offeredRouteRows.route_label" },
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
      next: "wait-schedule-stored",
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
  // OBSERVED LAST, immediately before the assert, and that ordering is
  // load-bearing rather than cosmetic. An SDK observation is republished into the
  // asking occurrence carrying its ORIGINAL timestamp, and the publisher stamps a
  // 30s freshness bound, so a fact observed early in a long slice is dropped as
  // stale by the time the final oracle asks. Measured: this read sat two steps
  // higher and `APP.SCHEDULE_IN_USE` never reached the derivation, which then
  // stayed silent and reported `REQUIRED_TIMEOUT` for a fact the device had
  // answered. Observe closest to the claim.
  //
  // The app plane is OBSERVED after the confirmation, not inferred from the tap.
  {
    ...stepBase({
      planStepId: "read-selected-route",
      sourceMapRef: "sm-route-8a",
      next: "assert-selection",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.state-projection")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.routeState,
    maxRows: 1,
    outputVariable: "selectedRouteRows",
    outputFactBindings: [
      { factKey: NESY_FACTS.SELECTED_ROUTE_OBSERVED, from: { kind: "COLUMN", column: "route_selected" } },
      // WHICH schedule the session holds, carried as the correlation key. On its
      // own this proves only that the screen has a plan — see the fact's note.
      {
        factKey: NESY_FACTS.SCHEDULE_IN_USE,
        from: { kind: "COLUMN", column: "schedule_in_use" },
        correlationColumn: "schedule_id",
      },
    ],
  },
  // The confirm tap does not store anything by itself.
  //
  // `Task/CreateEmptyScheduleDocument` goes out AFTER the tap returns, and the
  // store lands after that response plus several async hops
  // (`StopListFragment.handleEmptyScheduleSuccess` → `saveScheduleToDb` →
  // `ScheduleRepositoryImpl.saveScheduleToLocalSuspend`). Measured on
  // run_070214b6 (2026-09-05): the read below ran 530 ms BEFORE the create call
  // even started, found an empty Room, and the assert reported a correct empty
  // day as a broken route selection.
  //
  // Waited on the STORE, not on the approval: `APP.SCHEDULE_STATUS_APPROVED`
  // ships from the same choke point but carries the approval boolean, which a
  // freshly selected route legitimately does not satisfy — and a wait resolves
  // only on a true fact, so it would wait for the dispatcher. Not waited on
  // `LOCAL.SCHEDULE_PERSISTED` either: that is produced by the read below, and a
  // gate on a fact from a lower step is the trap `tap-confirm`'s own gate already
  // paid for once.
  {
    ...stepBase({
      planStepId: "wait-schedule-stored",
      sourceMapRef: "sm-route-8d",
      next: "read-local-schedule",
      timeoutMs: 20_000,
      capabilityRequirements: [requires("verdict.core.bridge.watch-fact")],
    }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.SCHEDULE_STORED,
    sourceLane: "APP",
    // No `stableForMs`: this is a discrete store, not a screen settling. The
    // APP-lane push wait in tour-approval omits it for the same reason.
    //
    // Correlation is not REQUIRED here, and that is a statement about what the
    // run can know: the schedule id is what the store MINTS, so a run selecting
    // a route has nothing to bind against — there is no schedule entity yet.
    // What keeps an older store from answering is occurrence scoping: the
    // executor only sees facts published into this occurrence, within their
    // freshness bound.
    requireCorrelation: false,
    // A day that never stored a schedule is a real failure, not something to
    // measure past — the whole leg below is about the plan the store produced.
    onTimeout: "FAIL",
  },
  // Selecting a route is supposed to CREATE today's schedule and store it. When
  // that creation fails the app falls back to `loadStopListFromLocal()` for ANY
  // schedule Room happens to hold — including yesterday's — and the screen looks
  // entirely normal. So the local plane is read on its own terms: is a schedule
  // stored, and is it today's by the product's own rule.
  //
  // "Stored" deliberately does NOT mean "carries stops". The SDK projection
  // computes `schedule_persisted` as `schedule != null && meta != null` precisely
  // because a freshly selected route's schedule is SUPPOSED to be empty; the
  // count travels separately as `SCHEDULE_BODY_STORED`. Folding stops into
  // "stored" would report the product's designed behaviour as a broken write.
  {
    ...stepBase({
      planStepId: "read-local-schedule",
      sourceMapRef: "sm-route-8c",
      next: "read-available-stops",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.dbSchedule,
    maxRows: 1,
    outputVariable: "localScheduleRows",
    outputFactBindings: [
      {
        factKey: NESY_FACTS.SCHEDULE_PERSISTED,
        from: { kind: "COLUMN", column: "schedule_persisted" },
        correlationColumn: "schedule_id",
      },
      {
        factKey: NESY_FACTS.SCHEDULE_IS_TODAY,
        from: { kind: "COLUMN", column: "schedule_is_today" },
        correlationColumn: "schedule_id",
      },
      // Correlated on the ROUTE, not the schedule id: a fact carries one
      // correlation value, and this claim is judged against the route the run
      // asked for. Same row, different question.
      {
        factKey: NESY_FACTS.SCHEDULE_ROUTE_OBSERVED,
        from: { kind: "COLUMN", column: "schedule_present" },
        correlationColumn: "schedule_route_code",
      },
    ],
  },
  {
    ...stepBase({
      planStepId: "read-available-stops",
      sourceMapRef: "sm-route-8b",
      next: "read-selected-route",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.availableStops,
    maxRows: 200,
    outputVariable: "loadedRows",
    // OBSERVED, never required here — and that is a BUSINESS RULE, not leniency.
    //
    // Selecting a route creates the schedule EMPTY by design. The courier then
    // loads the vehicle and the schedule fills itself from what was loaded. So an
    // empty stop list immediately after selection is the product working
    // correctly, and a REQUIRED stop fact turned correct behaviour into
    // `FAIL_PRODUCT` — measured: route 31's schedule was today's, stored, in use
    // and for the right route, and the run still failed on zero stops.
    //
    // The observation stays because the COUNT is worth recording: it is the
    // baseline the loading flow is judged against, and "0 at selection, N after
    // loading" is the shape a later slice asserts. `APP.AVAILABLE_STOPS_LOADED`
    // is still REQUIRED where it belongs — after a stop is opened, stops must
    // exist.
    outputFactBindings: [
      { factKey: NESY_FACTS.AVAILABLE_STOPS_LOADED, from: { kind: "ROWS_PRESENT" } },
    ],
  },
  // The back-office assignment read is GONE from this slice, deliberately.
  //
  // What route selection must get right is on the device: a schedule for today
  // was created, stored with its stops, and is the one the screen is working
  // with. Whether a back-office table also lists the assignment is a different
  // question with a different owner, and requiring it here made a staging data
  // gap read as a route-selection defect. `REMOTE.ROUTE_ASSIGNED` stays in the
  // registry for slices that genuinely reason about the backend's own record.
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
        // The three that decide whether the day's plan is real. The derived one
        // is what a mismatch trips: it requires the ids to agree, so yesterday's
        // plan sitting on screen cannot satisfy it.
        { factKey: NESY_FACTS.SCHEDULE_PERSISTED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.SCHEDULE_IS_TODAY, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        {
          factKey: NESY_FACTS.SCHEDULE_IN_USE_IS_TODAYS,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
        {
          factKey: NESY_FACTS.SCHEDULE_MATCHES_SELECTED_ROUTE,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
        // `APP.AVAILABLE_STOPS_LOADED` is NOT a requirement of this slice.
        // Route selection creates the schedule empty; the courier loads the
        // vehicle and the schedule fills from what was loaded. Requiring stops
        // here asserted a state the product is not supposed to be in yet.
        //
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
    { name: "currentRouteRows", type: "stringList" },
    { name: "offeredRouteRows", type: "stringList" },
    { name: "selectedRouteRows", type: "stringList" },
    { name: "loadedRows", type: "stringList" },
    { name: "localScheduleRows", type: "stringList" },
    { name: "spinnerHandle", type: "string" },
    { name: "rowHandle", type: "string" },
    { name: "confirmHandle", type: "string" },
  ],
  steps: STEPS,
  entryStepId: "read-current-route",
  capabilityRequirements: [requires("verdict.core.bridge.tap"), requires("verdict.core.bridge.watch-fact")],
  sourceMap: [
    sourceMapEntry("sm-route-0a", "read-current-route", NESY_SELECT_ROUTE_MACRO_KEY, "detect already-selected route before waiting for the dialog"),
    sourceMapEntry("sm-route-0b", "check-already-selected", NESY_SELECT_ROUTE_MACRO_KEY, "skip route selection when the requested route is already active"),
    sourceMapEntry("sm-route-1", "wait-dialog", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-2", "read-offered-routes", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-3", "check-offered", NESY_SELECT_ROUTE_MACRO_KEY, "guards against tapping a row that is not offered"),
    sourceMapEntry("sm-route-4", "report-not-offered", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-4a", "resolve-spinner", NESY_SELECT_ROUTE_MACRO_KEY, "the offered list lives in a spinner popup"),
    sourceMapEntry("sm-route-4b", "tap-spinner", NESY_SELECT_ROUTE_MACRO_KEY, "the list does not exist until the spinner opens"),
    sourceMapEntry("sm-route-4c", "scroll-to-row", NESY_SELECT_ROUTE_MACRO_KEY, "positions the list; establishes no identity"),
    sourceMapEntry("sm-route-5", "resolve-row", NESY_SELECT_ROUTE_MACRO_KEY, "identity is the label the dialog renders"),
    sourceMapEntry("sm-route-6", "tap-row", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-7", "resolve-confirm", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-8", "tap-confirm", NESY_SELECT_ROUTE_MACRO_KEY),
    sourceMapEntry("sm-route-8d", "wait-schedule-stored", NESY_SELECT_ROUTE_MACRO_KEY, "the confirm tap does not store; the store lands after a round trip"),
    sourceMapEntry("sm-route-8a", "read-selected-route", NESY_SELECT_ROUTE_MACRO_KEY, "app plane observed, not inferred"),
    sourceMapEntry("sm-route-8b", "read-available-stops", NESY_SELECT_ROUTE_MACRO_KEY, "stops loaded is a result-set property"),
    sourceMapEntry("sm-route-8c", "read-local-schedule", NESY_SELECT_ROUTE_MACRO_KEY, "Room truth: stored, and is it today's"),
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
      note: "Branches around an already-selected route; the not-offered path fails closed instead of producing a green terminal annotation.",
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
  // Kept in step with the ASSERT_FACT step's own policy, deliberately. These two
  // had drifted: the step already judged the schedule while this template still
  // demanded the back-office assignment and gated on stops. Two places describing
  // one decision is how a slice starts meaning different things depending on who
  // reads it — the same class of silent divergence that made `sql_named` run
  // unfiltered for months.
  oracleTemplate: {
    continueGate: {
      // Readiness only; stops are not this slice's business (see the step note).
      allOf: [NESY_FACTS.ROUTE_LIST_READY],
      deadlineMs: 25_000,
      unknownPolicy: "RETRY",
    },
    finalOracle: {
      requirements: [
        { factKey: NESY_FACTS.SELECTED_ROUTE_OBSERVED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.SCHEDULE_PERSISTED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.SCHEDULE_IS_TODAY, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        {
          factKey: NESY_FACTS.SCHEDULE_IN_USE_IS_TODAYS,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
        {
          factKey: NESY_FACTS.SCHEDULE_MATCHES_SELECTED_ROUTE,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
        { factKey: NESY_FACTS.ROUTES_AVAILABLE, obligation: "WARNING", timing: "IMMEDIATE", onTimeout: "WARNING" },
      ],
    },
    notResponsibleFor: [
      "the ordering or completeness of the stop list, which is empty at selection time by design",
      "the back-office assignment record, which has a different owner",
    ],
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
      caseKey: "STALE_SCHEDULE_SHOWN_AS_TODAYS",
      scenario:
        "Creating today's schedule fails, the app falls back to whatever Room already held — including yesterday's plan — and the screen looks entirely normal while the courier works it.",
      refusedBy:
        "LOCAL.SCHEDULE_IS_TODAY comes from the product's own ScheduleSessionValidator, and APP.SCHEDULE_IN_USE_IS_TODAYS requires the session's schedule id, the stored one and the today verdict to AGREE — which a stale fallback cannot do.",
    },
  ],
};
