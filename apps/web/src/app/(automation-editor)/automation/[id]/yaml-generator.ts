import type { Connection, WorkflowNode } from "./workflow-types";
import {
  Registry,
  parseAuthLoginParams,
  parseCheckRouteParams,
  parseDeliveryOperationParams,
  parseIfLoginParams,
  parseLaunchAppParams,
  parseLoadToVehicleParams,
  parseOpenParcelParams,
  parseOpenShipmentParams,
  parseRequestTourStartParams,
  parseScanBarcodeParams,
  parseSelectRouteParams,
  parseWaitParams,
  resolveLaunchAppApplicationId,
} from "./yaml-registry";

function getNodeConfig(node: WorkflowNode): Record<string, unknown> {
  return node.data.config ?? {};
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown YAML generation error";
}

function getTargetConnection(
  nodeId: string,
  connections: Connection[],
  sourceHandle: Connection["sourceHandle"],
) {
  return connections.find(
    (connection) =>
      connection.sourceNodeId === nodeId &&
      connection.sourceHandle === sourceHandle &&
      Boolean(connection.targetNodeId) &&
      !connection.isPlaceholder,
  );
}

function createNodeCommand(node: WorkflowNode, appId: string): string {
  const config = getNodeConfig(node);

  if (node.type === "LAUNCH_APP") {
    return Registry.LAUNCH_APP(parseLaunchAppParams(config));
  }

  if (node.type === "AUTH_LOGIN") {
    try {
      return Registry.AUTH_LOGIN(parseAuthLoginParams(config), appId);
    } catch (error) {
      return `
# Invalid Node: AUTH_LOGIN
# ${getErrorMessage(error)}
`;
    }
  }

  if (node.type === "SELECT_ROUTE") {
    try {
      return Registry.SELECT_ROUTE(parseSelectRouteParams(config), appId);
    } catch (error) {
      return `
# Invalid Node: SELECT_ROUTE
# ${getErrorMessage(error)}
`;
    }
  }

  if (node.type === "VALIDATE_STOPLIST") {
    return Registry.VALIDATE_STOPLIST();
  }

  if (node.type === "LOAD_TO_VEHICLE") {
    try {
      return Registry.LOAD_TO_VEHICLE(parseLoadToVehicleParams(config), appId);
    } catch (error) {
      return `
# Invalid Node: LOAD_TO_VEHICLE
# ${getErrorMessage(error)}
`;
    }
  }

  if (node.type === "OPEN_SHIPMENT") {
    try {
      return Registry.OPEN_SHIPMENT(parseOpenShipmentParams(config), appId);
    } catch (error) {
      return `
# Invalid Node: OPEN_SHIPMENT
# ${getErrorMessage(error)}
`;
    }
  }

  if (node.type === "OPEN_PARCEL") {
    try {
      return Registry.OPEN_PARCEL(parseOpenParcelParams(config), appId);
    } catch (error) {
      return `
# Invalid Node: OPEN_PARCEL
# ${getErrorMessage(error)}
`;
    }
  }

  if (node.type === "REQUEST_TOUR_START") {
    try {
      return Registry.REQUEST_TOUR_START(parseRequestTourStartParams(config), appId);
    } catch (error) {
      return `
# Invalid Node: REQUEST_TOUR_START
# ${getErrorMessage(error)}
`;
    }
  }

  if (node.type === "SCAN_BARCODE") {
    try {
      return Registry.SCAN_BARCODE(parseScanBarcodeParams(config), appId);
    } catch (error) {
      return `
# Invalid Node: SCAN_BARCODE
# ${getErrorMessage(error)}
`;
    }
  }

  if (node.type === "DELIVERY_OPERATION") {
    try {
      return Registry.DELIVER_PARCEL(parseDeliveryOperationParams(config), appId);
    } catch (error) {
      return `
# Invalid Node: DELIVERY_OPERATION
# ${getErrorMessage(error)}
`;
    }
  }

  if (node.type === "WAIT") {
    try {
      return Registry.WAIT_NODE(parseWaitParams(config));
    } catch (error) {
      return `
# Invalid Node: WAIT
# ${getErrorMessage(error)}
`;
    }
  }

  return `
# Unsupported Node: ${node.type}
# Node ID: ${node.id}
`;
}

export function generateYamlFromFlow(startNodeId: string, nodes: WorkflowNode[], connections: Connection[]): string {
  const launchNode = nodes.find((node) => node.type === "LAUNCH_APP");
  let resolvedAppId = resolveLaunchAppApplicationId({ country: "HR", environment: "stage" });
  let globalHeader = `appId: "${resolvedAppId}"\n---\n`;

  if (launchNode) {
    const launchParams = parseLaunchAppParams(getNodeConfig(launchNode));
    resolvedAppId = resolveLaunchAppApplicationId(launchParams);
    globalHeader = `appId: "${resolvedAppId}"\n---\n`;
  }

  const visited = new Set<string>();
  function traverseBranch(nodeId: string, stopAtNodeId: string | null): string {
    if (stopAtNodeId && nodeId === stopAtNodeId) return "";
    if (visited.has(nodeId)) return "";

    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return "";

    visited.add(nodeId);

    let branchYaml = `\n- evalScript: \${console.log("Executing Node: ${node.type} (${node.id})")}`;    branchYaml += `\n${createNodeCommand(node, resolvedAppId)}`;

    const nextEdge = getTargetConnection(nodeId, connections, "default");
    if (nextEdge?.targetNodeId && (!stopAtNodeId || nextEdge.targetNodeId !== stopAtNodeId)) {
      branchYaml += `\n${traverseBranch(nextEdge.targetNodeId, stopAtNodeId)}`;
    }

    return branchYaml;
  }

  function traverse(nodeId: string): string {
    if (visited.has(nodeId)) return "";
    visited.add(nodeId);

    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return "";

    let currentYaml = `\n- evalScript: \${console.log("Executing Node: ${node.type} (${node.id})")}`;    
    if (node.type === "IF_LOGIN") {
      const trueEdge = getTargetConnection(nodeId, connections, "true");
      const falseEdge = getTargetConnection(nodeId, connections, "false");

      const convergenceNodeId = trueEdge?.targetNodeId ?? null;

      const falseBranchYaml = falseEdge?.targetNodeId
        ? traverseBranch(falseEdge.targetNodeId, convergenceNodeId)
        : "";

      currentYaml += `\n${Registry.IF_LOGIN(parseIfLoginParams(getNodeConfig(node)), "", falseBranchYaml, resolvedAppId)}`;

      if (trueEdge?.targetNodeId) {
        currentYaml += `\n${traverse(trueEdge.targetNodeId)}`;
      }

      return currentYaml;
    }

    if (node.type === "CHECK_ROUTE") {
      const trueEdge = getTargetConnection(nodeId, connections, "true");
      const falseEdge = getTargetConnection(nodeId, connections, "false");

      const convergenceNodeId = trueEdge?.targetNodeId ?? null;

      const falseBranchYaml = falseEdge?.targetNodeId
        ? traverseBranch(falseEdge.targetNodeId, convergenceNodeId)
        : "";

      const convergenceYaml = convergenceNodeId ? traverse(convergenceNodeId) : "";

      currentYaml += `\n${Registry.CHECK_ROUTE(parseCheckRouteParams(getNodeConfig(node)), convergenceYaml, falseBranchYaml, resolvedAppId)}`;
      return currentYaml;
    }

    currentYaml += `\n${createNodeCommand(node, resolvedAppId)}`;

    const nextEdge = getTargetConnection(nodeId, connections, "default");
    if (nextEdge?.targetNodeId) {
      currentYaml += `\n${traverse(nextEdge.targetNodeId)}`;
    }

    return currentYaml;
  }

  return globalHeader + traverse(startNodeId);
}
