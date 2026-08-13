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
  /**
   * The delivery screen carries its OWN `manuel_input` / `btn_ok` / barcode
   * field with the same ids as the stop list's. Separate keys because the
   * screen a target lives on is part of what it means: resolving the stop
   * list's entry while the delivery screen is up would be a target that
   * happened to match, not the one the run asked for.
   */
  deliveryManualBarcodeEntry: "nesy.target.delivery-manual-barcode-entry",
  deliveryBarcodeInputField: "nesy.target.delivery-barcode-input-field",
  deliveryBarcodeInputConfirm: "nesy.target.delivery-barcode-input-confirm",
  /** DELY branch of the delivery-type chooser (DEPS is a separate slice). */
  deliveryTypeDely: "nesy.target.delivery-type-dely",
  /** "Are you sure" — the SHARED ArasDialog positive button. */
  deliveryConfirmAccept: "nesy.target.delivery-confirm-accept",
  /**
   * Requests tour start from the STOP LIST — not from end-of-day. Its label is
   * the schedule status, so the id is the only stable handle.
   */
  tourApprovalRequestButton: "nesy.target.tour-approval-request-button",
  /** Routing chooser shown between the request tap and the backend call. */
  tourRoutingAuto: "nesy.target.tour-routing-auto",
  tourRoutingManual: "nesy.target.tour-routing-manual",
  /** The only way to close the push notification list; BACK does not. */
  notificationListExit: "nesy.target.notification-list-exit",
  /**
   * The stop list's own search: the product's way of addressing one stop.
   *
   * A stop row carries no id, so before these existed the pack had nothing
   * honest to resolve it with. Searching a business key FILTERS the list, and a
   * filtered list of one is an identity the run established rather than guessed.
   */
  stopSearchToggle: "nesy.target.stop-search-toggle",
  /**
   * Two targets for one field, because they ask different questions. The probe
   * asks "is the bar open RIGHT NOW" and must answer at once; the post-tap
   * resolve asks "the bar was just opened, where is the field" and must wait out
   * the animation. A single target cannot be both absent-tolerant and patient.
   */
  stopSearchFieldProbe: "nesy.target.stop-search-field-probe",
  stopSearchField: "nesy.target.stop-search-field",
  stopSearchSubmit: "nesy.target.stop-search-submit",
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
      // The country rule, expressed as a policy rather than as an
      // `if (countryCode == "RS")` in a macro: the picker is shown for Serbia and
      // for nobody else (`ScanProcessor` gates it on `countryCode == "RS"` plus an
      // unselected waybill), so a missing picker is a CORRECT state — unlike a
      // missing OK button on the typed-barcode dialog above, which is a defect.
      //
      // The host now honours this: NOT_FOUND with TREAT_AS_ABSENT resolves to an
      // absent marker and the dependent action reports `SKIPPED`. It briefly did
      // not, and the pack had to declare FAIL and call itself RS-only.
      notFoundPolicy: "TREAT_AS_ABSENT",
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
    targetKey: NESY_TARGETS.stopSearchToggle,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Search bar toggle on the stop list",
    resolution: {
      // Named `close_search_bar` in the layout but it TOGGLES; measured, tapping
      // it while the bar is closed opens it. The name is the product's, not ours.
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "close_search_bar" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.stopSearchFieldProbe,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Stop list search field (state probe)",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "tietSearchText" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      // ABSENT IS A STATE, NOT A FAILURE, and it is the answer this probe exists
      // to get. The search bar is a TOGGLE: measured, tapping it while the bar is
      // open CLOSES it, so the macro has to ask before it acts.
      notFoundPolicy: "TREAT_AS_ABSENT",
      // Short on purpose. "Is it open now" must not wait; an absent-tolerant
      // target does not retry, so this is the ceiling on one look.
      deadlineMs: 3_000,
      reverifyBeforeAction: false,
    },
  },
  {
    targetKey: NESY_TARGETS.stopSearchField,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Stop list search field",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "tietSearchText" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      // MANDATORY here, unlike the probe above: by this point the toggle has been
      // tapped, so the field must appear. It arrives with an animation rather
      // than instantly — measured, a resolve issued in the same breath as the tap
      // reported NOT_FOUND while a repeat a moment later found it every time — so
      // the deadline is what the host now spends looking.
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.stopSearchSubmit,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Stop list search submit",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "search_button" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  {
    /**
     * The canonical provider chain. See the file header — and note what MEASURING
     * it on 2026-08-12 removed from it.
     *
     * The chain used to open with `ACCESSIBILITY_ID idPrefix: "stop_row_"` and
     * fall back to a container called `stop_list`. Neither exists. Dumped from
     * the device, a stop row is an ID-LESS clickable `LinearLayout` inside the
     * RecyclerView `rv`, and what identifies it lives on its children:
     * `tv_address`, `consignee`, `tv_piece_info`, `textViewLegacySystemId`.
     * `route_row_*` and `tour_approval_request_button` were invented the same way
     * — this is the third target in this registry written from a name rather than
     * from the screen.
     *
     * So ENTITY_BINDING now leads, which is also the honest order: the row has no
     * id of its own, and "the stop for this code" is what a human means anyway.
     * The fingerprint and the index hint keep their place behind it, pointed at
     * the container that actually exists. The index hint still establishes
     * nothing — the reason the file header exists.
     */
    targetKey: NESY_TARGETS.stopRow,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Stop row in the route list",
    resolution: {
      chain: [
        {
          kind: "ENTITY_BINDING",
          // `stop_id`, the column the collection query projects — not `stopCode`,
          // which is the ENTITY's business key path and appears in no projection.
          selector: { keyPath: "stop_id", collectionQueryRef: "nesy.availableStops" },
          establishesIdentity: true,
        },
        {
          kind: "STRUCTURAL_FINGERPRINT",
          selector: { containerId: "rv", rowRole: "listItem" },
          establishesIdentity: true,
        },
        { kind: "ROW_INDEX_HINT", selector: { containerId: "rv" }, establishesIdentity: false },
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
    /**
     * MEASURED on device 2026-08-13 (R6CW400BC8N, tstrsDebug, Delivery screen).
     *
     * The previous id `delivery_complete_button` exists nowhere in the app —
     * same invention as `tour_approval_request_button` and `stop_row_*`. The
     * real control is `btn_deliver`, a clickable LinearLayout at the bottom of
     * `delivery_scroll`. On first paint it sits below the fold (`visible=false`,
     * top≈2517); a scroll that starts on the parcels band (NOT the signature
     * pad) brings it on screen. `find_id` matches it even while off-screen.
     *
     * ID ONLY, DELIBERATELY. The label lives on a non-clickable child `text1`
     * and is the word "Delivery" — the same string as the action-bar title.
     * Matching on text would bind the title, or fail closed on ambiguity, and
     * would break the moment the locale changes. `btn_out` taught the same
     * lesson.
     */
    targetKey: NESY_TARGETS.deliveryManualBarcodeEntry,
    applicationRef: APP,
    screenRef: NESY_SCREENS.deliveryFlow,
    displayName: "Manual barcode entry button (delivery screen)",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "manuel_input" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.deliveryBarcodeInputField,
    applicationRef: APP,
    screenRef: NESY_SCREENS.deliveryFlow,
    displayName: "Typed barcode field (delivery screen)",
    resolution: {
      // `input_text` matches BY ID ONLY on the device; a text selector writes nowhere.
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
    targetKey: NESY_TARGETS.deliveryBarcodeInputConfirm,
    applicationRef: APP,
    screenRef: NESY_SCREENS.deliveryFlow,
    displayName: "Typed barcode OK button (delivery screen)",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "btn_ok" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 10_000,
      reverifyBeforeAction: true,
    },
  },
  {
    /**
     * MEASURED on device 2026-08-13. Tapping `btn_deliver` does not deliver —
     * it opens "Choose A Delivery Option" (`showDeliveryTypeDialog`), and the
     * backend call only happens two taps later.
     *
     * `btnDeps` is NOT modelled: DEPS is a different business outcome and its
     * own slice. Measured that `btnDeps` is hidden outright on some entry paths
     * (`hasScannedDocumentCollection`, ME/BA), so a target that assumed both
     * buttons exist would fail on the product behaving correctly.
     */
    targetKey: NESY_TARGETS.deliveryTypeDely,
    applicationRef: APP,
    screenRef: NESY_SCREENS.deliveryFlow,
    displayName: "Delivery type: DELY",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "btnDely" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: true,
    },
  },
  {
    /**
     * MEASURED on device 2026-08-13: "Attention / Are you sure that it is a
     * customer Delivery?" with `btn_arasDg_positive_button` / `..._negative_button`.
     *
     * THESE IDS ARE SHARED by every `ArasDialog` in the app — the same pair
     * names the load-to-vehicle error dialog. Only one dialog is in the active
     * window at a time, so the id is unambiguous AT THE MOMENT OF THE TAP, but
     * it does not by itself say WHICH dialog is open. What establishes that is
     * `APP.DELIVERY_CONFIRM_DIALOG_SHOWN`, the dedicated wire added with the
     * delivery-screen wire split — the run gates on the fact and taps by id,
     * rather than reading dialog copy that changes with locale.
     */
    targetKey: NESY_TARGETS.deliveryConfirmAccept,
    applicationRef: APP,
    screenRef: NESY_SCREENS.deliveryFlow,
    displayName: "Delivery confirmation: Yes",
    resolution: {
      chain: [
        { kind: "ACCESSIBILITY_ID", selector: { id: "btn_arasDg_positive_button" }, establishesIdentity: true },
      ],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.deliveryCompleteButton,
    applicationRef: APP,
    screenRef: NESY_SCREENS.deliveryFlow,
    displayName: "Complete delivery button (btn_deliver)",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "btn_deliver" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: true,
    },
  },
  {
    /**
     * MEASURED on device 2026-08-12 (R6CW400BC8N, schedule 11-31-20260812-1).
     *
     * The previous definition was invented twice over: it looked for an id
     * `tour_approval_request_button` that exists nowhere in the app, on the
     * end-of-day screen. The real control is `btn_out` on the STOP LIST
     * (`fragment_stops.xml`), and tapping it is what reaches
     * `Task/RequestLeavingPermission`.
     *
     * ID ONLY, DELIBERATELY. `btn_out` carries no text of its own; the label
     * lives on a child `text1` and is a pure function of the schedule status
     * (StopListFragment ~1924): BeginningOfDay → "Request Tour Start",
     * WaitingForApproval → "Waiting Approval", Approved AND EndOfDay → both
     * "End Of Tour". Matching on text would therefore bind to a non-clickable
     * child, would break the moment the status advances, and could not tell
     * Approved from EndOfDay anyway. `enabled` is no help either: the click
     * handler re-enables the view a second after every tap, so a disabled
     * status renders as `enabled: true` (measured).
     */
    targetKey: NESY_TARGETS.tourApprovalRequestButton,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    displayName: "Request tour start button (stop list)",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "btn_out" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: true,
    },
  },
  /**
   * The routing chooser, measured in the same run: tapping the request button
   * does NOT call the backend. A dialog opens first — "Please select your route
   * optimization type!" — and only the choice made here issues
   * `Task/RequestLeavingPermission` with the `calculateRoute` flag set
   * accordingly. A slice that models the request as one tap never leaves this
   * dialog.
   *
   * Both name `nesy.tour.routing-dialog` as their surface, and the stop list only
   * as the screen underneath it. That pairing is what a `surfaceRef` is for: the
   * buttons do not exist on the stop list, they exist on a dialog the stop list
   * hosts, and the registry now says so — see `surfaces.ts` for why the surface's
   * policy is IGNORE rather than HANDLE.
   */
  {
    targetKey: NESY_TARGETS.tourRoutingAuto,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    surfaceRef: NESY_SURFACES.tourRoutingDialog,
    displayName: "Auto routing choice on the tour start dialog",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "auto_route" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: true,
    },
  },
  {
    /**
     * The close control of the push notification list, read off
     * `notification_dialog.xml`: an `ImageView` with
     * `android:id="@+id/btn_exit"`, `clickable="true"`, whose listener is a bare
     * `dismiss()` (StopListFragment ~5412).
     *
     * ID ONLY, and there is no second link to add: the view renders
     * `@drawable/ic_close` and carries no text at all, so TEXT_MATCH has nothing to
     * match and would be a strategy that reads as coverage while never firing —
     * the mistake `stop_row_*` and `route_row_*` already cost this registry twice.
     *
     * `notFoundPolicy: TREAT_AS_ABSENT`, like `dialogAcknowledge` and for the same
     * reason: this target is only ever resolved by an interrupt handler, and the
     * dialog can legitimately be gone by the time the handler runs — the courier's
     * own tap, or a `dismiss()` from a notification row, closes it. "It is already
     * closed" is success for a dismissal, not a failure to find a button.
     */
    targetKey: NESY_TARGETS.notificationListExit,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    surfaceRef: NESY_SURFACES.notificationListDialog,
    displayName: "Close button on the push notification list",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "btn_exit" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "TREAT_AS_ABSENT",
      deadlineMs: 8_000,
      reverifyBeforeAction: true,
    },
  },
  {
    targetKey: NESY_TARGETS.tourRoutingManual,
    applicationRef: APP,
    screenRef: NESY_SCREENS.routeStopList,
    surfaceRef: NESY_SURFACES.tourRoutingDialog,
    displayName: "Manual routing choice on the tour start dialog",
    resolution: {
      chain: [{ kind: "ACCESSIBILITY_ID", selector: { id: "manual_route" }, establishesIdentity: true }],
      ambiguityPolicy: "FAIL",
      notFoundPolicy: "FAIL",
      deadlineMs: 12_000,
      reverifyBeforeAction: true,
    },
  },
];
