/**
 * ===========================================================================
 *  TOUR_APPROVAL_LIFECYCLE slice  (Plan D.6C · RUN_PLAY 4B.18)
 *
 *  THE ONLY MULTI-ACTOR SLICE, AND WHY THAT MATTERS
 *
 *  The courier asks for tour approval in the mobile UI. A DIFFERENT person — a
 *  dispatcher or supervisor — approves it in the back office. A test that only
 *  drove the phone would prove the button works and nothing about the business
 *  process, because the process is precisely the handover.
 *
 *  So the slice acts as both actors, and each half is bounded:
 *
 *    Courier half   → real UI, on the device, through the Bridge.
 *    Dispatcher half→ typed REMOTE_ACTION into an allowlisted back-office
 *                     operation, `actorRole: DISPATCHER`, fully audited.
 *
 *  HTTP 2xx IS NOT AN APPROVAL
 *
 *  `nesy.backoffice.approve-tour-request` declares `transportSuccessOnly: true`
 *  and binds NO output fact. Accepting the call is not the record being approved:
 *  the request can be queued, rejected by a downstream rule, or applied to a
 *  different record entirely.
 *
 *  Business success therefore needs TWO separate back-office fact reads plus the
 *  app's own event, all correlated:
 *
 *    APP.TOUR_APPROVAL_REQUESTED           the courier really asked
 *    REMOTE.TOUR_APPROVAL_REQUEST_CREATED  a record really exists
 *    REMOTE.TOUR_APPROVAL_STATUS_APPROVED  that record really reached APPROVED
 *      ↓ CORRELATED_ALL_OF on scheduleId
 *    REMOTE.TOUR_APPROVAL_CONFIRMED
 *
 *  Correlation is what stops a leftover approval from yesterday's run — or from
 *  another courier — satisfying today's oracle. It correlates on the SCHEDULE:
 *  measured on RS staging 2026-08-12, the leaving-request list came back with 47
 *  rows, most of them other couriers' tours and several already approved.
 *
 *  WHAT THIS SLICE LOOKED LIKE BEFORE IT WAS MEASURED
 *
 *  Until 2026-08-12 it waited for END_OF_DAY_READY, tapped a target id that
 *  existed nowhere in the app, and read two back-office operations pointed at
 *  `MobileApprovalRequests` — a queue this flow never writes to. It also required
 *  an `approvalRequestCode` input that nothing in the product ever mints. Every
 *  one of those was plausible on paper. The flow was then run by hand, end to
 *  end, and none of them survived contact with the device.
 *
 *  TWO WAYS IN, AND ONLY ONE OF THEM HAS AN EVENT
 *
 *  Since 1.37.0 the slice does not re-request a tour that is already
 *  WaitingForApproval or Approved; it jumps straight to back-office
 *  verification. On that path the courier's request happened before this run, so
 *  `APP.TOUR_APPROVAL_REQUESTED` cannot arrive — the app emits `TOUR_STARTED`
 *  once, at the tap. Requiring it there produced run_02f4d73b: every step green,
 *  both back-office reads satisfied, verdict INCONCLUSIVE on an event that was
 *  never going to be emitted.
 *
 *  The device half of the join is then the stored schedule status, read by the
 *  same query that chooses the branch:
 *
 *    LOCAL.TOUR_APPROVAL_REQUEST_ALREADY_OPEN  a request is on record
 *    REMOTE.TOUR_APPROVAL_REQUEST_CREATED      the back office holds it
 *    REMOTE.TOUR_APPROVAL_STATUS_APPROVED      and it reached APPROVED
 *      ↓ CORRELATED_ALL_OF on scheduleId
 *    REMOTE.TOUR_APPROVAL_CONFIRMED_FOR_OPEN_REQUEST
 *
 *  A SEPARATE conclusion, not a relaxation of the first. It proves less — nobody
 *  watched the button being pressed — and the fact key says so, so a run that
 *  took the shortcut cannot report the verdict that means the courier journey
 *  was exercised. On the path that does press the button, the event stays
 *  REQUIRED with onTimeout FAIL.
 *
 *  THE PUSH IS CONFIRMATORY, NOT REQUIRED
 *
 *  `APP.TOUR_APPROVAL_PUSH_RECEIVED` is a WARNING requirement and the wait uses
 *  `onTimeout: CONTINUE`. Push delivery is legitimately unreliable; a required
 *  gate on it would produce red runs about Firebase, not about the product.
 *
 *  SETUP MODE IS A DIFFERENT TEST
 *
 *  Other slices sometimes need an already-approved tour as a precondition. That
 *  is `nesy.launch.direct-state` with `producesProductVerdict: false` — arranging
 *  an approval is not evidence that approving works. Only this slice, under
 *  `nesy.launch.cold-real-login`, may write the approval verdict.
 * ===========================================================================
 */

import type { BridgeFlowPlanSnapshot, MacroDefinition, MacroExpansionSnapshot } from "@nesy/domain-pack-contracts";
import type { FinalOraclePolicy, WorkflowStepV2 } from "@nesy/workflow-contract";
import { NESY_BACKOFFICE_ADAPTER_REF, NESY_BACKOFFICE_OPERATIONS } from "../adapters/backoffice.js";
import { NESY_ADAPTER_QUERY_REFS } from "../registries/application.js";
import { NESY_ENTITIES } from "../registries/entities.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_ACTIONS, NESY_SCREENS, NESY_SURFACES } from "../registries/screens.js";
import { NESY_TARGETS } from "../registries/targets.js";
import type { NesyReferenceSlice } from "../slice.js";
import { NESY_TOUR_ROUTING_INTERRUPT_POLICY, NESY_UI_ONLY_RELEASE_ISOLATION } from "./common.js";
import { KEYED_MUTATION_RETRY, irDocument, requires, sourceMapEntry, stepBase } from "./ir-authoring.js";

export const NESY_TOUR_APPROVAL_MACRO_KEY = "nesy.macro.tour-approval-lifecycle";

/**
 * Keyed by the schedule, because the product mints nothing else. See the entity
 * definition: the request response is a bare string and no approval code exists
 * on either side of the tap.
 */
const REQUEST_ENTITY = { type: NESY_ENTITIES.tourApprovalRequest, id: "run.input.scheduleId" } as const;

/**
 * The slice's final oracle, authored once and used by both the assert step and
 * the macro template.
 *
 * TWO PATHS, ONE VERDICT, DIFFERENT EVIDENCE
 *
 * `LOCAL.TOUR_APPROVAL_REQUEST_ALREADY_OPEN` is what decides which half applies,
 * and it is the same observation the branch at `check-request-already-open`
 * reads — so the requirement that gets enforced is always the one describing the
 * path the run actually took:
 *
 *   request NOT open at start  → the run drove the button, so the courier's own
 *                                event is REQUIRED and the join that includes it
 *                                (`TOUR_APPROVAL_CONFIRMED`) is the verdict.
 *   request ALREADY open       → the request predates this run and no event can
 *                                arrive; the device's stored schedule status
 *                                carries the device half, and the verdict is
 *                                `TOUR_APPROVAL_CONFIRMED_FOR_OPEN_REQUEST`.
 *
 * What this deliberately does NOT do is make the courier's event optional. On
 * the path where the run presses the button, a missing `TOUR_APPROVAL_REQUESTED`
 * is still a FAIL: relaxing it there would let a broken request button pass by
 * reading a status some earlier run left behind.
 *
 * If the device cannot answer whether a request is open, applicability is
 * UNKNOWN, both conclusions stay PENDING and the slice ends INCONCLUSIVE. That
 * is the intended outcome: neither path's evidence was established.
 */
const REQUEST_ALREADY_OPEN = NESY_FACTS.TOUR_APPROVAL_REQUEST_ALREADY_OPEN;

const APPROVAL_REQUIREMENTS = [
  {
    factKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
    obligation: "REQUIRED",
    timing: "EVENTUAL",
    deadlineMs: 180_000,
    onTimeout: "INCONCLUSIVE",
    applicabilityCondition: { noneOf: [REQUEST_ALREADY_OPEN] },
  },
  {
    factKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED_FOR_OPEN_REQUEST,
    obligation: "REQUIRED",
    timing: "EVENTUAL",
    deadlineMs: 180_000,
    onTimeout: "INCONCLUSIVE",
    applicabilityCondition: { anyOf: [REQUEST_ALREADY_OPEN] },
  },
  {
    factKey: NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED,
    obligation: "REQUIRED",
    timing: "EVENTUAL",
    deadlineMs: 60_000,
    onTimeout: "INCONCLUSIVE",
  },
  {
    factKey: NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED,
    obligation: "REQUIRED",
    timing: "EVENTUAL",
    deadlineMs: 120_000,
    onTimeout: "INCONCLUSIVE",
  },
  {
    // Only on the path that actually pressed the button. See the note above.
    factKey: NESY_FACTS.TOUR_APPROVAL_REQUESTED,
    obligation: "REQUIRED",
    timing: "IMMEDIATE",
    onTimeout: "FAIL",
    applicabilityCondition: { noneOf: [REQUEST_ALREADY_OPEN] },
  },
  {
    factKey: NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
    obligation: "WARNING",
    timing: "EVENTUAL",
    deadlineMs: 120_000,
    onTimeout: "WARNING",
  },
] as const satisfies FinalOraclePolicy["requirements"];

const STEPS: readonly WorkflowStepV2[] = [
  {
    ...stepBase({
      planStepId: "read-current-schedule",
      sourceMapRef: "sm-appr-0a",
      next: "check-request-already-open",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.dbSchedule,
    maxRows: 1,
    outputVariable: "approvalScheduleRows",
    /**
     * The read that decides the branch also has to SAY what it saw.
     *
     * Until 1.38.0 this query fed the condition below and published nothing, so
     * on the already-open path the slice skipped the mobile leg — correctly —
     * and then had no admissible statement that a request existed on the device
     * side at all. The oracle waited out `APP.TOUR_APPROVAL_REQUESTED`, an event
     * that cannot be re-emitted for a tour already requested, and run_02f4d73b
     * closed INCONCLUSIVE with both back-office reads satisfied.
     *
     * `COLUMN_NOT_IN ["0"]` is the honest shape of the question: BeginningOfDay
     * is the only status that means "not requested". Statuses 1–5 all mean the
     * request happened, and an approved or ended tour is not less requested than
     * a waiting one. Missing column stays UNKNOWN — a projection that never
     * carried the answer is not a proven negative.
     */
    outputFactBindings: [
      {
        factKey: NESY_FACTS.TOUR_APPROVAL_REQUEST_ALREADY_OPEN,
        from: { kind: "COLUMN_NOT_IN", column: "schedule_status", values: ["0"] },
        correlationColumn: "schedule_id",
      },
    ],
  },
  {
    ...stepBase({ planStepId: "check-request-already-open", sourceMapRef: "sm-appr-0b", next: null }),
    kind: "CONDITION",
    condition: {
      kind: "or",
      operands: [
        {
          kind: "comparison",
          operator: "in",
          left: { kind: "literal", value: "1" },
          right: { kind: "operand", source: "step.output", path: "read-current-schedule.schedule_status" },
        },
        {
          kind: "comparison",
          operator: "in",
          left: { kind: "literal", value: "2" },
          right: { kind: "operand", source: "step.output", path: "read-current-schedule.schedule_status" },
        },
      ],
    },
    onTrue: "verify-request-record",
    onFalse: "resolve-request-button",
    unknownPolicy: "BRANCH",
    onUnknown: "resolve-request-button",
  },
  // ── Actor 1: the courier, on the device ─────────────────────────────────
  //
  // On the STOP LIST, not at end-of-day. Measured 2026-08-12: the button is
  // `btn_out` in `fragment_stops.xml`, the tour is requested while the courier
  // still has work in front of them, and the end-of-day screen is a later and
  // unrelated part of the day. The macro used to wait for END_OF_DAY_READY here
  // and could therefore never have reached the button it was aiming at.
  {
    ...stepBase({
      planStepId: "resolve-request-button",
      sourceMapRef: "sm-appr-1",
      next: "tap-request",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.tourApprovalRequestButton,
    outputVariable: "requestHandle",
  },
  {
    /**
     * This tap reaches no backend. It opens the routing chooser — "Please select
     * your route optimization type!" — and nothing is requested until that
     * choice is made. So there is deliberately NO continue gate here: gating on
     * TOUR_APPROVAL_REQUESTED at this point would wait for an event that cannot
     * arrive yet, and the timeout would blame the product for the pack's
     * misreading of the flow.
     */
    ...stepBase({
      planStepId: "tap-request",
      sourceMapRef: "sm-appr-2",
      next: "resolve-routing-choice",
      timeoutMs: 30_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "requestHandle",
    entityBinding: REQUEST_ENTITY,
  },
  {
    ...stepBase({
      planStepId: "resolve-routing-choice",
      sourceMapRef: "sm-appr-3",
      next: "tap-routing-choice",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.tourRoutingAuto,
    outputVariable: "routingHandle",
  },
  {
    /**
     * Auto routing, and that is a CHOICE the slice makes rather than a detail it
     * hides: it sets `calculateRoute: true` on the request, so the backend
     * generates the route. Manual routing is a different journey with its own
     * evidence, and `tourRoutingManual` exists for whoever writes it.
     *
     * The request event belongs to this step, not the one before it.
     */
    ...stepBase({
      planStepId: "tap-routing-choice",
      sourceMapRef: "sm-appr-4",
      next: "verify-request-record",
      timeoutMs: 30_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "routingHandle",
    entityBinding: REQUEST_ENTITY,
    continueGate: {
      allOf: [NESY_FACTS.TOUR_APPROVAL_REQUESTED],
      deadlineMs: 30_000,
      unknownPolicy: "RETRY",
    },
  },
  // ── Back-office fact check 1: the record exists ─────────────────────────
  {
    ...stepBase({
      planStepId: "verify-request-record",
      sourceMapRef: "sm-appr-5",
      next: "dispatcher-approves",
      timeoutMs: 30_000,
      capabilityRequirements: [requires("verdict.core.remote.allowlisted-operation")],
    }),
    kind: "REMOTE_ACTION",
    spec: {
      adapterRef: NESY_BACKOFFICE_ADAPTER_REF,
      operationRef: NESY_BACKOFFICE_OPERATIONS.readTourApprovalRequest,
      role: "VALIDATION",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputBindings: [{ name: "approvalRequest", source: { kind: "entityRef" } }],
      outputFactBindings: [{ factKey: NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED, responsePath: "request.exists" }],
      timeoutPolicy: { timeoutMs: 20_000, maxAttempts: 3, backoffMs: 2_000 },
      entityBinding: REQUEST_ENTITY,
      reconciliationPolicy: "NONE",
      auditPolicy: { recordRequest: true, recordResponse: true, redactFields: ["request.requesterName"] },
      allowedEnvironments: ["qa", "staging"],
    },
  },
  // ── Actor 2: the dispatcher, in the back office ─────────────────────────
  {
    /**
     * The second actor's action.
     *
     * Core's `role` axis is about VERDICT RIGHTS, not about who acts: SETUP means
     * "may not produce business evidence". That is exactly the constraint wanted
     * here, because the acknowledgement of this call proves nothing. The actor's
     * identity lives in the Domain Pack instead (`actorRole: DISPATCHER` on the
     * adapter operation), where it belongs.
     *
     * KEYED idempotency with an explicit key: approving twice must not create two
     * approvals, and a lost response must be reconciled before the resource is
     * released rather than assumed to be a no-op.
     */
    ...stepBase({
      planStepId: "dispatcher-approves",
      sourceMapRef: "sm-appr-6",
      next: "verify-approved-status",
      timeoutMs: 40_000,
      retryPolicy: KEYED_MUTATION_RETRY,
      capabilityRequirements: [requires("domain.nesy.backoffice.approval-operations")],
    }),
    kind: "REMOTE_ACTION",
    spec: {
      adapterRef: NESY_BACKOFFICE_ADAPTER_REF,
      operationRef: NESY_BACKOFFICE_OPERATIONS.approveTourRequest,
      role: "SETUP",
      effectClass: "IDEMPOTENT_MUTATION",
      idempotencyClass: "KEYED",
      idempotencyKey: "run.input.scheduleId",
      inputBindings: [{ name: "approvalRequest", source: { kind: "entityRef" } }],
      // Empty on purpose: accepting the call is not the approval.
      outputFactBindings: [],
      timeoutPolicy: { timeoutMs: 30_000, maxAttempts: 2, backoffMs: 3_000 },
      entityBinding: REQUEST_ENTITY,
      reconciliationPolicy: "RECONCILE_BEFORE_RELEASE",
      auditPolicy: { recordRequest: true, recordResponse: true, redactFields: ["approverComment"] },
      allowedEnvironments: ["qa", "staging"],
    },
  },
  // ── Back-office fact check 2: the record reached APPROVED ───────────────
  {
    ...stepBase({
      planStepId: "verify-approved-status",
      sourceMapRef: "sm-appr-7",
      next: "await-push",
      timeoutMs: 40_000,
      capabilityRequirements: [requires("verdict.core.remote.allowlisted-operation")],
    }),
    kind: "REMOTE_ACTION",
    spec: {
      adapterRef: NESY_BACKOFFICE_ADAPTER_REF,
      operationRef: NESY_BACKOFFICE_OPERATIONS.readTourApprovalStatus,
      role: "VALIDATION",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputBindings: [{ name: "approvalRequest", source: { kind: "entityRef" } }],
      outputFactBindings: [
        { factKey: NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED, responsePath: "approval.statusIsApproved" },
      ],
      timeoutPolicy: { timeoutMs: 30_000, maxAttempts: 3, backoffMs: 3_000 },
      entityBinding: REQUEST_ENTITY,
      reconciliationPolicy: "NONE",
      auditPolicy: { recordRequest: true, recordResponse: true, redactFields: ["approval.approverName"] },
      allowedEnvironments: ["qa", "staging"],
    },
  },
  {
    // CONTINUE on timeout: push delivery is unreliable infrastructure, and a
    // required gate here would produce red runs about the notification service.
    ...stepBase({ planStepId: "await-push", sourceMapRef: "sm-appr-8", next: "assert-approved", timeoutMs: 120_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
    sourceLane: "APP",
    requireCorrelation: true,
    onTimeout: "CONTINUE",
    entityBinding: REQUEST_ENTITY,
  },
  {
    ...stepBase({ planStepId: "assert-approved", sourceMapRef: "sm-appr-9", next: null, timeoutMs: 60_000 }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
    expected: true,
    unknownPolicy: "INCONCLUSIVE",
    entityBinding: REQUEST_ENTITY,
    finalOraclePolicy: { requirements: APPROVAL_REQUIREMENTS },
  },
  {
    ...stepBase({ planStepId: "release-approval-fixture", sourceMapRef: "sm-appr-10", next: null, timeoutMs: 40_000 }),
    kind: "CLEANUP",
    compensatesStepIds: ["dispatcher-approves"],
    runOnFailure: true,
    spec: {
      adapterRef: NESY_BACKOFFICE_ADAPTER_REF,
      operationRef: NESY_BACKOFFICE_OPERATIONS.rejectTourRequest,
      role: "TEARDOWN",
      effectClass: "IDEMPOTENT_MUTATION",
      idempotencyClass: "KEYED",
      idempotencyKey: "run.input.scheduleId",
      inputBindings: [{ name: "approvalRequest", source: { kind: "entityRef" } }],
      outputFactBindings: [],
      timeoutPolicy: { timeoutMs: 30_000, maxAttempts: 2, backoffMs: 3_000 },
      entityBinding: REQUEST_ENTITY,
      reconciliationPolicy: "RECONCILE_BEFORE_RELEASE",
      auditPolicy: { recordRequest: true, recordResponse: true, redactFields: [] },
      allowedEnvironments: ["qa", "staging"],
    },
  },
];

const GENERIC_IR = irDocument({
  workflowId: "nesy.reference.tour-approval-lifecycle",
  name: "Tour approval requested on device, approved in the back office",
  sourceRef: NESY_TOUR_APPROVAL_MACRO_KEY,
  inputs: [
    { name: "routeCode", type: "string", required: true },
    // Was `approvalRequestCode`, which no run could ever supply. The schedule id
    // is known from route selection onwards and is what the device itself sends.
    { name: "scheduleId", type: "string", required: true },
  ],
  variables: [
    { name: "approvalScheduleRows", type: "stringList" },
    { name: "requestHandle", type: "string" },
    { name: "routingHandle", type: "string" },
  ],
  steps: STEPS,
  entryStepId: "read-current-schedule",
  capabilityRequirements: [
    requires("verdict.core.bridge.tap"),
    requires("verdict.core.remote.allowlisted-operation"),
    requires("domain.nesy.backoffice.approval-operations"),
  ],
  sourceMap: [
    sourceMapEntry("sm-appr-0a", "read-current-schedule", NESY_TOUR_APPROVAL_MACRO_KEY, "detect an already-open or already-approved tour request"),
    sourceMapEntry("sm-appr-0b", "check-request-already-open", NESY_TOUR_APPROVAL_MACRO_KEY, "skip mobile request UI when schedule status is already WaitingForApproval/Approved"),
    sourceMapEntry("sm-appr-1", "resolve-request-button", NESY_TOUR_APPROVAL_MACRO_KEY),
    sourceMapEntry("sm-appr-2", "tap-request", NESY_TOUR_APPROVAL_MACRO_KEY, "actor 1: the courier, real UI — opens the routing chooser, calls nothing"),
    sourceMapEntry("sm-appr-3", "resolve-routing-choice", NESY_TOUR_APPROVAL_MACRO_KEY),
    sourceMapEntry("sm-appr-4", "tap-routing-choice", NESY_TOUR_APPROVAL_MACRO_KEY, "the tap that actually requests the tour"),
    sourceMapEntry("sm-appr-5", "verify-request-record", NESY_TOUR_APPROVAL_MACRO_KEY, "back-office fact check 1"),
    sourceMapEntry("sm-appr-6", "dispatcher-approves", NESY_TOUR_APPROVAL_MACRO_KEY, "actor 2: dispatcher, typed and audited; produces no evidence"),
    sourceMapEntry("sm-appr-7", "verify-approved-status", NESY_TOUR_APPROVAL_MACRO_KEY, "back-office fact check 2"),
    sourceMapEntry("sm-appr-8", "await-push", NESY_TOUR_APPROVAL_MACRO_KEY, "confirmatory only"),
    sourceMapEntry("sm-appr-9", "assert-approved", NESY_TOUR_APPROVAL_MACRO_KEY),
    sourceMapEntry("sm-appr-10", "release-approval-fixture", NESY_TOUR_APPROVAL_MACRO_KEY),
  ],
});

const EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_TOUR_APPROVAL_MACRO_KEY,
  authoredBy: "COMPILER",
  genericIr: GENERIC_IR,
  irSourceMap: GENERIC_IR.sourceMap,
  domainSourceMap: [
    {
      ref: "ds-appr-1",
      macroRef: NESY_TOUR_APPROVAL_MACRO_KEY,
      planStepIds: STEPS.map((step) => step.planStepId),
      sliceRef: "TOUR_APPROVAL_LIFECYCLE",
      note: "Courier leg on the device, dispatcher leg through the back-office adapter, two independent fact reads, one correlated derivation.",
    },
  ],
};

const BRIDGE_PLAN: BridgeFlowPlanSnapshot = {
  macroRef: NESY_TOUR_APPROVAL_MACRO_KEY,
  authoredBy: "COMPILER",
  requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.bridge.resolve-target"],
  legs: [
    // No awaited fact on the first tap: it only opens the routing chooser.
    { planStepId: "tap-request", bridgeVerb: "tap", targetRef: NESY_TARGETS.tourApprovalRequestButton },
    {
      planStepId: "tap-routing-choice",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.tourRoutingAuto,
      awaitFactKey: NESY_FACTS.TOUR_APPROVAL_REQUESTED,
    },
    { planStepId: "await-push", bridgeVerb: "watch", awaitFactKey: NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED },
  ],
};

export const NESY_TOUR_APPROVAL_MACRO: MacroDefinition = {
  macroKey: NESY_TOUR_APPROVAL_MACRO_KEY,
  actionRef: NESY_ACTIONS.tourApprovalLifecycle,
  displayName: "Tour approval lifecycle",
  businessMeaning:
    "A courier requests approval for the completed tour on the device, a dispatcher approves it in the back office, and both the created record and its APPROVED status are confirmed for that specific request.",
  notResponsibleFor: [
    "rejection and rework flows",
    "dispatcher authorisation rules — the pack asserts an approval happened, not that this dispatcher was entitled to make it",
    "push notification delivery reliability (carried as a WARNING only)",
    "payroll or settlement consequences of an approved tour",
    "approving a tour as a PRECONDITION for another test — that is the setup-mode launch profile, which cannot produce this verdict",
  ],
  input: {
    fields: [
      { name: "route", type: "entityRef", required: true, entityTypeRef: NESY_ENTITIES.route },
      {
        name: "approvalRequest",
        type: "entityRef",
        required: true,
        entityTypeRef: NESY_ENTITIES.tourApprovalRequest,
        description:
          "Correlation anchor for both back-office fact reads. Resolves to the schedule id — the request carries no identifier of its own.",
      },
    ],
  },
  output: {
    fields: [
      { name: "requested", type: "boolean", factKey: NESY_FACTS.TOUR_APPROVAL_REQUESTED },
      { name: "recordCreated", type: "boolean", factKey: NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED },
      { name: "approved", type: "boolean", factKey: NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED },
      { name: "confirmed", type: "boolean", factKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED },
      {
        // The already-open path's conclusion. Reported separately so a reader can
        // tell which of the two journeys produced the verdict.
        name: "confirmedForOpenRequest",
        type: "boolean",
        factKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED_FOR_OPEN_REQUEST,
      },
      {
        name: "requestAlreadyOpen",
        type: "boolean",
        factKey: NESY_FACTS.TOUR_APPROVAL_REQUEST_ALREADY_OPEN,
      },
    ],
  },
  preconditions: [
    { kind: "SCREEN_READY", ref: NESY_SCREENS.routeStopList, deadlineMs: 25_000, onUnmet: "FAIL" },
    { kind: "FACT_TRUE", ref: NESY_FACTS.SELECTED_ROUTE_OBSERVED, deadlineMs: 20_000, onUnmet: "FAIL" },
    { kind: "FACT_FALSE", ref: NESY_FACTS.TOUR_APPROVAL_CONFIRMED, deadlineMs: 10_000, onUnmet: "FAIL" },
  ],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.routeStopList],
    // The routing chooser is listed alongside the two global dialogs, but it is a
    // different kind of entry: the others may interrupt this slice, while this one
    // is a step of it. Without it the slice would reference a surface through its
    // own targets that it never declared.
    surfaceRefs: [
      NESY_SURFACES.tourRoutingDialog,
      NESY_SURFACES.networkDialog,
      NESY_SURFACES.sessionExpiredDialog,
      NESY_SURFACES.notificationListDialog,
    ],
    entityTypeRefs: [NESY_ENTITIES.route, NESY_ENTITIES.tourApprovalRequest],
    targetRefs: [
      NESY_TARGETS.tourApprovalRequestButton,
      NESY_TARGETS.tourRoutingAuto,
      NESY_TARGETS.tourRoutingManual,
      NESY_TARGETS.notificationListExit,
    ],
    factKeys: [
      NESY_FACTS.SELECTED_ROUTE_OBSERVED,
      NESY_FACTS.TOUR_APPROVAL_REQUESTED,
      NESY_FACTS.TOUR_APPROVAL_REQUEST_ALREADY_OPEN,
      NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED,
      NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED,
      NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
      NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
      NESY_FACTS.TOUR_APPROVAL_CONFIRMED_FOR_OPEN_REQUEST,
    ],
    queryRefs: ["nesy.routeState"],
    adapterOperationRefs: [
      NESY_BACKOFFICE_OPERATIONS.approveTourRequest,
      NESY_BACKOFFICE_OPERATIONS.readTourApprovalRequest,
      NESY_BACKOFFICE_OPERATIONS.readTourApprovalStatus,
      NESY_BACKOFFICE_OPERATIONS.rejectTourRequest,
    ],
  },
  oracleTemplate: {
    continueGate: {
      allOf: [NESY_FACTS.TOUR_APPROVAL_REQUESTED],
      deadlineMs: 30_000,
      unknownPolicy: "RETRY",
    },
    // The macro template and the step carry ONE list, not two copies of it. They
    // had drifted — the template omitted the courier-request requirement the step
    // enforced — and a reader consulting the template would have concluded the
    // slice could pass without any device-side evidence at all.
    finalOracle: { requirements: APPROVAL_REQUIREMENTS },
    notResponsibleFor: [
      "whether the dispatcher was authorised — only that an approval was recorded against this request",
    ],
  },
  // Not the shared default: this slice is the one that opens the routing chooser,
  // so it is the one that has to account for it. See the policy's own comment.
  interruptPolicy: NESY_TOUR_ROUTING_INTERRUPT_POLICY,
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.resolve-target",
    "verdict.core.bridge.watch-fact",
    "verdict.core.remote.allowlisted-operation",
    "domain.nesy.backoffice.approval-operations",
    "domain.nesy.adapter.event-stream",
  ],
  expansionSnapshot: EXPANSION,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
};

export const TOUR_APPROVAL_LIFECYCLE_SLICE: NesyReferenceSlice = {
  sliceKey: "TOUR_APPROVAL_LIFECYCLE",
  displayName: "Tour approval lifecycle",
  businessMeaning: NESY_TOUR_APPROVAL_MACRO.businessMeaning,
  notResponsibleFor: NESY_TOUR_APPROVAL_MACRO.notResponsibleFor,
  inputSchema: NESY_TOUR_APPROVAL_MACRO.input,
  outputSchema: NESY_TOUR_APPROVAL_MACRO.output,
  preconditions: NESY_TOUR_APPROVAL_MACRO.preconditions,
  screenRefs: [NESY_SCREENS.routeStopList],
  surfaceRefs: [
    NESY_SURFACES.tourRoutingDialog,
    NESY_SURFACES.networkDialog,
    NESY_SURFACES.sessionExpiredDialog,
    NESY_SURFACES.notificationListDialog,
  ],
  entityBindings: [
    { entityTypeRef: NESY_ENTITIES.route, role: "Scopes the request to the tour that was worked." },
    {
      entityTypeRef: NESY_ENTITIES.tourApprovalRequest,
      role: "Correlation anchor across the device event and both back-office reads, resolved to the schedule id; this is what stops another courier's approval from satisfying this run's oracle.",
    },
  ],
  targetResolutionRefs: [
    NESY_TARGETS.tourApprovalRequestButton,
    NESY_TARGETS.tourRoutingAuto,
    NESY_TARGETS.tourRoutingManual,
    NESY_TARGETS.notificationListExit,
  ],
  semanticMacroRef: NESY_TOUR_APPROVAL_MACRO_KEY,
  macroExpansion: EXPANSION,
  genericIrSnapshot: GENERIC_IR,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
  oracle: NESY_TOUR_APPROVAL_MACRO.oracleTemplate,
  interruptPolicy: NESY_TOUR_APPROVAL_MACRO.interruptPolicy,
  requiredCapabilityRefs: NESY_TOUR_APPROVAL_MACRO.requiredCapabilityRefs,
  releaseIsolation: NESY_UI_ONLY_RELEASE_ISOLATION,
  negativeCases: [
    {
      caseKey: "TRANSPORT_ACK_AS_APPROVAL",
      scenario:
        "The approve call returns 200 and the run reports the tour approved. A downstream rule rejected it and the record is still PENDING.",
      refusedBy:
        "The approve operation declares transportSuccessOnly:true and binds no output fact; validateRemoteAdapterOperation raises TRANSPORT_SUCCESS_AS_VALIDATION if it is used as VALIDATION. Two separate READ_ONLY fact operations carry the evidence.",
    },
    {
      caseKey: "STALE_APPROVAL_SATISFIES_ORACLE",
      scenario:
        "An approval left over from an earlier run (or another courier's tour) is read as this run's approval, and the slice passes without anything having been approved today.",
      refusedBy:
        "REMOTE.TOUR_APPROVAL_CONFIRMED is CORRELATED_ALL_OF with requiresCorrelation:true on approvalRequestCode, and each back-office output declares both entityStatusPath and correlationPath.",
    },
    {
      caseKey: "SETUP_MODE_CLAIMS_APPROVAL_VERDICT",
      scenario:
        "Another slice needs an approved tour, arranges one via direct state, and the run reports that tour approval works.",
      refusedBy:
        "nesy.launch.direct-state declares producesProductVerdict:false; validateLaunchProfile raises SETUP_LAUNCH_PRODUCES_VERDICT if a DIRECT_STATE/PREPARED_SESSION profile claims otherwise.",
    },
    {
      caseKey: "RAW_HTTP_SETUP_HOOK",
      scenario:
        "The dispatcher half is implemented as an inline HTTP call or a shell script in the workflow row, bypassing the allowlist and the audit log.",
      refusedBy:
        "ExternalActionSpec has no url/method/header/body/script field and validateWorkflowIrV2 rejects those names outright; FORBIDDEN_REMOTE_OPERATION_FIELDS does the same for adapter operations, and findRuntimeCodeViolations rejects code-shaped bundle content.",
    },
    {
      caseKey: "PUSH_REQUIRED_AS_GATE",
      scenario:
        "APP.TOUR_APPROVAL_PUSH_RECEIVED is made a REQUIRED requirement, and the suite starts going red about notification infrastructure instead of the product.",
      refusedBy:
        "The push source holds CONFIRMATORY authority, the requirement is WARNING, and the wait uses onTimeout CONTINUE.",
    },
    {
      caseKey: "DOUBLE_APPROVAL_ON_RETRY",
      scenario:
        "The approve call's response is lost, the step retries, and two approvals are recorded against one tour.",
      refusedBy:
        "The operation is KEYED with an explicit idempotencyKey and reconciliationPolicy RECONCILE_BEFORE_RELEASE; validateExternalAction raises UNSAFE_RETRY for a non-idempotent retry and MISSING_IDEMPOTENCY_KEY for a keyed operation with no key.",
    },
  ],
};
