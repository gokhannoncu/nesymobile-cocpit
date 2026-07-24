/**
 * Backend YAML Generator
 *
 * Generates a single Maestro YAML file from workflow nodes/edges.
 * Injects NESY_STEP::START/DONE markers for stdout-based step tracking.
 */

import {
  type NesyMobileCountry,
  type NesyMobileEnvironment,
  NESY_MOBILE_COUNTRIES,
  NESY_MOBILE_ENVIRONMENTS,
  resolveNesyMobileApplicationId,
} from "../nesy-mobile-env.js";
import { buildWorkflowIR, type IRNode } from "./workflow-ir.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SourceHandle = "default" | "true" | "false";

interface WorkflowNode {
  id: string;
  type: string;
  kind: string;
  position: { x: number; y: number };
  data: {
    title: string;
    subtitle?: string;
    config?: Record<string, unknown>;
  };
  parentId?: string | null;
  branchType?: "true" | "false" | null;
}

interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string | null;
  sourceHandle: SourceHandle;
  targetHandle: string | null;
  isPlaceholder?: boolean;
}

interface YamlGeneratorOptions {
  workflowId: string;
  runId: string;
  nodes: WorkflowNode[];
  edges: Connection[];
  environment?: string;
  country?: string;
  config?: Record<string, unknown>;
  /**
   * Run-time inputs (barcode, shipmentId, ...). Merged into the Maestro `env`
   * block and used to resolve `{{key}}` tokens in node config so one saved
   * workflow can run against different shipments. Overrides version `config`.
   */
  runInput?: Record<string, string>;
  /**
   * When set (e.g. single_step partial YAML that drops LAUNCH_APP), force this
   * applicationId instead of resolving from the sliced node list.
   */
  appIdOverride?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment Mapping (shared with frontend yaml-registry)
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Legacy combined keys kept for migration only. */
const AppEnvironmentMapping: Record<string, string> = {
  HR_STAGE: "com.arasdigital.nesymobile.test",
  HR_PROD: "com.arasdigital.nesymobileprod",
  SI_STAGE: "com.arasdigital.nesymobile.sitest",
  SI_PROD: "com.arasdigital.nesymobileprod.si",
  RS_STAGE: "com.arasdigital.nesymobile.rstest",
  RS_PROD: "com.arasdigital.nesymobileprod.rs",
  BA_STAGE: "com.arasdigital.nesymobile.batest",
  BA_PROD: "com.arasdigital.nesymobileprod.ba",
  ME_STAGE: "com.arasdigital.nesymobile.metest",
  ME_PROD: "com.arasdigital.nesymobileprod.me",
};

const DEFAULT_LAUNCH_COUNTRY: NesyMobileCountry = "HR";
const DEFAULT_LAUNCH_ENVIRONMENT: NesyMobileEnvironment = "stage";

function isLaunchCountry(value: unknown): value is NesyMobileCountry {
  return typeof value === "string" && NESY_MOBILE_COUNTRIES.includes(value as NesyMobileCountry);
}

function isLaunchEnvironment(value: unknown): value is NesyMobileEnvironment {
  return typeof value === "string" && NESY_MOBILE_ENVIRONMENTS.includes(value as NesyMobileEnvironment);
}

function resolveLaunchAppIdFromConfig(config: Record<string, unknown>): string {
  if (isLaunchCountry(config.country) && isLaunchEnvironment(config.environment)) {
    return resolveNesyMobileApplicationId(config.country, config.environment);
  }

  const environmentValue = config.environment;
  if (typeof environmentValue === "string" && environmentValue in AppEnvironmentMapping) {
    return (
      AppEnvironmentMapping[environmentValue] ??
      resolveNesyMobileApplicationId(DEFAULT_LAUNCH_COUNTRY, DEFAULT_LAUNCH_ENVIRONMENT)
    );
  }

  const country = isLaunchCountry(config.country) ? config.country : DEFAULT_LAUNCH_COUNTRY;
  const environment = isLaunchEnvironment(environmentValue) ? environmentValue : DEFAULT_LAUNCH_ENVIRONMENT;
  return resolveNesyMobileApplicationId(country, environment);
}

const DEFAULT_PIN_VIEW_ID = "com.arasdigital.nesymobile:id/pinView";
const DEFAULT_LOGIN_BUTTON_ID = "com.arasdigital.nesymobile:id/btn_login";
const DEFAULT_ROUTE_SPINNER_ID = "com.arasdigital.nesymobile:id/dialog_spinner";
const DEFAULT_ROUTE_OK_BUTTON_ID = "com.arasdigital.nesymobile:id/yesButton";

function resourceId(appId: string, viewId: string): string {
  return `${appId}:id/${viewId}`;
}

/**
 * Shared search interaction on the Stops screen (verified selector inventory:
 * FAB `close_search_bar` opens the bar, `tietSearchText` is the input,
 * `search_button` submits).
 */
function searchOnStopsYaml(appId: string, query: string): string {
  const searchFabId = resourceId(appId, "close_search_bar");
  const searchTextId = resourceId(appId, "tietSearchText");
  const searchButtonId = resourceId(appId, "search_button");
  return `- tapOn:
    id: "${searchFabId}"
- extendedWaitUntil:
    visible:
      id: "${searchTextId}"
    timeout: 3000
- tapOn:
    id: "${searchTextId}"
- eraseText: 50
- inputText: "${query}"
- tapOn:
    id: "${searchButtonId}"`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node -> YAML Mapping Functions
// ─────────────────────────────────────────────────────────────────────────────

function cfg(node: WorkflowNode): Record<string, unknown> {
  return node.data.config ?? {};
}

/**
 * Substitution variables for `{{token}}` placeholders in node config.
 * runInput wins over version config so a run can override saved values.
 */
function buildRunVars(options: YamlGeneratorOptions): Record<string, string> {
  const vars: Record<string, string> = {};
  if (options.config) {
    for (const [key, val] of Object.entries(options.config)) {
      if (typeof val === "string") vars[key] = val;
    }
  }
  if (options.runInput) {
    for (const [key, val] of Object.entries(options.runInput)) vars[key] = val;
  }
  return vars;
}

function substituteTokens(value: string, vars: Record<string, string>): string {
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");
}

/** Resolves `{{token}}` placeholders in every string (and string-array) config value. */
function resolveConfig(config: Record<string, unknown>, vars: Record<string, string>): Record<string, unknown> {
  if (Object.keys(vars).length === 0) return config;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(config)) {
    if (typeof val === "string") out[key] = substituteTokens(val, vars);
    else if (Array.isArray(val)) {
      out[key] = val.map((item) => (typeof item === "string" ? substituteTokens(item, vars) : item));
    } else out[key] = val;
  }
  return out;
}

function str(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

function num(val: unknown, fallback = 5000): number {
  return typeof val === "number" ? val : fallback;
}

function bool(val: unknown, fallback = false): boolean {
  return typeof val === "boolean" ? val : fallback;
}

/**
 * Collects barcodes from a node config that may carry either a singular
 * `barcode` (UI schema) or a plural `barcodes[]` (API-authored / multicolli).
 * Comma-separated values in a single string are split (LOAD & TOUR runInput).
 * Empty strings are dropped.
 */
function collectBarcodes(c: Record<string, unknown>): string[] {
  const out: string[] = [];
  const pushParts = (raw: string) => {
    for (const part of raw.split(",")) {
      const t = part.trim();
      if (t && !out.includes(t)) out.push(t);
    }
  };
  if (Array.isArray(c.barcodes)) {
    for (const item of c.barcodes) if (typeof item === "string") pushParts(item);
  }
  const single = str(c.barcode).trim();
  if (single) pushParts(single);
  return out;
}

/** Clear overlays that block Stop List (notifications sheet / route picker). */
function clearStopListOverlaysYaml(appId: string, routeNumber = "36"): string {
  const spinnerId = resourceId(appId, "dialog_spinner");
  const notifListId = resourceId(appId, "rv_notifications");
  const btnExitId = resourceId(appId, "btn_exit");
  return `# --- Clear Stop List overlays ---
- runFlow:
    when:
      visible:
        id: "${notifListId}"
    commands:
      - tapOn:
          id: "${btnExitId}"
      - waitForAnimationToEnd
- runFlow:
    when:
      visible:
        text: "PRINT"
    commands:
      - pressKey: Back
- runFlow:
    when:
      visible:
        id: "${spinnerId}"
    commands:
      - tapOn:
          id: "${spinnerId}"
      - waitForAnimationToEnd
      - scrollUntilVisible:
          element:
            text: "${routeNumber}.*"
          direction: DOWN
          speed: 15
          visibilityPercentage: 10
          timeout: 20000
      - tapOn:
          text: "${routeNumber}.*"
      - waitForAnimationToEnd
      - tapOn:
          text: "OK"
      - waitForAnimationToEnd
`;
}

/** Stop-list manual scan → optional Attention dialog → options-sheet button. */
function stopListScanOptionYaml(appId: string, barcode: string, optionButtonResId: string): string {
  const manuelInputId = resourceId(appId, "manuel_input");
  const barcodeInputId = resourceId(appId, "et_input_dialog_barcode_number");
  const barcodeOkId = resourceId(appId, "btn_ok");
  const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
  const optionId = resourceId(appId, optionButtonResId);
  const optionsRootId = resourceId(appId, "rootDeliveryOptions");
  const swipeRefreshId = resourceId(appId, "srl");
  return `${clearStopListOverlaysYaml(appId)}# --- Stop-list scan → ${optionButtonResId} ---
- extendedWaitUntil:
    visible:
      id: "${manuelInputId}"
    timeout: 20000
# Pull-to-refresh so freshly zimmet'ted parcels appear before scan
- runFlow:
    when:
      visible:
        id: "${swipeRefreshId}"
    commands:
      - swipe:
          start: "50%, 30%"
          end: "50%, 75%"
          duration: 400
      - waitForAnimationToEnd
- tapOn:
    id: "${manuelInputId}"
- extendedWaitUntil:
    visible:
      id: "${barcodeInputId}"
    timeout: 8000
- tapOn:
    id: "${barcodeInputId}"
- eraseText: 40
- inputText: "${barcode}"
- tapOn:
    id: "${barcodeOkId}"
- waitForAnimationToEnd
# Attention / document-collection confirm (optional)
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"
      - waitForAnimationToEnd
# Wait for options bottom sheet (network + fragment transition)
- extendedWaitUntil:
    visible:
      id: "${optionsRootId}"
    timeout: 20000
    optional: true
- extendedWaitUntil:
    visible:
      id: "${optionId}"
    timeout: 20000
- tapOn:
    id: "${optionId}"
`;
}

function nodeYaml(node: WorkflowNode, options: YamlGeneratorOptions, appId: string): string {
  const c = resolveConfig(cfg(node), buildRunVars(options));
  const pinViewId = resourceId(appId, "pinView");
  const loginButtonId = resourceId(appId, "btn_login");

  switch (node.type) {
    case "LAUNCH_APP": {
      const resolvedAppId = resolveLaunchAppIdFromConfig(c);
      const clearState = bool(c.clearState);
      const manuelInputId = resourceId(resolvedAppId, "manuel_input");
      const pinViewId = resourceId(resolvedAppId, "pinView");
      const btnOutId = resourceId(resolvedAppId, "btn_out");
      // After relaunch, wait until either login or Stop List is interactive so
      // the next scan step does not race SplashActivity.
      // Screen-readiness probes: exactly one of pinView / manuel_input / btn_out
      // is ever present, so the other two ALWAYS burn their full timeout. Because
      // they are `optional`, they give no correctness guarantee (the flow proceeds
      // regardless) — the downstream IF_LOGIN / CHECK_ROUTE steps carry the real
      // gates. Short timeouts here just clear SplashActivity without dead-waiting
      // ~25s on the two non-matching probes.
      //
      // No post-launch `waitForAnimationToEnd` (it cost ~3.5s of screenshot-diffing
      // on cold start): the extendedWaitUntil probes below poll the hierarchy and
      // tolerate an animating screen, so they provide the real settle.
      //
      // No inline Samsung "app compatibility" dialog guard either — checking for it
      // every run cost ~6.9s (a cold-start waitForIdle hierarchy fetch) for a dialog
      // that only appears after install/data-clear. It's dismissed once per device in
      // DeviceWorker.prepare() (dismissCompatDialogOnce) instead.
      return `- launchApp:
    appId: "${resolvedAppId}"
    clearState: ${clearState}
- extendedWaitUntil:
    visible:
      id: "${pinViewId}"
    timeout: 3000
    optional: true
- extendedWaitUntil:
    visible:
      id: "${manuelInputId}"
    timeout: 2500
    optional: true
- extendedWaitUntil:
    visible:
      id: "${btnOutId}"
    timeout: 2500
    optional: true`;
    }

    case "AUTH_LOGIN": {
      const pinCode = str(c.pinCode, "0000");
      // The pinView tap is REQUIRED — the PIN field does NOT reliably auto-focus on
      // the login screen (verified on device: inputText without a preceding tap is
      // silently dropped and login stays on the PIN screen). It costs ~3s to Maestro's
      // hierarchyBasedTap, but removing it regresses login. Keep the tap.
      return `- tapOn:
    id: "${pinViewId}"
- inputText: "${pinCode}"
- tapOn:
    id: "${loginButtonId}"`;
    }

    case "IF_LOGIN":
      return ""; // handled separately as conditional

    case "CHECK_ROUTE":
      return ""; // handled separately as conditional

    case "SELECT_ROUTE": {
      const routeNumber = str(c.routeNumber ?? c.route, "1");
      const spinnerId = resourceId(appId, "dialog_spinner");
      // Automation-bridge route selection (replaces the ~20s UI scroll+tap).
      // The route/hub list is still fetched from the service normally; once the
      // "Please Select Route" dialog is up we emit a NESY_SELECT_ROUTE marker.
      // The runner parses it (maestro-executor) and fires the TestNavigationReceiver
      // `select_route` broadcast, which drives StopListFragment.selectRouteProgrammatically
      // — the exact confirmation path a courier tap runs (SP.route write,
      // createEmptySchedule, ROUTE_SELECTED emit), no scroll/tap and no
      // hierarchyBasedTap tax. Maestro then just waits for the dialog to close
      // (route applied → StopList loads); a failed bridge call leaves the spinner
      // up and this wait times out → the step fails loudly (never a silent pass).
      return `# --- SELECT ROUTE ${routeNumber} (automation bridge) ---
- extendedWaitUntil:
    visible:
      id: "${spinnerId}"
    timeout: 15000
- evalScript: \${console.log("NESY_SELECT_ROUTE::${node.id}::${routeNumber}")}
- extendedWaitUntil:
    notVisible:
      id: "${spinnerId}"
    timeout: 20000`;
    }

    case "VALIDATE_STOPLIST": {
      // Soft assert Stop List readiness — never hard-fail the Maestro process.
      // Pull-to-refresh nudges GetMyScheduleByZoneCode when srl is present.
      // Hard backend gate runs after Maestro (server-steps.ts): device JWT +
      // GET_KEY → Task/GetMyScheduleByZoneCode (+ admin schedule cross-check).
      const srlId = resourceId(appId, "srl");
      const rvId = resourceId(appId, "rv");
      const btnOutId = resourceId(appId, "btn_out");
      // All three waits are `optional` (soft readiness checks — the hard gate is
      // the post-Maestro backend server step). btn_out is the real readiness
      // signal; rv/second-btn_out are confirmations that cost their full timeout
      // whenever the list id differs or the list is empty. Bounded low so an
      // absent element costs ~3s instead of ~15-20s.
      // No leading waitForAnimationToEnd: the preceding step (CHECK_ROUTE / OK tap)
      // already settled, and the btn_out extendedWaitUntil below polls the screen,
      // so it saves one screenshot-loop + hierarchy cycle for nothing lost.
      return `# --- VALIDATE STOPLIST ---
- extendedWaitUntil:
    visible:
      id: "${btnOutId}"
    timeout: 8000
    optional: true
- runFlow:
    when:
      visible:
        id: "${srlId}"
    commands:
      - swipe:
          start: "50%, 25%"
          end: "50%, 70%"
          duration: 400
- waitForAnimationToEnd
- extendedWaitUntil:
    visible:
      id: "${rvId}"
    timeout: 3000
    optional: true
- extendedWaitUntil:
    visible:
      id: "${btnOutId}"
    timeout: 2500
    optional: true`;
    }

    case "LOAD_TO_VEHICLE": {
      const barcodes = collectBarcodes(c);
      const manuelInputId = resourceId(appId, "manuel_input");
      const barcodeInputId = resourceId(appId, "et_input_dialog_barcode_number");
      const barcodeOkId = resourceId(appId, "btn_ok");
      const dialogTitleId = resourceId(appId, "tv_arasDg_title");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      // RS ScanProcessor shows SingleChoicePickerDialogFragment ("Select Time Range")
      // between FETCH_SHIPMENT and CREATE_TASK when hub time slots exist.
      const timeSlotSaveId = resourceId(appId, "btnSave");
      const timeSlotLabel = str(c.timeSlot, ""); // optional exact label e.g. "07:00 - 09:00"
      const timeSlotPick =
        timeSlotLabel.length > 0
          ? `- tapOn: "${timeSlotLabel}"\n      - tapOn:\n          id: "${timeSlotSaveId}"`
          : `- tapOn:\n          id: "${timeSlotSaveId}"`;
      if (barcodes.length === 0) {
        return `# --- LOAD TO VEHICLE (no barcode) ---
- evalScript: \${console.log("NESY_STEP::WARN::LOAD_TO_VEHICLE::empty_barcode")}`;
      }
      let yaml = `# --- LOAD TO VEHICLE (${barcodes.length} barcode(s)) ---
${clearStopListOverlaysYaml(appId)}- extendedWaitUntil:
    visible:
      id: "${manuelInputId}"
    timeout: 20000`;
      for (const barcode of barcodes) {
        yaml += `
# Recover to Stop List before each scan (post-scan dialogs / overlays)
${clearStopListOverlaysYaml(appId)}- runFlow:
    when:
      notVisible:
        id: "${manuelInputId}"
    commands:
      - pressKey: Back
      - waitForAnimationToEnd
- extendedWaitUntil:
    visible:
      id: "${manuelInputId}"
    timeout: 20000
- tapOn:
    id: "${manuelInputId}"
- extendedWaitUntil:
    visible:
      id: "${barcodeInputId}"
    timeout: 8000
- tapOn:
    id: "${barcodeInputId}"
- eraseText: 40
- inputText: "${barcode}"
- tapOn:
    id: "${barcodeOkId}"
- waitForAnimationToEnd
# ScanProcessor — HUB_WARNING / GENERIC_ERROR (longer: network + parse)
- extendedWaitUntil:
    visible:
      id: "${dialogTitleId}"
    timeout: 8000
    optional: true
- runFlow:
    when:
      visible:
        id: "${dialogTitleId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"
      - waitForAnimationToEnd
# RS time slot picker — blocks CREATE_TASK until Select
- extendedWaitUntil:
    visible:
      text: "Select Time Range"
    timeout: 8000
    optional: true
- runFlow:
    when:
      visible:
        text: "Select Time Range"
    commands:
      ${timeSlotPick}
      - waitForAnimationToEnd
# CREATE_TASK stage — second dialog may appear
- extendedWaitUntil:
    visible:
      id: "${dialogTitleId}"
    timeout: 6000
    optional: true
- runFlow:
    when:
      visible:
        id: "${dialogTitleId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"
      - waitForAnimationToEnd
# Hard signal that zimmet applied — barcode must appear on a stop card.
# Without this, Maestro exits 0 even when ScanProcessor silently drops
# (matchedItem null) and the parcel never lands on the schedule.
- extendedWaitUntil:
    visible:
      text: "${barcode}"
    timeout: 20000
- waitForAnimationToEnd`;
      }
      return yaml;
    }

    case "SEARCH_SHIPMENT": {
      const trackingNumber = str(c.trackingNumber, "");
      return searchOnStopsYaml(appId, trackingNumber);
    }

    case "SEARCH_PARCEL": {
      // UI schema: barcode / legacySystemShortBarcode / trimmed variant.
      const parcelQuery =
        str(c.barcode) ||
        str(c.legacySystemShortBarcode) ||
        str(c.legacySystemShortBarcodeTrim) ||
        str(c.parcelId);
      return searchOnStopsYaml(appId, parcelQuery);
    }

    case "SEARCH_STOP": {
      // UI schema field is `stopOrder`; keep legacy `stopId` as a fallback.
      const stopOrder = str(c.stopOrder, str(c.stopId, ""));
      return searchOnStopsYaml(appId, stopOrder);
    }

    case "REQUEST_TOUR_START":
      return `# --- REQUEST TOUR START FLOW ---
- tapOn:
    id: "${appId}:id/btn_out"
- runFlow:
    when:
      visible:
        id: "${appId}:id/btn_arasDg_positive_button"
    commands:
      - tapOn:
          id: "${appId}:id/btn_arasDg_positive_button"
- runFlow:
    when:
      visible:
        id: "${appId}:id/auto_route"
    commands:
      - tapOn:
          id: "${appId}:id/auto_route"`;

    case "END_OF_DAY": {
      // Schedule must be Approved; btn_out reads "End Of Tour" and triggers the
      // mobile Task/RequestScheduleEndOfDay, then an ArasDialog confirmation.
      // Server-side approval (ApproveScheduleEndOfDay) is a separate EOD_APPROVE step.
      const btnOutId = resourceId(appId, "btn_out");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      return `# --- END OF DAY (request) ---
- extendedWaitUntil:
    visible:
      id: "${btnOutId}"
    timeout: 10000
- tapOn:
    id: "${btnOutId}"
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;
    }

    case "TOUR_APPROVE":
    case "PICKUP_ASSIGN":
    case "EOD_APPROVE": {
      // Executed server-side after Maestro (see server-steps.ts). The marker keeps
      // the node visible in step tracking; its completionPolicy requires the
      // "backend" oracle, which the server phase resolves.
      return `- evalScript: \${console.log("NESY_SERVER_STEP::${node.id}::${node.type}")}`;
    }

    case "OPEN_SHIPMENT": {
      const barcode = str(c.barcode, str(c.trackingNumber, ""));
      const searchFabId = resourceId(appId, "close_search_bar");
      const searchTextId = resourceId(appId, "tietSearchText");
      const searchButtonId = resourceId(appId, "search_button");
      const stopCardId = resourceId(appId, "stopCard");
      return `# --- SHIPMENT SEARCH & OPEN ---
- tapOn:
    id: "${searchFabId}"
- extendedWaitUntil:
    visible:
      id: "${searchTextId}"
    timeout: 3000
- tapOn:
    id: "${searchTextId}"
- eraseText: 50
- inputText: "${barcode}"
- tapOn:
    id: "${searchButtonId}"
# Wait for the search result card (SEARCH_STOP logcat event lands in parallel)
- extendedWaitUntil:
    visible:
      id: "${stopCardId}"
    timeout: 10000
- tapOn:
    index: 0
    id: "${stopCardId}"`;
    }

    case "OPEN_PARCEL": {
      const trackingNumber = str(c.trackingNumber, "");
      const searchFabId = resourceId(appId, "close_search_bar");
      const searchTextId = resourceId(appId, "tietSearchText");
      const searchButtonId = resourceId(appId, "search_button");
      const stopCardId = resourceId(appId, "stopCard");
      return `# --- PARCEL SEARCH & OPEN ---
- tapOn:
    id: "${searchFabId}"
- extendedWaitUntil:
    visible:
      id: "${searchTextId}"
    timeout: 3000
- tapOn:
    id: "${searchTextId}"
- eraseText: 50
- inputText: "${trackingNumber}"
- tapOn:
    id: "${searchButtonId}"
# Wait for the search result card (SEARCH_STOP logcat event lands in parallel)
- extendedWaitUntil:
    visible:
      id: "${stopCardId}"
    timeout: 10000
- tapOn:
    index: 0
    id: "${stopCardId}"`;
    }

    case "OPEN_STOP": {
      // stop_item_<n> is a gated automation contentDescription set by
      // StopsAdapter (n = stopOrder); Maestro's text selector matches it.
      // UI schema field is `stopOrder`; keep legacy `stopIndex` as a fallback.
      const stopIndex = str(c.stopOrder, str(c.stopIndex, "0"));
      return `- tapOn: "stop_item_${stopIndex}"`;
    }

    case "SCAN_BARCODE": {
      const barcode = str(c.barcode, "");
      const manuelInputId = resourceId(appId, "manuel_input");
      const barcodeInputId = resourceId(appId, "et_input_dialog_barcode_number");
      const btnOkId = resourceId(appId, "btn_ok");

      return `# --- SCAN BARCODE ON TASK LIST (Manual Input Dialog) ---
# 1. Press manual input icon in toolbar
- tapOn:
    id: "${manuelInputId}"
# 2. Wait for dialog to open
- extendedWaitUntil:
    visible:
      id: "${barcodeInputId}"
    timeout: 5000
# 3. Click barcode input field and write barcode
- tapOn:
    id: "${barcodeInputId}"
- inputText: "${barcode}"
# 4. Press OK button -> processBarcodeTransaction -> navigate to DeliveryFragment
# (SCAN_PARCEL success/failure is decided by the logcat event handler)
- tapOn:
    id: "${btnOkId}"`;
    }

    case "DELIVERY_OPERATION": {
      const waitBeforeDelivery = num(c.waitBeforeDelivery, 0);
      const deliveryNameId = resourceId(appId, "tie_delivery_name");
      const signaturePadId = resourceId(appId, "signature_pad_rl");
      const btnDeliverId = resourceId(appId, "btn_deliver");
      const btnDelyId = resourceId(appId, "btnDely");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      // When barcode is provided, enter via Stop List scan → options sheet (PATH-NOTES).
      const entryBarcode = collectBarcodes(c)[0] || str(c.shipmentRef).trim();

      let yaml = `# --- DELIVER PARCEL FLOW ---`;
      if (entryBarcode) {
        yaml += `\n${stopListScanOptionYaml(appId, entryBarcode, "btnDelivery")}`;
      }
      yaml += `
# 1. Wait for delivery form
- extendedWaitUntil:
    visible:
      id: "${deliveryNameId}"
    timeout: 10000`;

      if (waitBeforeDelivery > 0) {
        yaml += `\n# Wait before delivery: ${waitBeforeDelivery}ms\n- extendedWaitUntil:\n    visible:\n      id: "nesy_wait_never_matches"\n    timeout: ${waitBeforeDelivery}\n    optional: true`;
      }

      const personName = str(c.personDelivered, "") || "${TASK_PARTY}";
      yaml += `
# 2. Fill Person Delivered field and hide keyboard
- tapOn:
    id: "${deliveryNameId}"
- inputText: "${personName}"
- pressKey: Enter
- hideKeyboard`;



      yaml += `
# 3. Scroll down until Delivery button is visible
- scrollUntilVisible:
    element:
      id: "${btnDeliverId}"
    direction: DOWN
    timeout: 10000`;

      yaml += `
# 4. Draw signature (wider swipe)
- swipe:
    start: "30%, 75%"
    end: "70%, 75%"
    duration: 400`;

      yaml += `
# Wait for UI to settle before tapping delivery button
- waitForAnimationToEnd:
    timeout: 2000`;

      yaml += `
# 5. Press Delivery button
- tapOn:
    id: "${btnDeliverId}"`;

      yaml += `
# --- DIALOG MANAGEMENT ---
# (Optional) DELY/DEPS selection dialog
- runFlow:
    when:
      visible:
        id: "${btnDelyId}"
    commands:
      - tapOn:
          id: "${btnDelyId}"`;

      yaml += `
# (Optional) "Are you sure?" dialog
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;

      yaml += `
# (Optional) Payment dialog
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;

      // COD / payment: always attempt Cash (optional). RS COD shipments block
      // DELY until a tender is chosen — without this, Maestro finishes while
      // the parcel stays Loaded on device.
      {
        const invoiceSummaryId = resourceId(appId, "tvInvoiceSummary");
        const notifListId = resourceId(appId, "rv_notifications");
        const btnExitId = resourceId(appId, "btn_exit");
        yaml += `
# (Optional) COD cash / card tender
- extendedWaitUntil:
    visible:
      text: "Cash"
    timeout: 8000
    optional: true
- runFlow:
    when:
      visible:
        text: "Cash"
    commands:
      - tapOn:
          text: "Cash"
      - waitForAnimationToEnd
- runFlow:
    when:
      visible:
        text: "Credit Card"
    commands:
      - tapOn:
          text: "Credit Card"
      - waitForAnimationToEnd
# Fiscal invoice summary can take several seconds after tender
- extendedWaitUntil:
    visible:
      id: "${invoiceSummaryId}"
    timeout: 25000
    optional: true
- runFlow:
    when:
      visible:
        id: "${invoiceSummaryId}"
    commands:
      - pressKey: Back
      - waitForAnimationToEnd
# Sticky "Fiscal Created" notification
- runFlow:
    when:
      visible:
        id: "${notifListId}"
    commands:
      - tapOn:
          id: "${btnExitId}"
      - waitForAnimationToEnd`;
      }

      // Completion is verified by the logcat DELIVER_PARCEL handler (BACKEND_CONFIRMED)
      // and, when verifyBackend is set, by the server-side event poller (NESY_BACKEND_CHECK).
      return yaml;
    }

    case "PICKUP_OPERATION": {
      // PATH-NOTES: Stop List scan → "Pick Up" dialog → (task) scan again →
      // complete_task / btn_task_complete. UI schema: barcode; API: barcodes[].
      const barcodes = collectBarcodes(c);
      const manuelInputId = resourceId(appId, "manuel_input");
      const barcodeInputId = resourceId(appId, "et_input_dialog_barcode_number");
      const barcodeOkId = resourceId(appId, "btn_ok");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      const taskCompleteId = resourceId(appId, "btn_task_complete");
      const completeTaskId = resourceId(appId, "complete_task");
      const primary = barcodes[0] || "";

      let yaml = `# --- PICKUP OPERATION ---`;
      if (primary) {
        yaml += `
- tapOn:
    id: "${manuelInputId}"
- extendedWaitUntil:
    visible:
      id: "${barcodeInputId}"
    timeout: 5000
- tapOn:
    id: "${barcodeInputId}"
- eraseText: 40
- inputText: "${primary}"
- tapOn:
    id: "${barcodeOkId}"
# "Which operation…?" → Pick Up
- extendedWaitUntil:
    visible:
      id: "${dialogPositiveId}"
    timeout: 8000
- tapOn:
    id: "${dialogPositiveId}"
- waitForAnimationToEnd`;
      }
      // Second scan on task / multi-piece dialog (optional if single-piece auto-queued)
      for (const barcode of barcodes) {
        yaml += `
- runFlow:
    when:
      visible:
        id: "${manuelInputId}"
    commands:
      - tapOn:
          id: "${manuelInputId}"
      - extendedWaitUntil:
          visible:
            id: "${barcodeInputId}"
          timeout: 5000
      - tapOn:
          id: "${barcodeInputId}"
      - eraseText: 40
      - inputText: "${barcode}"
      - tapOn:
          id: "${barcodeOkId}"`;
      }
      yaml += `
- runFlow:
    when:
      visible:
        id: "${completeTaskId}"
    commands:
      - tapOn:
          id: "${completeTaskId}"
- runFlow:
    when:
      visible:
        id: "${taskCompleteId}"
    commands:
      - tapOn:
          id: "${taskCompleteId}"`;
      return yaml;
    }

    case "DEPS_OPERATION": {
      // PATH-NOTES: Stop List scan → btnDeps → delivery form (isDeps) → btn_deliver
      // → chooser btnDeps → confirm dialog.
      const entryBarcode = collectBarcodes(c)[0] || str(c.shipmentRef).trim();
      const deliveryNameId = resourceId(appId, "tie_delivery_name");
      const btnDeliverId = resourceId(appId, "btn_deliver");
      const btnDepsId = resourceId(appId, "btnDeps");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      const personName = str(c.personDelivered, "") || "${TASK_PARTY}";
      let yaml = `# --- DEPS OPERATION ---`;
      if (entryBarcode) {
        yaml += `\n${stopListScanOptionYaml(appId, entryBarcode, "btnDeps")}`;
      } else {
        yaml += `
- extendedWaitUntil:
    visible:
      id: "${btnDepsId}"
    timeout: 5000
- tapOn:
    id: "${btnDepsId}"`;
      }
      yaml += `
- extendedWaitUntil:
    visible:
      id: "${deliveryNameId}"
    timeout: 10000
- tapOn:
    id: "${deliveryNameId}"
- inputText: "${personName}"
- pressKey: Enter
- hideKeyboard
- scrollUntilVisible:
    element:
      id: "${btnDeliverId}"
    direction: DOWN
    timeout: 10000
- swipe:
    start: "30%, 75%"
    end: "70%, 75%"
    duration: 400
- waitForAnimationToEnd:
    timeout: 2000
- tapOn:
    id: "${btnDeliverId}"
# Chooser may take a network round-trip (getEventTypeList) before AreYouSure
- extendedWaitUntil:
    visible:
      id: "${btnDepsId}"
    timeout: 15000
    optional: true
- runFlow:
    when:
      visible:
        id: "${btnDepsId}"
    commands:
      - tapOn:
          id: "${btnDepsId}"
- extendedWaitUntil:
    visible:
      id: "${dialogPositiveId}"
    timeout: 15000
    optional: true
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"
      - waitForAnimationToEnd
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;
      return yaml;
    }

    case "REMOTE_PICKUP_OPERATION": {
      // Same stop-list entry as PICKUP (options dialog → Pick Up), then task complete.
      const barcodes = collectBarcodes(c);
      const manuelInputId = resourceId(appId, "manuel_input");
      const barcodeInputId = resourceId(appId, "et_input_dialog_barcode_number");
      const barcodeOkId = resourceId(appId, "btn_ok");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      const taskCompleteId = resourceId(appId, "btn_task_complete");
      const completeTaskId = resourceId(appId, "complete_task");
      const primary = barcodes[0] || "";
      let yaml = `# --- REMOTE PICKUP OPERATION ---`;
      if (primary) {
        yaml += `
${clearStopListOverlaysYaml(appId)}- extendedWaitUntil:
    visible:
      id: "${manuelInputId}"
    timeout: 20000
- tapOn:
    id: "${manuelInputId}"
- extendedWaitUntil:
    visible:
      id: "${barcodeInputId}"
    timeout: 8000
- tapOn:
    id: "${barcodeInputId}"
- eraseText: 40
- inputText: "${primary}"
- tapOn:
    id: "${barcodeOkId}"
- extendedWaitUntil:
    visible:
      id: "${dialogPositiveId}"
    timeout: 10000
- tapOn:
    id: "${dialogPositiveId}"
- waitForAnimationToEnd`;
      }
      for (const barcode of barcodes) {
        yaml += `
- runFlow:
    when:
      visible:
        id: "${manuelInputId}"
    commands:
      - tapOn:
          id: "${manuelInputId}"
      - extendedWaitUntil:
          visible:
            id: "${barcodeInputId}"
          timeout: 5000
      - tapOn:
          id: "${barcodeInputId}"
      - eraseText: 40
      - inputText: "${barcode}"
      - tapOn:
          id: "${barcodeOkId}"`;
      }
      yaml += `
- extendedWaitUntil:
    visible:
      id: "${completeTaskId}"
    timeout: 15000
    optional: true
- runFlow:
    when:
      visible:
        id: "${completeTaskId}"
    commands:
      - tapOn:
          id: "${completeTaskId}"
- runFlow:
    when:
      visible:
        id: "${taskCompleteId}"
    commands:
      - tapOn:
          id: "${taskCompleteId}"`;
      return yaml;
    }

    case "PICKUP_AT_CUSTOMER_OPERATION":
    case "RDOC_OPERATION": {
      // On the "Waiting For Pickup" task the barcodes are scanned via the manual
      // input dialog; the app then shows dialog_pickup_at_remote ("Please scan
      // all the barcodes") and the shared complete_task button confirms.
      // RDOC carries deliveryBarcode/pickupBarcode; PAC/remote carry barcode(s).
      const completeTaskId = resourceId(appId, "complete_task");
      const manuelInputId = resourceId(appId, "manuel_input");
      const barcodeInputId = resourceId(appId, "et_input_dialog_barcode_number");
      const barcodeOkId = resourceId(appId, "btn_ok");

      const barcodes = collectBarcodes(c);
      for (const extra of [c.deliveryBarcode, c.pickupBarcode]) {
        const b = str(extra).trim();
        if (b && !barcodes.includes(b)) barcodes.push(b);
      }

      let yaml = `# --- ${node.type} (confirm via dialog_pickup_at_remote) ---`;
      for (const barcode of barcodes) {
        yaml += `
- tapOn:
    id: "${manuelInputId}"
- extendedWaitUntil:
    visible:
      id: "${barcodeInputId}"
    timeout: 5000
- tapOn:
    id: "${barcodeInputId}"
- inputText: "${barcode}"
- tapOn:
    id: "${barcodeOkId}"`;
      }
      yaml += `
- extendedWaitUntil:
    visible:
      id: "${completeTaskId}"
    timeout: 10000
- tapOn:
    id: "${completeTaskId}"`;
      return yaml;
    }

    case "LOS_OPERATION": {
      // LOS entry is btnD4Me in the delivery-options bottom sheet; locker-type
      // chooser (icon_los) and an ArasDialog confirmation may follow.
      const btnD4MeId = resourceId(appId, "btnD4Me");
      const iconLosId = resourceId(appId, "icon_los");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      return `# --- LOS OPERATION ---
- tapOn:
    id: "${btnD4MeId}"
- runFlow:
    when:
      visible:
        id: "${iconLosId}"
    commands:
      - tapOn:
          id: "${iconLosId}"
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;
    }

    case "DELIVERY_FAIL_OPERATION": {
      // Stop List scan → btnDeliveryFailed → btn_deliver → fail_reason_<code>.
      const failReason = str(c.failReason) || str(c.failureReason, "15");
      const entryBarcode = collectBarcodes(c)[0] || str(c.shipmentRef).trim();
      const btnDeliverId = resourceId(appId, "btn_deliver");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      let yaml = `# --- DELIVERY FAIL OPERATION (reason code: ${failReason}) ---`;
      if (entryBarcode) {
        yaml += `\n${stopListScanOptionYaml(appId, entryBarcode, "btnDeliveryFailed")}`;
      } else {
        const btnDeliveryFailedId = resourceId(appId, "btnDeliveryFailed");
        yaml += `
- runFlow:
    when:
      visible:
        id: "${btnDeliveryFailedId}"
    commands:
      - tapOn:
          id: "${btnDeliveryFailedId}"`;
      }
      yaml += `
- extendedWaitUntil:
    visible:
      id: "${btnDeliverId}"
    timeout: 10000
- tapOn:
    id: "${btnDeliverId}"
- extendedWaitUntil:
    visible: "fail_reason_${failReason}"
    timeout: 8000
- tapOn: "fail_reason_${failReason}"
- waitForAnimationToEnd
# Confirm / navigate after reason (photo path or AreYouSure)
- extendedWaitUntil:
    visible:
      id: "${dialogPositiveId}"
    timeout: 8000
    optional: true
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"
- runFlow:
    when:
      visible:
        text: "OK"
    commands:
      - tapOn:
          text: "OK"
- waitForAnimationToEnd`;
      return yaml;
    }

    case "PICKUP_FAIL_OPERATION": {
      // Stop List scan → "Pickup Failed" (negative) → fail_reason_<code>.
      // Fallback: task-card btn_not_deliver when already on the task.
      const failReason = str(c.failReason) || str(c.failureReason, "43");
      const entryBarcode = collectBarcodes(c)[0] || str(c.shipmentRef).trim();
      const manuelInputId = resourceId(appId, "manuel_input");
      const barcodeInputId = resourceId(appId, "et_input_dialog_barcode_number");
      const barcodeOkId = resourceId(appId, "btn_ok");
      const dialogNegativeId = resourceId(appId, "btn_arasDg_negative_button");
      const btnNotDeliverId = resourceId(appId, "btn_not_deliver");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      let yaml = `# --- PICKUP FAIL OPERATION (reason code: ${failReason}) ---`;
      if (entryBarcode) {
        yaml += `
- tapOn:
    id: "${manuelInputId}"
- extendedWaitUntil:
    visible:
      id: "${barcodeInputId}"
    timeout: 5000
- tapOn:
    id: "${barcodeInputId}"
- eraseText: 40
- inputText: "${entryBarcode}"
- tapOn:
    id: "${barcodeOkId}"
- extendedWaitUntil:
    visible:
      id: "${dialogNegativeId}"
    timeout: 8000
- tapOn:
    id: "${dialogNegativeId}"`;
      } else {
        yaml += `
- tapOn:
    id: "${btnNotDeliverId}"`;
      }
      yaml += `
- extendedWaitUntil:
    visible: "fail_reason_${failReason}"
    timeout: 10000
- scrollUntilVisible:
    element: "fail_reason_${failReason}"
    direction: DOWN
    timeout: 10000
    optional: true
- tapOn: "fail_reason_${failReason}"
- waitForAnimationToEnd
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;
      return yaml;
    }

    case "CANCEL_DELIVERY_OPERATION": {
      // Reservation cancel: btn_not_deliver → ArasDialog reason list; rows
      // carry the gated aras_dialog_item_<position> contentDescription and
      // tapping the row completes the cancellation.
      const cancelReasonIndex = str(c.cancelReason, "0");
      const btnNotDeliverId = resourceId(appId, "btn_not_deliver");
      return `# --- CANCEL DELIVERY / RESERVATION (reason index: ${cancelReasonIndex}) ---
- tapOn:
    id: "${btnNotDeliverId}"
- extendedWaitUntil:
    visible: "aras_dialog_item_${cancelReasonIndex}"
    timeout: 5000
- tapOn: "aras_dialog_item_${cancelReasonIndex}"`;
    }

    case "CONDITION":
      return ""; // handled separately as conditional

    case "WAIT": {
      const timeout = num(c.timeout, 5000);
      // Maestro-native wait: extendedWaitUntil on a selector that never matches,
      // with optional:true, blocks for exactly `timeout` without failing — no
      // synthetic swipe input reaches the app.
      return `# --- WAIT: ${timeout}ms ---
- evalScript: \${console.log("NESY_WAIT::${node.id}::${timeout}")}
- extendedWaitUntil:
    visible:
      id: "nesy_wait_never_matches"
    timeout: ${timeout}
    optional: true`;
    }

    case "ASSERT_VISIBLE": {
      // `selector` is an alias for elementId (resource id); `text` matches label.
      const elementId = str(c.elementId) || str(c.selector);
      const text = str(c.text);
      if (elementId) {
        return `- assertVisible:
    id: "${elementId}"`;
      }
      if (text) {
        return `- assertVisible:
    text: "${text}"`;
      }
      return `- assertVisible:
    id: "unknown_element"`;
    }

    case "VERIFY_BACKEND_STATE": {
      const taskId = str(c.taskId, "");
      return `- assertVisible:
    id: "nesy_auto_verify_placeholder"
- evalScript: \${console.log("NESY_VERIFY::WAITING::${node.id}::${taskId}")}`;
    }

    case "HTTP_REQUEST": {
      const url = str(c.url, "");
      const method = str(c.method, "GET");
      return `- evalScript: \${console.log("NESY_STEP::HTTP_REQUEST::${node.id}::${method}::${url}")}`;
    }

    case "DATABASE_QUERY": {
      const query = str(c.query, "");
      return `- evalScript: \${console.log("NESY_STEP::DATABASE_QUERY::${node.id}::${query.substring(0, 50)}")}`;
    }

    default:
      return `- evalScript: \${console.log("NESY_STEP::UNSUPPORTED::${node.id}::${node.type}")}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Topological Sort (DAG linearization)
// ─────────────────────────────────────────────────────────────────────────────

function topologicalSort(nodes: WorkflowNode[], edges: Connection[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const result: WorkflowNode[] = [];

  const startNode = nodes.find((n) => n.type === "LAUNCH_APP") ?? nodes[0];
  if (!startNode) return [];

  function traverse(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    result.push(node);

    const outgoing = edges
      .filter((e) => e.sourceNodeId === nodeId && e.targetNodeId && !e.isPlaceholder)
      .sort((a, b) => {
        const order: Record<string, number> = { default: 0, true: 1, false: 2 };
        return (order[a.sourceHandle] ?? 0) - (order[b.sourceHandle] ?? 0);
      });

    for (const edge of outgoing) {
      if (edge.targetNodeId) {
        traverse(edge.targetNodeId);
      }
    }
  }

  traverse(startNode.id);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// IF_LOGIN / CONDITION Handler
// ─────────────────────────────────────────────────────────────────────────────

function generateConditionalYaml(
  node: WorkflowNode,
  edges: Connection[],
  nodeMap: Map<string, WorkflowNode>,
  visited: Set<string>,
  options: YamlGeneratorOptions,
  appId: string,
  doneMarker: string
): string {
  const c = cfg(node);

  if (node.type === "IF_LOGIN") {
    const loginButtonId = resourceId(appId, "btn_login");
    const trueEdge = edges.find(
      (e) => e.sourceNodeId === node.id && e.sourceHandle === "true" && e.targetNodeId && !e.isPlaceholder
    );
    const falseEdge = edges.find(
      (e) => e.sourceNodeId === node.id && e.sourceHandle === "false" && e.targetNodeId && !e.isPlaceholder
    );

    // The TRUE edge target (e.g. CHECK_ROUTE) is the convergence point.
    // It must run OUTSIDE and AFTER the IF block for both scenarios.
    const convergenceNodeId = trueEdge?.targetNodeId ?? null;

    let yaml = "";

    // btn_login shows in <2s post-launch when present; short timeout avoids a
    // 15s dead-wait on the already-logged-in path (optional → no correctness gate).
    yaml += `- extendedWaitUntil:
    visible:
      id: "${loginButtonId}"
    timeout: 5000
    optional: true\n`;

    // Convergence mode: only FALSE branch (AUTH_LOGIN) runs inside conditional.
    // Stop traversal at the convergence node so it doesn't get nested inside.
    if (falseEdge?.targetNodeId) {
      const falseBranch = generateBranchYaml(falseEdge.targetNodeId, edges, nodeMap, visited, options, appId, convergenceNodeId);
      yaml += `\n- runFlow:
    when:
      visible:
        id: "${loginButtonId}"
    commands:
${indent(falseBranch, 6)}`;
    }

    yaml += `\n${doneMarker}\n`;

    // After IF block, continue with convergence nodes (CHECK_ROUTE etc.)
    if (trueEdge?.targetNodeId) {
      const convergenceBranch = generateBranchYaml(trueEdge.targetNodeId, edges, nodeMap, visited, options, appId);
      yaml += `${convergenceBranch}`;
    }

    return yaml;
  }

  if (node.type === "CONDITION") {
    const conditionElement = str(c.elementId, "");
    const trueEdge = edges.find(
      (e) => e.sourceNodeId === node.id && e.sourceHandle === "true" && e.targetNodeId && !e.isPlaceholder
    );
    const falseEdge = edges.find(
      (e) => e.sourceNodeId === node.id && e.sourceHandle === "false" && e.targetNodeId && !e.isPlaceholder
    );

    let yaml = "";

    if (trueEdge?.targetNodeId) {
      const trueBranch = generateBranchYaml(trueEdge.targetNodeId, edges, nodeMap, visited, options, appId);
      yaml += `- runFlow:
    when:
      visible: "${conditionElement}"
    commands:
${indent(trueBranch, 6)}`;
    }

    if (falseEdge?.targetNodeId) {
      const falseBranch = generateBranchYaml(falseEdge.targetNodeId, edges, nodeMap, visited, options, appId);
      yaml += `\n- runFlow:
    when:
      notVisible: "${conditionElement}"
    commands:
${indent(falseBranch, 6)}`;
    }

    yaml += `\n${doneMarker}\n`;

    return yaml;
  }

  if (node.type === "CHECK_ROUTE") {
    const spinnerId = resourceId(appId, "dialog_spinner");
    const trueEdge = edges.find(
      (e) => e.sourceNodeId === node.id && e.sourceHandle === "true" && e.targetNodeId && !e.isPlaceholder
    );
    const falseEdge = edges.find(
      (e) => e.sourceNodeId === node.id && e.sourceHandle === "false" && e.targetNodeId && !e.isPlaceholder
    );

    // The TRUE edge target (e.g. VALIDATE_STOPLIST) is the convergence point.
    // It must run AFTER both branches so it executes regardless of which path was taken.
    const convergenceNodeId = trueEdge?.targetNodeId ?? null;

    let yaml = `- waitForAnimationToEnd
- extendedWaitUntil:
    visible:
      id: "${spinnerId}"
    timeout: 15000
    optional: true\n`;

    // FALSE branch (route not selected → SELECT_ROUTE) runs inside conditional.
    // Stop at convergence node so it doesn't get nested.
    if (falseEdge?.targetNodeId) {
      const falseBranch = generateBranchYaml(falseEdge.targetNodeId, edges, nodeMap, visited, options, appId, convergenceNodeId);
      yaml += `- runFlow:
    when:
      visible:
        id: "${spinnerId}"
    commands:
${indent(falseBranch, 6)}`;
    }

    yaml += `\n${doneMarker}\n`;

    // Convergence: runs after CHECK_ROUTE for both paths (route was selected or just got selected)
    if (convergenceNodeId) {
      const convergenceBranch = generateBranchYaml(convergenceNodeId, edges, nodeMap, visited, options, appId);
      yaml += `${convergenceBranch}`;
    }

    return yaml;
  }

  return "";
}

function generateBranchYaml(
  startNodeId: string,
  edges: Connection[],
  nodeMap: Map<string, WorkflowNode>,
  visited: Set<string>,
  options: YamlGeneratorOptions,
  appId: string,
  stopAtNodeId?: string | null
): string {
  let yaml = "";
  let currentId: string | null = startNodeId;

  while (currentId) {
    // Stop before the convergence node — it will be handled by the parent
    if (stopAtNodeId && currentId === stopAtNodeId) break;
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const node = nodeMap.get(currentId);
    if (!node) break;

    yaml += markerStart(node);

    if (node.type === "IF_LOGIN" || node.type === "CONDITION" || node.type === "CHECK_ROUTE") {
      yaml += generateConditionalYaml(node, edges, nodeMap, visited, options, appId, markerDone(node)) + "\n";
    } else {
      yaml += nodeYaml(node, options, appId) + "\n";
      yaml += backendCheckMarker(node, options);
      yaml += markerDone(node);
    }

    const nextEdge = edges.find(
      (e) => e.sourceNodeId === currentId && e.sourceHandle === "default" && e.targetNodeId && !e.isPlaceholder
    );
    currentId = nextEdge?.targetNodeId ?? null;
  }

  return yaml;
}

// ─────────────────────────────────────────────────────────────────────────────
// Marker Injection
// ─────────────────────────────────────────────────────────────────────────────

/** Parses expectedEventCodes as an array (of number/string) or a CSV string. */
function normalizeEventCodes(value: unknown): string[] {
  const push = (out: string[], v: unknown) => {
    if (typeof v === "number") out.push(String(v));
    else if (typeof v === "string" && v.trim()) out.push(v.trim());
  };
  const out: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) push(out, item);
  } else if (typeof value === "string") {
    for (const part of value.split(",")) push(out, part);
  } else {
    push(out, value);
  }
  return out;
}

/**
 * Server-side backend verification marker. Emitted right after an operation
 * node whose config sets `verifyBackend: true`; the runner parses it from
 * Maestro stdout and polls EventTower/GetEvents for the expected event codes.
 * Format: NESY_BACKEND_CHECK::<nodeId>::<shipmentRef>::<codesCsv>::<delayMs>
 */
function backendCheckMarker(node: WorkflowNode, options: YamlGeneratorOptions): string {
  const c = resolveConfig(cfg(node), buildRunVars(options));
  if (!bool(c.verifyBackend)) return "";
  const shipmentRef = (str(c.shipmentRef) || str(c.barcode) || collectBarcodes(c)[0] || "").trim();
  const codes = normalizeEventCodes(c.expectedEventCodes);
  if (!shipmentRef || codes.length === 0) return "";
  const delayMs = num(c.verifyDelayMs, 30000);
  return `- evalScript: \${console.log("NESY_BACKEND_CHECK::${node.id}::${shipmentRef}::${codes.join(",")}::${delayMs}")}\n`;
}

function markerStart(node: WorkflowNode): string {
  return `- evalScript: \${console.log("NESY_STEP::START::${node.id}::${node.type}")}\n`;
}

function markerDone(node: WorkflowNode): string {
  return `- evalScript: \${console.log("NESY_STEP::DONE::${node.id}::${node.type}")}\n`;
}

function indent(text: string, spaces: number): string {
  if (!text.trim()) return `${" ".repeat(spaces)}- evalScript: \${console.log("NESY_STEP::BRANCH_EMPTY")}`;
  return text
    .trim()
    .split("\n")
    .map((line) => `${" ".repeat(spaces)}${line}`)
    .join("\n");
}

export function resolveWorkflowAppId(
  nodes: WorkflowNode[],
  country?: string,
  environment?: string,
): string {
  const launchNode = nodes.find((n) => n.type === "LAUNCH_APP");

  if (launchNode) {
    return resolveLaunchAppIdFromConfig(cfg(launchNode));
  }

  if (isLaunchCountry(country) && isLaunchEnvironment(environment)) {
    return resolveNesyMobileApplicationId(country, environment);
  }

  return resolveNesyMobileApplicationId(DEFAULT_LAUNCH_COUNTRY, DEFAULT_LAUNCH_ENVIRONMENT);
}

function buildYamlHeader(options: YamlGeneratorOptions, appId: string): string {
  const envVars: Record<string, string> = {};
  if (options.config && typeof options.config === "object") {
    for (const [key, val] of Object.entries(options.config)) {
      if (typeof val === "string") envVars[key] = val;
    }
  }
  // Run-time inputs override version config in the Maestro env block too.
  if (options.runInput) {
    for (const [key, val] of Object.entries(options.runInput)) envVars[key] = val;
  }

  let header = `appId: "${appId}"\n`;
  if (Object.keys(envVars).length > 0) {
    header += "env:\n";
    for (const [key, val] of Object.entries(envVars)) {
      header += `  ${key}: "${val}"\n`;
    }
  }
  header += "---\n";

  return header;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Generator Function
// ─────────────────────────────────────────────────────────────────────────────

export function generateWorkflowYaml(options: YamlGeneratorOptions): string {
  const { nodes, edges } = options;

  if (!nodes.length) return "# Empty workflow\n";

  const appId =
    options.appIdOverride ||
    resolveWorkflowAppId(nodes, options.country, options.environment);
  const header = buildYamlHeader(options, appId);

  const sortedNodes = topologicalSort(nodes, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  let body = "";

  for (const node of sortedNodes) {
    if (visited.has(node.id)) continue;
    visited.add(node.id);

    body += `\n# ===== STEP: ${node.id} (${node.type}) =====\n`;
    body += markerStart(node);

    if (node.type === "IF_LOGIN" || node.type === "CONDITION" || node.type === "CHECK_ROUTE") {
      body += generateConditionalYaml(node, edges, nodeMap, visited, options, appId, markerDone(node)) + "\n";
    } else {
      body += nodeYaml(node, options, appId) + "\n";
      body += backendCheckMarker(node, options);
      body += markerDone(node);
    }
  }

  return header + body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace Generator — one Maestro run per workflow, one subflow file per node
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Device state pulled via GET_STATE before the run. Used to resolve
 * IF_LOGIN / CHECK_ROUTE branches at compile time so the whole workflow —
 * conditionals included — executes as a single Maestro process.
 */
export interface PreflightState {
  isLoggedIn: boolean | null;
  routeSelected: boolean | null;
  evidence?: string;
}

export interface ConditionDecision {
  nodeId: string;
  nodeType: string;
  /** "skip_branch" | "take_branch" | "runtime_fallback" */
  decision: "skip_branch" | "take_branch" | "runtime_fallback";
  evidence: string;
}

export interface WorkspaceFile {
  /** Path relative to the workspace root, e.g. "main.yaml" or "flows/step-01-AUTH_LOGIN.yaml". */
  relativePath: string;
  content: string;
}

export interface WorkflowWorkspace {
  files: WorkspaceFile[];
  mainFile: string;
  /** All files concatenated with headers — persisted to WorkflowRun.yamlContent. */
  combinedYaml: string;
  /** Branch nodes eliminated by preflight resolution (mark them skipped in DB). */
  skippedNodeIds: string[];
  conditionDecisions: ConditionDecision[];
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
}

function irToWorkflowNode(ir: IRNode): WorkflowNode {
  return {
    id: ir.id,
    type: ir.type,
    kind: "action",
    position: { x: 0, y: 0 },
    data: { title: ir.title ?? ir.type, config: ir.config },
  };
}

/**
 * Maestro workspace compiler: consumes the neutral Workflow IR (see
 * workflow-ir.ts) and emits `main.yaml` chaining node subflows via
 * `runFlow: file:`, one YAML file per action node. Compile-time-resolved
 * conditions are inlined or skipped; unresolved ones degrade to Maestro's own
 * UI-visibility conditional (`runFlow when:`) — either way the run needs only
 * one Maestro process.
 */
export function generateWorkflowWorkspace(
  options: YamlGeneratorOptions,
  preflight?: PreflightState | null,
): WorkflowWorkspace {
  const { nodes, edges } = options;
  const appId =
    options.appIdOverride ||
    resolveWorkflowAppId(nodes, options.country, options.environment);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const ir = buildWorkflowIR(nodes, edges, preflight ?? null);

  const files: WorkspaceFile[] = [];
  const conditionDecisions: ConditionDecision[] = [];
  const visited = new Set<string>();

  let mainBody = "";
  let stepIndex = 0;

  function subflowHeader(): string {
    return `appId: "${appId}"\n---\n`;
  }

  function emitActionNode(node: WorkflowNode): void {
    visited.add(node.id);
    stepIndex += 1;
    const fileName = `flows/step-${String(stepIndex).padStart(2, "0")}-${sanitizeForFilename(node.type)}-${sanitizeForFilename(node.id)}.yaml`;
    const body = nodeYaml(node, options, appId).trim();

    files.push({
      relativePath: fileName,
      content: subflowHeader() + (body.length > 0 ? body + "\n" : `- evalScript: \${console.log("NESY_STEP::EMPTY")}\n`),
    });

    mainBody += `\n# ===== STEP: ${node.id} (${node.type}) =====\n`;
    mainBody += markerStart(node);
    mainBody += `- runFlow:\n    file: ${fileName}\n`;
    mainBody += backendCheckMarker(node, options);
    mainBody += markerDone(node);
  }

  /** UI-visibility fallback when preflight state is unavailable. */
  function emitRuntimeFallback(node: WorkflowNode, branch: IRNode[]): void {
    const probeId =
      node.type === "IF_LOGIN" ? resourceId(appId, "btn_login") : resourceId(appId, "dialog_spinner");
    // Branch-trigger probe timeout. When the branch is NOT taken the trigger is
    // absent and this wait burns its FULL timeout (it is `optional`, so it never
    // gates correctness — only latency). Tuned per probe:
    //  - IF_LOGIN/btn_login: the login screen is already rendered by the time this
    //    runs (LAUNCH_APP's pinView probe absorbed the splash), so btn_login shows
    //    in <2s when present. A short timeout keeps the already-logged-in path from
    //    dead-waiting 15s. btn_login is effectively redundant with LAUNCH_APP.
    //  - CHECK_ROUTE/dialog_spinner: the RS StopList route spinner can take >10s to
    //    render after a fresh login; a short probe would skip SELECT_ROUTE and leave
    //    the run route-less. Kept long — the cost only hits the already-route-selected
    //    path and cannot be cut here without a state-aware signal (see preflight).
    const waitTimeout = node.type === "IF_LOGIN" ? 5000 : 15000;

    visited.add(node.id);
    mainBody += `\n# ===== STEP: ${node.id} (${node.type}) — runtime UI fallback =====\n`;
    mainBody += markerStart(node);
    mainBody += `- extendedWaitUntil:
    visible:
      id: "${probeId}"
    timeout: ${waitTimeout}
    optional: true\n`;

    if (branch.length > 0) {
      let branchYaml = "";
      for (const irNode of branch) {
        const branchNode = irToWorkflowNode(irNode);
        visited.add(branchNode.id);
        branchYaml += markerStart(branchNode);
        branchYaml += nodeYaml(branchNode, options, appId) + "\n";
        branchYaml += markerDone(branchNode);
      }

      mainBody += `- runFlow:
    when:
      visible:
        id: "${probeId}"
    commands:
${indent(branchYaml, 6)}\n`;
    }

    mainBody += markerDone(node);
  }

  for (const step of ir.steps) {
    switch (step.kind) {
      case "macro":
        emitActionNode(irToWorkflowNode(step.node));
        break;

      case "resolved-condition":
        conditionDecisions.push({
          nodeId: step.node.id,
          nodeType: step.node.type,
          decision: step.decision,
          evidence: step.evidence,
        });
        for (const branchNode of step.branch) {
          emitActionNode(irToWorkflowNode(branchNode));
        }
        break;

      case "runtime-condition":
        conditionDecisions.push({
          nodeId: step.node.id,
          nodeType: step.node.type,
          decision: "runtime_fallback",
          evidence: "preflight state unavailable — using UI visibility",
        });
        emitRuntimeFallback(irToWorkflowNode(step.node), step.branch);
        break;

      case "ui-condition": {
        // Generic UI conditions keep their existing inline when:/notVisible form.
        const node = nodeMap.get(step.node.id);
        if (!node) break;
        visited.add(node.id);
        mainBody += `\n# ===== STEP: ${node.id} (${node.type}) =====\n`;
        mainBody += markerStart(node);
        mainBody += generateConditionalYaml(node, edges, nodeMap, visited, options, appId, markerDone(node)) + "\n";
        break;
      }
    }
  }

  const mainContent = buildYamlHeader(options, appId) + mainBody;
  files.unshift({ relativePath: "main.yaml", content: mainContent });

  const combinedYaml = files
    .map((file) => `# ═════ FILE: ${file.relativePath} ═════\n${file.content}`)
    .join("\n");

  return {
    files,
    mainFile: "main.yaml",
    combinedYaml,
    skippedNodeIds: ir.skippedNodeIds,
    conditionDecisions,
  };
}

/**
 * Generate YAML for a subset of nodes (single_step or up_to_step mode)
 */
export function generatePartialWorkflowYaml(
  options: YamlGeneratorOptions,
  mode: "single_step" | "up_to_step",
  targetNodeId: string
): string {
  const { nodes, edges } = options;
  // Resolve appId from the FULL graph (LAUNCH_APP) before slicing — otherwise
  // single_step falls back to the HR default package id.
  const appIdOverride =
    options.appIdOverride ||
    resolveWorkflowAppId(nodes, options.country, options.environment);

  if (mode === "single_step") {
    const targetNode = nodes.find((n) => n.id === targetNodeId);
    if (!targetNode) return "# Target node not found\n";

    return generateWorkflowYaml({
      ...options,
      nodes: [targetNode],
      edges: [],
      appIdOverride,
    });
  }

  // up_to_step: include all nodes from start to target (inclusive)
  const sorted = topologicalSort(nodes, edges);
  const targetIndex = sorted.findIndex((n) => n.id === targetNodeId);
  if (targetIndex === -1) return "# Target node not found\n";

  const partialNodes = sorted.slice(0, targetIndex + 1);
  const partialNodeIds = new Set(partialNodes.map((n) => n.id));
  const partialEdges = edges.filter(
    (e) => partialNodeIds.has(e.sourceNodeId) && (!e.targetNodeId || partialNodeIds.has(e.targetNodeId))
  );

  return generateWorkflowYaml({
    ...options,
    nodes: partialNodes,
    edges: partialEdges,
    appIdOverride,
  });
}
