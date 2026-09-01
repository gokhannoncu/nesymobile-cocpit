import { describe, expect, it } from "vitest";

import { validateWorkflowState } from "./workflow-rule-engine";
import { WorkflowNodeType, type Connection, type WorkflowNode } from "./workflow-types";

function node(id: string, type: WorkflowNodeType, config: Record<string, unknown> = {}): WorkflowNode {
  return {
    id,
    type,
    kind: "action",
    position: { x: 380, y: 80 },
    data: { title: id, config },
  };
}

function chain(nodes: WorkflowNode[]): Connection[] {
  return nodes.slice(0, -1).map((source, index) => ({
    id: `${source.id}-to-${nodes[index + 1]!.id}`,
    sourceNodeId: source.id,
    targetNodeId: nodes[index + 1]!.id,
    sourceHandle: "default",
    targetHandle: "top",
  }));
}

/**
 * The canvas the Domain Pack seed authors for `nesy.workflow.full-courier-day`.
 * It carries no Validate StopList node because the pack's own macros bind
 * `APP.AVAILABLE_STOPS_LOADED` from route selection onward.
 */
const seededCourierDay = [
  node("launch-app", WorkflowNodeType.LAUNCH_APP, { country: "RS", environment: "stage", clearState: false }),
  node("grant-permissions", WorkflowNodeType.GRANT_PERMISSIONS),
  node("auth-login", WorkflowNodeType.AUTH_LOGIN, { pinCode: "3680" }),
  node("select-route", WorkflowNodeType.SELECT_ROUTE, { routeNumber: "36" }),
  node("load", WorkflowNodeType.LOAD_TO_VEHICLE, { barcode: "N688011" }),
  node("permit", WorkflowNodeType.REQUEST_TOUR_START),
  node("visit", WorkflowNodeType.OPEN_STOP),
  node("item", WorkflowNodeType.SCAN_BARCODE, { barcode: "N688011" }),
  node("deliver", WorkflowNodeType.DELIVERY_OPERATION, { personDelivered: "Test" }),
];

describe("validateWorkflowState — stop list prerequisite", () => {
  it("accepts the seeded full courier day, which proves the stop list through Select Route", () => {
    const errors = validateWorkflowState({ nodes: seededCourierDay, connections: chain(seededCourierDay) });
    expect(errors).toEqual([]);
  });

  it("does not require a stop order on Open Stop, which the macro addresses by entityRef", () => {
    const errors = validateWorkflowState({ nodes: seededCourierDay, connections: chain(seededCourierDay) });
    expect(errors.some((error) => error.nodeId === "visit")).toBe(false);
  });

  it("requires Grant Permissions directly between Launch App and Auth / Login", () => {
    const nodes = [
      node("launch-app", WorkflowNodeType.LAUNCH_APP),
      node("auth-login", WorkflowNodeType.AUTH_LOGIN, { pinCode: "3680" }),
    ];
    const errors = validateWorkflowState({ nodes, connections: chain(nodes) });
    expect(errors.map((error) => error.code)).toContain("MISSING_PERMISSIONS_AFTER_LAUNCH");
  });

  it("still rejects a courier operation with no route selection upstream", () => {
    const nodes = [
      node("launch-app", WorkflowNodeType.LAUNCH_APP, { country: "RS", environment: "stage", clearState: false }),
      node("load", WorkflowNodeType.LOAD_TO_VEHICLE, { barcode: "N688011" }),
    ];
    const errors = validateWorkflowState({ nodes, connections: chain(nodes) });
    expect(errors.map((error) => error.code)).toContain("COURIER_OPERATION_BEFORE_VALIDATE");
  });
});
