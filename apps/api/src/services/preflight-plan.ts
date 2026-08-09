/**
 * Decides when IF_LOGIN / CHECK_ROUTE may be resolved from GET_STATE.
 *
 * Pulling device state BEFORE LAUNCH_APP is unsafe: the process can report a
 * stale logged-in StopList while runtime launch lands on the PIN login screen.
 * When a LAUNCH_APP node is present, branch resolution must wait until after
 * launch (runtime UI probes).
 */

export type PreflightNode = {
  type: string;
  data?: { config?: Record<string, unknown> };
};

export type PreflightPlan =
  | { kind: "force_logged_out"; evidence: string }
  | { kind: "pull_now" }
  | { kind: "defer_to_runtime"; evidence: string };

const LOG_CONDITION_TYPES = new Set(["IF_LOGIN", "CHECK_ROUTE"]);

export function hasLogConditionNodes(nodes: PreflightNode[]): boolean {
  return nodes.some((node) => LOG_CONDITION_TYPES.has(node.type));
}

export function planPreflight(nodes: PreflightNode[]): PreflightPlan {
  const launchNode = nodes.find((node) => node.type === "LAUNCH_APP");
  if (launchNode?.data?.config?.clearState === true) {
    return {
      kind: "force_logged_out",
      evidence: "LAUNCH_APP clearState=true — state is wiped at launch",
    };
  }

  if (launchNode) {
    return {
      kind: "defer_to_runtime",
      evidence:
        "LAUNCH_APP present — defer IF_LOGIN/CHECK_ROUTE until after launch (pre-launch GET_STATE can be stale)",
    };
  }

  return { kind: "pull_now" };
}
