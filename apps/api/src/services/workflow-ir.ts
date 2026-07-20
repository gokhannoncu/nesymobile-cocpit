/**
 * Workflow IR — neutral intermediate representation between the editor's
 * node/edge graph and any executable output.
 *
 * The drag-and-drop graph is first linearized into semantic steps (macros,
 * resolved conditions, runtime-conditional blocks); compilers then turn the
 * IR into concrete artifacts. Today the only compiler is the Maestro
 * workspace compiler (yaml-generator.generateWorkflowWorkspace); the IR keeps
 * graph-walking logic in exactly one place so future targets (documentation
 * flows, coverage graphs, manual test scripts) don't re-implement traversal.
 */

export interface IRNode {
  id: string;
  type: string;
  title?: string;
  config?: Record<string, unknown>;
}

export interface IREdge {
  sourceNodeId: string;
  targetNodeId: string | null;
  sourceHandle: "default" | "true" | "false";
  isPlaceholder?: boolean;
}

/** Device state known before the run (GET_STATE preflight). */
export interface IRPreflight {
  isLoggedIn: boolean | null;
  routeSelected: boolean | null;
  evidence?: string;
}

export type IRStep =
  /** A plain action node — compiles to one subflow macro. */
  | { kind: "macro"; node: IRNode }
  /** A condition resolved at compile time; branch nodes are inlined or skipped. */
  | {
      kind: "resolved-condition";
      node: IRNode;
      decision: "skip_branch" | "take_branch";
      evidence: string;
      /** Branch macros to execute (empty when decision is skip_branch). */
      branch: IRNode[];
      /** Node ids eliminated by the decision (empty when take_branch). */
      skippedNodeIds: string[];
    }
  /** A condition that must be decided at runtime from UI visibility. */
  | {
      kind: "runtime-condition";
      node: IRNode;
      branch: IRNode[];
    }
  /** Generic CONDITION node — compiled as a UI-visibility conditional. */
  | { kind: "ui-condition"; node: IRNode };

export interface WorkflowIR {
  steps: IRStep[];
  skippedNodeIds: string[];
}

interface GraphNode {
  id: string;
  type: string;
  data?: { title?: string; config?: Record<string, unknown> };
}

function toIRNode(node: GraphNode): IRNode {
  return { id: node.id, type: node.type, title: node.data?.title, config: node.data?.config };
}

function edgeTarget(edges: IREdge[], sourceNodeId: string, handle: IREdge["sourceHandle"]): string | null {
  return (
    edges.find(
      (e) => e.sourceNodeId === sourceNodeId && e.sourceHandle === handle && e.targetNodeId && !e.isPlaceholder,
    )?.targetNodeId ?? null
  );
}

function collectBranch(edges: IREdge[], startNodeId: string | null, stopAtNodeId: string | null): string[] {
  if (!startNodeId) return [];
  const result: string[] = [];
  const seen = new Set<string>();

  function walk(nodeId: string): void {
    if (stopAtNodeId && nodeId === stopAtNodeId) return;
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    result.push(nodeId);
    for (const edge of edges) {
      if (edge.sourceNodeId === nodeId && edge.targetNodeId && !edge.isPlaceholder) {
        walk(edge.targetNodeId);
      }
    }
  }

  walk(startNodeId);
  return result;
}

/**
 * Linearizes the editor graph into IR steps, resolving IF_LOGIN / CHECK_ROUTE
 * against the preflight state when possible.
 */
export function buildWorkflowIR(
  nodes: GraphNode[],
  edges: IREdge[],
  preflight?: IRPreflight | null,
): WorkflowIR {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const steps: IRStep[] = [];
  const skippedNodeIds: string[] = [];

  function resolveCondition(node: GraphNode): boolean | null {
    if (!preflight) return null;
    if (node.type === "IF_LOGIN") return preflight.isLoggedIn;
    if (node.type === "CHECK_ROUTE") {
      // Only route_selected=true is unambiguous; some flavors never require a
      // route, so false/unknown defers to the runtime UI probe.
      return preflight.routeSelected === true ? true : null;
    }
    return null;
  }

  function branchNodes(startNodeId: string | null, stopAtNodeId: string | null): IRNode[] {
    const result: IRNode[] = [];
    let currentId = startNodeId;
    while (currentId && currentId !== stopAtNodeId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const node = nodeMap.get(currentId);
      if (!node) break;
      result.push(toIRNode(node));
      currentId = edgeTarget(edges, currentId, "default");
    }
    return result;
  }

  function walk(startNodeId: string | null): void {
    let currentId = startNodeId;

    while (currentId) {
      if (visited.has(currentId)) return;
      const node = nodeMap.get(currentId);
      if (!node) return;

      if (node.type === "IF_LOGIN" || node.type === "CHECK_ROUTE") {
        visited.add(currentId);
        const trueTarget = edgeTarget(edges, node.id, "true");
        const falseTarget = edgeTarget(edges, node.id, "false");
        const convergenceId = trueTarget;
        const resolved = resolveCondition(node);

        if (resolved === true) {
          const skipped = collectBranch(edges, falseTarget, convergenceId);
          skippedNodeIds.push(...skipped);
          steps.push({
            kind: "resolved-condition",
            node: toIRNode(node),
            decision: "skip_branch",
            evidence: preflight?.evidence ?? "preflight state",
            branch: [],
            skippedNodeIds: skipped,
          });
        } else if (resolved === false) {
          steps.push({
            kind: "resolved-condition",
            node: toIRNode(node),
            decision: "take_branch",
            evidence: preflight?.evidence ?? "preflight state",
            branch: branchNodes(falseTarget, convergenceId),
            skippedNodeIds: [],
          });
        } else {
          steps.push({
            kind: "runtime-condition",
            node: toIRNode(node),
            branch: branchNodes(falseTarget, convergenceId),
          });
        }

        currentId = convergenceId ?? edgeTarget(edges, node.id, "default");
        continue;
      }

      if (node.type === "CONDITION") {
        visited.add(currentId);
        steps.push({ kind: "ui-condition", node: toIRNode(node) });
        currentId = edgeTarget(edges, node.id, "default");
        continue;
      }

      visited.add(currentId);
      steps.push({ kind: "macro", node: toIRNode(node) });
      currentId = edgeTarget(edges, node.id, "default");
    }
  }

  const startNode = nodes.find((n) => n.type === "LAUNCH_APP") ?? nodes[0];
  walk(startNode?.id ?? null);

  return { steps, skippedNodeIds };
}
