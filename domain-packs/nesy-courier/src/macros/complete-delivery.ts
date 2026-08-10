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
    ...stepBase({ planStepId: "wait-flow", sourceMapRef: "sm-done-1", next: "resolve-complete", timeoutMs: 20_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.DELIVERY_FLOW_READY,
    sourceLane: "UI",
    requireCorrelation: false,
    onTimeout: "FAIL",
  },
  {
    ...stepBase({
      planStepId: "resolve-complete",
      sourceMapRef: "sm-done-2",
      next: "tap-complete",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.deliveryCompleteButton,
    outputVariable: "completeHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-complete",
      sourceMapRef: "sm-done-3",
      next: "branch-on-queue",
      timeoutMs: 25_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "completeHandle",
    entityBinding: { type: NESY_ENTITIES.shipment, id: "run.input.consignmentNumber" },
    continueGate: {
      allOf: [NESY_FACTS.DELIVERY_SUBMITTED],
      deadlineMs: 25_000,
      unknownPolicy: "RETRY",
    },
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
        condition: {
          kind: "comparison",
          operator: "greaterThan",
          left: { kind: "operand", source: "local.result", path: "pendingOperation.count" },
          right: { kind: "literal", value: 0 },
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
      entityBinding: { type: NESY_ENTITIES.shipment, id: "run.input.consignmentNumber" },
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
  inputs: [{ name: "consignmentNumber", type: "string", required: true }],
  variables: [{ name: "completeHandle", type: "string" }],
  steps: STEPS,
  entryStepId: "wait-flow",
  capabilityRequirements: [requires("verdict.core.bridge.tap"), requires("verdict.core.remote.allowlisted-operation")],
  sourceMap: [
    sourceMapEntry("sm-done-1", "wait-flow", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-2", "resolve-complete", NESY_COMPLETE_DELIVERY_MACRO_KEY),
    sourceMapEntry("sm-done-3", "tap-complete", NESY_COMPLETE_DELIVERY_MACRO_KEY),
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
      planStepId: "tap-complete",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.deliveryCompleteButton,
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
    "payment collection and fiscal receipt printing",
    "recipient signature quality or identity verification",
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
    targetRefs: [NESY_TARGETS.deliveryCompleteButton],
    factKeys: [
      NESY_FACTS.DELIVERY_FLOW_READY,
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
    notResponsibleFor: ["payment and fiscal surfaces, which are IGNORE-policy surfaces for this macro"],
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
