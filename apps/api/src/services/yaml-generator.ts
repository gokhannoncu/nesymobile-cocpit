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
      return `# --- AUTOMATION BRIDGE: VALIDATE_STOPLIST ---
- evalScript: \${console.log("AWAIT_BRIDGE::VALIDATE_STOPLIST")}
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
          id: "${dialogPositiveId}"
# Automation Bridge Waiting
- evalScript: \${console.log("AWAIT_BRIDGE::LOAD_TO_VEHICLE")}`;
    }

    case "SEARCH_SHIPMENT": {
      const trackingNumber = str(c.trackingNumber, "");
      return `- tapOn:
    id: "search_input"
- inputText: "${trackingNumber}"
- pressKey: Enter`;
    }

    case "SEARCH_PARCEL": {
      const parcelId = str(c.parcelId, "");
      return `- tapOn:
    id: "search_input"
- inputText: "${parcelId}"
- pressKey: Enter`;
    }

    case "SEARCH_STOP": {
      const stopId = str(c.stopId, "");
      return `- tapOn:
    id: "search_input"
- inputText: "${stopId}"
- pressKey: Enter`;
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
          id: "${appId}:id/auto_route"
- evalScript: \${console.log("AWAIT_BRIDGE::REQUEST_TOUR_START")}`;

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
- evalScript: \${console.log("AWAIT_BRIDGE::SEARCH_STOP")}
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
- evalScript: \${console.log("AWAIT_BRIDGE::SEARCH_STOP")}
- tapOn:
    index: 0
    id: "${stopCardId}"`;
    }

    case "OPEN_STOP": {
      const stopIndex = str(c.stopIndex, "0");
      return `- tapOn:
    id: "stop_item_${stopIndex}"`;
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
- tapOn:
    id: "${btnOkId}"
# 5. Bridge log: SCAN_PARCEL | SUCCESS
- evalScript: \${console.log("AWAIT_BRIDGE::SCAN_PARCEL")}`;
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
        yaml += `\n# Wait before delivery: ${waitBeforeDelivery}ms\n- swipe:\n    start: "50%, 50%"\n    end: "50%, 50%"\n    duration: ${waitBeforeDelivery}`;
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
- evalScript: \${console.log("NESY_STEP::Wait for UI to settle")}
- swipe:
    start: "50%, 50%"
    end: "50%, 50%"
    duration: 1000`;

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

      yaml += `
# 6. Verify local step completion
- evalScript: \${console.log("AWAIT_BRIDGE::DELIVER_PARCEL")}`;

      return yaml;
    }

    case "PICKUP_OPERATION": {
      const barcodes = Array.isArray(c.barcodes) ? (c.barcodes as string[]) : [];
      let yaml = `- tapOn:
    id: "btn_pickup"`;
      for (const barcode of barcodes) {
        yaml += `\n- tapOn:\n    id: "barcode_input"\n- inputText: "${barcode}"\n- pressKey: Enter`;
      }
      yaml += `\n- tapOn:\n    id: "btn_confirm_pickup"`;
      return yaml;
    }

    case "DEPS_OPERATION":
      return `- tapOn:
    id: "btn_deps"
- tapOn:
    id: "btn_confirm_deps"`;

    case "REMOTE_PICKUP_OPERATION":
      return `- tapOn:
    id: "btn_remote_pickup"
- tapOn:
    id: "btn_confirm_remote_pickup"`;

    case "PICKUP_AT_CUSTOMER_OPERATION":
      return `- tapOn:
    id: "btn_pickup_at_customer"
- tapOn:
    id: "btn_confirm_pickup_customer"`;

    case "RDOC_OPERATION":
      return `- tapOn:
    id: "btn_rdoc"
- tapOn:
    id: "btn_confirm_rdoc"`;

    case "LOS_OPERATION":
      return `- tapOn:
    id: "btn_los"
- tapOn:
    id: "btn_confirm_los"`;

    case "DELIVERY_FAIL_OPERATION": {
      const failReason = str(c.failReason, "not_at_home");
      return `- tapOn:
    id: "btn_delivery_fail"
- tapOn:
    id: "fail_reason_${failReason}"
- tapOn:
    id: "btn_confirm_fail"`;
    }

    case "PICKUP_FAIL_OPERATION": {
      const failReason = str(c.failReason, "not_ready");
      return `- tapOn:
    id: "btn_pickup_fail"
- tapOn:
    id: "fail_reason_${failReason}"
- tapOn:
    id: "btn_confirm_pickup_fail"`;
    }

    case "CANCEL_DELIVERY_OPERATION": {
      const cancelReason = str(c.cancelReason, "customer_request");
      return `- tapOn:
    id: "btn_cancel_delivery"
- tapOn:
    id: "cancel_reason_${cancelReason}"
- tapOn:
    id: "btn_confirm_cancel"`;
    }

    case "CONDITION":
      return ""; // handled separately as conditional

    case "WAIT": {
      const timeout = num(c.timeout, 5000);
      return `# --- WAIT: ${timeout}ms ---
- evalScript: \${console.log("NESY_WAIT::${node.id}::${timeout}")}
- swipe:
    start: "50%, 50%"
    end: "50%, 50%"
    duration: ${timeout}`;
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

function resolveWorkflowAppId(nodes: WorkflowNode[]): string {
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

export function generateSingleNodeWorkflowYaml(options: YamlGeneratorOptions, nodeId: string): string {
  const node = options.nodes.find((n) => n.id === nodeId);
  if (!node) return "# Target node not found\n";

  const appId = resolveWorkflowAppId(options.nodes);
  let body = `\n# ===== STEP: ${node.id} (${node.type}) =====\n`;
  body += markerStart(node);
  body += nodeYaml(node, options, appId) + "\n";
  body += markerDone(node);

  return buildYamlHeader(options, appId) + body;
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
