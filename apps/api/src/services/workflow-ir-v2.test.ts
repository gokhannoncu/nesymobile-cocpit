import { hashWorkflowIrV2, validateWorkflowIrV2, type LegacyWorkflowConfig } from "@nesy/workflow-contract";
import { describe, expect, it } from "vitest";

import {
  MIGRATABLE_LEGACY_NODE_TYPES,
  migrateLegacyGraphToIrV2Skeleton,
  readWorkflowIrV2,
} from "./workflow-ir-v2.js";

/** A graph shaped like the ones the editor stores today. */
const legacyGraph = (): LegacyWorkflowConfig => ({
  workflowId: "wf-legacy-1",
  workflowVersion: 7,
  name: "Legacy delivery flow",
  entryNodeId: "n1",
  nodes: [
    { id: "n1", type: "LAUNCH_APP" },
    { id: "n2", type: "IF_LOGIN" },
    { id: "n3", type: "CHECK_ROUTE" },
    {
      id: "n4",
      type: "DELIVERY_OPERATION",
      config: { completionPolicy: { required: ["ui", "mobileEvent", "backend"] }, timeoutMs: 90000 },
    },
  ],
  edges: [
    { sourceNodeId: "n1", targetNodeId: "n2", sourceHandle: "default" },
    { sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "true" },
    { sourceNodeId: "n2", targetNodeId: "n4", sourceHandle: "false" },
    { sourceNodeId: "n3", targetNodeId: "n4", sourceHandle: "true" },
  ],
});

describe("legacy graph → IR v2 skeleton", () => {
  it("covers the node types the repo actually uses", () => {
    for (const type of [
      "LAUNCH_APP",
      "IF_LOGIN",
      "CHECK_ROUTE",
      "CONDITION",
      "LOAD_TO_VEHICLE",
      "SCAN_BARCODE",
      "DELIVERY_OPERATION",
      "VALIDATE_STOPLIST",
      "REQUEST_TOUR_START",
      "OPEN_SHIPMENT",
      "OPEN_PARCEL",
      "VERIFY_BACKEND_STATE",
      "TOUR_APPROVE",
      "PICKUP_ASSIGN",
      "EOD_APPROVE",
    ]) {
      expect(MIGRATABLE_LEGACY_NODE_TYPES).toContain(type);
    }
  });

  it("produces a document the shared validator accepts", () => {
    const result = migrateLegacyGraphToIrV2Skeleton(legacyGraph());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateWorkflowIrV2(result.ir)).toEqual([]);
    expect(result.ir.schemaVersion).toBe(2);
    expect(result.ir.source).toEqual({ kind: "LEGACY_CONFIG", ref: "wf-legacy-1" });
  });

  it("carries a per-step source map back to the editor node", () => {
    const result = migrateLegacyGraphToIrV2Skeleton(legacyGraph());
    if (!result.ok) throw new Error("migration failed");
    expect(result.ir.sourceMap.map((e) => e.sourceNodeId)).toEqual(["n1", "n2", "n3", "n4"]);
    for (const step of result.ir.steps) {
      expect(result.ir.sourceMap.some((e) => e.ref === step.sourceMapRef)).toBe(true);
    }
  });

  it("honours a legacy per-node timeout instead of overriding it", () => {
    const result = migrateLegacyGraphToIrV2Skeleton(legacyGraph());
    if (!result.ok) throw new Error("migration failed");
    expect(result.ir.steps.find((s) => s.planStepId === "n4")?.timeoutMs).toBe(90000);
  });

  it("folds completionPolicy.required into unified oracle requirements", () => {
    const result = migrateLegacyGraphToIrV2Skeleton(legacyGraph());
    if (!result.ok) throw new Error("migration failed");
    const requirements = result.ir.steps.find((s) => s.planStepId === "n4")?.finalOraclePolicy?.requirements ?? [];
    expect(requirements.map((r) => r.factKey).sort()).toEqual([
      "app.step_business_event_reported",
      "remote.step_backend_confirmed",
      "ui.step_commands_completed",
    ]);
    // Obligation and timing now live on the same requirement — the whole point
    // of dropping the parallel required[]/eventual[] arrays.
    for (const requirement of requirements) {
      expect(requirement.obligation).toBe("REQUIRED");
      expect(requirement.timing).toBe("IMMEDIATE");
    }
  });

  it("is deterministic, so the plan hash is a usable identity", () => {
    const a = migrateLegacyGraphToIrV2Skeleton(legacyGraph());
    const b = migrateLegacyGraphToIrV2Skeleton(legacyGraph());
    if (!a.ok || !b.ok) throw new Error("migration failed");
    expect(hashWorkflowIrV2(a.ir)).toBe(hashWorkflowIrV2(b.ir));
  });

  it("refuses an unmapped node type rather than dropping the step", () => {
    const graph = legacyGraph();
    const result = migrateLegacyGraphToIrV2Skeleton({
      ...graph,
      nodes: [...graph.nodes, { id: "n9", type: "SOME_FUTURE_NODE" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe("UNSUPPORTED_LEGACY_ACTION");
  });
});

describe("host-side IR v2 read", () => {
  it("rejects malformed input with field paths instead of throwing", () => {
    const result = readWorkflowIrV2({ schemaVersion: 2, steps: "nope" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((i) => typeof i.path === "string")).toBe(true);
  });

  it("rejects a plan that hard-requires a capability a Bridge v1 device lacks (B-13)", () => {
    const migrated = migrateLegacyGraphToIrV2Skeleton(legacyGraph());
    if (!migrated.ok) throw new Error("migration failed");
    const hardened = {
      ...migrated.ir,
      capabilityRequirements: [{ capability: "bridge.wait_any", optional: false }],
    };
    const result = readWorkflowIrV2(hardened, ["bridge.tap"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.code)).toContain("UNSUPPORTED_CAPABILITY");
  });
});
