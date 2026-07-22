import { describe, expect, it } from "vitest";
import { generateWorkflowWorkspace } from "./yaml-generator.js";
import { buildWorkflowIR } from "./workflow-ir.js";

type TestNode = {
  id: string;
  type: string;
  kind: string;
  position: { x: number; y: number };
  data: { title: string; config?: Record<string, unknown> };
};

type TestEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string | null;
  sourceHandle: "default" | "true" | "false";
  targetHandle: string | null;
};

function node(id: string, type: string, config?: Record<string, unknown>): TestNode {
  return { id, type, kind: "action", position: { x: 0, y: 0 }, data: { title: type, config } };
}

function edge(source: string, target: string, handle: "default" | "true" | "false" = "default"): TestEdge {
  return { id: `${source}->${target}`, sourceNodeId: source, targetNodeId: target, sourceHandle: handle, targetHandle: null };
}

const linearNodes = [
  node("n1", "LAUNCH_APP", { country: "HR", environment: "stage" }),
  node("n2", "AUTH_LOGIN", { pinCode: "1234" }),
  node("n3", "SELECT_ROUTE", { routeNumber: "102" }),
];
const linearEdges = [edge("n1", "n2"), edge("n2", "n3")];

const conditionalNodes = [
  node("n1", "LAUNCH_APP", { country: "HR", environment: "stage" }),
  node("if1", "IF_LOGIN"),
  node("login", "AUTH_LOGIN", { pinCode: "1234" }),
  node("route", "SELECT_ROUTE", { routeNumber: "102" }),
];
const conditionalEdges = [
  edge("n1", "if1"),
  edge("if1", "route", "true"),
  edge("if1", "login", "false"),
  edge("login", "route"),
];

function options(nodes: TestNode[], edges: TestEdge[]) {
  return { workflowId: "wf", runId: "run", nodes, edges } as Parameters<typeof generateWorkflowWorkspace>[0];
}

describe("generateWorkflowWorkspace", () => {
  it("emits one subflow file per action node, chained from main.yaml", () => {
    const workspace = generateWorkflowWorkspace(options(linearNodes, linearEdges));

    expect(workspace.mainFile).toBe("main.yaml");
    // main.yaml + 3 subflows
    expect(workspace.files).toHaveLength(4);

    const main = workspace.files.find((f) => f.relativePath === "main.yaml")!;
    const runFlowCount = (main.content.match(/- runFlow:\n    file: flows\//g) ?? []).length;
    expect(runFlowCount).toBe(3);

    // Step markers surround each runFlow so stdout tracking keeps working.
    expect(main.content).toContain('NESY_STEP::START::n1::LAUNCH_APP');
    expect(main.content).toContain('NESY_STEP::DONE::n3::SELECT_ROUTE');
  });

  it("skips the login branch when preflight says already logged in", () => {
    const workspace = generateWorkflowWorkspace(options(conditionalNodes, conditionalEdges), {
      isLoggedIn: true,
      routeSelected: null,
      evidence: "GET_STATE: is_logged_in=true",
    });

    expect(workspace.skippedNodeIds).toEqual(["login"]);
    expect(workspace.conditionDecisions).toEqual([
      expect.objectContaining({ nodeId: "if1", decision: "skip_branch" }),
    ]);

    const main = workspace.files.find((f) => f.relativePath === "main.yaml")!;
    expect(main.content).not.toContain("AUTH_LOGIN");
    expect(main.content).toContain("SELECT_ROUTE");
  });

  it("inlines the login branch when preflight says logged out", () => {
    const workspace = generateWorkflowWorkspace(options(conditionalNodes, conditionalEdges), {
      isLoggedIn: false,
      routeSelected: null,
      evidence: "GET_STATE: is_logged_in=false",
    });

    expect(workspace.skippedNodeIds).toEqual([]);
    expect(workspace.conditionDecisions).toEqual([
      expect.objectContaining({ nodeId: "if1", decision: "take_branch" }),
    ]);

    const main = workspace.files.find((f) => f.relativePath === "main.yaml")!;
    expect(main.content).toContain("AUTH_LOGIN");
    // Branch node became a normal subflow — still exactly one Maestro run.
    expect(workspace.files.some((f) => f.relativePath.includes("AUTH_LOGIN"))).toBe(true);
  });

  it("falls back to a UI-visibility conditional when preflight is unavailable", () => {
    const workspace = generateWorkflowWorkspace(options(conditionalNodes, conditionalEdges), null);

    expect(workspace.conditionDecisions).toEqual([
      expect.objectContaining({ nodeId: "if1", decision: "runtime_fallback" }),
    ]);

    const main = workspace.files.find((f) => f.relativePath === "main.yaml")!;
    expect(main.content).toContain("runFlow:\n    when:\n      visible:");
    expect(main.content).toContain("btn_login");
  });

  it("runs LAUNCH_APP before the deferred IF_LOGIN runtime probe", () => {
    // Matches WorkflowRunner defer_to_runtime: null preflight when LAUNCH_APP is present.
    const workspace = generateWorkflowWorkspace(options(conditionalNodes, conditionalEdges), null);
    const main = workspace.files.find((f) => f.relativePath === "main.yaml")!.content;

    const launchIdx = main.indexOf("NESY_STEP::START::n1::LAUNCH_APP");
    const ifLoginIdx = main.indexOf("NESY_STEP::START::if1::IF_LOGIN");
    expect(launchIdx).toBeGreaterThanOrEqual(0);
    expect(ifLoginIdx).toBeGreaterThan(launchIdx);
  });
});

describe("buildWorkflowIR", () => {
  it("linearizes a plain workflow into macro steps", () => {
    const ir = buildWorkflowIR(linearNodes, linearEdges, null);
    expect(ir.steps.map((s) => s.kind)).toEqual(["macro", "macro", "macro"]);
    expect(ir.skippedNodeIds).toEqual([]);
  });

  it("records skipped branch nodes when a condition resolves to true", () => {
    const ir = buildWorkflowIR(conditionalNodes, conditionalEdges, {
      isLoggedIn: true,
      routeSelected: null,
    });
    expect(ir.skippedNodeIds).toEqual(["login"]);
    const condition = ir.steps.find((s) => s.kind === "resolved-condition");
    expect(condition).toBeDefined();
  });
});
