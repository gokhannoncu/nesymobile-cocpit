/**
 * ===========================================================================
 *  Legacy workflow migration  (Plan D.5.12 · D.6A.8 · RUN_PLAY 4A.5)
 *
 *  Existing workflows are editor graphs: nodes with business types, edges with
 *  `default`/`true`/`false` handles. They must survive the move to IR v2, and
 *  the move must be reviewable — hence a source map on every produced step.
 *
 *  The design decision that matters here: this migrator does NOT know a single
 *  legacy node type.
 *
 *  A lookup table mapping `LOAD_TO_VEHICLE` or `OPEN_SHIPMENT` to generic steps
 *  would be the shortest possible path to exactly the leak Phase 4A exists to
 *  prevent — business vocabulary, permanently, inside Verdict Core. So the
 *  caller supplies the mapping (a Domain Pack concern) and Core supplies the
 *  graph walk, the ordering, the source map and the failure mode.
 *
 *  An unmapped node type is a hard error, never a NOOP. Silently dropping a
 *  step produces a workflow that runs, passes, and tests nothing.
 * ===========================================================================
 */

import type { ConditionNode, UnknownPolicy } from "./condition.js";
import { migrateLegacyOracleLists, type FinalOraclePolicy, type LegacyParallelOracleLists } from "./evidence-policy.js";
import {
  WORKFLOW_IR_VERSION,
  type StepRetryPolicy,
  type WorkflowIrV2,
  type WorkflowPolicies,
  type WorkflowSourceMapEntry,
  type WorkflowStepV2,
} from "./ir-v2.js";

export interface LegacyWorkflowNode {
  id: string;
  type: string;
  title?: string;
  config?: Record<string, unknown>;
}

export interface LegacyWorkflowEdge {
  sourceNodeId: string;
  targetNodeId: string | null;
  sourceHandle: "default" | "true" | "false";
  isPlaceholder?: boolean;
}

export interface LegacyWorkflowConfig {
  workflowId: string;
  workflowVersion?: number;
  name: string;
  nodes: readonly LegacyWorkflowNode[];
  edges: readonly LegacyWorkflowEdge[];
  /** Node id to start from; falls back to the first node. */
  entryNodeId?: string;
}

/**
 * What one legacy node type becomes.
 *
 * Intentionally a small set. The migrator is a preservation tool, not the
 * production compiler — that is Phase 4C's job (BridgeFlowCompiler). Anything
 * the small set cannot express should fail loudly and be authored in v2
 * directly.
 */
export type LegacyNodeMapping =
  | { to: "BRIDGE_ACTION"; action: string; args?: Readonly<Record<string, string | number | boolean | null>> }
  | { to: "CONDITION"; condition: ConditionNode; unknownPolicy: UnknownPolicy; onUnknown?: string | null }
  | { to: "WAIT_EVENT"; factKey: string; onTimeout: "FAIL" | "INCONCLUSIVE" | "CONTINUE"; requireCorrelation?: boolean }
  | { to: "ASSERT_FACT"; factKey: string; expected: boolean; unknownPolicy: UnknownPolicy }
  | { to: "ANNOTATE"; message: string }
  | { to: "NOOP"; reason: string };

export interface LegacyMigrationOptions {
  /** Legacy node type → generic IR step. Supplied by the Domain Pack. */
  nodeMappings: Readonly<Record<string, LegacyNodeMapping>>;
  /**
   * Maps a legacy oracle kind (`ui`, `mobileEvent`, `backend`) to a normalized
   * fact key. Omit to migrate without oracle policies.
   */
  factKeyForLegacyOracle?: (oracleKind: string, nodeType: string) => string | null;
  policies: WorkflowPolicies;
  /** Default per-step timeout when the legacy node declares none. */
  defaultStepTimeoutMs: number;
}

export type LegacyMigrationErrorCode =
  | "UNSUPPORTED_LEGACY_ACTION"
  | "MISSING_ENTRY_NODE"
  | "DUPLICATE_NODE_ID"
  | "AMBIGUOUS_ORACLE_LISTS";

export interface LegacyMigrationError {
  nodeId?: string;
  nodeType?: string;
  code: LegacyMigrationErrorCode;
  message: string;
}

export type LegacyMigrationResult =
  | { ok: true; ir: WorkflowIrV2 }
  | { ok: false; errors: readonly LegacyMigrationError[] };

const NO_RETRY: StepRetryPolicy = { maxAttempts: 1, effectClass: "READ_ONLY" };

/**
 * Migrates a legacy graph into IR v2.
 *
 * Deterministic by construction: steps are emitted in graph-walk order from the
 * entry node, and `sourceMapRef` is derived from the node id rather than a
 * counter, so re-running the migration on the same input produces a
 * byte-identical document — which is what makes the golden hash fixtures
 * meaningful.
 */
export function migrateLegacyWorkflow(
  legacy: LegacyWorkflowConfig,
  options: LegacyMigrationOptions,
): LegacyMigrationResult {
  const errors: LegacyMigrationError[] = [];
  const byId = new Map<string, LegacyWorkflowNode>();

  for (const node of legacy.nodes) {
    if (byId.has(node.id)) {
      errors.push({ nodeId: node.id, code: "DUPLICATE_NODE_ID", message: `duplicate legacy node id "${node.id}"` });
      continue;
    }
    byId.set(node.id, node);
  }

  const entryNodeId = legacy.entryNodeId ?? legacy.nodes[0]?.id;
  if (entryNodeId === undefined || !byId.has(entryNodeId)) {
    errors.push({ code: "MISSING_ENTRY_NODE", message: "legacy config has no usable entry node" });
    return { ok: false, errors };
  }

  // Every node must be mappable before anything is emitted. A partial
  // migration that silently drops the tail is worse than no migration.
  for (const node of legacy.nodes) {
    if (options.nodeMappings[node.type] === undefined) {
      errors.push({
        nodeId: node.id,
        nodeType: node.type,
        code: "UNSUPPORTED_LEGACY_ACTION",
        message: `legacy node type "${node.type}" has no mapping; supply one or re-author the step in IR v2`,
      });
    }
  }

  const steps: WorkflowStepV2[] = [];
  const sourceMap: WorkflowSourceMapEntry[] = [];
  const visited = new Set<string>();
  const order: string[] = [];

  // Deterministic depth-first walk: default edge first, then true, then false.
  // Handle order is fixed rather than edge-array order so a reordered database
  // read cannot change the emitted step order.
  const walk = (nodeId: string): void => {
    if (visited.has(nodeId) || !byId.has(nodeId)) return;
    visited.add(nodeId);
    order.push(nodeId);
    for (const handle of ["default", "true", "false"] as const) {
      const target = edgeTarget(legacy.edges, nodeId, handle);
      if (target !== null) walk(target);
    }
  };
  walk(entryNodeId);

  // Nodes the graph cannot reach are still migrated — losing them would lose
  // work — but the source map records that they were orphaned.
  for (const node of legacy.nodes) {
    if (!visited.has(node.id)) order.push(node.id);
  }

  for (const nodeId of order) {
    const node = byId.get(nodeId);
    if (node === undefined) continue;
    const mapping = options.nodeMappings[node.type];
    if (mapping === undefined) continue;

    const ref = `legacy:${node.id}`;
    sourceMap.push({
      ref,
      planStepId: node.id,
      sourceNodeId: node.id,
      legacyPath: `nodes[${legacy.nodes.findIndex((n) => n.id === node.id)}]`,
      ...(node.title === undefined ? {} : { note: node.title }),
    });

    const oracle = migrateNodeOracle(node, options, errors);
    const base = {
      planStepId: node.id,
      sourceMapRef: ref,
      timeoutMs: readTimeout(node) ?? options.defaultStepTimeoutMs,
      retryPolicy: NO_RETRY,
      capabilityRequirements: [],
      next: edgeTarget(legacy.edges, node.id, "default"),
      ...(oracle === null ? {} : { finalOraclePolicy: oracle }),
    };

    switch (mapping.to) {
      case "BRIDGE_ACTION":
        steps.push({
          ...base,
          kind: "BRIDGE_ACTION",
          action: mapping.action,
          ...(mapping.args === undefined ? {} : { args: mapping.args }),
        });
        break;
      case "CONDITION":
        steps.push({
          ...base,
          kind: "CONDITION",
          condition: mapping.condition,
          // The legacy graph's `true` handle continued the main flow and
          // `false` entered the branch; preserving that mapping is what keeps
          // migrated workflows behaving the way they did.
          onTrue: edgeTarget(legacy.edges, node.id, "true"),
          onFalse: edgeTarget(legacy.edges, node.id, "false"),
          unknownPolicy: mapping.unknownPolicy,
          ...(mapping.unknownPolicy === "BRANCH" ? { onUnknown: mapping.onUnknown ?? null } : {}),
        });
        break;
      case "WAIT_EVENT":
        steps.push({
          ...base,
          kind: "WAIT_EVENT",
          factKey: mapping.factKey,
          requireCorrelation: mapping.requireCorrelation ?? true,
          onTimeout: mapping.onTimeout,
        });
        break;
      case "ASSERT_FACT":
        steps.push({
          ...base,
          kind: "ASSERT_FACT",
          factKey: mapping.factKey,
          expected: mapping.expected,
          unknownPolicy: mapping.unknownPolicy,
        });
        break;
      case "ANNOTATE":
        steps.push({ ...base, kind: "ANNOTATE", message: mapping.message });
        break;
      case "NOOP":
        steps.push({ ...base, kind: "NOOP", reason: mapping.reason });
        break;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    ir: {
      schemaVersion: WORKFLOW_IR_VERSION,
      workflowId: legacy.workflowId,
      workflowVersion: legacy.workflowVersion ?? 1,
      name: legacy.name,
      source: { kind: "LEGACY_CONFIG", ref: legacy.workflowId },
      inputs: [],
      variables: [],
      steps,
      entryStepId: entryNodeId,
      policies: options.policies,
      capabilityRequirements: [],
      sourceMap,
    },
  };
}

function edgeTarget(
  edges: readonly LegacyWorkflowEdge[],
  sourceNodeId: string,
  handle: LegacyWorkflowEdge["sourceHandle"],
): string | null {
  return (
    edges.find(
      (e) => e.sourceNodeId === sourceNodeId && e.sourceHandle === handle && e.targetNodeId !== null && e.isPlaceholder !== true,
    )?.targetNodeId ?? null
  );
}

function readTimeout(node: LegacyWorkflowNode): number | null {
  const raw = node.config?.timeoutMs;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}

/**
 * Converts a legacy `completionPolicy.required` array into a Final Oracle
 * policy, or records an ambiguity error.
 *
 * The legacy array conflated obligation with timing, which is the whole reason
 * {@link migrateLegacyOracleLists} exists; here we only translate oracle kinds
 * to fact keys and hand the shape problem to it.
 */
function migrateNodeOracle(
  node: LegacyWorkflowNode,
  options: LegacyMigrationOptions,
  errors: LegacyMigrationError[],
): FinalOraclePolicy | null {
  const mapFact = options.factKeyForLegacyOracle;
  if (mapFact === undefined) return null;

  const policy = node.config?.completionPolicy;
  if (typeof policy !== "object" || policy === null) return null;
  const required = (policy as Record<string, unknown>).required;
  if (!Array.isArray(required)) return null;

  const legacyLists: LegacyParallelOracleLists = {
    required: required
      .filter((kind): kind is string => typeof kind === "string")
      .map((kind) => mapFact(kind, node.type))
      .filter((factKey): factKey is string => factKey !== null),
  };
  if ((legacyLists.required ?? []).length === 0) return null;

  const result = migrateLegacyOracleLists(legacyLists);
  if (!result.ok) {
    for (const error of result.errors) {
      errors.push({
        nodeId: node.id,
        nodeType: node.type,
        code: "AMBIGUOUS_ORACLE_LISTS",
        message: `${error.code}: ${error.message}`,
      });
    }
    return null;
  }
  return result.policy;
}
