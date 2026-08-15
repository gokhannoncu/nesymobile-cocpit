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
    /**
     * The TASK LIST, not a scanner surface.
     *
     * Mapped 2026-08-13: `ScanProcessor` — the scanner surface and its whole
     * DELY/DELR/STOR/LOST tree — belongs to `StopListFragment` and is
     * unreachable from the task page. A scan here arrives through
     * `MainActivity.onBarcodeRead` and is dispatched to `TaskListFragment`, so
     * waiting for a scanner surface was waiting for a screen this slice never
     * visits.
     */
    ...stepBase({ planStepId: "wait-task-list", sourceMapRef: "sm-scan-1", next: "resolve-manual-entry", timeoutMs: 20_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.TASK_LIST_READY,
    sourceLane: "UI",
    stableForMs: 200,
    requireCorrelation: false,
    onTimeout: "FAIL",
  },
  {
    /**
     * THE PRODUCT'S OWN INPUT PATH, not an automation seam.
     *
     * This slice used to inject the scan through `nesy.setup.scanner-inject` —
     * an automation-only backdoor that then had to be justified by asserting
     * release isolation, and that the host had no runtime for anyway (the ref is
     * a DEVICE COMMAND while the macro called it as an adapter operation).
     *
     * Measured 2026-08-13: the task page carries the SAME manual-entry control
     * the stop list does — `manuel_input` opens `et_input_dialog_barcode_number`
     * with `btn_ok` — and typing the barcode there produced exactly the sequence
     * the slice is about: `PARCEL_SCANNED`, then `SCREEN_READY`, then
     * `DELIVERY_STARTED`, with the delivery screen on screen.
     *
     * So there is no seam to isolate, no adapter to wire, and no backdoor to
     * explain: a courier can type a barcode, and now so does the test. The
     * `SESSION_ISOLATION_ASSERTED` requirement went with the injection — it
     * guarded a risk this slice no longer takes.
     */
    ...stepBase({
      planStepId: "resolve-manual-entry",
      sourceMapRef: "sm-scan-2",
      next: "tap-manual-entry",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.manualBarcodeEntry,
    outputVariable: "manualEntryHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-manual-entry",
      sourceMapRef: "sm-scan-3",
      next: "resolve-scan-field",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "manualEntryHandle",
  },
  {
    ...stepBase({
      planStepId: "resolve-scan-field",
      sourceMapRef: "sm-scan-3a",
      next: "enter-scan-value",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.barcodeInputField,
    outputVariable: "scanFieldHandle",
  },
  {
    ...stepBase({
      planStepId: "enter-scan-value",
      sourceMapRef: "sm-scan-3b",
      next: "resolve-input-confirm",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("verdict.core.bridge.set-text")],
    }),
    kind: "BRIDGE_ACTION",
    action: "setText",
    targetVariable: "scanFieldHandle",
    args: { valueRef: "run.input.scanPayload" },
  },
  {
    ...stepBase({
      planStepId: "resolve-input-confirm",
      sourceMapRef: "sm-scan-3c",
      next: "tap-input-confirm",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.barcodeInputConfirm,
    outputVariable: "confirmHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-input-confirm",
      sourceMapRef: "sm-scan-3d",
      next: "read-pending-queue",
      timeoutMs: 20_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "confirmHandle",
    entityBinding: { type: NESY_ENTITIES.parcel, id: "run.input.scanPayload" },
    /**
     * BOTH facts gated on the tap that CAUSES them, not on later wait steps.
     *
     * A device event is stamped with the occurrence the host last seeded, which
     * is the step doing the tapping — so a separate WAIT_EVENT looks for the
     * fact under its own occurrence and never finds it. Measured 2026-08-13: the
     * scan was accepted, the delivery screen opened, and `await-accepted` timed
     * out on a `PARCEL_SCANNED` that had landed on `tap-input-confirm`.
     *
     * This is the shape TOUR_APPROVAL already uses for the same reason.
     */
    continueGate: {
      allOf: [NESY_FACTS.PARCEL_SCANNED, NESY_FACTS.DELIVERY_FLOW_STARTED],
      deadlineMs: 30_000,
      unknownPolicy: "RETRY",
    },
  },
  {
    /**
     * G90.10 BD.6 — LOCAL durable queue is a measurement, not a declaration.
     *
     * The scan accept is what may write `RequestSenderService`. Without this
     * read the oracle cannot see `LOCAL.OFFLINE_QUEUE_ITEM_WAITING`, and
     * `PASS_QUEUED_OFFLINE` would be unreachable. `pending_count` is the
     * string `"0"` when empty; `COLUMN_NOT_IN` is that measurement.
     *
     * OPTIONAL on the oracle: online uninjected stays `PASS_ONLINE`.
     */
    ...stepBase({
      planStepId: "read-pending-queue",
      sourceMapRef: "sm-scan-5",
      next: "assert-delivery-started",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.pendingOperation,
    maxRows: 1,
    outputVariable: "queueRows",
    outputFactBindings: [
      {
        factKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
        from: { kind: "COLUMN_NOT_IN", column: "pending_count", values: ["0"] },
      },
    ],
  },
  {
    ...stepBase({ planStepId: "assert-delivery-started", sourceMapRef: "sm-scan-6", next: null }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.DELIVERY_FLOW_STARTED,
    expected: true,
    unknownPolicy: "FAIL",
    entityBinding: { type: NESY_ENTITIES.parcel, id: "run.input.scanPayload" },
    finalOraclePolicy: {
      requirements: [
        // The scan was accepted at all.
        { factKey: NESY_FACTS.PARCEL_SCANNED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        // ...and it started the DELIVERY flow rather than one of its neighbours.
        {
          factKey: NESY_FACTS.DELIVERY_FLOW_STARTED,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 30_000,
          onTimeout: "INCONCLUSIVE",
        },
        /**
         * CONTEXT, not proof — and WARNING for a measured reason.
         *
         * `Delivery` and `Already_Load` differ only by `scheduleStatus ==
         * Approved(2)`, so this looked like the discriminator and was written
         * REQUIRED. On device it timed out, and the timeout was right: this
         * branch performs no local schedule write, so the app has no occasion to
         * re-announce its status during the run. The fact is established earlier,
         * at login and route selection.
         *
         * The discrimination is already carried by DELIVERY_FLOW_STARTED above:
         * `Already_Load` shows a toast and does NOT open the delivery screen, so
         * a run that saw the flow start cannot have taken that branch. Demanding
         * the status as well would make the slice fail for want of an event the
         * product had no reason to emit — the exact shape of requirement this
         * phase exists to remove.
         */
        {
          factKey: NESY_FACTS.SCHEDULE_STATUS_APPROVED,
          obligation: "WARNING",
          timing: "EVENTUAL",
          deadlineMs: 20_000,
          onTimeout: "WARNING",
        },
        /**
         * Diagnostic, not a pass condition. Present + subtype=queue is what
         * lets the oracle emit PASS_QUEUED_OFFLINE. Absent keeps PASS_ONLINE.
         * PARCEL_RECORD_PERSISTED is not this fact — that exists online too.
         */
        {
          factKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
          obligation: "OPTIONAL",
          timing: "IMMEDIATE",
          onTimeout: "WARNING",
        },
      ],
    },
  },
  {
    // Nothing to compensate on the device any more: the slice types into the
    // product's own dialog rather than installing an injection to undo.
    ...stepBase({ planStepId: "close-input", sourceMapRef: "sm-scan-7", next: null, timeoutMs: 20_000 }),
    kind: "CLEANUP",
    compensatesStepIds: ["tap-input-confirm"],
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
    { name: "manualEntryHandle", type: "string" },
    { name: "scanFieldHandle", type: "string" },
    { name: "confirmHandle", type: "string" },
    { name: "queueRows", type: "string" },
  ],
  steps: STEPS,
  entryStepId: "wait-task-list",
  capabilityRequirements: [
    requires("verdict.core.bridge.watch-fact"),
    requires("verdict.core.bridge.resolve-target"),
    requires("verdict.core.bridge.tap"),
    requires("verdict.core.bridge.set-text"),
  ],
  sourceMap: [
    sourceMapEntry("sm-scan-1", "wait-task-list", NESY_PROCESS_PARCEL_MACRO_KEY, "the task page, not a scanner surface"),
    sourceMapEntry("sm-scan-2", "resolve-manual-entry", NESY_PROCESS_PARCEL_MACRO_KEY, "the product's own input path, not a seam"),
    sourceMapEntry("sm-scan-3", "tap-manual-entry", NESY_PROCESS_PARCEL_MACRO_KEY),
    sourceMapEntry("sm-scan-3a", "resolve-scan-field", NESY_PROCESS_PARCEL_MACRO_KEY),
    sourceMapEntry("sm-scan-3b", "enter-scan-value", NESY_PROCESS_PARCEL_MACRO_KEY),
    sourceMapEntry("sm-scan-3c", "resolve-input-confirm", NESY_PROCESS_PARCEL_MACRO_KEY),
    sourceMapEntry("sm-scan-3d", "tap-input-confirm", NESY_PROCESS_PARCEL_MACRO_KEY),
    sourceMapEntry("sm-scan-5", "read-pending-queue", NESY_PROCESS_PARCEL_MACRO_KEY, "LOCAL queue measurement"),
    sourceMapEntry("sm-scan-4", "assert-delivery-started", NESY_PROCESS_PARCEL_MACRO_KEY, "WHICH branch ran"),
    sourceMapEntry("sm-scan-6", "assert-delivery-started", NESY_PROCESS_PARCEL_MACRO_KEY),
    sourceMapEntry("sm-scan-7", "close-input", NESY_PROCESS_PARCEL_MACRO_KEY),
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
    { planStepId: "wait-task-list", bridgeVerb: "watch", awaitFactKey: NESY_FACTS.TASK_LIST_READY },
    { planStepId: "tap-manual-entry", bridgeVerb: "tap", targetRef: NESY_TARGETS.manualBarcodeEntry },
    { planStepId: "enter-scan-value", bridgeVerb: "setText", targetRef: NESY_TARGETS.barcodeInputField },
    { planStepId: "tap-input-confirm", bridgeVerb: "tap", targetRef: NESY_TARGETS.barcodeInputConfirm },
    { planStepId: "tap-input-confirm", bridgeVerb: "tap", awaitFactKey: NESY_FACTS.DELIVERY_FLOW_STARTED },
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
    entityTypeRefs: [NESY_ENTITIES.parcel, NESY_ENTITIES.task, NESY_ENTITIES.shipment, NESY_ENTITIES.pendingOperation],
    targetRefs: [NESY_TARGETS.scanTrigger],
    factKeys: [
      NESY_FACTS.SCANNER_SURFACE_READY,
      NESY_FACTS.PARCEL_SCANNED,
      NESY_FACTS.PARCEL_STATE_PROCESSED,
      NESY_FACTS.PARCEL_RECORD_PERSISTED,
      NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
      NESY_FACTS.SESSION_ISOLATION_ASSERTED,
      NESY_FACTS.ACTIVE_STOP_MATCHES,
    ],
    queryRefs: [NESY_ADAPTER_QUERY_REFS.parcelState, NESY_ADAPTER_QUERY_REFS.pendingOperation],
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
        {
          factKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
          obligation: "OPTIONAL",
          timing: "IMMEDIATE",
          onTimeout: "WARNING",
        },
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
