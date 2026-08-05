/**
 * Host-side seam onto the shared WorkflowIR v2 contract (Phase 4A).
 *
 * `@nesy/workflow-contract` is domain-neutral by construction; this file is
 * where the repo's *existing* legacy editor node types are named, because they
 * are Nesy vocabulary and must not enter the shared package. The same mapping
 * table will later be owned by the Nesy Courier Domain Pack (Phase 4B); until
 * then it lives here, next to the legacy runner it describes.
 *
 * What this migration is and is not:
 *
 *   IS  — a preservation and provenance tool. It turns a stored editor graph
 *         into a valid, source-mapped IR v2 skeleton so no workflow is lost and
 *         every migrated step can be traced back to the node it came from.
 *
 *   NOT — an executable compiler. The per-node Maestro command sequence is
 *         deliberately not translated; that is Phase 4C's BridgeFlowCompiler.
 *         Hence `…IrV2Skeleton` in the name: a caller that mistook this for a
 *         runnable plan would silently execute nothing and report success.
 */

import {
  migrateLegacyWorkflow,
  parseWorkflowIrV2,
  type LegacyMigrationResult,
  type LegacyNodeMapping,
  type LegacyWorkflowConfig,
  type ParseResult,
  type WorkflowIrV2,
  type WorkflowPolicies,
} from "@nesy/workflow-contract";

/** Fact keys the legacy oracle kinds resolve to. */
const LEGACY_ORACLE_FACT_KEYS: Record<string, string> = {
  ui: "ui.step_commands_completed",
  mobileEvent: "app.step_business_event_reported",
  backend: "remote.step_backend_confirmed",
};

/**
 * Legacy editor node type → generic IR v2 step.
 *
 * Action nodes become `ASSERT_FACT` rather than `BRIDGE_ACTION`: what the legacy
 * model actually recorded per node was its completion oracle, and the UI command
 * list belongs to Maestro until 4C. Mapping them to a bridge action would
 * fabricate a plan that looks executable and is not.
 */
const LEGACY_NODE_MAPPINGS: Record<string, LegacyNodeMapping> = {
  LAUNCH_APP: { to: "BRIDGE_ACTION", action: "launchApp" },

  // The two preflight-resolved conditions. `RETRY` rather than `FAIL` on
  // UNKNOWN mirrors today's behavior: an unresolved preflight deferred to the
  // runtime UI probe instead of failing the run.
  IF_LOGIN: {
    to: "CONDITION",
    condition: { kind: "existence", operator: "exists", operand: { kind: "operand", source: "sdk.state", path: "session.authenticated" } },
    unknownPolicy: "RETRY",
  },
  CHECK_ROUTE: {
    to: "CONDITION",
    condition: {
      kind: "comparison",
      operator: "equals",
      left: { kind: "operand", source: "sdk.state", path: "route.selected" },
      right: { kind: "literal", value: true },
    },
    unknownPolicy: "RETRY",
  },
  CONDITION: {
    to: "CONDITION",
    condition: {
      kind: "comparison",
      operator: "equals",
      left: { kind: "operand", source: "bridge.visible" },
      right: { kind: "literal", value: true },
    },
    unknownPolicy: "RETRY",
  },

  LOAD_TO_VEHICLE: { to: "ASSERT_FACT", factKey: "app.load_pipeline_completed", expected: true, unknownPolicy: "INCONCLUSIVE" },
  SCAN_BARCODE: { to: "ASSERT_FACT", factKey: "app.item_scanned", expected: true, unknownPolicy: "INCONCLUSIVE" },
  DELIVERY_OPERATION: { to: "ASSERT_FACT", factKey: "app.delivery_ui_completed", expected: true, unknownPolicy: "INCONCLUSIVE" },
  VALIDATE_STOPLIST: { to: "ASSERT_FACT", factKey: "remote.schedule_validated", expected: true, unknownPolicy: "INCONCLUSIVE" },
  REQUEST_TOUR_START: { to: "ASSERT_FACT", factKey: "app.leaving_request_created", expected: true, unknownPolicy: "INCONCLUSIVE" },
  OPEN_SHIPMENT: { to: "ASSERT_FACT", factKey: "app.entity_detail_opened", expected: true, unknownPolicy: "INCONCLUSIVE" },
  OPEN_PARCEL: { to: "ASSERT_FACT", factKey: "app.entity_detail_opened", expected: true, unknownPolicy: "INCONCLUSIVE" },
  VERIFY_BACKEND_STATE: { to: "ASSERT_FACT", factKey: "remote.state_verified", expected: true, unknownPolicy: "INCONCLUSIVE" },
  TOUR_APPROVE: { to: "ASSERT_FACT", factKey: "remote.lifecycle_approved", expected: true, unknownPolicy: "INCONCLUSIVE" },
  PICKUP_ASSIGN: { to: "ASSERT_FACT", factKey: "remote.assignment_confirmed", expected: true, unknownPolicy: "INCONCLUSIVE" },
  EOD_APPROVE: { to: "ASSERT_FACT", factKey: "remote.day_close_confirmed", expected: true, unknownPolicy: "INCONCLUSIVE" },
};

/** Node types this migration understands. Anything else fails explicitly. */
export const MIGRATABLE_LEGACY_NODE_TYPES: readonly string[] = Object.keys(LEGACY_NODE_MAPPINGS);

/**
 * Run-level policies for migrated workflows.
 *
 * Conservative on purpose: no retries and no artifacts on success, so migrating
 * a workflow cannot change how much it does or how much it stores.
 */
export const MIGRATION_DEFAULT_POLICIES: WorkflowPolicies = {
  runDeadlineMs: 30 * 60 * 1000,
  cleanupDeadlineMs: 2 * 60 * 1000,
  defaultRetry: { maxAttempts: 1, effectClass: "READ_ONLY" },
  artifactPolicy: { captureOnSuccess: false, captureOnFailure: true, kinds: ["SCREENSHOT", "UI_TREE"] },
  redactionPolicy: {},
};

const DEFAULT_STEP_TIMEOUT_MS = 60 * 1000;

/**
 * Migrates a stored editor graph into a source-mapped IR v2 skeleton.
 *
 * Returns the contract's own error list on failure — an unmapped node type is
 * never silently dropped, because a workflow that quietly loses a step still
 * runs and still reports green.
 */
export function migrateLegacyGraphToIrV2Skeleton(legacy: LegacyWorkflowConfig): LegacyMigrationResult {
  return migrateLegacyWorkflow(legacy, {
    nodeMappings: LEGACY_NODE_MAPPINGS,
    policies: MIGRATION_DEFAULT_POLICIES,
    defaultStepTimeoutMs: DEFAULT_STEP_TIMEOUT_MS,
    factKeyForLegacyOracle: (oracleKind) => LEGACY_ORACLE_FACT_KEYS[oracleKind] ?? null,
  });
}

/**
 * Validates an IR v2 document arriving from an untrusted source.
 *
 * `availableCapabilities` carries B-13 to the host boundary: a plan that
 * hard-requires `wait_any` or `cancel_request` is rejected here rather than
 * half-executed on a Bridge v1 device.
 */
export function readWorkflowIrV2(
  input: unknown,
  availableCapabilities?: readonly string[],
): ParseResult<WorkflowIrV2> {
  return parseWorkflowIrV2(input, availableCapabilities === undefined ? {} : { availableCapabilities });
}
