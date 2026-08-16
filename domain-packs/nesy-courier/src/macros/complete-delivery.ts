/**
 * ===========================================================================
 *  COMPLETE_DELIVERY slice  (Plan D.6C · RUN_PLAY 4B.18)
 *
 *  A courier completes a delivery. The interesting part is that couriers work
 *  where there is no signal.
 *
 *  THE OFFLINE PATH IS NOT AN EXCEPTION
 *
 *  A delivery completed underground goes into a local queue and reaches the
 *  backend minutes later. Two wrong ways to model that:
 *
 *    - Treat the queue as its own evidence plane. Then every new local mechanism
 *      needs a Core change, and the plane axis stops meaning "who observed this".
 *      Here the queue is `LOCAL` plane, `OFFLINE_QUEUE_WATCH` source kind.
 *
 *    - Fail the run because the backend has not confirmed yet. That makes the
 *      suite unusable in exactly the conditions couriers work in. Here
 *      `REMOTE.DELIVERY_CONFIRMED` is an EVENTUAL requirement with a deadline and
 *      `onTimeout: INCONCLUSIVE` — an unconfirmed delivery is unresolved, which is
 *      true, rather than failed, which is not.
 *
 *  AND HTTP 2xx IS STILL NOT A DELIVERY
 *
 *  The delivery POST's acknowledgement is registered
 *  (`nesy.remote.delivery-transport-ack`) with `transportSuccessOnly: true`,
 *  FALLBACK authority and NO bound fact. What counts is
 *  `REMOTE.DELIVERY_CONFIRMED`: a correlated derivation over the backend status
 *  and the app's own submission event.
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

export const NESY_COMPLETE_DELIVERY_MACRO_KEY = "nesy.macro.complete-delivery";

const STEPS: readonly WorkflowStepV2[] = [
  {
    ...stepBase({ planStepId: "wait-flow", sourceMapRef: "sm-done-1", next: "resolve-scan-entry", timeoutMs: 20_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.DELIVERY_FLOW_READY,
    sourceLane: "UI",
    requireCorrelation: false,
    onTimeout: "FAIL",
  },
  /**
   * ===================================================================
   *  THE SCAN IS A PRECONDITION, NOT A FORMALITY
   *
   *  `initiateDeliveryProcess` starts with `shipmentModelList.any { isScanned }`
   *  and, when that is false, shows a toast and RETURNS — no event, no dialog,
   *  no backend call. Measured 2026-08-13: the delivery screen opens with
   *  `tv_deliver_item_size = "0"`, and scanning the same barcode on the screen
   *  takes it to `"1"`.
   *
   *  A plan that tapped Complete without this would watch a run do nothing at
   *  all and then time out its gate — the most expensive way to learn that a
   *  precondition was missing.
   * ===================================================================
   */
  {
    ...stepBase({
      planStepId: "resolve-scan-entry",
      sourceMapRef: "sm-done-2a",
      next: "tap-scan-entry",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.deliveryManualBarcodeEntry,
    outputVariable: "scanEntryHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-scan-entry",
      sourceMapRef: "sm-done-2b",
      next: "resolve-scan-field",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "scanEntryHandle",
  },
  {
    ...stepBase({
      planStepId: "resolve-scan-field",
      sourceMapRef: "sm-done-2c",
      next: "type-barcode",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.deliveryBarcodeInputField,
    outputVariable: "scanFieldHandle",
  },
  {
    ...stepBase({
      planStepId: "type-barcode",
      sourceMapRef: "sm-done-2d",
      next: "resolve-scan-confirm",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "setText",
    targetVariable: "scanFieldHandle",
    args: { text: "run.input.consignmentNumber" },
  },
  {
    ...stepBase({
      planStepId: "resolve-scan-confirm",
      sourceMapRef: "sm-done-2e",
      next: "tap-scan-confirm",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.deliveryBarcodeInputConfirm,
    outputVariable: "scanConfirmHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-scan-confirm",
      sourceMapRef: "sm-done-2f",
      next: "resolve-complete",
      timeoutMs: 20_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "scanConfirmHandle",
    entityBinding: { type: NESY_ENTITIES.shipment, id: "run.input.consignmentNumber" },
    // The gate is the product's own gate. `DELIVERY_PARCEL_SCANNED` carries a
    // boolean, so a scan that matched nothing arrives as a measured `false`
    // rather than as silence — and this step fails instead of letting the run
    // walk into a Complete that can only toast.
    continueGate: {
      allOf: [NESY_FACTS.DELIVERY_PARCEL_SCANNED],
      deadlineMs: 20_000,
      unknownPolicy: "RETRY",
    },
  },
  {
    ...stepBase({
      planStepId: "resolve-complete",
      sourceMapRef: "sm-done-2",
      next: "reveal-complete",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.deliveryCompleteButton,
    outputVariable: "completeHandle",
  },
  {
    /**
     * `btn_deliver` starts below the fold — measured 2026-08-13: `find_id`
     * matches at `top=2517` on a 2340-tall screen while `visible=false`, and
     * `tap_id` answers `not_visible`.
     *
     * Three ways out, and only one is honest. A coordinate swipe is not
     * identity: it is a pixel band that survives until a font scale or a COD
     * row moves it. Clicking the invisible node would let this run go green on
     * a control the courier can never reach. This step asks the PLATFORM to
     * bring the node on screen (`ACTION_SHOW_ON_SCREEN`), which makes the app's
     * own `delivery_scroll` do the scrolling — the same thing the product does
     * to the same button when the signature pad opens.
     *
     * POSITIONS, DOES NOT ADDRESS. The tap below still establishes identity and
     * still refuses an invisible node.
     */
    ...stepBase({
      planStepId: "reveal-complete",
      sourceMapRef: "sm-done-2g",
      next: "tap-complete",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "reveal",
    targetVariable: "completeHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-complete",
      sourceMapRef: "sm-done-3",
      next: "resolve-delivery-type",
      timeoutMs: 25_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "completeHandle",
    entityBinding: { type: NESY_ENTITIES.shipment, id: "run.input.consignmentNumber" },
    // NOT `DELIVERY_SUBMITTED` — measured, this tap only opens the type
    // chooser. Gating on submission here would wait 25s for something two taps
    // away and report the wrong step as the failure.
    continueGate: {
      allOf: [NESY_FACTS.DELIVERY_TYPE_DIALOG_SHOWN],
      deadlineMs: 25_000,
      unknownPolicy: "RETRY",
    },
  },
  {
    ...stepBase({
      planStepId: "resolve-delivery-type",
      sourceMapRef: "sm-done-3a",
      next: "tap-delivery-type",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.deliveryTypeDely,
    outputVariable: "deliveryTypeHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-delivery-type",
      sourceMapRef: "sm-done-3b",
      next: "resolve-delivery-confirm",
      timeoutMs: 25_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "deliveryTypeHandle",
    entityBinding: { type: NESY_ENTITIES.shipment, id: "run.input.consignmentNumber" },
    continueGate: {
      allOf: [NESY_FACTS.DELIVERY_CONFIRM_DIALOG_SHOWN],
      deadlineMs: 25_000,
      unknownPolicy: "RETRY",
    },
  },
  {
    ...stepBase({
      planStepId: "resolve-delivery-confirm",
      sourceMapRef: "sm-done-3c",
      next: "tap-delivery-confirm",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.deliveryConfirmAccept,
    outputVariable: "deliveryConfirmHandle",
  },
  {
    /**
     * The tap that actually delivers. Its gate is `DELIVERY_SUBMITTED`, whose
     * wire carries `delivery_submitted` as a boolean — so a backend refusal
     * arrives as a measured `false` and reads as FAIL_PRODUCT, instead of
     * looking like a delivery because it shares the wire name with success.
     */
    ...stepBase({
      planStepId: "tap-delivery-confirm",
      sourceMapRef: "sm-done-3d",
      next: "read-pending-queue",
      timeoutMs: 30_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "deliveryConfirmHandle",
    entityBinding: { type: NESY_ENTITIES.shipment, id: "run.input.consignmentNumber" },
    continueGate: {
      allOf: [NESY_FACTS.DELIVERY_SUBMITTED],
      deadlineMs: 30_000,
      unknownPolicy: "RETRY",
    },
  },
  {
    /**
     * MEASURED 2026-08-13: the SWITCH below read `local.result` at
     * `pendingOperation.count` and NOTHING in this macro ever produced it, so
     * the branch could only resolve to unknown — `FAILED` under its own
     * `unknownPolicy`. It went unnoticed because no run had ever reached this
     * far; every earlier attempt died at the Complete tap.
     *
     * The projection's column is `pending_count` (one row, `maxRows: 1`), which
     * is also not what the old path spelled. Reading the queue is what makes
     * the offline branch a measurement rather than a declaration.
     */
    ...stepBase({
      planStepId: "read-pending-queue",
      sourceMapRef: "sm-done-3e",
      next: "branch-on-queue",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.pendingOperation,
    maxRows: 1,
    outputVariable: "queueRows",
    /**
     * G90.10 BD.6 — LOCAL durable queue is a measurement, not a declaration.
     * process-parcel / tap-input-confirm was HOST_NOT_CAPABLE. This read is
     * what can publish LOCAL.OFFLINE_QUEUE_ITEM_WAITING after
     * tap-delivery-confirm. OPTIONAL on the oracle: online uninjected stays
     * PASS_ONLINE. Classifier is unchanged.
     */
    outputFactBindings: [
      {
        factKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
        from: { kind: "COLUMN_NOT_IN", column: "pending_count", values: ["0"] },
      },
    ],
  },
  {
    // The offline path, modelled rather than hoped away. `default: GOTO` means the
    // online case is explicit too — an unmatched switch with no default is a
    // silently skipped step, which reads as success in every report.
    ...stepBase({ planStepId: "branch-on-queue", sourceMapRef: "sm-done-4", next: null }),
    kind: "SWITCH",
    branches: [
      {
        branchId: "queued-offline",
        /**
         * NOT `greaterThan`. The evaluator defines ordering for NUMBERS ONLY
         * and answers UNKNOWN otherwise — deliberately, to keep `>` away from
         * locale-dependent string comparison. The projection emits
         * `pending_count` as the STRING "0" (measured), and a path over a row
         * set yields the collected column, so the old numeric form could not
         * resolve on any device, in any state.
         *
         * `notIn` needs only scalar equality, which is defined here: "0" is
         * absent from the collected counts exactly when something is queued.
         */
        condition: {
          kind: "comparison",
          operator: "notIn",
          left: { kind: "literal", value: "0" },
          right: { kind: "operand", source: "step.output", path: "queueRows.pending_count" },
        },
        next: "await-queue-drain",
      },
    ],
    default: { policy: "GOTO", next: "verify-backend-status" },
    unknownPolicy: "FAIL",
  },
  {
    ...stepBase({ planStepId: "await-queue-drain", sourceMapRef: "sm-done-5", next: "verify-backend-status", timeoutMs: 120_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.OFFLINE_QUEUE_DRAINED,
    sourceLane: "LOCAL",
    requireCorrelation: true,
    // Not FAIL: a queue that has not drained yet is unresolved, not broken.
    onTimeout: "INCONCLUSIVE",
    entityBinding: { type: NESY_ENTITIES.pendingOperation, id: "run.input.consignmentNumber" },
  },
  {
    ...stepBase({
      planStepId: "verify-backend-status",
      sourceMapRef: "sm-done-6",
      next: "assert-confirmed",
      timeoutMs: 30_000,
      capabilityRequirements: [requires("verdict.core.remote.allowlisted-operation")],
    }),
    kind: "REMOTE_ACTION",
    spec: {
      adapterRef: NESY_BACKOFFICE_ADAPTER_REF,
      operationRef: NESY_BACKOFFICE_OPERATIONS.readDeliveryStatus,
      role: "VALIDATION",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputBindings: [{ name: "shipment", source: { kind: "entityRef" } }],
      outputFactBindings: [{ factKey: NESY_FACTS.DELIVERY_STATUS_COMPLETED, responsePath: "delivery.completed" }],
      timeoutPolicy: { timeoutMs: 20_000, maxAttempts: 3, backoffMs: 2_000 },
      entityBinding: { type: NESY_ENTITIES.shipment, id: "run.input.proofLookupId" },
      reconciliationPolicy: "NONE",
      auditPolicy: { recordRequest: true, recordResponse: true, redactFields: ["delivery.recipientName"] },
      allowedEnvironments: ["qa", "staging"],
    },
  },
  {
    ...stepBase({ planStepId: "assert-confirmed", sourceMapRef: "sm-done-7", next: null, timeoutMs: 30_000 }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.DELIVERY_CONFIRMED,
    expected: true,
    unknownPolicy: "INCONCLUSIVE",
    entityBinding: { type: NESY_ENTITIES.shipment, id: "run.input.consignmentNumber" },
    finalOraclePolicy: {
      requirements: [
        {
          factKey: NESY_FACTS.DELIVERY_CONFIRMED,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 120_000,
          onTimeout: "INCONCLUSIVE",
        },
        {
          factKey: NESY_FACTS.DELIVERY_STATUS_COMPLETED,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 120_000,
          onTimeout: "INCONCLUSIVE",
        },
        { factKey: NESY_FACTS.DELIVERY_SUBMITTED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        // Not a failure: a queued item explains a delayed confirmation.
        {
          factKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
          obligation: "OPTIONAL",
          timing: "IMMEDIATE",
          onTimeout: "WARNING",
        },
      ],
    },
  },
];

const GENERIC_IR = irDocument({
  workflowId: "nesy.reference.complete-delivery",
  name: "Complete a delivery, online or queued",
  sourceRef: NESY_COMPLETE_DELIVERY_MACRO_KEY,
  inputs: [
    { name: "consignmentNumber", type: "string", required: true },
    { name: "proofLookupId", type: "string", required: true },
  ],
  variables: [
    { name: "scanEntryHandle", type: "string" },
    { name: "scanFieldHandle", type: "string" },
    { name: "scanConfirmHandle", type: "string" },
    { name: "completeHandle", type: "string" },
    { name: "deliveryTypeHandle", type: "string" },
    { name: "deliveryConfirmHandle", type: "string" },
    { name: "queueRows", type: "string" },
  ],
  steps: STEPS,
  entryStepId: "wait-flow",
  capabilityRequirements: [requires("verdict.core.bridge.tap"), requires("verdict.core.remote.allowlisted-operation")],
  sourceMap: [
    sourceMapEntry("sm-done-1", "wait-flow", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-2a", "resolve-scan-entry", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-2b", "tap-scan-entry", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-2c", "resolve-scan-field", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-2d", "type-barcode", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-2e", "resolve-scan-confirm", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry(
      "sm-done-2f",
      "tap-scan-confirm",
      NESY_COMPLETE_DELIVERY_MACRO_KEY,
      "the product's own gate: without a scanned shipment Complete only toasts",
    ),
    sourceMapEntry("sm-done-2", "resolve-complete", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry(
      "sm-done-2g",
      "reveal-complete",
      NESY_COMPLETE_DELIVERY_MACRO_KEY,
      "positions the button the app itself scrolls to; identity stays with the tap",
    ),
    sourceMapEntry("sm-done-3", "tap-complete", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-3a", "resolve-delivery-type", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-3b", "tap-delivery-type", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-3c", "resolve-delivery-confirm", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry(
      "sm-done-3d",
      "tap-delivery-confirm",
      NESY_COMPLETE_DELIVERY_MACRO_KEY,
      "the tap that actually delivers — three taps after Complete, not one",
    ),
    sourceMapEntry(
      "sm-done-3e",
      "read-pending-queue",
      NESY_COMPLETE_DELIVERY_MACRO_KEY,
      "the offline branch needs a reading, not a declaration",
    ),
    sourceMapEntry("sm-done-4", "branch-on-queue", NESY_COMPLETE_DELIVERY_MACRO_KEY, "offline queue is a LOCAL evidence kind, not a plane"),
    sourceMapEntry("sm-done-5", "await-queue-drain", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-6", "verify-backend-status", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-7", "assert-confirmed", NESY_COMPLETE_DELIVERY_MACRO_KEY),
  ],
});

const EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_COMPLETE_DELIVERY_MACRO_KEY,
  authoredBy: "COMPILER",
  genericIr: GENERIC_IR,
  irSourceMap: GENERIC_IR.sourceMap,
  domainSourceMap: [
    {
      ref: "ds-done-1",
      macroRef: NESY_COMPLETE_DELIVERY_MACRO_KEY,
      planStepIds: STEPS.map((step) => step.planStepId),
      sliceRef: "COMPLETE_DELIVERY",
      note: "One SWITCH separating the queued path from the online path; both converge on the backend verification.",
    },
  ],
};

const BRIDGE_PLAN: BridgeFlowPlanSnapshot = {
  macroRef: NESY_COMPLETE_DELIVERY_MACRO_KEY,
  authoredBy: "COMPILER",
  requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.bridge.resolve-target"],
  legs: [
    { planStepId: "wait-flow", bridgeVerb: "watch", awaitFactKey: NESY_FACTS.DELIVERY_FLOW_READY },
    {
      planStepId: "tap-scan-confirm",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.deliveryBarcodeInputConfirm,
      awaitFactKey: NESY_FACTS.DELIVERY_PARCEL_SCANNED,
    },
    {
      planStepId: "tap-complete",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.deliveryCompleteButton,
      awaitFactKey: NESY_FACTS.DELIVERY_TYPE_DIALOG_SHOWN,
    },
    {
      planStepId: "tap-delivery-type",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.deliveryTypeDely,
      awaitFactKey: NESY_FACTS.DELIVERY_CONFIRM_DIALOG_SHOWN,
    },
    {
      planStepId: "tap-delivery-confirm",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.deliveryConfirmAccept,
      awaitFactKey: NESY_FACTS.DELIVERY_SUBMITTED,
    },
  ],
};

export const NESY_COMPLETE_DELIVERY_MACRO: MacroDefinition = {
  macroKey: NESY_COMPLETE_DELIVERY_MACRO_KEY,
  actionRef: NESY_ACTIONS.completeDelivery,
  displayName: "Complete delivery",
  businessMeaning:
    "A courier completes the delivery for a shipment, and the backend eventually records it as completed — whether the device was online at the time or queued the operation.",
  notResponsibleFor: [
    "payment collection and fiscal receipt printing — this slice is the unpaid DELY path; RS cash+EXW is a later slice",
    "production RS printer hardware (tstrs has isPrinterConnectionRequired=false; productionrs does not)",
    "the SI tax-number identity check (unconditional return outside the RS branch)",
    "createFiscalInvoice ignoring its shipmentId (outside this unpaid path)",
    "recipient signature quality — the pad is visible on RS but isDeliveryCodeOrSignatureNotRequired is true",
    "failure/cancel reason codes (separate slices)",
    "how long the backend takes to confirm — only that it confirms within the declared deadline",
  ],
  input: {
    fields: [{ name: "shipment", type: "entityRef", required: true, entityTypeRef: NESY_ENTITIES.shipment }],
  },
  output: {
    fields: [
      { name: "submitted", type: "boolean", factKey: NESY_FACTS.DELIVERY_SUBMITTED },
      { name: "confirmed", type: "boolean", factKey: NESY_FACTS.DELIVERY_CONFIRMED },
    ],
  },
  preconditions: [
    { kind: "FACT_TRUE", ref: NESY_FACTS.ACTIVE_STOP_MATCHES, deadlineMs: 20_000, onUnmet: "FAIL" },
    { kind: "FACT_TRUE", ref: NESY_FACTS.PARCEL_STATE_PROCESSED, deadlineMs: 20_000, onUnmet: "FAIL" },
    { kind: "SCREEN_READY", ref: NESY_SCREENS.deliveryFlow, deadlineMs: 20_000, onUnmet: "FAIL" },
  ],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.deliveryFlow],
    surfaceRefs: [NESY_SURFACES.paymentSurface, NESY_SURFACES.fiscalSurface, NESY_SURFACES.networkDialog],
    entityTypeRefs: [NESY_ENTITIES.shipment, NESY_ENTITIES.pendingOperation],
    targetRefs: [
      NESY_TARGETS.deliveryManualBarcodeEntry,
      NESY_TARGETS.deliveryBarcodeInputField,
      NESY_TARGETS.deliveryBarcodeInputConfirm,
      NESY_TARGETS.deliveryCompleteButton,
      NESY_TARGETS.deliveryTypeDely,
      NESY_TARGETS.deliveryConfirmAccept,
    ],
    factKeys: [
      NESY_FACTS.DELIVERY_FLOW_READY,
      NESY_FACTS.DELIVERY_PARCEL_SCANNED,
      NESY_FACTS.DELIVERY_TYPE_DIALOG_SHOWN,
      NESY_FACTS.DELIVERY_CONFIRM_DIALOG_SHOWN,
      NESY_FACTS.DELIVERY_SUBMITTED,
      NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
      NESY_FACTS.OFFLINE_QUEUE_DRAINED,
      NESY_FACTS.DELIVERY_STATUS_COMPLETED,
      NESY_FACTS.DELIVERY_CONFIRMED,
      NESY_FACTS.ACTIVE_STOP_MATCHES,
      NESY_FACTS.PARCEL_STATE_PROCESSED,
    ],
    queryRefs: ["nesy.pendingOperation"],
    adapterOperationRefs: [NESY_BACKOFFICE_OPERATIONS.readDeliveryStatus],
  },
  oracleTemplate: {
    continueGate: {
      allOf: [NESY_FACTS.DELIVERY_SUBMITTED],
      deadlineMs: 25_000,
      unknownPolicy: "RETRY",
    },
    finalOracle: {
      requirements: [
        {
          factKey: NESY_FACTS.DELIVERY_CONFIRMED,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 120_000,
          onTimeout: "INCONCLUSIVE",
        },
        { factKey: NESY_FACTS.DELIVERY_SUBMITTED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        {
          factKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
          obligation: "OPTIONAL",
          timing: "IMMEDIATE",
          onTimeout: "WARNING",
        },
      ],
    },
    notResponsibleFor: [
      "payment and fiscal surfaces on the unpaid DELY path, which the product skips rather than this macro ignoring",
      "production RS printer hardware, which tstrs does not exercise",
    ],
  },
  interruptPolicy: NESY_DEFAULT_INTERRUPT_POLICY,
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.resolve-target",
    "verdict.core.bridge.watch-fact",
    "verdict.core.remote.allowlisted-operation",
    "domain.nesy.adapter.named-query",
    "domain.nesy.adapter.event-stream",
  ],
  expansionSnapshot: EXPANSION,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
};

export const COMPLETE_DELIVERY_SLICE: NesyReferenceSlice = {
  sliceKey: "COMPLETE_DELIVERY",
  displayName: "Complete delivery",
  businessMeaning: NESY_COMPLETE_DELIVERY_MACRO.businessMeaning,
  notResponsibleFor: NESY_COMPLETE_DELIVERY_MACRO.notResponsibleFor,
  inputSchema: NESY_COMPLETE_DELIVERY_MACRO.input,
  outputSchema: NESY_COMPLETE_DELIVERY_MACRO.output,
  preconditions: NESY_COMPLETE_DELIVERY_MACRO.preconditions,
  screenRefs: [NESY_SCREENS.deliveryFlow],
  surfaceRefs: [NESY_SURFACES.paymentSurface, NESY_SURFACES.fiscalSurface, NESY_SURFACES.networkDialog],
  entityBindings: [
    { entityTypeRef: NESY_ENTITIES.shipment, targetRef: NESY_TARGETS.deliveryCompleteButton, role: "Scopes the completion and the backend read to one shipment." },
    { entityTypeRef: NESY_ENTITIES.pendingOperation, role: "Correlates the queued operation with this delivery." },
  ],
  targetResolutionRefs: [NESY_TARGETS.deliveryCompleteButton],
  semanticMacroRef: NESY_COMPLETE_DELIVERY_MACRO_KEY,
  macroExpansion: EXPANSION,
  genericIrSnapshot: GENERIC_IR,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
  oracle: NESY_COMPLETE_DELIVERY_MACRO.oracleTemplate,
  interruptPolicy: NESY_COMPLETE_DELIVERY_MACRO.interruptPolicy,
  requiredCapabilityRefs: NESY_COMPLETE_DELIVERY_MACRO.requiredCapabilityRefs,
  releaseIsolation: NESY_UI_ONLY_RELEASE_ISOLATION,
  negativeCases: [
    {
      caseKey: "HTTP_2XX_AS_DELIVERY",
      scenario:
        "The delivery POST returns 200 and the run reports a completed delivery. The backend rejected the payload downstream and nothing was recorded.",
      refusedBy:
        "nesy.remote.delivery-transport-ack declares transportSuccessOnly:true, so validateEvidenceSource refuses it a factKey and PRIMARY authority. REMOTE.DELIVERY_CONFIRMED is a correlated derivation over the backend status and the app's submission event.",
    },
    {
      caseKey: "OFFLINE_TREATED_AS_FAILURE",
      scenario:
        "The courier is underground. The operation queues correctly, the backend has not confirmed yet, and the run reports FAIL — making the suite unusable in normal working conditions.",
      refusedBy:
        "REMOTE.DELIVERY_CONFIRMED is EVENTUAL with onTimeout INCONCLUSIVE, the queue wait uses onTimeout INCONCLUSIVE, and LOCAL.OFFLINE_QUEUE_ITEM_WAITING is carried as an OPTIONAL diagnostic requirement.",
    },
    {
      caseKey: "QUEUE_AS_SEPARATE_PLANE",
      scenario:
        "The offline queue is modelled as a fifth evidence plane, so every future local mechanism needs a Core change.",
      refusedBy:
        "EVIDENCE_PLANES is a closed four-member union, FORBIDDEN_EVIDENCE_PLANES lists QUEUE explicitly, and the queue source is LOCAL/OFFLINE_QUEUE_WATCH.",
    },
    {
      caseKey: "UNMATCHED_SWITCH_SKIPS_VERIFICATION",
      scenario:
        "Neither branch of the online/offline switch matches, the step is skipped, and the backend verification never runs — reading as success.",
      refusedBy:
        "The SWITCH declares an explicit default GOTO to verify-backend-status; validateWorkflowIrV2 raises MISSING_SWITCH_DEFAULT when a default is absent.",
    },
  ],
};
