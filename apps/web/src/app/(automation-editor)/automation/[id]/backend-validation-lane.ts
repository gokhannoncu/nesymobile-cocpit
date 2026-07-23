/**
 * Backend Validation Lane — canvas-side derive + layout (ephemeral, not persisted).
 */

import {
  WorkflowNodeType,
  type Connection,
  type WorkflowNode,
} from "./workflow-types";

export const BACKEND_VALIDATION_STEP_PREFIX = "__bv__";
export const BACKEND_LANE_HEADER_ID = "__backend_lane_header__";

const BACKEND_REQUIRED_TYPES = new Set<string>([
  WorkflowNodeType.DELIVERY_OPERATION,
  WorkflowNodeType.VALIDATE_STOPLIST,
  WorkflowNodeType.VERIFY_BACKEND_STATE,
  "TOUR_APPROVE",
  "PICKUP_ASSIGN",
  "EOD_APPROVE",
]);

export type BackendValidationKind = "event_tower" | "server_step" | "logcat_backend";

export interface BackendHttpCapture {
  method: string;
  url: string;
  headers?: Record<string, string>;
  requestBody?: unknown;
  status?: number;
  responseBody?: unknown;
  error?: string;
}

export interface BackendValidationStepOutput {
  kind: "backend_validation";
  sourceNodeId: string;
  sourceNodeType: string;
  sourceTitle: string;
  validationKind: BackendValidationKind;
  verdict: "passed" | "failed" | "pending";
  detail: string;
  requests: BackendHttpCapture[];
}

export interface DerivedBackendValidation {
  sourceNodeId: string;
  sourceNodeType: string;
  sourceTitle: string;
  stepNodeId: string;
  kind: BackendValidationKind;
  title: string;
  subtitle: string;
  checkLabel: string;
  description: string;
  sourceIcon: string;
}

export interface BackendValidationPresentation {
  title: string;
  subtitle: string;
  checkLabel: string;
  description: string;
  sourceIcon: string;
}

/** Wider lane cards so validation intent stays readable on canvas. */
export const BACKEND_LANE_NODE_WIDTH = 280;
export const BACKEND_LANE_HEADER_HEIGHT = 68;
export const BACKEND_LANE_STEP_HEIGHT = 96;

const TYPE_LABELS: Record<string, string> = {
  [WorkflowNodeType.VALIDATE_STOPLIST]: "Validate StopList",
  [WorkflowNodeType.DELIVERY_OPERATION]: "Delivery Operation",
  [WorkflowNodeType.VERIFY_BACKEND_STATE]: "Verify Backend State",
  TOUR_APPROVE: "Tour Approve",
  PICKUP_ASSIGN: "Pickup Assign",
  EOD_APPROVE: "EOD Approve",
};

const TYPE_ICONS: Record<string, string> = {
  [WorkflowNodeType.VALIDATE_STOPLIST]: "ListChecks",
  [WorkflowNodeType.DELIVERY_OPERATION]: "Box",
  [WorkflowNodeType.VERIFY_BACKEND_STATE]: "Database",
  TOUR_APPROVE: "ClipboardCheck",
  PICKUP_ASSIGN: "Truck",
  EOD_APPROVE: "Sunset",
};

const CHECK_LABELS: Record<BackendValidationKind, string> = {
  server_step: "Server API",
  event_tower: "EventTower",
  logcat_backend: "Logcat signal",
};

function humanizeType(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function resolveSourceLabel(sourceNodeType: string, sourceTitle: string): string {
  if (sourceTitle && sourceTitle !== sourceNodeType) return sourceTitle;
  return TYPE_LABELS[sourceNodeType] ?? humanizeType(sourceNodeType);
}

function descriptionForValidation(sourceNodeType: string, kind: BackendValidationKind): string {
  switch (sourceNodeType) {
    case WorkflowNodeType.VALIDATE_STOPLIST:
      return "GetMyScheduleByZoneCode — zone, courier, schedule & stop list";
    case WorkflowNodeType.DELIVERY_OPERATION:
      return "EventTower GetEvents confirms delivery status on backend";
    case WorkflowNodeType.VERIFY_BACKEND_STATE:
      return "Logcat backend state matches expected assertion";
    case "TOUR_APPROVE":
      return "GetWaitingLeavingRequests → ApproveLeavingPermission";
    case "PICKUP_ASSIGN":
      return "Device hub/branch/zone → AssignPickupToCourier";
    case "EOD_APPROVE":
      return "End-of-day approval confirmed on server";
    default:
      if (kind === "server_step") return "Server-side API validation after Maestro";
      if (kind === "logcat_backend") return "Backend state verified via app logcat";
      return "EventTower GetEvents confirms operation on backend";
  }
}

export function getBackendValidationPresentation(
  sourceNodeType: string,
  sourceTitle: string,
  kind: BackendValidationKind,
): BackendValidationPresentation {
  const title = resolveSourceLabel(sourceNodeType, sourceTitle);
  const checkLabel = CHECK_LABELS[kind];
  const description = descriptionForValidation(sourceNodeType, kind);
  const sourceIcon = TYPE_ICONS[sourceNodeType] ?? "Database";
  return {
    title,
    subtitle: `Checks ${checkLabel.toLowerCase()} after courier UI step`,
    checkLabel,
    description,
    sourceIcon,
  };
}

export function backendValidationStepId(sourceNodeId: string): string {
  return `${BACKEND_VALIDATION_STEP_PREFIX}${sourceNodeId}`;
}

export function isBackendValidationStepId(nodeId: string): boolean {
  return nodeId.startsWith(BACKEND_VALIDATION_STEP_PREFIX);
}

export function parseBackendValidationOutput(raw: string | null | undefined): BackendValidationStepOutput | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BackendValidationStepOutput>;
    if (parsed.kind !== "backend_validation") return null;
    return parsed as BackendValidationStepOutput;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function nodeNeedsBackendValidation(node: WorkflowNode): boolean {
  const config = asRecord(node.data?.config);
  if (config.verifyBackend === true) return true;

  const policy = config.completionPolicy;
  if (policy && typeof policy === "object" && !Array.isArray(policy)) {
    const required = (policy as Record<string, unknown>).required;
    if (Array.isArray(required) && required.includes("backend")) return true;
  }

  return BACKEND_REQUIRED_TYPES.has(node.type);
}

function kindForType(type: string): BackendValidationKind {
  if (
    type === "VALIDATE_STOPLIST" ||
    type === "TOUR_APPROVE" ||
    type === "PICKUP_ASSIGN" ||
    type === "EOD_APPROVE"
  ) {
    return "server_step";
  }
  if (type === WorkflowNodeType.VERIFY_BACKEND_STATE) return "logcat_backend";
  return "event_tower";
}

export function deriveBackendValidations(nodes: WorkflowNode[]): DerivedBackendValidation[] {
  const derived: DerivedBackendValidation[] = [];
  for (const node of nodes) {
    if (!nodeNeedsBackendValidation(node)) continue;
    const sourceTitle = node.data.title?.trim() || node.type;
    const kind = kindForType(node.type);
    const presentation = getBackendValidationPresentation(node.type, sourceTitle, kind);
    derived.push({
      sourceNodeId: node.id,
      sourceNodeType: node.type,
      sourceTitle,
      stepNodeId: backendValidationStepId(node.id),
      kind,
      title: presentation.title,
      subtitle: presentation.subtitle,
      checkLabel: presentation.checkLabel,
      description: presentation.description,
      sourceIcon: presentation.sourceIcon,
    });
  }
  return derived;
}

const LANE_GAP_X = 320;
/** Vertical gap between lane nodes — matches courier graph `NODE_VERTICAL_GAP`. */
const LANE_VERTICAL_GAP = 56;

export interface BackendLaneLayout {
  header: WorkflowNode | null;
  nodes: WorkflowNode[];
  connections: Connection[];
}

/**
 * Place a read-only Backend Validations lane to the right of the courier graph.
 */
export function layoutBackendValidationLane(
  courierNodes: WorkflowNode[],
  courierNodeWidth = 200,
): BackendLaneLayout {
  const validations = deriveBackendValidations(courierNodes);
  if (validations.length === 0) {
    return { header: null, nodes: [], connections: [] };
  }

  let maxX = 0;
  let minY = Infinity;
  for (const node of courierNodes) {
    maxX = Math.max(maxX, node.position.x + courierNodeWidth);
    minY = Math.min(minY, node.position.y);
  }
  if (!Number.isFinite(minY)) minY = 80;

  const laneX = maxX + LANE_GAP_X;
  const headerY = minY;
  const checkCountLabel =
    validations.length === 1 ? "1 check" : `${validations.length} checks`;

  const header: WorkflowNode = {
    id: BACKEND_LANE_HEADER_ID,
    type: WorkflowNodeType.VERIFY_BACKEND_STATE,
    kind: "assertion",
    position: { x: laneX, y: headerY },
    data: {
      title: "Post-Maestro checks",
      subtitle: `${checkCountLabel} · runs after courier UI test`,
      icon: "Database",
      config: { __backendLaneHeader: true, checkCount: validations.length },
    },
  };

  const nodes: WorkflowNode[] = [];
  const connections: Connection[] = [];
  let prevId = header.id;
  let nextY = headerY + BACKEND_LANE_HEADER_HEIGHT + LANE_VERTICAL_GAP;

  for (const v of validations) {
    const laneNode: WorkflowNode = {
      id: v.stepNodeId,
      type: WorkflowNodeType.VERIFY_BACKEND_STATE,
      kind: "assertion",
      position: { x: laneX, y: nextY },
      data: {
        title: v.title,
        subtitle: v.description,
        icon: v.sourceIcon,
        config: {
          __backendLane: true,
          sourceNodeId: v.sourceNodeId,
          sourceNodeType: v.sourceNodeType,
          validationKind: v.kind,
          checkLabel: v.checkLabel,
          description: v.description,
        },
      },
    };
    nodes.push(laneNode);
    connections.push({
      id: `__bv_conn__${prevId}__${laneNode.id}`,
      sourceNodeId: prevId,
      targetNodeId: laneNode.id,
      sourceHandle: "default",
      targetHandle: "top",
    });
    prevId = laneNode.id;
    nextY += BACKEND_LANE_STEP_HEIGHT + LANE_VERTICAL_GAP;
  }

  return { header, nodes, connections };
}

export function getBackendLaneNodeDimensions(node: Pick<WorkflowNode, "data" | "id">): {
  width: number;
  height: number;
} {
  if (node.id === BACKEND_LANE_HEADER_ID || node.data?.config?.__backendLaneHeader === true) {
    return { width: BACKEND_LANE_NODE_WIDTH, height: BACKEND_LANE_HEADER_HEIGHT };
  }
  if (node.data?.config?.__backendLane === true) {
    return { width: BACKEND_LANE_NODE_WIDTH, height: BACKEND_LANE_STEP_HEIGHT };
  }
  return { width: BACKEND_LANE_NODE_WIDTH, height: BACKEND_LANE_STEP_HEIGHT };
}
