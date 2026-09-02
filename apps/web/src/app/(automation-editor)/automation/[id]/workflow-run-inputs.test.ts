/**
 * The bug these pin: a node's settings were collected, validated and then
 * dropped on the way to the run.
 *
 * Measured on run_d5bae2af — a barcode typed into Load to Vehicle never became
 * `run.input.scanValue`, the step that types it reported SUCCESS against an
 * empty dialog, and the run failed four steps later citing something else.
 */
import { describe, expect, it } from "vitest";

import { WorkflowNodeType } from "./workflow-types";
import {
  collectMissingRunInputs,
  collectRunInputs,
  type RunInputNode,
} from "./workflow-run-inputs";

function node(
  type: WorkflowNodeType,
  config: Record<string, unknown> = {},
  id = `${type}-1`,
): RunInputNode {
  return { type, id, data: { config } };
}

describe("collectRunInputs", () => {
  it("sends the Load to Vehicle barcode as scanValue", () => {
    // The regression itself. `run.input.scanValue` is what
    // `load-to-vehicle.ts` addresses; the canvas calls the field `barcode`.
    const inputs = collectRunInputs([
      node(WorkflowNodeType.LOAD_TO_VEHICLE, { barcode: "6880051000310910" }),
    ]);

    expect(inputs).toEqual({ scanValue: "6880051000310910" });
  });

  it("still sends the inputs that already worked", () => {
    const inputs = collectRunInputs([
      node(WorkflowNodeType.AUTH_LOGIN, { pinCode: "3680" }),
      node(WorkflowNodeType.SELECT_ROUTE, { routeNumber: "36" }),
    ]);

    expect(inputs).toEqual({ pin: "3680", routeCode: "36" });
  });

  it("collects every node on the canvas, not just the first two", () => {
    const inputs = collectRunInputs([
      node(WorkflowNodeType.AUTH_LOGIN, { pinCode: "3680" }),
      node(WorkflowNodeType.SELECT_ROUTE, { routeNumber: "36" }),
      node(WorkflowNodeType.LOAD_TO_VEHICLE, { barcode: "688005" }),
      node(WorkflowNodeType.SCAN_BARCODE, { barcode: "999111" }),
      node(WorkflowNodeType.OPEN_STOP, { stopOrder: 12 }),
    ]);

    expect(inputs).toEqual({
      pin: "3680",
      routeCode: "36",
      scanValue: "688005",
      scanPayload: "999111",
      rowKey: "12",
    });
  });

  it("omits an empty value rather than sending a blank string", () => {
    // A blank resolves fine and then gets typed into the field — which is how a
    // missing barcode became a successful-looking step. Absent is honest.
    const inputs = collectRunInputs([
      node(WorkflowNodeType.LOAD_TO_VEHICLE, { barcode: "   " }),
    ]);

    expect(inputs).toEqual({});
    expect("scanValue" in inputs).toBe(false);
  });

  it("contributes nothing for a node with no binding", () => {
    expect(collectRunInputs([node(WorkflowNodeType.REQUEST_TOUR_START)])).toEqual({});
  });

  it("accepts a numeric config value", () => {
    expect(collectRunInputs([node(WorkflowNodeType.SEARCH_STOP, { stopOrder: 7 })])).toEqual({
      searchTerm: "7",
    });
  });
});

describe("collectMissingRunInputs", () => {
  it("reports a required input the author left blank", () => {
    const missing = collectMissingRunInputs([
      node(WorkflowNodeType.LOAD_TO_VEHICLE, { barcode: "" }, "load-node"),
    ]);

    expect(missing).toEqual([
      {
        nodeId: "load-node",
        nodeType: WorkflowNodeType.LOAD_TO_VEHICLE,
        configKey: "barcode",
        runInputName: "scanValue",
      },
    ]);
  });

  it("reports nothing when every required input is set", () => {
    const missing = collectMissingRunInputs([
      node(WorkflowNodeType.AUTH_LOGIN, { pinCode: "3680" }),
      node(WorkflowNodeType.LOAD_TO_VEHICLE, { barcode: "688005" }),
    ]);

    expect(missing).toEqual([]);
  });

  it("does not report an optional input", () => {
    const missing = collectMissingRunInputs([
      node(WorkflowNodeType.DELIVERY_OPERATION, { barcode: "" }),
    ]);

    expect(missing).toEqual([]);
  });

  it("reports each offending node separately", () => {
    const missing = collectMissingRunInputs([
      node(WorkflowNodeType.LOAD_TO_VEHICLE, {}, "load-1"),
      node(WorkflowNodeType.SCAN_BARCODE, {}, "scan-1"),
    ]);

    expect(missing.map((item) => item.nodeId)).toEqual(["load-1", "scan-1"]);
  });
});
