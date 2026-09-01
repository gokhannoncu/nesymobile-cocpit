import { getWorkflowPhaseForType, workflowComponentRegistry } from "./workflow-registry";
import { validateNodeConfig } from "./workflow-node-config";
import {
  WorkflowNodeType,
  type BranchType,
  type Connection,
  type PaletteItem,
  type SourceHandle,
  type WorkflowPhase,
  type WorkflowNode,
} from "./workflow-types";

export type RuleValidationResult = {
  valid: boolean;
  code?: string;
  title?: string;
  message?: string;
  /** Extra copy for dialogs (e.g. validation hints). */
  detail?: string;
  dialog?: {
    title?: string;
    message?: string;
    beforeTitle?: string;
    beforeItems?: string[];
    afterTitle?: string;
    afterItems?: string[];
    primaryActionLabel?: string;
  };
  /** Node to highlight or remove for INVALID_POST_VALIDATE_NODE. */
  nodeId?: string;
  suggestedAction?: "AUTO_CREATE_REQUIRED_FLOW" | "REMOVE_INVALID_NODE";
  suggestedActionLabel?: string;
};

export type DropTarget =
  | { kind: "canvas" }
  | { kind: "node"; nodeId: string }
  | { kind: "connection"; connectionId: string }
  | { kind: "branch"; nodeId: string; branchType: BranchType };

type WorkflowGraphState = {
  nodes: WorkflowNode[];
  connections: Connection[];
};

const validResult: RuleValidationResult = { valid: true };

const POST_VALIDATE_FORBIDDEN_PHASES = new Set<WorkflowPhase>(["bootstrap", "precheck", "precheck_boundary"]);

function incomingByTargetMap(state: WorkflowGraphState) {
  const incomingByTarget = new Map<string, Connection[]>();
  state.connections.forEach((connection) => {
    if (!connection.targetNodeId || connection.isPlaceholder) return;
    const targetId = connection.targetNodeId;
    incomingByTarget.set(targetId, [...(incomingByTarget.get(targetId) ?? []), connection]);
  });
  return incomingByTarget;
}

/** True when `nodeId` has Validate StopList as a proper ancestor (strictly after it in flow order). */
export function isStrictDownstreamOfValidateStopList(state: WorkflowGraphState, nodeId: string): boolean {
  const incomingByTarget = incomingByTargetMap(state);
  const visited = new Set<string>();
  let frontier = (incomingByTarget.get(nodeId) ?? []).map((connection) => connection.sourceNodeId);
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      const node = state.nodes.find((candidate) => candidate.id === id);
      if (node?.type === WorkflowNodeType.VALIDATE_STOPLIST) return true;
      for (const connection of incomingByTarget.get(id) ?? []) next.push(connection.sourceNodeId);
    }
    frontier = next;
  }
  return false;
}

/** True when this node is Validate StopList or lies strictly downstream of it. */
export function isSourceAtOrAfterValidateStopList(state: WorkflowGraphState, sourceNodeId: string): boolean {
  const sourceNode = state.nodes.find((candidate) => candidate.id === sourceNodeId);
  if (sourceNode?.type === WorkflowNodeType.VALIDATE_STOPLIST) return true;
  return isStrictDownstreamOfValidateStopList(state, sourceNodeId);
}

function postValidateForbiddenRuleDrop(): RuleValidationResult {
  return {
    valid: false,
    code: "INVALID_POST_VALIDATE_NODE",
    title: "Invalid step order",
    message: "This step can't be added here because the workflow sequence is restricted.",
    detail: "After Validate StopList, add search, open, operation, assertion or integration steps.",
    dialog: {
      title: "Invalid step order",
      message: "This step can't be added here because the workflow sequence is restricted.",
      beforeTitle: "Allowed before Validate StopList",
      beforeItems: ["Launch App", "Grant Permissions", "Auth / Login", "Route Setup"],
      afterTitle: "Allowed after Validate StopList",
      afterItems: ["Search", "Open", "Operation", "Assertion", "Integration"],
    },
  };
}

function postValidateForbiddenRuleState(nodeId: string, nodeType: WorkflowNodeType): RuleValidationResult {
  const label = workflowComponentRegistry[nodeType]?.label ?? "This step";
  return {
    valid: false,
    code: "INVALID_POST_VALIDATE_NODE",
    title: "Invalid step order",
    message: `${label} can't be added here because the workflow sequence is restricted.`,
    detail: "After Validate StopList, add search, open, operation, assertion or integration steps.",
    dialog: {
      title: "Invalid step order",
      message: `${label} can't be added here because the workflow sequence is restricted.`,
      beforeTitle: "Allowed before Validate StopList",
      beforeItems: ["Launch App", "Grant Permissions", "Auth / Login", "Route Setup"],
      afterTitle: "Allowed after Validate StopList",
      afterItems: ["Search", "Open", "Operation", "Assertion", "Integration"],
    },
    nodeId,
    suggestedAction: "REMOVE_INVALID_NODE",
    suggestedActionLabel: "Remove invalid node",
  };
}

export const courierOperationTypes = new Set<WorkflowNodeType>([
  WorkflowNodeType.LOAD_TO_VEHICLE,
  WorkflowNodeType.REQUEST_TOUR_START,
  WorkflowNodeType.END_OF_DAY,
  WorkflowNodeType.RESTART_TOUR,
  WorkflowNodeType.SEARCH_SHIPMENT,
  WorkflowNodeType.SEARCH_PARCEL,
  WorkflowNodeType.SEARCH_STOP,
  WorkflowNodeType.OPEN_SHIPMENT,
  WorkflowNodeType.OPEN_PARCEL,
  WorkflowNodeType.OPEN_STOP,
  WorkflowNodeType.SCAN_BARCODE,
  WorkflowNodeType.DELIVERY_OPERATION,
  WorkflowNodeType.PICKUP_OPERATION,
  WorkflowNodeType.DEPS_OPERATION,
  WorkflowNodeType.REMOTE_PICKUP_OPERATION,
  WorkflowNodeType.PICKUP_AT_CUSTOMER_OPERATION,
  WorkflowNodeType.RDOC_OPERATION,
  WorkflowNodeType.LOS_OPERATION,
  WorkflowNodeType.DELIVERY_FAIL_OPERATION,
  WorkflowNodeType.PICKUP_FAIL_OPERATION,
  WorkflowNodeType.CANCEL_DELIVERY_OPERATION,
]);

export function isCourierOperationType(type: WorkflowNodeType) {
  return courierOperationTypes.has(type);
}

/**
 * Types that prove the stop list on their own.
 *
 * `APP.AVAILABLE_STOPS_LOADED` is bound by the select-route and change-route
 * macros in the Domain Pack, so a canvas that runs through route selection has
 * already established the stop list. Demanding a separate Validate StopList
 * node there rejects the pack's own composed workflows.
 */
const stopListEstablishingTypes = new Set<WorkflowNodeType>([
  WorkflowNodeType.VALIDATE_STOPLIST,
  WorkflowNodeType.SELECT_ROUTE,
  WorkflowNodeType.CHANGE_ROUTE,
]);

export function validateNodeDrop({
  state,
  paletteItem,
  target,
}: {
  state: WorkflowGraphState;
  paletteItem: PaletteItem;
  target?: DropTarget;
}): RuleValidationResult {
  if (state.nodes.length === 0) {
    if (paletteItem.type === WorkflowNodeType.LAUNCH_APP) return validResult;
    if (paletteItem.type === WorkflowNodeType.VALIDATE_STOPLIST) {
      return {
        valid: false,
        code: "REQUIRES_REQUIRED_FLOW",
        title: "Required flow missing",
        message: "This node requires Launch App -> Grant Permissions -> If Login -> Check Route first.",
        suggestedAction: "AUTO_CREATE_REQUIRED_FLOW",
        suggestedActionLabel: "Auto-create required flow",
      };
    }
    return {
      valid: false,
      code: "WORKFLOW_MUST_START_WITH_LAUNCH_APP",
      title: "Invalid workflow start",
      message: "Every workflow must start with Launch App.",
    };
  }

  const plannedConnections = plannedConnectionsForDrop(state, paletteItem.type, target);
  const insertionAnchorSourceId =
    plannedConnections.find((connection) => connection.sourceNodeId !== "__new__")?.sourceNodeId ?? null;
  for (const plannedConnection of plannedConnections) {
    const sourceNode = state.nodes.find((node) => node.id === plannedConnection.sourceNodeId);
    const targetNode =
      plannedConnection.targetNodeId === "__new__"
        ? ({ id: "__new__", type: paletteItem.type, kind: paletteItem.kind } as WorkflowNode)
        : state.nodes.find((node) => node.id === plannedConnection.targetNodeId);
    if (!sourceNode || !targetNode) continue;
    const connectionResult = validateConnection({
      state,
      sourceNode,
      targetNode,
      sourceHandle: plannedConnection.sourceHandle,
      insertionAnchorSourceId,
    });
    if (!connectionResult.valid) return connectionResult;
  }

  if (isCourierOperationType(paletteItem.type) && !targetHasValidatedStopListAncestor(state, target)) {
    return {
      valid: false,
      code: "VALIDATE_STOPLIST_REQUIRED",
      title: "Stop list required",
      message: "Courier operations can only be added after Select Route or Validate StopList.",
    };
  }

  return validResult;
}

export function validateConnection({
  state,
  sourceNode,
  targetNode,
  sourceHandle,
  insertionAnchorSourceId = null,
}: {
  state: WorkflowGraphState;
  sourceNode: WorkflowNode;
  targetNode: WorkflowNode;
  sourceHandle: SourceHandle;
  /** First real source in a palette drop (for two-step insert: anchor → new → tail). */
  insertionAnchorSourceId?: string | null;
}): RuleValidationResult {
  if (sourceNode.type === WorkflowNodeType.LAUNCH_APP && targetNode.type !== WorkflowNodeType.GRANT_PERMISSIONS) {
    return {
      valid: false,
      code: "MISSING_PERMISSIONS_AFTER_LAUNCH",
      title: "Missing startup permissions",
      message: "After Launch App, you must add Grant Permissions.",
    };
  }

  if (targetNode.type === WorkflowNodeType.GRANT_PERMISSIONS && sourceNode.type !== WorkflowNodeType.LAUNCH_APP) {
    return {
      valid: false,
      code: "PERMISSIONS_SOURCE_INVALID",
      title: "Invalid permission step position",
      message: "Grant Permissions can only be connected after Launch App.",
    };
  }

  if (
    sourceNode.type === WorkflowNodeType.GRANT_PERMISSIONS &&
    targetNode.type !== WorkflowNodeType.IF_LOGIN &&
    targetNode.type !== WorkflowNodeType.AUTH_LOGIN
  ) {
    return {
      valid: false,
      code: "PERMISSIONS_TARGET_INVALID",
      title: "Missing login step",
      message: "Grant Permissions must continue to If Login or Auth / Login.",
    };
  }

  if (targetNode.type === WorkflowNodeType.IF_LOGIN && sourceNode.type !== WorkflowNodeType.GRANT_PERMISSIONS) {
    return {
      valid: false,
      code: "IF_LOGIN_SOURCE_INVALID",
      title: "Invalid login validation position",
      message: "If Login can only be connected after Grant Permissions.",
    };
  }

  if (sourceNode.type === WorkflowNodeType.IF_LOGIN) {
    if (sourceHandle === "default") {
      return {
        valid: false,
        code: "IF_LOGIN_REQUIRES_BRANCH_HANDLE",
        title: "Missing branch selection",
        message: "If Login must use True or False branch connections.",
      };
    }
    if (sourceHandle === "true" && targetNode.type !== WorkflowNodeType.CHECK_ROUTE) {
      return {
        valid: false,
        code: "IF_LOGIN_TRUE_REQUIRES_CHECK_ROUTE",
        title: "Missing route validation",
        message: "If Login true branch must continue to Check Route.",
      };
    }
    if (sourceHandle === "false" && targetNode.type !== WorkflowNodeType.AUTH_LOGIN) {
      return {
        valid: false,
        code: "IF_LOGIN_FALSE_REQUIRES_AUTH",
        title: "Missing auth action",
        message: "If Login false branch must continue to Auth / Login.",
      };
    }
  }

  if (sourceNode.type === WorkflowNodeType.CHECK_ROUTE) {
    if (sourceHandle === "default") {
      return {
        valid: false,
        code: "CHECK_ROUTE_REQUIRES_BRANCH_HANDLE",
        title: "Missing branch selection",
        message: "Check Route must use True or False branch connections.",
      };
    }
    if (sourceHandle === "true" && targetNode.type !== WorkflowNodeType.VALIDATE_STOPLIST) {
      return {
        valid: false,
        code: "CHECK_ROUTE_TRUE_REQUIRES_VALIDATE",
        title: "Validate StopList required",
        message: "Check Route true branch must continue to Validate StopList.",
      };
    }
    if (sourceHandle === "false" && targetNode.type === WorkflowNodeType.VALIDATE_STOPLIST) {
      return {
        valid: false,
        code: "CHECK_ROUTE_FALSE_REQUIRES_SELECT_ROUTE_BEFORE_VALIDATE",
        title: "Missing route selection",
        message: "False route branch must run Select Route before Validate StopList.",
      };
    }
    if (sourceHandle === "false" && targetNode.type !== WorkflowNodeType.SELECT_ROUTE) {
      return {
        valid: false,
        code: "CHECK_ROUTE_FALSE_REQUIRES_SELECT_ROUTE",
        title: "Missing route selection",
        message: "Check Route false branch must continue to Select Route.",
      };
    }
  }

  if (
    sourceNode.type === WorkflowNodeType.SELECT_ROUTE &&
    targetNode.type !== WorkflowNodeType.VALIDATE_STOPLIST &&
    !isCourierOperationType(targetNode.type)
  ) {
    return {
      valid: false,
      code: "SELECT_ROUTE_REQUIRES_VALIDATE",
      title: "Invalid step after Select Route",
      message: "Select Route must continue to Validate StopList or a courier operation.",
    };
  }

  const targetPhase = getWorkflowPhaseForType(targetNode.type);
  if (targetPhase && POST_VALIDATE_FORBIDDEN_PHASES.has(targetPhase)) {
    const zoneAnchorId = sourceNode.id === "__new__" ? insertionAnchorSourceId : sourceNode.id;
    if (zoneAnchorId && isSourceAtOrAfterValidateStopList(state, zoneAnchorId)) {
      return postValidateForbiddenRuleDrop();
    }
  }

  if (isCourierOperationType(targetNode.type) && !hasStopListAncestor(state, sourceNode.id)) {
    return {
      valid: false,
      code: "VALIDATE_STOPLIST_REQUIRED",
      title: "Stop list required",
      message: "Courier operations can only be added after Select Route or Validate StopList.",
    };
  }

  return validResult;
}

export function validateWorkflowState(state: WorkflowGraphState): RuleValidationResult[] {
  const errors: RuleValidationResult[] = [];
  const launchApp = firstNodeOfType(state.nodes, WorkflowNodeType.LAUNCH_APP);
  const grantPermissions = firstNodeOfType(state.nodes, WorkflowNodeType.GRANT_PERMISSIONS);
  const ifLogin = firstNodeOfType(state.nodes, WorkflowNodeType.IF_LOGIN);
  const authLogin = firstNodeOfType(state.nodes, WorkflowNodeType.AUTH_LOGIN);
  const checkRoute = firstNodeOfType(state.nodes, WorkflowNodeType.CHECK_ROUTE);
  const selectRoute = firstNodeOfType(state.nodes, WorkflowNodeType.SELECT_ROUTE);
  const validateStopList = firstNodeOfType(state.nodes, WorkflowNodeType.VALIDATE_STOPLIST);

  if (!launchApp || state.connections.some((connection) => connection.targetNodeId === launchApp.id)) {
    errors.push({
      valid: false,
      code: "WORKFLOW_MUST_START_WITH_LAUNCH_APP",
      title: "Workflow must start with Launch App",
      message: "Workflow must start with Launch App.",
    });
  }

  if (!grantPermissions) {
    errors.push({
      valid: false,
      code: "MISSING_PERMISSIONS_AFTER_LAUNCH",
      title: "Missing Grant Permissions after Launch App",
      message: "Every workflow must prepare Android startup permissions after Launch App.",
    });
  }

  if (launchApp && grantPermissions && !hasConnection(state, launchApp.id, grantPermissions.id, "default")) {
    errors.push({
      valid: false,
      code: "MISSING_PERMISSIONS_AFTER_LAUNCH",
      title: "Grant Permissions is not connected after Launch App",
      message: "Launch App must connect directly to Grant Permissions.",
    });
  }

  if (grantPermissions && ifLogin && !hasConnection(state, grantPermissions.id, ifLogin.id, "default")) {
    errors.push({
      valid: false,
      code: "MISSING_IF_LOGIN_AFTER_PERMISSIONS",
      title: "Missing If Login after Grant Permissions",
      message: "If Login must be connected after Grant Permissions.",
    });
  }

  if (
    grantPermissions &&
    !ifLogin &&
    authLogin &&
    !hasConnection(state, grantPermissions.id, authLogin.id, "default")
  ) {
    errors.push({
      valid: false,
      code: "MISSING_AUTH_LOGIN_AFTER_PERMISSIONS",
      title: "Missing Auth / Login after Grant Permissions",
      message: "Grant Permissions must connect directly to Auth / Login.",
    });
  }

  if (ifLogin && checkRoute && !hasConnection(state, ifLogin.id, checkRoute.id, "true")) {
    errors.push({
      valid: false,
      code: "MISSING_CHECK_ROUTE_AFTER_AUTHENTICATION",
      title: "Missing Check Route after authentication",
      message: "If Login true branch must connect to Check Route.",
    });
  }

  if (ifLogin && authLogin && !hasConnection(state, ifLogin.id, authLogin.id, "false")) {
    errors.push({
      valid: false,
      code: "MISSING_AUTH_LOGIN_ON_FALSE_BRANCH",
      title: "Missing Auth / Login on unauthenticated branch",
      message: "If Login false branch must connect to Auth / Login.",
    });
  }

  if (checkRoute && validateStopList && !hasConnection(state, checkRoute.id, validateStopList.id, "true")) {
    errors.push({
      valid: false,
      code: "MISSING_VALIDATE_STOPLIST_ON_ROUTE_TRUE",
      title: "Missing Validate StopList on route-found branch",
      message: "Check Route true branch must connect to Validate StopList.",
    });
  }

  if (checkRoute && selectRoute && !hasConnection(state, checkRoute.id, selectRoute.id, "false")) {
    errors.push({
      valid: false,
      code: "MISSING_SELECT_ROUTE_ON_ROUTE_FALSE",
      title: "Missing Select Route on no-route branch",
      message: "Check Route false branch must connect to Select Route.",
    });
  }

  if (selectRoute && validateStopList && !hasConnection(state, selectRoute.id, validateStopList.id, "default")) {
    errors.push({
      valid: false,
      code: "MISSING_VALIDATE_STOPLIST_AFTER_SELECT_ROUTE",
      title: "Missing Validate StopList after Select Route",
      message: "Select Route must connect to Validate StopList.",
    });
  }

  const operationBeforeValidate = state.nodes.find(
    (node) => isCourierOperationType(node.type) && !hasStopListAncestor(state, node.id),
  );
  if (operationBeforeValidate) {
    errors.push({
      valid: false,
      code: "COURIER_OPERATION_BEFORE_VALIDATE",
      title: "Missing stop list before courier operations",
      message: "Courier operations need Select Route or Validate StopList upstream.",
    });
  }

  for (const node of state.nodes) {
    const phase = getWorkflowPhaseForType(node.type);
    if (!phase || !POST_VALIDATE_FORBIDDEN_PHASES.has(phase)) continue;
    if (!isStrictDownstreamOfValidateStopList(state, node.id)) continue;
    errors.push(postValidateForbiddenRuleState(node.id, node.type));
  }

  for (const node of state.nodes) {
    const configErrors = validateNodeConfig(node);
    for (const configError of configErrors) {
      errors.push({
        valid: false,
        code: "NODE_CONFIG_INVALID",
        title: `${node.data.title} config is incomplete`,
        message: configError.message,
        nodeId: node.id,
      });
    }
  }

  return dedupeErrors(errors);
}

export function isCriticalRequiredConnection(state: WorkflowGraphState, connection: Connection) {
  const sourceNode = state.nodes.find((node) => node.id === connection.sourceNodeId);
  const targetNode = connection.targetNodeId ? state.nodes.find((node) => node.id === connection.targetNodeId) : null;
  if (!sourceNode || !targetNode) return false;
  return (
    (sourceNode.type === WorkflowNodeType.LAUNCH_APP && targetNode.type === WorkflowNodeType.IF_LOGIN) ||
    (sourceNode.type === WorkflowNodeType.IF_LOGIN &&
      ((connection.sourceHandle === "true" && targetNode.type === WorkflowNodeType.CHECK_ROUTE) ||
        (connection.sourceHandle === "false" && targetNode.type === WorkflowNodeType.AUTH_LOGIN))) ||

    (sourceNode.type === WorkflowNodeType.CHECK_ROUTE &&
      ((connection.sourceHandle === "true" && targetNode.type === WorkflowNodeType.VALIDATE_STOPLIST) ||
        (connection.sourceHandle === "false" && targetNode.type === WorkflowNodeType.SELECT_ROUTE))) ||
    (sourceNode.type === WorkflowNodeType.SELECT_ROUTE && targetNode.type === WorkflowNodeType.VALIDATE_STOPLIST)
  );
}

function plannedConnectionsForDrop(
  state: WorkflowGraphState,
  type: WorkflowNodeType,
  target?: DropTarget,
): { sourceNodeId: string; targetNodeId: string; sourceHandle: SourceHandle }[] {
  if (target?.kind === "branch") {
    const tail = findBranchTail(state, target.nodeId, target.branchType);
    if (!tail) return [];
    return [
      {
        sourceNodeId: tail.nodeId,
        targetNodeId: "__new__",
        sourceHandle: tail.nodeId === target.nodeId ? target.branchType : "default",
      },
    ];
  }

  if (target?.kind === "node") {
    const existing = state.connections.find(
      (connection) => connection.sourceNodeId === target.nodeId && connection.sourceHandle === "default",
    );
    return existing
      ? [
          { sourceNodeId: target.nodeId, targetNodeId: "__new__", sourceHandle: "default" },
          ...(existing.targetNodeId
            ? [{ sourceNodeId: "__new__", targetNodeId: existing.targetNodeId, sourceHandle: "default" as const }]
            : []),
        ]
      : [{ sourceNodeId: target.nodeId, targetNodeId: "__new__", sourceHandle: "default" }];
  }

  if (target?.kind === "connection") {
    const existing = state.connections.find((connection) => connection.id === target.connectionId);
    if (!existing) return [];
    return [
      { sourceNodeId: existing.sourceNodeId, targetNodeId: "__new__", sourceHandle: existing.sourceHandle },
      ...(existing.targetNodeId
        ? [{ sourceNodeId: "__new__", targetNodeId: existing.targetNodeId, sourceHandle: "default" as const }]
        : []),
    ];
  }

  const terminal = findTerminalNode(state.nodes, state.connections);
  return terminal ? [{ sourceNodeId: terminal.id, targetNodeId: "__new__", sourceHandle: "default" }] : [];
}

function targetHasValidatedStopListAncestor(state: WorkflowGraphState, target?: DropTarget) {
  if (!target) return state.nodes.some((node) => stopListEstablishingTypes.has(node.type));
  if (target.kind === "connection") {
    const connection = state.connections.find((candidate) => candidate.id === target.connectionId);
    return Boolean(connection && hasStopListAncestor(state, connection.sourceNodeId));
  }
  if (target.kind === "node") return hasStopListAncestor(state, target.nodeId);
  if (target.kind === "branch") {
    const tail = findBranchTail(state, target.nodeId, target.branchType);
    return Boolean(tail && hasStopListAncestor(state, tail.nodeId));
  }
  const terminal = findTerminalNode(state.nodes, state.connections);
  return Boolean(terminal && hasStopListAncestor(state, terminal.id));
}

function hasConnection(state: WorkflowGraphState, sourceNodeId: string, targetNodeId: string, sourceHandle: SourceHandle) {
  return state.connections.some(
    (connection) =>
      connection.sourceNodeId === sourceNodeId &&
      connection.targetNodeId === targetNodeId &&
      connection.sourceHandle === sourceHandle,
  );
}

function firstNodeOfType(nodes: WorkflowNode[], type: WorkflowNodeType) {
  return nodes.find((node) => node.type === type);
}

function findBranchTail(state: WorkflowGraphState, sourceNodeId: string, branchType: BranchType) {
  const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
  const branchConnection = state.connections.find(
    (connection) =>
      connection.sourceNodeId === sourceNodeId &&
      connection.sourceHandle === branchType &&
      Boolean(connection.targetNodeId) &&
      !connection.isPlaceholder,
  );

  if (!branchConnection?.targetNodeId) {
    return nodeById.has(sourceNodeId) ? { nodeId: sourceNodeId } : null;
  }

  let currentNodeId = branchConnection.targetNodeId;
  const visited = new Set<string>();

  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const nextConnection = state.connections.find(
      (connection) =>
        connection.sourceNodeId === currentNodeId &&
        connection.sourceHandle === "default" &&
        Boolean(connection.targetNodeId) &&
        !connection.isPlaceholder,
    );
    if (!nextConnection?.targetNodeId) return { nodeId: currentNodeId };
    currentNodeId = nextConnection.targetNodeId;
  }

  return currentNodeId ? { nodeId: currentNodeId } : null;
}

function hasPathFromTypes(state: WorkflowGraphState, nodeId: string, types: ReadonlySet<WorkflowNodeType>) {
  const incomingByTarget = new Map<string, Connection[]>();
  state.connections.forEach((connection) => {
    if (!connection.targetNodeId) return;
    incomingByTarget.set(connection.targetNodeId, [...(incomingByTarget.get(connection.targetNodeId) ?? []), connection]);
  });

  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const currentNode = state.nodes.find((node) => node.id === current);
    if (currentNode && types.has(currentNode.type)) return true;
    (incomingByTarget.get(current) ?? []).forEach((connection) => queue.push(connection.sourceNodeId));
  }
  return false;
}

/** True when the stop list is proven at or upstream of `nodeId`. */
function hasStopListAncestor(state: WorkflowGraphState, nodeId: string) {
  return hasPathFromTypes(state, nodeId, stopListEstablishingTypes);
}

function findTerminalNode(nodes: WorkflowNode[], connections: Connection[]) {
  if (nodes.length === 0) return null;
  const sourceIds = new Set(connections.map((connection) => connection.sourceNodeId));
  const terminals = nodes.filter((node) => !sourceIds.has(node.id));
  return [...(terminals.length ? terminals : nodes)].sort((a, b) => a.position.y - b.position.y).at(-1) ?? nodes[0];
}

function dedupeErrors(errors: RuleValidationResult[]) {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key =
      error.nodeId != null
        ? `${error.code ?? "unknown"}:${error.nodeId}`
        : error.code ?? error.message ?? "unknown";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
