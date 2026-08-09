import { describe, expect, it } from "vitest";
import {
  deriveBackendValidations,
  layoutBackendValidationLane,
} from "./backend-validation-lane";
import { WorkflowNodeType, type WorkflowNode } from "./workflow-types";

function node(type: string, id: string, y: number): WorkflowNode {
  return {
    id,
    type: type as WorkflowNodeType,
    kind: "action",
    position: { x: 0, y },
    data: { title: type, config: {} },
  };
}

describe("LOAD & TOUR backend lane", () => {
  const loadTourNodes = [
    node("LAUNCH_APP", "launch", 0),
    node("LOAD_TO_VEHICLE", "load", 160),
    node("REQUEST_TOUR_START", "tour", 320),
    node("TOUR_APPROVE", "approve", 480),
    node("PICKUP_ASSIGN", "assign", 640),
  ];

  it("derives Tour Approve and Pickup Assign as server_step checks", () => {
    const derived = deriveBackendValidations(loadTourNodes);
    expect(derived.map((d) => d.sourceNodeType)).toEqual([
      "TOUR_APPROVE",
      "PICKUP_ASSIGN",
    ]);
    expect(derived.every((d) => d.kind === "server_step")).toBe(true);
    expect(derived[0]?.description).toContain("ApproveLeavingPermission");
    expect(derived[1]?.description).toContain("AssignPickupToCourier");
  });

  it("layouts Post-BridgeFlow checks header with both cards", () => {
    const lane = layoutBackendValidationLane(loadTourNodes);
    expect(lane.header?.data.title).toBe("Post-BridgeFlow checks");
    expect(lane.nodes).toHaveLength(2);
    expect(lane.nodes.map((n) => n.data.title)).toEqual([
      "Tour Approve",
      "Pickup Assign",
    ]);
  });
});
