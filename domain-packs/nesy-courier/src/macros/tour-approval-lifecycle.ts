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
 *      ↓ CORRELATED_ALL_OF on approvalRequestCode
 *    REMOTE.TOUR_APPROVAL_CONFIRMED
 *
 *  Correlation is what stops a leftover approval from yesterday's run — or from
 *  another courier — satisfying today's oracle.
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
import type { WorkflowStepV2 } from "@nesy/workflow-contract";
import { NESY_BACKOFFICE_ADAPTER_REF, NESY_BACKOFFICE_OPERATIONS } from "../adapters/backoffice.js";
import { NESY_ENTITIES } from "../registries/entities.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_ACTIONS, NESY_SCREENS, NESY_SURFACES } from "../registries/screens.js";
import { NESY_TARGETS } from "../registries/targets.js";
import type { NesyReferenceSlice } from "../slice.js";
import { NESY_DEFAULT_INTERRUPT_POLICY, NESY_UI_ONLY_RELEASE_ISOLATION } from "./common.js";
import { KEYED_MUTATION_RETRY, irDocument, requires, sourceMapEntry, stepBase } from "./ir-authoring.js";

export const NESY_TOUR_APPROVAL_MACRO_KEY = "nesy.macro.tour-approval-lifecycle";

const REQUEST_ENTITY = { type: NESY_ENTITIES.tourApprovalRequest, id: "run.input.approvalRequestCode" } as const;

const STEPS: readonly WorkflowStepV2[] = [
  // ── Actor 1: the courier, on the device ─────────────────────────────────
  {
    ...stepBase({ planStepId: "wait-day-close", sourceMapRef: "sm-appr-1", next: "resolve-request-button", timeoutMs: 25_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.END_OF_DAY_READY,
    sourceLane: "UI",
    requireCorrelation: false,
    onTimeout: "FAIL",
  },
  {
    ...stepBase({
      planStepId: "resolve-request-button",
      sourceMapRef: "sm-appr-2",
      next: "tap-request",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.tourApprovalRequestButton,
    outputVariable: "requestHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-request",
      sourceMapRef: "sm-appr-3",
      next: "verify-request-record",
      timeoutMs: 30_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "requestHandle",
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
      sourceMapRef: "sm-appr-4",
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
      sourceMapRef: "sm-appr-5",
      next: "verify-approved-status",
      timeoutMs: 40_000,
      retryPolicy: KEYED_MUTATION_RETRY,
      capabilityRequirements: [requires("nesy.backoffice.approval-operations")],
    }),
    kind: "REMOTE_ACTION",
    spec: {
      adapterRef: NESY_BACKOFFICE_ADAPTER_REF,
      operationRef: NESY_BACKOFFICE_OPERATIONS.approveTourRequest,
      role: "SETUP",
      effectClass: "IDEMPOTENT_MUTATION",
      idempotencyClass: "KEYED",
      idempotencyKey: "run.input.approvalRequestCode",
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
      sourceMapRef: "sm-appr-6",
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
    ...stepBase({ planStepId: "await-push", sourceMapRef: "sm-appr-7", next: "assert-approved", timeoutMs: 120_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
    sourceLane: "APP",
    requireCorrelation: true,
    onTimeout: "CONTINUE",
    entityBinding: REQUEST_ENTITY,
  },
  {
    ...stepBase({ planStepId: "assert-approved", sourceMapRef: "sm-appr-8", next: null, timeoutMs: 60_000 }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
    expected: true,
    unknownPolicy: "INCONCLUSIVE",
    entityBinding: REQUEST_ENTITY,
    finalOraclePolicy: {
      requirements: [
        {
          factKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 180_000,
          onTimeout: "INCONCLUSIVE",
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
          factKey: NESY_FACTS.TOUR_APPROVAL_REQUESTED,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
        {
          factKey: NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
          obligation: "WARNING",
          timing: "EVENTUAL",
          deadlineMs: 120_000,
          onTimeout: "WARNING",
        },
      ],
    },
  },
  {
    ...stepBase({ planStepId: "release-approval-fixture", sourceMapRef: "sm-appr-9", next: null, timeoutMs: 40_000 }),
    kind: "CLEANUP",
    compensatesStepIds: ["dispatcher-approves"],
    runOnFailure: true,
  },
];

const GENERIC_IR = irDocument({
  workflowId: "nesy.reference.tour-approval-lifecycle",
  name: "Tour approval requested on device, approved in the back office",
  sourceRef: NESY_TOUR_APPROVAL_MACRO_KEY,
  inputs: [
    { name: "routeCode", type: "string", required: true },
    { name: "approvalRequestCode", type: "string", required: true },
  ],
  variables: [{ name: "requestHandle", type: "string" }],
  steps: STEPS,
  entryStepId: "wait-day-close",
  capabilityRequirements: [
    requires("verdict.core.bridge.tap"),
    requires("verdict.core.remote.allowlisted-operation"),
    requires("nesy.backoffice.approval-operations"),
  ],
  sourceMap: [
    sourceMapEntry("sm-appr-1", "wait-day-close", NESY_TOUR_APPROVAL_MACRO_KEY),
    sourceMapEntry("sm-appr-2", "resolve-request-button", NESY_TOUR_APPROVAL_MACRO_KEY),
    sourceMapEntry("sm-appr-3", "tap-request", NESY_TOUR_APPROVAL_MACRO_KEY, "actor 1: the courier, real UI"),
    sourceMapEntry("sm-appr-4", "verify-request-record", NESY_TOUR_APPROVAL_MACRO_KEY, "back-office fact check 1"),
    sourceMapEntry("sm-appr-5", "dispatcher-approves", NESY_TOUR_APPROVAL_MACRO_KEY, "actor 2: dispatcher, typed and audited; produces no evidence"),
    sourceMapEntry("sm-appr-6", "verify-approved-status", NESY_TOUR_APPROVAL_MACRO_KEY, "back-office fact check 2"),
    sourceMapEntry("sm-appr-7", "await-push", NESY_TOUR_APPROVAL_MACRO_KEY, "confirmatory only"),
    sourceMapEntry("sm-appr-8", "assert-approved", NESY_TOUR_APPROVAL_MACRO_KEY),
    sourceMapEntry("sm-appr-9", "release-approval-fixture", NESY_TOUR_APPROVAL_MACRO_KEY),
  ],
});

const EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_TOUR_APPROVAL_MACRO_KEY,
  authoredBy: "HAND",
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
  authoredBy: "HAND",
  requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.bridge.resolve-target"],
  legs: [
    { planStepId: "wait-day-close", bridgeVerb: "watch", awaitFactKey: NESY_FACTS.END_OF_DAY_READY },
    {
      planStepId: "tap-request",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.tourApprovalRequestButton,
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
        description: "Correlation anchor for both back-office fact reads.",
      },
    ],
  },
  output: {
    fields: [
      { name: "requested", type: "boolean", factKey: NESY_FACTS.TOUR_APPROVAL_REQUESTED },
      { name: "recordCreated", type: "boolean", factKey: NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED },
      { name: "approved", type: "boolean", factKey: NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED },
      { name: "confirmed", type: "boolean", factKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED },
    ],
  },
  preconditions: [
    { kind: "SCREEN_READY", ref: NESY_SCREENS.endOfDay, deadlineMs: 25_000, onUnmet: "FAIL" },
    { kind: "FACT_TRUE", ref: NESY_FACTS.SELECTED_ROUTE_OBSERVED, deadlineMs: 20_000, onUnmet: "FAIL" },
    { kind: "FACT_FALSE", ref: NESY_FACTS.TOUR_APPROVAL_CONFIRMED, deadlineMs: 10_000, onUnmet: "FAIL" },
  ],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.endOfDay],
    surfaceRefs: [NESY_SURFACES.networkDialog, NESY_SURFACES.sessionExpiredDialog],
    entityTypeRefs: [NESY_ENTITIES.route, NESY_ENTITIES.tourApprovalRequest],
    targetRefs: [NESY_TARGETS.tourApprovalRequestButton],
    factKeys: [
      NESY_FACTS.END_OF_DAY_READY,
      NESY_FACTS.SELECTED_ROUTE_OBSERVED,
      NESY_FACTS.TOUR_APPROVAL_REQUESTED,
      NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED,
      NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED,
      NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
      NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
    ],
    queryRefs: ["nesy.routeState"],
    adapterOperationRefs: [
      NESY_BACKOFFICE_OPERATIONS.approveTourRequest,
      NESY_BACKOFFICE_OPERATIONS.readTourApprovalRequest,
      NESY_BACKOFFICE_OPERATIONS.readTourApprovalStatus,
    ],
  },
  oracleTemplate: {
    continueGate: {
      allOf: [NESY_FACTS.TOUR_APPROVAL_REQUESTED],
      deadlineMs: 30_000,
      unknownPolicy: "RETRY",
    },
    finalOracle: {
      requirements: [
        {
          factKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 180_000,
          onTimeout: "INCONCLUSIVE",
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
          factKey: NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
          obligation: "WARNING",
          timing: "EVENTUAL",
          deadlineMs: 120_000,
          onTimeout: "WARNING",
        },
      ],
    },
    notResponsibleFor: [
      "whether the dispatcher was authorised — only that an approval was recorded against this request",
    ],
  },
  interruptPolicy: NESY_DEFAULT_INTERRUPT_POLICY,
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.resolve-target",
    "verdict.core.bridge.watch-fact",
    "verdict.core.remote.allowlisted-operation",
    "nesy.backoffice.approval-operations",
    "nesy.adapter.event-stream",
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
  screenRefs: [NESY_SCREENS.endOfDay],
  surfaceRefs: [NESY_SURFACES.networkDialog, NESY_SURFACES.sessionExpiredDialog],
  entityBindings: [
    { entityTypeRef: NESY_ENTITIES.route, role: "Scopes the request to the tour that was worked." },
    {
      entityTypeRef: NESY_ENTITIES.tourApprovalRequest,
      role: "Correlation anchor across the device event and both back-office reads; this is what stops yesterday's approval from satisfying today's oracle.",
    },
  ],
  targetResolutionRefs: [NESY_TARGETS.tourApprovalRequestButton],
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
