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
  // Both shipment keys set, `stopOrder` deliberately not: the macro resolves the
  // stop the loading just created. The two keys DIFFER — waybill in the search
  // box, short barcode read off the row.
  node("visit", WorkflowNodeType.OPEN_STOP, {
    waybill: "30313215212281",
    shortBarcode: "6880051000313416",
  }),
  node("item", WorkflowNodeType.SCAN_BARCODE, { barcode: "N688011" }),
  node("deliver", WorkflowNodeType.DELIVERY_OPERATION, {
    personDelivered: "Test",
    // Both required by `complete-delivery`, and two different identities: the
    // barcode is typed on the delivery screen, the proof id is what the back
    // office is asked about.
    barcode: "6880051000313515",
    proofLookupId: "72297210092948",
  }),
];

describe("validateWorkflowState — stop list prerequisite", () => {
  it("accepts the seeded full courier day, which proves the stop list through Select Route", () => {
    const errors = validateWorkflowState({ nodes: seededCourierDay, connections: chain(seededCourierDay) });
    expect(errors).toEqual([]);
  });

  it("does not require a stop order on Open Stop, which the macro addresses by entityRef", () => {
    // The two shipment keys ARE required — see workflow-node-config — but the
    // stop order is not, and `seededCourierDay` leaves it blank on purpose.
    const errors = validateWorkflowState({ nodes: seededCourierDay, connections: chain(seededCourierDay) });
    expect(errors.some((error) => error.nodeId === "visit")).toBe(false);
  });

  it("rejects Open Stop with no shipment keys, and names both", () => {
    // Measured on run_56582949: both blank, Run Test allowed it, and the run
    // died 35 steps later on `unresolved-value-ref:run.input.searchTerm` after a
    // real login, route selection, load and tour approval.
    const nodes = seededCourierDay.map((entry) =>
      entry.id === "visit" ? node("visit", WorkflowNodeType.OPEN_STOP) : entry,
    );
    const errors = validateWorkflowState({ nodes, connections: chain(nodes) });
    const visit = errors.filter((error) => error.nodeId === "visit");

    // ONE result, because `dedupeErrors` keys on `code:nodeId` and a second one
    // would be silently dropped.
    expect(visit).toHaveLength(1);
    // And it names the fields. The old shape said only "config is incomplete",
    // which sent the author hunting through an eight-field panel.
    expect(visit[0]?.title).toContain("Waybill");
    expect(visit[0]?.title).toContain("Short Barcode");
    // `detail` is what the dialog actually renders under the title; `title`
    // alone was displayed before, so the field names never reached the screen.
    expect(visit[0]?.detail).toContain("Waybill is required.");
    expect(visit[0]?.detail).toContain("Short Barcode is required.");
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
