/**
 * ===========================================================================
 *  PROCESS_PARCEL slice  (Plan D.6C · RUN_PLAY 4B.18)
 *
 *  A courier scans a parcel and the app accepts it.
 *
 *  THE SCANNER PROBLEM
 *
 *  A camera cannot be driven from a test host, so the scan payload is injected
 *  through an App Adapter seam. That seam is the most dangerous thing in this
 *  pack: it lets a caller tell the app "you just read this barcode". Left in a
 *  shipped build it would let anyone claim a scan they never performed.
 *
 *  Hence `releaseIsolation.automationOnly: true` with a named build guard, and
 *  `APP.SESSION_ISOLATION_ASSERTED` as an assertion fact so a build that shipped
 *  the seam fails the run instead of quietly using it.
 *
 *  THE SETUP/EVIDENCE SEPARATION
 *
 *  The injection step is a `SETUP`-role action with NO output fact bindings. It
 *  cannot produce evidence, so the run cannot validate its own injection. What
 *  proves the scan worked is the app's own critical event (`APP.PARCEL_SCANNED`)
 *  and its state projection (`APP.PARCEL_STATE_PROCESSED`) — the product
 *  reacting, not the harness reporting.
 * ===========================================================================
 */

import type { BridgeFlowPlanSnapshot, MacroDefinition, MacroExpansionSnapshot } from "@nesy/domain-pack-contracts";
import type { WorkflowStepV2 } from "@nesy/workflow-contract";
import { NESY_ADAPTER_QUERY_REFS, NESY_ADAPTER_SETUP_REFS, NESY_COURIER_ADAPTER_REF } from "../registries/application.js";
import { NESY_ENTITIES } from "../registries/entities.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_ACTIONS, NESY_SCREENS, NESY_SURFACES } from "../registries/screens.js";
import { NESY_TARGETS } from "../registries/targets.js";
import type { NesyReferenceSlice } from "../slice.js";
import { KEYED_MUTATION_RETRY, irDocument, requires, sourceMapEntry, stepBase } from "./ir-authoring.js";
import { NESY_SCANNER_INTERRUPT_POLICY, NESY_SEAM_RELEASE_ISOLATION } from "./common.js";

export const NESY_PROCESS_PARCEL_MACRO_KEY = "nesy.macro.process-parcel";

const STEPS: readonly WorkflowStepV2[] = [
  {
    ...stepBase({ planStepId: "wait-scanner", sourceMapRef: "sm-scan-1", next: "resolve-trigger", timeoutMs: 20_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.SCANNER_SURFACE_READY,
    sourceLane: "UI",
    stableForMs: 200,
    requireCorrelation: false,
    onTimeout: "FAIL",
  },
  {
    ...stepBase({
      planStepId: "resolve-trigger",
      sourceMapRef: "sm-scan-2",
      next: "inject-payload",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.scanTrigger,
    outputVariable: "triggerHandle",
  },
  {
    // SETUP role, zero output facts. See the header: the harness arranges the
    // input, the product supplies the evidence.
    ...stepBase({
      planStepId: "inject-payload",
      sourceMapRef: "sm-scan-3",
      next: "await-accepted",
      timeoutMs: 20_000,
      retryPolicy: KEYED_MUTATION_RETRY,
      capabilityRequirements: [requires("domain.nesy.scanner.inject")],
    }),
    kind: "REMOTE_ACTION",
    spec: {
      adapterRef: NESY_COURIER_ADAPTER_REF,
      operationRef: NESY_ADAPTER_SETUP_REFS.scannerInject,
      role: "SETUP",
      effectClass: "IDEMPOTENT_MUTATION",
      idempotencyClass: "KEYED",
      idempotencyKey: "run.input.scanPayload",
      inputBindings: [{ name: "scanPayload", source: { kind: "runInput", path: "scanPayload" } }],
      outputFactBindings: [],
      timeoutPolicy: { timeoutMs: 15_000, maxAttempts: 1 },
      reconciliationPolicy: "RECONCILE_ON_UNKNOWN",
      auditPolicy: { recordRequest: true, recordResponse: true, redactFields: ["scanPayload"] },
      allowedEnvironments: ["qa", "automation"],
    },
  },
  {
    ...stepBase({ planStepId: "await-accepted", sourceMapRef: "sm-scan-4", next: "read-item-state", timeoutMs: 25_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.PARCEL_SCANNED,
    sourceLane: "APP",
    // Correlated: in a multi-item stop, a late event from an earlier item would
    // otherwise close this one.
    requireCorrelation: true,
    onTimeout: "FAIL",
    entityBinding: { type: NESY_ENTITIES.parcel, id: "run.input.scanPayload" },
    continueGate: {
      allOf: [NESY_FACTS.PARCEL_SCANNED],
      deadlineMs: 25_000,
      unknownPolicy: "RETRY",
    },
  },
  {
    ...stepBase({
      planStepId: "read-item-state",
      sourceMapRef: "sm-scan-5",
      next: "assert-processed",
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.parcelState,
    maxRows: 20,
    outputVariable: "itemStateRows",
  },
  {
    ...stepBase({ planStepId: "assert-processed", sourceMapRef: "sm-scan-6", next: null }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.PARCEL_STATE_PROCESSED,
    expected: true,
    unknownPolicy: "FAIL",
    entityBinding: { type: NESY_ENTITIES.parcel, id: "run.input.scanPayload" },
    finalOraclePolicy: {
      requirements: [
        { factKey: NESY_FACTS.PARCEL_STATE_PROCESSED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.PARCEL_SCANNED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        {
          factKey: NESY_FACTS.PARCEL_RECORD_PERSISTED,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 30_000,
          onTimeout: "INCONCLUSIVE",
        },
        {
          // The isolation assertion travels with every slice that uses a seam.
          factKey: NESY_FACTS.SESSION_ISOLATION_ASSERTED,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
      ],
    },
  },
  {
    ...stepBase({ planStepId: "clear-injection", sourceMapRef: "sm-scan-7", next: null, timeoutMs: 20_000 }),
    kind: "CLEANUP",
    compensatesStepIds: ["inject-payload"],
    runOnFailure: true,
  },
];

const GENERIC_IR = irDocument({
  workflowId: "nesy.reference.process-parcel",
  name: "Scan and process one parcel",
  sourceRef: NESY_PROCESS_PARCEL_MACRO_KEY,
  inputs: [
    { name: "scanPayload", type: "string", required: true, secret: false },
    { name: "taskCode", type: "string", required: true },
  ],
  variables: [
    { name: "triggerHandle", type: "string" },
    { name: "itemStateRows", type: "stringList" },
  ],
  steps: STEPS,
  entryStepId: "wait-scanner",
  capabilityRequirements: [requires("verdict.core.bridge.watch-fact"), requires("domain.nesy.scanner.inject")],
  sourceMap: [
    sourceMapEntry("sm-scan-1", "wait-scanner", NESY_PROCESS_PARCEL_MACRO_KEY),
    sourceMapEntry("sm-scan-2", "resolve-trigger", NESY_PROCESS_PARCEL_MACRO_KEY),
    sourceMapEntry("sm-scan-3", "inject-payload", NESY_PROCESS_PARCEL_MACRO_KEY, "SETUP role: arranges input, produces no evidence"),
    sourceMapEntry("sm-scan-4", "await-accepted", NESY_PROCESS_PARCEL_MACRO_KEY, "the product's own reaction"),
    sourceMapEntry("sm-scan-5", "read-item-state", NESY_PROCESS_PARCEL_MACRO_KEY),
    sourceMapEntry("sm-scan-6", "assert-processed", NESY_PROCESS_PARCEL_MACRO_KEY),
    sourceMapEntry("sm-scan-7", "clear-injection", NESY_PROCESS_PARCEL_MACRO_KEY),
  ],
});

const EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_PROCESS_PARCEL_MACRO_KEY,
  authoredBy: "COMPILER",
  genericIr: GENERIC_IR,
  irSourceMap: GENERIC_IR.sourceMap,
  domainSourceMap: [
    {
      ref: "ds-scan-1",
      macroRef: NESY_PROCESS_PARCEL_MACRO_KEY,
      planStepIds: STEPS.map((step) => step.planStepId),
      sliceRef: "PROCESS_PARCEL",
      note: "Setup injection is separated from the evidence-producing wait and query.",
    },
  ],
};

const BRIDGE_PLAN: BridgeFlowPlanSnapshot = {
  macroRef: NESY_PROCESS_PARCEL_MACRO_KEY,
  authoredBy: "COMPILER",
  requiredCapabilityRefs: ["verdict.core.bridge.resolve-target", "domain.nesy.scanner.inject"],
  legs: [
    { planStepId: "wait-scanner", bridgeVerb: "watch", awaitFactKey: NESY_FACTS.SCANNER_SURFACE_READY },
    { planStepId: "resolve-trigger", bridgeVerb: "resolveTarget", targetRef: NESY_TARGETS.scanTrigger },
    { planStepId: "await-accepted", bridgeVerb: "watch", awaitFactKey: NESY_FACTS.PARCEL_SCANNED },
  ],
};

export const NESY_PROCESS_PARCEL_MACRO: MacroDefinition = {
  macroKey: NESY_PROCESS_PARCEL_MACRO_KEY,
  actionRef: NESY_ACTIONS.processParcel,
  displayName: "Process parcel",
  businessMeaning:
    "A courier scans one parcel at the current stop and the app accepts and records it, both in memory and on the device.",
  notResponsibleFor: [
    "camera hardware, focus or lighting — the payload is injected, so optical scanning is out of scope by construction",
    "the delivery outcome for the parcel (see COMPLETE_DELIVERY)",
    "payment or fiscal receipt handling",
    "backend reconciliation of the scan",
  ],
  input: {
    fields: [
      { name: "scanPayload", type: "string", required: true, description: "The value the scanner is told it read." },
      { name: "task", type: "entityRef", required: true, entityTypeRef: NESY_ENTITIES.task },
    ],
  },
  output: {
    fields: [
      { name: "itemAccepted", type: "boolean", factKey: NESY_FACTS.PARCEL_SCANNED },
      { name: "itemProcessed", type: "boolean", factKey: NESY_FACTS.PARCEL_STATE_PROCESSED },
    ],
  },
  preconditions: [
    { kind: "FACT_TRUE", ref: NESY_FACTS.ACTIVE_STOP_MATCHES, deadlineMs: 20_000, onUnmet: "FAIL" },
    { kind: "SCREEN_READY", ref: NESY_SCREENS.deliveryFlow, deadlineMs: 20_000, onUnmet: "FAIL" },
    { kind: "FACT_TRUE", ref: NESY_FACTS.SESSION_ISOLATION_ASSERTED, deadlineMs: 10_000, onUnmet: "FAIL" },
  ],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.deliveryFlow, NESY_SCREENS.stopTaskList, NESY_SCREENS.pickupFlow, NESY_SCREENS.vehicleLoading],
    surfaceRefs: [NESY_SURFACES.scannerSurface],
    entityTypeRefs: [NESY_ENTITIES.parcel, NESY_ENTITIES.task, NESY_ENTITIES.shipment],
    targetRefs: [NESY_TARGETS.scanTrigger],
    factKeys: [
      NESY_FACTS.SCANNER_SURFACE_READY,
      NESY_FACTS.PARCEL_SCANNED,
      NESY_FACTS.PARCEL_STATE_PROCESSED,
      NESY_FACTS.PARCEL_RECORD_PERSISTED,
      NESY_FACTS.SESSION_ISOLATION_ASSERTED,
      NESY_FACTS.ACTIVE_STOP_MATCHES,
    ],
    queryRefs: [NESY_ADAPTER_QUERY_REFS.parcelState],
    adapterOperationRefs: [NESY_ADAPTER_SETUP_REFS.scannerInject, NESY_ADAPTER_SETUP_REFS.scannerManualEntry],
  },
  oracleTemplate: {
    continueGate: {
      allOf: [NESY_FACTS.PARCEL_SCANNED],
      deadlineMs: 25_000,
      unknownPolicy: "RETRY",
    },
    finalOracle: {
      requirements: [
        { factKey: NESY_FACTS.PARCEL_STATE_PROCESSED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        {
          factKey: NESY_FACTS.PARCEL_RECORD_PERSISTED,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 30_000,
          onTimeout: "INCONCLUSIVE",
        },
        { factKey: NESY_FACTS.SESSION_ISOLATION_ASSERTED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
      ],
    },
    notResponsibleFor: ["whether the backend later accepts the scan — that belongs to COMPLETE_DELIVERY"],
  },
  interruptPolicy: NESY_SCANNER_INTERRUPT_POLICY,
  requiredCapabilityRefs: [
    "verdict.core.bridge.resolve-target",
    "verdict.core.bridge.watch-fact",
    "domain.nesy.adapter.named-query",
    "domain.nesy.adapter.event-stream",
    "domain.nesy.scanner.inject",
    "domain.nesy.adapter.release-isolation",
  ],
  expansionSnapshot: EXPANSION,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
};

export const PROCESS_PARCEL_SLICE: NesyReferenceSlice = {
  sliceKey: "PROCESS_PARCEL",
  displayName: "Process parcel",
  businessMeaning: NESY_PROCESS_PARCEL_MACRO.businessMeaning,
  notResponsibleFor: NESY_PROCESS_PARCEL_MACRO.notResponsibleFor,
  inputSchema: NESY_PROCESS_PARCEL_MACRO.input,
  outputSchema: NESY_PROCESS_PARCEL_MACRO.output,
  preconditions: NESY_PROCESS_PARCEL_MACRO.preconditions,
  screenRefs: [NESY_SCREENS.deliveryFlow, NESY_SCREENS.stopTaskList],
  surfaceRefs: [NESY_SURFACES.scannerSurface],
  entityBindings: [
    { entityTypeRef: NESY_ENTITIES.parcel, role: "Correlates the injected payload with the app's own scan event." },
    { entityTypeRef: NESY_ENTITIES.task, role: "Scopes the scan to the task under test." },
  ],
  targetResolutionRefs: [NESY_TARGETS.scanTrigger],
  semanticMacroRef: NESY_PROCESS_PARCEL_MACRO_KEY,
  macroExpansion: EXPANSION,
  genericIrSnapshot: GENERIC_IR,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
  oracle: NESY_PROCESS_PARCEL_MACRO.oracleTemplate,
  interruptPolicy: NESY_PROCESS_PARCEL_MACRO.interruptPolicy,
  requiredCapabilityRefs: NESY_PROCESS_PARCEL_MACRO.requiredCapabilityRefs,
  releaseIsolation: NESY_SEAM_RELEASE_ISOLATION,
  negativeCases: [
    {
      caseKey: "INJECTION_AS_ITS_OWN_EVIDENCE",
      scenario:
        "The injection operation binds a fact meaning 'a scan happened'. The run then proves that the harness called the adapter, not that the app processed anything.",
      refusedBy:
        "The operation has role SETUP with no outputFactBindings; validateExternalAction raises SETUP_PRODUCES_VERDICT if setup binds facts, and validateRemoteAdapterOperation raises SETUP_BINDS_BUSINESS_FACT for the adapter twin.",
    },
    {
      caseKey: "SCANNER_SEAM_SHIPPED",
      scenario:
        "The injection seam is present in a production build, letting anyone tell the app they scanned a parcel they never held.",
      refusedBy:
        "The SCANNER_INJECTION adapter capability is mutating and therefore must be automationOnly with a named releaseGuard (ADAPTER_SEAM_NOT_ISOLATED otherwise), and APP.SESSION_ISOLATION_ASSERTED is a REQUIRED oracle requirement of this slice.",
    },
    {
      caseKey: "LATE_EVENT_CLOSES_WRONG_ITEM",
      scenario:
        "A stop with several parcels: the scan event for the first item arrives late and closes the wait for the third.",
      refusedBy:
        "The WAIT_EVENT declares requireCorrelation:true with a PARCEL entity binding, and the source's correlation policy requires both entity and occurrence match.",
    },
  ],
};
