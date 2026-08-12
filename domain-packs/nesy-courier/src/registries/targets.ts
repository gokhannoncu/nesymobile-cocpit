/**
 * ===========================================================================
 *  Nesy Courier Target Registry  (Plan D.6B · 4B.15 · 4B.7)
 *
 *  `nesy.target.stop-row` is the target this whole registry design exists for,
 *  so it is worth reading its chain top to bottom:
 *
 *    1. ACCESSIBILITY_ID   — the row's app-authored test id, when the build has
 *                            one. Strongest identity available.
 *    2. ENTITY_BINDING     — resolve by the stop's business key. This is what a
 *                            human actually means by "the stop for order 42",
 *                            and it survives a re-sort.
 *    3. STRUCTURAL_FINGERPRINT — the row's shape inside the list container.
 *                            Weaker, but real.
 *    4. ROW_INDEX_HINT     — LAST, and `establishesIdentity: false`. It may
 *                            narrow a search; it may never decide the target.
 *
 *  Why that last line matters concretely: a plan that taps "row 3" will
 *  eventually tap the wrong stop after a background sync re-sorts the list, and
 *  it will then deliver someone else's parcel *successfully*. Every oracle
 *  passes. The report is green. The data is wrong.
 *
 *  `ambiguityPolicy: "FAIL"` and `reverifyBeforeAction: true` close the other two
 *  windows: two matching candidates stop the run instead of picking one, and the
 *  gap between resolving a row and tapping it is re-checked.
 * ===========================================================================
 */

import type { TargetDefinition } from "@nesy/domain-pack-contracts";
import { NESY_COURIER_APPLICATION_KEY } from "./application.js";
import { NESY_ENTITIES } from "./entities.js";
import { NESY_SCREENS, NESY_SURFACES } from "./screens.js";

const APP = NESY_COURIER_APPLICATION_KEY;

export const NESY_TARGETS = {
  /** Default login tab on NesyMobile (`@string/pin_view`). */
  loginPinTab: "nesy.target.login-pin-tab",
  /** Chaos PinView on the PIN tab (`R.id.pinView`). */
  loginPinField: "nesy.target.login-pin-field",
  loginSubmit: "nesy.target.login-submit",
  /** Spinner that OPENS the route list; the list itself has no app id. */
  routeSpinner: "nesy.target.route-spinner",
  /** Opens the typed-barcode dialog on the stop list. */
  manualBarcodeEntry: "nesy.target.manual-barcode-entry",
  barcodeInputField: "nesy.target.barcode-input-field",
  barcodeInputConfirm: "nesy.target.barcode-input-confirm",
  /** RS-only: confirms the delivery time range before the task is created. */
  timeSlotConfirm: "nesy.target.time-slot-confirm",
  /** The shared ArasDialog acknowledgement button. */
  dialogAcknowledge: "nesy.target.dialog-acknowledge",
  routeRow: "nesy.target.route-row",
  routeDialogConfirm: "nesy.target.route-dialog-confirm",
  stopRow: "nesy.target.stop-row",
  taskRow: "nesy.target.task-row",
  scanTrigger: "nesy.target.scan-trigger",
  deliveryCompleteButton: "nesy.target.delivery-complete-button",
  tourApprovalRequestButton: "nesy.target.tour-approval-request-button",
} as const;

export const NESY_COURIER_TARGETS: readonly TargetDefinition[] = [
  {
    targetKey: NESY_TARGETS.loginPinTab,
    applicationRef: APP,
    screenRef: NESY_SCREENS.login,
    displayName: "PIN login tab",
    resolution: {
      // Cold start already selects the PIN tab; TEXT_MATCH recovers if the
      // username tab was left selected from a prior interactive session.
      chain: [
        { kind: "TEXT_MATCH", selector: { text: "PIN" }, establishesIdentity: true },
        { kind: "ACCESSIBILITY_ID", selector: { id: "tl_login" }, establishesIdentity: false },
      ],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: false,
    },
  },
  {
    targetKey: NESY_TARGETS.loginPinField,
    applicationRef: APP,
    screenRef: NESY_SCREENS.login,
    displayName: "PIN field",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "pinView" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: false,
    },
  },
  {
    targetKey: NESY_TARGETS.loginSubmit,
    applicationRef: APP,
    screenRef: NESY_SCREENS.login,
    displayName: "Sign-in button",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "btn_login" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  {
    // MEASURED on device, not assumed: the dialog is a Spinner plus two buttons.
    // `route_row_*`, `route_list` and `route_dialog_confirm` were invented ids —
    // nothing on screen ever carried them, so the chain below is what the
    // product actually shows.
    targetKey: NESY_TARGETS.routeSpinner,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    surfaceRef: NESY_SURFACES.routeSelectionDialog,
    displayName: "Route spinner that opens the offered list",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "dialog_spinner" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  // ── Vehicle loading (zimmet) — every id below was DUMPED from the device,
  // not inferred from a layout file. The route dialog taught that lesson: it
  // expected `route_row_*`, `route_list` and `route_dialog_confirm`, and none of
  // the three was ever on screen.
  {
    targetKey: NESY_TARGETS.manualBarcodeEntry,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Manual barcode entry button",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "manuel_input" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.barcodeInputField,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Typed barcode field",
    resolution: {
      // `input_text` on the device matches BY ID ONLY, so an id chain is not a
      // preference here — a text selector would silently write nowhere.
      chain: [
        { kind: "ACCESSIBILITY_ID", selector: { id: "et_input_dialog_barcode_number" }, establishesIdentity: true },
      ],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.barcodeInputConfirm,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Typed barcode OK button",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "btn_ok" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.timeSlotConfirm,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Delivery time range confirm (RS)",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "btnSave" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      // The picker is shown for Serbia and for nobody else (`ScanProcessor` gates
      // it on `countryCode == "RS"` plus an unselected waybill), so the country
      // rule WANTS to be `TREAT_AS_ABSENT` here — a missing picker is a correct
      // state, unlike a missing OK button on the dialog above.
      //
      // FAIL anyway, and deliberately: MEASURED that the host's RESOLVE_TARGET
      // runtime never reads `notFoundPolicy` — anything but `RESOLVED_UNIQUE` is
      // a step failure. Declaring the policy we want would describe behaviour the
      // runtime does not have, and the slice would read as country-neutral while
      // failing everywhere but Serbia. FAIL states what is actually enforced.
      notFoundPolicy: "FAIL",
      deadlineMs: 8_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.dialogAcknowledge,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Warning dialog acknowledge",
    resolution: {
      chain: [
        { kind: "ACCESSIBILITY_ID", selector: { id: "btn_arasDg_positive_button" }, establishesIdentity: true },
      ],
      ambiguityPolicy: "FAIL",
      // Absent on the happy path. Used only to CLEAN UP a refusal dialog: an
      // aborted run that leaves one open makes the next run fail on a screen it
      // never reached — measured with the route spinner, whose popup stayed open
      // and turned the following run's `resolve-spinner` into `not_found`.
      notFoundPolicy: "TREAT_AS_ABSENT",
      deadlineMs: 5_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.routeRow,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    surfaceRef: NESY_SURFACES.routeSelectionDialog,
    displayName: "Route row inside the selection dialog",
    resolution: {
      chain: [
        // Rows share ONE id (`android:id/text1`), so an id can only ever be
        // ambiguous here. The only per-row identity the product exposes is the
        // label it renders — and that label is what the courier reads, which is
        // also the right thing for a test to mean by "that route".
        //
        // The key is supplied per run: for a Serbian fiscal route the row says
        // "31 *" while `routeCode` is "31", so the macro binds the LABEL from the
        // projection rather than the raw input.
        { kind: "ENTITY_BINDING", selector: { keyPath: "routeLabel" }, establishesIdentity: true },
      ],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: true,
    },
    entityBinding: {
      entityTypeRef: NESY_ENTITIES.route,
      targetRef: NESY_TARGETS.routeRow,
      projectedPaths: ["routeCode", "routeId"],
      redactProjection: true,
    },
  },
  {
    targetKey: NESY_TARGETS.routeDialogConfirm,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    surfaceRef: NESY_SURFACES.routeSelectionDialog,
    displayName: "Route dialog confirm button",
    resolution: {
      // `yesButton` on device; it renders the label "OK".
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "yesButton" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  {
    // The canonical provider chain. See the file header.
    targetKey: NESY_TARGETS.stopRow,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Stop row in the route list",
    resolution: {
      chain: [
        { kind: "ACCESSIBILITY_ID", selector: { idPrefix: "stop_row_" }, establishesIdentity: true },
        {
          kind: "ENTITY_BINDING",
          selector: { keyPath: "stopCode", collectionQueryRef: "nesy.availableStops" },
          establishesIdentity: true,
        },
        {
          kind: "STRUCTURAL_FINGERPRINT",
          selector: { containerId: "stop_list", rowRole: "listItem" },
          establishesIdentity: true,
        },
        { kind: "ROW_INDEX_HINT", selector: { containerId: "stop_list" }, establishesIdentity: false },
      ],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 15_000,
      reverifyBeforeAction: true,
    },
    entityBinding: {
      entityTypeRef: NESY_ENTITIES.stop,
      targetRef: NESY_TARGETS.stopRow,
      // Bounded: enough to identify the row, nothing more. An unbounded
      // projection would put recipient addresses into every plan artifact.
      projectedPaths: ["stopCode", "stopId", "sequenceLabel"],
      redactProjection: true,
    },
  },
  {
    targetKey: NESY_TARGETS.taskRow,
    applicationRef: APP,
    screenRef: NESY_SCREENS.stopTaskList,
    displayName: "Task row in the stop task list",
    resolution: {
      chain: [
        { kind: "ACCESSIBILITY_ID", selector: { idPrefix: "task_row_" }, establishesIdentity: true },
        { kind: "ENTITY_BINDING", selector: { keyPath: "taskCode" }, establishesIdentity: true },
        { kind: "ROW_INDEX_HINT", selector: { containerId: "task_list" }, establishesIdentity: false },
      ],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: true,
    },
    entityBinding: {
      entityTypeRef: NESY_ENTITIES.task,
      targetRef: NESY_TARGETS.taskRow,
      projectedPaths: ["taskCode", "taskId"],
      redactProjection: true,
    },
  },
  {
    targetKey: NESY_TARGETS.scanTrigger,
    applicationRef: APP,
    screenRef: NESY_SCREENS.deliveryFlow,
    surfaceRef: NESY_SURFACES.scannerSurface,
    displayName: "Scan trigger",
    resolution: {
      chain: [
        { kind: "ACCESSIBILITY_ID", selector: { id: "scan_trigger" }, establishesIdentity: true },
        { kind: "INSPECTOR_MAPPING", selector: { mappingRef: "nesy.inspector.scan-trigger" }, establishesIdentity: true },
      ],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: false,
    },
  },
  {
    targetKey: NESY_TARGETS.deliveryCompleteButton,
    applicationRef: APP,
    screenRef: NESY_SCREENS.deliveryFlow,
    displayName: "Complete delivery button",
    resolution: {
      chain: [
        { kind: "ACCESSIBILITY_ID", selector: { id: "delivery_complete_button" }, establishesIdentity: true },
        { kind: "INSPECTOR_MAPPING", selector: { mappingRef: "nesy.inspector.delivery-complete" }, establishesIdentity: true },
      ],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.tourApprovalRequestButton,
    applicationRef: APP,
    screenRef: NESY_SCREENS.endOfDay,
    displayName: "Request tour approval button",
    resolution: {
      chain: [
        { kind: "ACCESSIBILITY_ID", selector: { id: "tour_approval_request_button" }, establishesIdentity: true },
      ],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: true,
    },
  },
];
