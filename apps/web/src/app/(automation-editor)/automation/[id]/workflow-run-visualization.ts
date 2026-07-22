import type { RunStatusResponse } from "@/services/automation-api";
import type { Connection } from "./workflow-types";

export const VIRTUAL_START_NODE_ID = "__start__";
export const VIRTUAL_START_CONNECTION_ID = "__start_to_launch__";

export const TRAVERSED_CONNECTION_COLOR = "#22c55e";

export type NodeExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped"
  | "cancelled";

export interface WorkflowRunVisualization {
  runId: string;
  runStatus: string;
  currentStepId: string | null;
  isActive: boolean;
  nodeStatusById: Record<string, NodeExecutionStatus>;
  traversedConnectionIds: Set<string>;
}

function coerceNodeStatus(status: string): NodeExecutionStatus {
  if (
    status === "running" ||
    status === "success" ||
    status === "failed" ||
    status === "skipped" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "pending";
}

function isNodeReached(status: NodeExecutionStatus): boolean {
  return status !== "pending" && status !== "skipped";
}

function computeTraversedConnectionIds(
  connections: Connection[],
  nodeStatusById: Record<string, NodeExecutionStatus>,
): Set<string> {
  const traversed = new Set<string>();

  for (const connection of connections) {
    if (!connection.targetNodeId) continue;
    if (connection.isPlaceholder && connection.sourceHandle === "default") continue;

    const targetStatus = nodeStatusById[connection.targetNodeId] ?? "pending";
    if (!isNodeReached(targetStatus)) continue;

    const sourceReady =
      connection.sourceNodeId === VIRTUAL_START_NODE_ID
        ? isNodeReached(targetStatus)
        : nodeStatusById[connection.sourceNodeId] === "success";

    if (!sourceReady) continue;

    traversed.add(connection.id);
  }

  return traversed;
}

export function buildWorkflowRunVisualization(
  status: RunStatusResponse,
  connections: Connection[],
): WorkflowRunVisualization {
  const nodeStatusById: Record<string, NodeExecutionStatus> = {};

  for (const step of status.steps) {
    nodeStatusById[step.nodeId] = coerceNodeStatus(step.status);
  }

  const isActive = status.runStatus === "running" || status.runStatus === "pending";
  const anyStepReached = status.steps.some((step) => isNodeReached(coerceNodeStatus(step.status)));

  if (isActive) {
    nodeStatusById[VIRTUAL_START_NODE_ID] = anyStepReached ? "success" : "running";
  } else if (anyStepReached) {
    nodeStatusById[VIRTUAL_START_NODE_ID] = "success";
  }

  const backendLaneSteps = status.steps.filter((step) => step.nodeId.startsWith("__bv__"));
  if (backendLaneSteps.length > 0) {
    const anyBvRunning = backendLaneSteps.some((s) => coerceNodeStatus(s.status) === "running");
    const anyBvFailed = backendLaneSteps.some((s) => coerceNodeStatus(s.status) === "failed");
    const allBvDone = backendLaneSteps.every((s) => {
      const st = coerceNodeStatus(s.status);
      return st === "success" || st === "failed" || st === "skipped" || st === "cancelled";
    });
    const anyBvReached = backendLaneSteps.some((s) => isNodeReached(coerceNodeStatus(s.status)));
    if (anyBvRunning) {
      nodeStatusById["__backend_lane_header__"] = "running";
    } else if (anyBvFailed && allBvDone) {
      nodeStatusById["__backend_lane_header__"] = "failed";
    } else if (allBvDone && anyBvReached) {
      nodeStatusById["__backend_lane_header__"] = "success";
    } else if (isActive && anyBvReached) {
      nodeStatusById["__backend_lane_header__"] = "running";
    }
  }

  const traversedConnectionIds = computeTraversedConnectionIds(connections, nodeStatusById);

  if (anyStepReached) {
    traversedConnectionIds.add(VIRTUAL_START_CONNECTION_ID);
  }

  // Traverse backend lane connections when targets are reached.
  for (const connection of connections) {
    if (!connection.id.startsWith("__bv_conn__")) continue;
    if (!connection.targetNodeId) continue;
    const targetStatus = nodeStatusById[connection.targetNodeId] ?? "pending";
    if (!isNodeReached(targetStatus)) continue;
    const sourceReady =
      connection.sourceNodeId === "__backend_lane_header__"
        ? isNodeReached(targetStatus)
        : nodeStatusById[connection.sourceNodeId] === "success" ||
          nodeStatusById[connection.sourceNodeId] === "failed" ||
          nodeStatusById[connection.sourceNodeId] === "running";
    if (sourceReady || connection.sourceNodeId === "__backend_lane_header__") {
      traversedConnectionIds.add(connection.id);
    }
  }

  return {
    runId: status.runId,
    runStatus: status.runStatus,
    currentStepId: status.currentStepId,
    isActive,
    nodeStatusById,
    traversedConnectionIds,
  };
}

export function getCanvasNodeExecutionStatus(
  nodeId: string,
  visualization: WorkflowRunVisualization | null | undefined,
): NodeExecutionStatus | null {
  if (!visualization) return null;
  const status = visualization.nodeStatusById[nodeId] ?? "pending";
  if (status === "pending") return null;
  return status;
}
