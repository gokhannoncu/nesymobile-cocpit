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

function str(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

function num(val: unknown, fallback = 5000): number {
  return typeof val === "number" ? val : fallback;
}

function bool(val: unknown, fallback = false): boolean {
  return typeof val === "boolean" ? val : fallback;
}

function nodeYaml(node: WorkflowNode, _options: YamlGeneratorOptions, appId: string): string {
  const c = cfg(node);
  const pinViewId = resourceId(appId, "pinView");
  const loginButtonId = resourceId(appId, "btn_login");

  switch (node.type) {
    case "LAUNCH_APP": {
      const resolvedAppId = resolveLaunchAppIdFromConfig(c);
      const clearState = bool(c.clearState);
      return `- launchApp:
    appId: "${resolvedAppId}"
    clearState: ${clearState}
- waitForAnimationToEnd`;
    }

    case "AUTH_LOGIN": {
      const pinCode = str(c.pinCode, "0000");
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
      const okButtonId = resourceId(appId, "yesButton");
      return `- tapOn:
    id: "${spinnerId}"
- scrollUntilVisible:
    element:
      text: "${routeNumber}"
    direction: DOWN
- tapOn: "${routeNumber}"
- tapOn:
    id: "${okButtonId}"`;
    }

    case "VALIDATE_STOPLIST":
      // Success/failure is decided by the logcat VALIDATE_STOPLIST event handler.
      return `# --- AUTOMATION BRIDGE: VALIDATE_STOPLIST ---
- waitForAnimationToEnd`;

    case "LOAD_TO_VEHICLE": {
      const barcode = str(c.barcode, "");
      const manuelInputId = resourceId(appId, "manuel_input");
      const barcodeInputId = resourceId(appId, "et_input_dialog_barcode_number");
      const barcodeOkId = resourceId(appId, "btn_ok");
      const dialogTitleId = resourceId(appId, "tv_arasDg_title");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      return `# --- LOAD TO VEHICLE PROCESS ---
- tapOn:
    id: "${manuelInputId}"
- extendedWaitUntil:
    visible:
      id: "${barcodeInputId}"
    timeout: 3000
- inputText: "${barcode}"
- tapOn:
    id: "${barcodeOkId}"
# --- ScanProcessor Pipeline — Dialog Handling ---
# FETCH_SHIPMENT stage — dialog may appear (HUB_WARNING, GENERIC_ERROR, etc.)
- extendedWaitUntil:
    visible:
      id: "${dialogTitleId}"
    timeout: 5000
    optional: true
- runFlow:
    when:
      visible:
        id: "${dialogTitleId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"
# CREATE_TASK stage — second dialog may appear
- extendedWaitUntil:
    visible:
      id: "${dialogTitleId}"
    timeout: 3000
    optional: true
- runFlow:
    when:
      visible:
        id: "${dialogTitleId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;
    }

    case "SEARCH_SHIPMENT": {
      const trackingNumber = str(c.trackingNumber, "");
      return searchOnStopsYaml(appId, trackingNumber);
    }

    case "SEARCH_PARCEL": {
      const parcelId = str(c.parcelId, "");
      return searchOnStopsYaml(appId, parcelId);
    }

    case "SEARCH_STOP": {
      const stopId = str(c.stopId, "");
      return searchOnStopsYaml(appId, stopId);
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
      const stopIndex = str(c.stopIndex, "0");
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

      let yaml = `# --- DELIVER PARCEL FLOW ---
# 1. Wait for a top-level field to ensure screen is loaded
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

      // Completion is verified by the logcat DELIVER_PARCEL handler (BACKEND_CONFIRMED).
      return yaml;
    }

    case "PICKUP_OPERATION": {
      // Verified flow: barcodes go in via the toolbar manual-input dialog
      // (manuel_input → et_input_dialog_barcode_number → btn_ok); pickup is
      // completed with btn_task_complete on the pickup screen.
      const barcodes = Array.isArray(c.barcodes) ? (c.barcodes as string[]) : [];
      const manuelInputId = resourceId(appId, "manuel_input");
      const barcodeInputId = resourceId(appId, "et_input_dialog_barcode_number");
      const barcodeOkId = resourceId(appId, "btn_ok");
      const taskCompleteId = resourceId(appId, "btn_task_complete");

      let yaml = `# --- PICKUP OPERATION ---`;
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
# Complete the pickup
- extendedWaitUntil:
    visible:
      id: "${taskCompleteId}"
    timeout: 10000
- tapOn:
    id: "${taskCompleteId}"`;
      return yaml;
    }

    case "DEPS_OPERATION": {
      // DEPS choice appears after btn_deliver on the delivery screen
      // (deliver_clicked_dialog_layout.xml → btnDeps).
      const btnDeliverId = resourceId(appId, "btn_deliver");
      const btnDepsId = resourceId(appId, "btnDeps");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      return `# --- DEPS OPERATION ---
- tapOn:
    id: "${btnDeliverId}"
- extendedWaitUntil:
    visible:
      id: "${btnDepsId}"
    timeout: 5000
- tapOn:
    id: "${btnDepsId}"
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;
    }

    case "REMOTE_PICKUP_OPERATION":
    case "PICKUP_AT_CUSTOMER_OPERATION":
    case "RDOC_OPERATION": {
      // These flows open dialog_pickup_at_remote automatically after the
      // barcode scan; confirmation is the shared complete_task button.
      const completeTaskId = resourceId(appId, "complete_task");
      return `# --- ${node.type} (confirm via dialog_pickup_at_remote) ---
- extendedWaitUntil:
    visible:
      id: "${completeTaskId}"
    timeout: 10000
- tapOn:
    id: "${completeTaskId}"`;
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
      // btnDeliveryFailed (bottom sheet) → btn_deliver on the delivery-failed
      // screen opens the reason list; rows carry the gated contentDescription
      // fail_reason_<backend code>; tapping the row submits. Some reasons show
      // an ArasDialog yes/no afterwards.
      const failReason = str(c.failReason, "1");
      const btnDeliveryFailedId = resourceId(appId, "btnDeliveryFailed");
      const btnDeliverId = resourceId(appId, "btn_deliver");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      return `# --- DELIVERY FAIL OPERATION (reason code: ${failReason}) ---
- runFlow:
    when:
      visible:
        id: "${btnDeliveryFailedId}"
    commands:
      - tapOn:
          id: "${btnDeliveryFailedId}"
- tapOn:
    id: "${btnDeliverId}"
- extendedWaitUntil:
    visible: "fail_reason_${failReason}"
    timeout: 5000
- tapOn: "fail_reason_${failReason}"
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;
    }

    case "PICKUP_FAIL_OPERATION": {
      // Entry from the task card is btn_not_deliver; reason rows carry the
      // gated fail_reason_<code> contentDescription; tapping the row submits.
      const failReason = str(c.failReason, "1");
      const btnNotDeliverId = resourceId(appId, "btn_not_deliver");
      const dialogPositiveId = resourceId(appId, "btn_arasDg_positive_button");
      return `# --- PICKUP FAIL OPERATION (reason code: ${failReason}) ---
- tapOn:
    id: "${btnNotDeliverId}"
- extendedWaitUntil:
    visible: "fail_reason_${failReason}"
    timeout: 5000
- tapOn: "fail_reason_${failReason}"
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;
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
      const elementId = str(c.elementId, "");
      const text = str(c.text, "");
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

    yaml += `- extendedWaitUntil:
    visible:
      id: "${loginButtonId}"
    timeout: 15000
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
    timeout: 4000
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

export function resolveWorkflowAppId(nodes: WorkflowNode[]): string {
  const launchNode = nodes.find((n) => n.type === "LAUNCH_APP");

  if (launchNode) {
    return resolveLaunchAppIdFromConfig(cfg(launchNode));
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

  const appId = resolveWorkflowAppId(nodes);
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
  const appId = resolveWorkflowAppId(nodes);
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
    mainBody += markerDone(node);
  }

  /** UI-visibility fallback when preflight state is unavailable. */
  function emitRuntimeFallback(node: WorkflowNode, branch: IRNode[]): void {
    const probeId =
      node.type === "IF_LOGIN" ? resourceId(appId, "btn_login") : resourceId(appId, "dialog_spinner");
    const waitTimeout = node.type === "IF_LOGIN" ? 15000 : 4000;

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

  if (mode === "single_step") {
    const targetNode = nodes.find((n) => n.id === targetNodeId);
    if (!targetNode) return "# Target node not found\n";

    return generateWorkflowYaml({
      ...options,
      nodes: [targetNode],
      edges: [],
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
  });
}
