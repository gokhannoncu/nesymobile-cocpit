/**
 * ===========================================================================
 *  Full courier golden workflow IR  (Phase 7.6–7.8)
 *
 *  Composes entity discovery + nested FOR_EACH:
 *    availableStops → FOR_EACH route item → parcelState → FOR_EACH item (≤20)
 *
 *  Core identifiers stay domain-neutral (no STOP/PARCEL/BARCODE segments).
 *  Business types live only in Domain Pack opaque refs (queryRef / entityBinding).
 * ===========================================================================
 */

import type { WorkflowStepV2 } from "@nesy/workflow-contract";
import { NESY_ADAPTER_QUERY_REFS } from "../registries/application.js";
import { NESY_ENTITIES } from "../registries/entities.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_TARGETS } from "../registries/targets.js";
import { irDocument, requires, sourceMapEntry, stepBase } from "./ir-authoring.js";

export const NESY_FULL_COURIER_GOLDEN_WORKFLOW_KEY = "nesy.workflow.full-courier-golden";
export const NESY_FULL_COURIER_GOLDEN_SOURCE_REF = "nesy.reference.full-courier-golden";

/** Hard bound for item/barcode loop — CHECKPOINT 7.8. */
export const NESY_BARCODE_FOR_EACH_MAX = 20;

const STEPS: readonly WorkflowStepV2[] = [
  {
    ...stepBase({
      planStepId: "query-route-items",
      sourceMapRef: "sm-golden-1",
      next: "for-each-route-item",
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.availableStops,
    maxRows: 200,
    outputVariable: "routeItems",
  },
  {
    ...stepBase({
      planStepId: "for-each-route-item",
      sourceMapRef: "sm-golden-2",
      next: "branch-on-queue",
      timeoutMs: 480_000,
    }),
    kind: "FOR_EACH",
    itemsVariable: "routeItems",
    maxIterations: 50,
    itemVariable: "loopItem",
    indexVariable: "loopIndex",
    body: "resolve-row",
    emptyPolicy: "OPERATOR_ATTENTION",
  },
  {
    ...stepBase({
      planStepId: "resolve-row",
      sourceMapRef: "sm-golden-3",
      next: "open-row",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.stopRow,
    outputVariable: "rowTarget",
    entityBinding: { type: NESY_ENTITIES.stop, id: "vars.loopItem" },
  },
  {
    ...stepBase({
      planStepId: "open-row",
      sourceMapRef: "sm-golden-4",
      next: "query-items",
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "rowTarget",
    entityBinding: { type: NESY_ENTITIES.stop, id: "vars.loopItem" },
    continueGate: {
      anyOf: [NESY_FACTS.TASK_LIST_READY, NESY_FACTS.DELIVERY_FLOW_READY],
      noneOf: [NESY_FACTS.LOADING_BLOCKER_PRESENT],
      deadlineMs: 20_000,
      unknownPolicy: "RETRY",
    },
  },
  {
    ...stepBase({
      planStepId: "query-items",
      sourceMapRef: "sm-golden-5",
      next: "for-each-item",
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.parcelState,
    maxRows: NESY_BARCODE_FOR_EACH_MAX,
    outputVariable: "itemRows",
  },
  {
    ...stepBase({
      planStepId: "for-each-item",
      sourceMapRef: "sm-golden-6",
      next: "route-item-done",
      timeoutMs: 300_000,
    }),
    kind: "FOR_EACH",
    itemsVariable: "itemRows",
    maxIterations: NESY_BARCODE_FOR_EACH_MAX,
    itemVariable: "item",
    indexVariable: "itemIndex",
    body: "assert-item-processed",
    emptyPolicy: "SKIP",
  },
  {
    ...stepBase({
      planStepId: "assert-item-processed",
      sourceMapRef: "sm-golden-7",
      next: null,
      timeoutMs: 45_000,
    }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.PARCEL_STATE_PROCESSED,
    expected: true,
    unknownPolicy: "FAIL",
    entityBinding: { type: NESY_ENTITIES.parcel, id: "vars.item" },
  },
  {
    ...stepBase({ planStepId: "route-item-done", sourceMapRef: "sm-golden-8", next: null }),
    kind: "NOOP",
    reason: "Route-item occurrence complete; return to outer FOR_EACH",
  },
  {
    ...stepBase({ planStepId: "branch-on-queue", sourceMapRef: "sm-golden-9", next: null }),
    kind: "SWITCH",
    branches: [
      {
        branchId: "queued-offline",
        condition: {
          kind: "comparison",
          operator: "greaterThan",
          left: { kind: "operand", source: "local.result", path: "pendingOperation.count" },
          right: { kind: "literal", value: 0 },
        },
        next: "await-queue-drain",
      },
    ],
    default: { policy: "GOTO", next: "golden-complete" },
    unknownPolicy: "FAIL",
  },
  {
    ...stepBase({
      planStepId: "await-queue-drain",
      sourceMapRef: "sm-golden-10",
      next: "golden-complete",
      timeoutMs: 120_000,
    }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.OFFLINE_QUEUE_DRAINED,
    sourceLane: "LOCAL",
    requireCorrelation: true,
    onTimeout: "INCONCLUSIVE",
  },
  {
    ...stepBase({ planStepId: "golden-complete", sourceMapRef: "sm-golden-11", next: null }),
    kind: "ANNOTATE",
    message:
      "Full courier golden path finished. Offline queue evidence stays on the LOCAL plane (PASS_QUEUED_OFFLINE when subtype=queue).",
  },
];

export const NESY_FULL_COURIER_GOLDEN_IR = irDocument({
  workflowId: NESY_FULL_COURIER_GOLDEN_WORKFLOW_KEY,
  name: "Nested Parcel Processing",
  sourceRef: NESY_FULL_COURIER_GOLDEN_SOURCE_REF,
  entryStepId: "query-route-items",
  inputs: [{ name: "routeCode", type: "string", required: true }],
  variables: [
    { name: "routeItems", type: "stringList" },
    { name: "loopItem", type: "string" },
    { name: "loopIndex", type: "number" },
    { name: "rowTarget", type: "string" },
    { name: "itemRows", type: "stringList" },
    { name: "item", type: "string" },
    { name: "itemIndex", type: "number" },
  ],
  steps: STEPS,
  sourceMap: [
    sourceMapEntry("sm-golden-1", "query-route-items", NESY_FULL_COURIER_GOLDEN_SOURCE_REF, "entity discovery via availableStops"),
    sourceMapEntry("sm-golden-2", "for-each-route-item", NESY_FULL_COURIER_GOLDEN_SOURCE_REF, "outer FOR_EACH occurrence"),
    sourceMapEntry("sm-golden-3", "resolve-row", NESY_FULL_COURIER_GOLDEN_SOURCE_REF),
    sourceMapEntry("sm-golden-4", "open-row", NESY_FULL_COURIER_GOLDEN_SOURCE_REF),
    sourceMapEntry("sm-golden-5", "query-items", NESY_FULL_COURIER_GOLDEN_SOURCE_REF, "entity discovery via parcelState"),
    sourceMapEntry(
      "sm-golden-6",
      "for-each-item",
      NESY_FULL_COURIER_GOLDEN_SOURCE_REF,
      `inner FOR_EACH max=${NESY_BARCODE_FOR_EACH_MAX}`,
    ),
    sourceMapEntry("sm-golden-7", "assert-item-processed", NESY_FULL_COURIER_GOLDEN_SOURCE_REF),
    sourceMapEntry("sm-golden-8", "route-item-done", NESY_FULL_COURIER_GOLDEN_SOURCE_REF),
    sourceMapEntry("sm-golden-9", "branch-on-queue", NESY_FULL_COURIER_GOLDEN_SOURCE_REF, "LOCAL offline queue"),
    sourceMapEntry("sm-golden-10", "await-queue-drain", NESY_FULL_COURIER_GOLDEN_SOURCE_REF),
    sourceMapEntry("sm-golden-11", "golden-complete", NESY_FULL_COURIER_GOLDEN_SOURCE_REF),
  ],
  capabilityRequirements: [
    requires("domain.nesy.adapter.named-query"),
    requires("verdict.core.bridge.resolve-target"),
    requires("verdict.core.bridge.tap"),
  ],
});

export function countGoldenPlanSteps(): number {
  return NESY_FULL_COURIER_GOLDEN_IR.steps.length;
}

export function goldenForEachBounds(): { outerMax: number; innerMax: number } {
  const outer = NESY_FULL_COURIER_GOLDEN_IR.steps.find((s) => s.planStepId === "for-each-route-item");
  const inner = NESY_FULL_COURIER_GOLDEN_IR.steps.find((s) => s.planStepId === "for-each-item");
  if (outer?.kind !== "FOR_EACH" || inner?.kind !== "FOR_EACH") {
    throw new Error("golden IR missing nested FOR_EACH steps");
  }
  return { outerMax: outer.maxIterations, innerMax: inner.maxIterations };
}
