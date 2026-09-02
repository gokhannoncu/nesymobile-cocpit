/**
 * ===========================================================================
 *  FULL COURIER DAY — seven macros composed into one run
 *
 *  Login → select route → load the vehicle (zimmet) → request and approve the
 *  tour → open a stop → process a parcel → complete the delivery.
 *
 *  WHY THIS EXISTS ALONGSIDE THE SEVEN SINGLE-MACRO WORKFLOWS
 *
 *  The dedicated workflows each judge ONE product claim, and they stay that way:
 *  a login defect must not be reported as a delivery failure. What none of them
 *  can answer is whether the day HOLDS END TO END — whether the schedule route
 *  selection creates, the parcel loading fills, and the tour approval unblocks
 *  is still the same schedule the delivery is written against. Every hand-off in
 *  that sentence is a place the product has broken before, and each of those
 *  breaks is invisible to a run that installs the previous state from a launch
 *  profile instead of producing it.
 *
 *  ONE composed macro, not seven macroRefs on a workflow: an empty canvas can
 *  only auto-materialize from ONE expansion snapshot. This is the same reason
 *  `login-and-select-route` exists, and the reason manifest 1.2.0 collapsed five
 *  workflows back to a single macro each.
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  THE COMPOSITION IS NOT A CONCATENATION. Six things had to be decided.
 *
 *  1. STEP IDS AND VARIABLES ARE NAMESPACED PER LEG.
 *     Nine plan-step ids collide across these seven macros (`tap-row`,
 *     `read-local-schedule`, `resolve-manual-entry`, `tap-input-confirm`,
 *     `resolve-scan-field`, …) and so do several variables (`rowHandle`,
 *     `confirmHandle`, `manualEntryHandle`, `scanFieldHandle`, `loadedRows`).
 *     A straight concatenation is not merely untidy, it is INVALID — the IR
 *     validator rejects a duplicate `planStepId` — and if it had been accepted,
 *     `tap-row` would have meant the route row and the stop row at once, and one
 *     leg's stale target handle would have been tapped by another.
 *
 *     Leg prefixes are deliberately domain-NEUTRAL (`auth` `route` `load`
 *     `permit` `visit` `item` `deliver`) because variable names are Core
 *     identifiers: `stopRowHandle` or `parcelRows` would trip the domain-leakage
 *     guard, which exists so business vocabulary stays in Domain Pack refs.
 *
 *  2. EACH LEG'S CLOSING ASSERTION CONTINUES INTO THE NEXT LEG'S ENTRY.
 *     Only that one edge is rewritten per leg. Every other `next`, every CONDITION
 *     branch and the delivery SWITCH keep their own targets — including
 *     select-route's not-offered dead end, which must still stop the run rather
 *     than fall through into vehicle loading.
 *
 *  3. THE POST-LOGIN GATE ALSO ADMITS THE ROUTE DIALOG.
 *     Login's `tap-submit` closed on `UI.ROUTE_LIST_READY` alone. After a cold
 *     PIN login the route dialog sits on TOP of the stop list, so a run whose PIN
 *     was accepted timed out waiting for a list it could not see. Same stitch as
 *     `login-and-select-route`.
 *
 *  4. FOUR RE-WAITS BECOME CONFIRMATORY INSTEAD OF FATAL.
 *     Each leg opens by waiting for the screen it works on. Standalone that is
 *     correct. Chained it is a re-wait for a fact the PREVIOUS leg's continue
 *     gate already consumed, and manifest 1.21.1 records what that costs: a
 *     device event is stamped with the occurrence the host last seeded, so a wait
 *     looks under its own occurrence and never finds a fact that had plainly
 *     arrived. Four such pairs exist here:
 *
 *       route-tap-confirm  (UI.ROUTE_LIST_READY)    → load-wait-stop-list-ready
 *       visit-tap-row      (UI.TASK_LIST_READY)     → item-wait-task-list
 *       item-tap-input-confirm (delivery flow)      → deliver-wait-flow
 *       auth-tap-submit    (UI.ROUTE_DIALOG_READY)  → route-wait-dialog
 *
 *     They keep their step — the timeline should still show that the screen was
 *     checked — but `onTimeout` becomes CONTINUE on a short budget. The screen is
 *     already proven; if it is genuinely wrong the next RESOLVE_TARGET says which
 *     control is missing, which is a better report than "waited 20s for an event".
 *     `onTimeout: "CONTINUE"` for a confirmatory wait is the shape tour approval's
 *     own `await-push` already uses.
 *
 *  5. THE PUSH NOTIFICATION LIST IS HANDLED, AND ONLY THIS COMPOSITION NEEDS IT.
 *     `nesy.notification-list-dialog` is screen-scoped to the stop list and only
 *     a push puts it there. In the standalone tour-approval workflow the run ENDS
 *     just after the push, so the dialog never blocked anything. Here the very
 *     next leg searches the stop list UNDERNEATH it — which is exactly the
 *     failure manifest 1.16.0 describes ("every following run failed on the
 *     screen underneath it"). Handled here, with the pack's own dismiss handler.
 *
 *  6. PRECONDITIONS ARE LOGIN'S ONLY — NOT THE UNION.
 *     Unioning them would make the run unstartable by construction: open-stop
 *     requires `APP.AVAILABLE_STOPS_LOADED` and tour approval requires
 *     `REMOTE.TOUR_APPROVAL_CONFIRMED` to be FALSE, and both are statements about
 *     the middle of this run, not its start. Every downstream precondition is
 *     PRODUCED by an upstream leg, which is the whole point of the composition.
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  THE FINAL ORACLE IS BUILT FROM THE ASSERT_FACT STEPS, NOT FROM THE MACRO
 *  `oracleTemplate.finalOracle` FIELDS.
 *
 *  Those two have drifted in the source macros, and the step-level policy is the
 *  current one. `process-parcel` is the clearest case: its slice was rewritten in
 *  1.20.0/1.21.0 around `APP.DELIVERY_FLOW_STARTED`, and its ASSERT_FACT says so,
 *  while its `oracleTemplate` still asks for `LOCAL.PARCEL_RECORD_PERSISTED` and
 *  `APP.SESSION_ISOLATION_ASSERTED` — a local write that branch does not perform
 *  and an assertion 1.21.0 deliberately dropped. Merging the templates would have
 *  imported requirements nothing in this run can satisfy and failed a correct day.
 *
 *  This is also why the legs keep their own `finalOraclePolicy`: the evidence
 *  compiler accumulates them across steps, so the run is judged on all seven
 *  legs' evidence without anything here restating it.
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  INPUTS: the three barcode inputs are separate ON PURPOSE.
 *
 *  `scanValue` (loaded), `scanPayload` (processed at the stop) and
 *  `consignmentNumber` (delivered) are each their source leg's own declared
 *  input, and in a single-parcel golden day an operator gives all three the SAME
 *  value. They are not collapsed into one because a courier's day legitimately
 *  loads several parcels and delivers one of them, and unifying the name would
 *  quietly forbid that while also rewriting each leg's contract.
 * ===========================================================================
 */

import type {
  BridgeFlowPlanSnapshot,
  InterruptPolicy,
  MacroDefinition,
  MacroExpansionSnapshot,
  MacroOutputField,
  MacroPrecondition,
} from "@nesy/domain-pack-contracts";
import type {
  OracleRequirement,
  WorkflowCapabilityRequirement,
  WorkflowInputDeclaration,
  WorkflowIrV2,
  WorkflowSourceMapEntry,
  WorkflowStepV2,
  WorkflowVariableDeclaration,
} from "@nesy/workflow-contract";
import { NESY_COMPLETE_DELIVERY_MACRO } from "./complete-delivery.js";
import { irDocument } from "./ir-authoring.js";
import { NESY_LOAD_TO_VEHICLE_MACRO } from "./load-to-vehicle.js";
import { NESY_LOGIN_MACRO } from "./login.js";
import { NESY_OPEN_STOP_MACRO } from "./open-stop.js";
import { NESY_PROCESS_PARCEL_MACRO } from "./process-parcel.js";
import { NESY_SELECT_ROUTE_MACRO } from "./select-route.js";
import { NESY_TOUR_APPROVAL_MACRO } from "./tour-approval-lifecycle.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_ACTIONS, NESY_SURFACES } from "../registries/screens.js";

export const NESY_FULL_COURIER_DAY_MACRO_KEY = "nesy.macro.full-courier-day";
export const NESY_FULL_COURIER_DAY_WORKFLOW_KEY = "nesy.workflow.full-courier-day";

// ───────────────────────────────────────────────────────────────────────────
//  Leg declarations
// ───────────────────────────────────────────────────────────────────────────

interface LegSeed {
  /** Domain-neutral namespace for this leg's step ids and variables. */
  readonly prefix: string;
  readonly macro: MacroDefinition;
  readonly sliceRef: string;
  /** The leg's closing ASSERT_FACT — the only step whose `next` is rewritten. */
  readonly exitStepId: string;
  readonly note: string;
}

const LEG_SEEDS: readonly LegSeed[] = [
  {
    prefix: "auth",
    macro: NESY_LOGIN_MACRO,
    sliceRef: "COURIER_LOGIN",
    exitStepId: "assert-login",
    note: "PIN login on a cold start; its tap-submit gate also admits the route dialog.",
  },
  {
    prefix: "route",
    macro: NESY_SELECT_ROUTE_MACRO,
    sliceRef: "SELECT_ROUTE",
    exitStepId: "assert-selection",
    note: "Route selection, which creates today's schedule empty.",
  },
  {
    prefix: "load",
    macro: NESY_LOAD_TO_VEHICLE_MACRO,
    sliceRef: "LOAD_TO_VEHICLE",
    exitStepId: "assert-loaded",
    note: "Zimmet: the step that gives the empty schedule a body and a stop.",
  },
  {
    prefix: "permit",
    macro: NESY_TOUR_APPROVAL_MACRO,
    sliceRef: "TOUR_APPROVAL_LIFECYCLE",
    exitStepId: "assert-approved",
    note: "Tour requested by the courier, approved by the dispatcher as a second actor.",
  },
  {
    prefix: "visit",
    macro: NESY_OPEN_STOP_MACRO,
    sliceRef: "OPEN_STOP",
    exitStepId: "assert-correct-item",
    note: "Opens the stop the loading leg created, addressed through the product's own search.",
  },
  {
    prefix: "item",
    macro: NESY_PROCESS_PARCEL_MACRO,
    sliceRef: "PROCESS_PARCEL",
    exitStepId: "assert-delivery-started",
    note: "Scan on the task page, which opens the delivery flow.",
  },
  {
    prefix: "deliver",
    macro: NESY_COMPLETE_DELIVERY_MACRO,
    sliceRef: "COMPLETE_DELIVERY",
    exitStepId: "assert-confirmed",
    note: "The unpaid DELY path: scan, Complete, choose option, confirm.",
  },
];

// ───────────────────────────────────────────────────────────────────────────
//  Namespacing
// ───────────────────────────────────────────────────────────────────────────

/** Keys whose string value names another step in the same leg. */
const STEP_REF_KEYS = new Set(["next", "onTrue", "onFalse", "onUnknown", "body", "onWin"]);

/** Keys whose string value names a variable declared by the same leg. */
const VARIABLE_REF_KEYS = new Set([
  "outputVariable",
  "targetVariable",
  "itemsVariable",
  "itemVariable",
  "indexVariable",
]);

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface LegNames {
  readonly stepIds: ReadonlySet<string>;
  readonly variableNames: ReadonlySet<string>;
  step: (id: string) => string;
  variable: (name: string) => string;
}

function legNames(prefix: string, ir: WorkflowIrV2): LegNames {
  const stepIds = new Set(ir.steps.map((step) => step.planStepId));
  const variableNames = new Set(ir.variables.map((variable) => variable.name));
  return {
    stepIds,
    variableNames,
    // Guarded rather than unconditional: a name this leg does not declare is not
    // this leg's to rename, and renaming it anyway would forge a dangling ref
    // that the IR validator would then report against the wrong leg.
    step: (id) => (stepIds.has(id) ? `${prefix}-${id}` : id),
    variable: (name) => (variableNames.has(name) ? `${prefix}${capitalize(name)}` : name),
  };
}

/**
 * Rewrites one leg's internal references onto its namespace.
 *
 * Driven by key name rather than by step kind, so a field added to a source
 * macro later is covered without this file having to enumerate every step shape.
 * `spec` subtrees (REMOTE_ACTION) are carried through untouched by construction:
 * they address `run.input.*` and `entityRef`, never a step id or a variable, and
 * none of their keys appear in the two sets above.
 */
function rewriteReferences(value: unknown, names: LegNames): unknown {
  if (Array.isArray(value)) return value.map((entry) => rewriteReferences(entry, names));
  if (!isRecord(value)) return value;

  // An operand reading a previous step's output addresses it as "<head>.<column>",
  // where <head> is EITHER a step id (`read-offered-routes.match_key`) or an
  // output variable (`queueRows.pending_count`). Both spellings occur in these
  // seven macros, so the head is resolved against what the leg declares.
  if (value.kind === "operand" && value.source === "step.output" && typeof value.path === "string") {
    const [head, ...rest] = value.path.split(".");
    if (head !== undefined) {
      const renamed = names.stepIds.has(head)
        ? names.step(head)
        : names.variableNames.has(head)
          ? names.variable(head)
          : head;
      return { ...value, path: [renamed, ...rest].join(".") };
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "planStepId" && typeof entry === "string") {
      result[key] = names.step(entry);
    } else if (key === "compensatesStepIds" && Array.isArray(entry)) {
      result[key] = entry.map((id) => (typeof id === "string" ? names.step(id) : id));
    } else if (STEP_REF_KEYS.has(key) && typeof entry === "string") {
      result[key] = names.step(entry);
    } else if (VARIABLE_REF_KEYS.has(key) && typeof entry === "string") {
      result[key] = names.variable(entry);
    } else if (key === "id" && typeof entry === "string" && entry.startsWith("vars.")) {
      result[key] = `vars.${names.variable(entry.slice("vars.".length))}`;
    } else if (typeof entry === "string" && entry.startsWith("var.")) {
      /**
       * A `var.<name>[.<column>]` reference inside a step's ARGS.
       *
       * The two key-name sets above cover the fields that HOLD a variable name
       * (`outputVariable`, `targetVariable`, …). They do not cover a variable
       * named inside a value — and `BRIDGE_ACTION.args` is full of those: the
       * host resolves `var.<name>` the same way it resolves `run.input.<name>`.
       *
       * Measured 2026-09-01 (run_237cb164), the first composed run that actually
       * had to open the route spinner: `scroll-to-row` carries
       * `rowIndex: "var.offeredRouteRows.route_index"`, the leg had renamed the
       * variable to `routeOfferedRouteRows`, and the arg still pointed at the old
       * name. The host resolved nothing, the device was asked to scroll to row
       * "-" and answered `missing_scroll_target`. Every earlier composed run had
       * found the route already selected and skipped this branch entirely, so the
       * dangling reference had never been executed.
       */
      const [head, ...rest] = entry.slice("var.".length).split(".");
      result[key] =
        head !== undefined && names.variableNames.has(head)
          ? [`var.${names.variable(head)}`, ...rest].join(".")
          : entry;
    } else {
      result[key] = rewriteReferences(entry, names);
    }
  }
  return result;
}

interface NamespacedLeg extends LegSeed {
  readonly entryStepId: string;
  readonly exitStepIdNamespaced: string;
  readonly steps: readonly WorkflowStepV2[];
  readonly variables: readonly WorkflowVariableDeclaration[];
  readonly inputs: readonly WorkflowInputDeclaration[];
  readonly sourceMap: readonly WorkflowSourceMapEntry[];
  readonly capabilityRequirements: readonly WorkflowCapabilityRequirement[];
  readonly finalOracleRequirements: readonly OracleRequirement[];
}

function namespaceLeg(seed: LegSeed): NamespacedLeg {
  const snapshot = seed.macro.expansionSnapshot;
  if (snapshot === undefined) {
    throw new Error(`${seed.macro.macroKey} is missing its expansion snapshot`);
  }
  const ir = snapshot.genericIr;
  const names = legNames(seed.prefix, ir);

  const steps = ir.steps.map((step) => rewriteReferences(step, names) as WorkflowStepV2);

  const exit = steps.find((step) => step.planStepId === names.step(seed.exitStepId));
  if (exit === undefined) {
    throw new Error(`${seed.macro.macroKey} has no exit step "${seed.exitStepId}"`);
  }
  if (exit.kind !== "ASSERT_FACT") {
    throw new Error(`${seed.macro.macroKey} exit step "${seed.exitStepId}" must be an ASSERT_FACT`);
  }

  return {
    ...seed,
    entryStepId: names.step(ir.entryStepId),
    exitStepIdNamespaced: exit.planStepId,
    steps,
    variables: ir.variables.map((variable) => ({ ...variable, name: names.variable(variable.name) })),
    inputs: ir.inputs,
    sourceMap: ir.sourceMap.map((entry) => ({ ...entry, planStepId: names.step(entry.planStepId) })),
    capabilityRequirements: [
      ...ir.capabilityRequirements,
      ...steps.flatMap((step) => step.capabilityRequirements),
    ],
    // The step's policy, not the macro's template: see the file header.
    finalOracleRequirements: exit.finalOraclePolicy?.requirements ?? [],
  };
}

const LEGS: readonly NamespacedLeg[] = LEG_SEEDS.map(namespaceLeg);

// ───────────────────────────────────────────────────────────────────────────
//  Stitching
// ───────────────────────────────────────────────────────────────────────────

/**
 * Re-waits the previous leg already proved, keyed by the step that proved them.
 *
 * Header note 4. Kept as steps and left in the timeline, but they may no longer
 * end the run: the budget is short because a fact stamped under an earlier
 * occurrence will not arrive at all, and there is nothing to be gained by
 * waiting out the original deadline for it.
 */
const CONFIRMATORY_WAIT_BUDGET_MS = 8_000;

const CONFIRMATORY_RE_WAITS: readonly { stepId: string; provenBy: string }[] = [
  { stepId: "route-wait-dialog", provenBy: "auth-tap-submit" },
  { stepId: "load-wait-stop-list-ready", provenBy: "route-tap-confirm" },
  { stepId: "item-wait-task-list", provenBy: "visit-tap-row" },
  { stepId: "deliver-wait-flow", provenBy: "item-tap-input-confirm" },
];

const CONFIRMATORY_WAIT_IDS = new Set(CONFIRMATORY_RE_WAITS.map((entry) => entry.stepId));

/** Leg exit → next leg entry. The last leg's exit stays terminal. */
const STITCH_EDGES: ReadonlyMap<string, string> = new Map(
  LEGS.slice(0, -1).map((leg, index) => [leg.exitStepIdNamespaced, LEGS[index + 1]!.entryStepId]),
);

function stitchStep(step: WorkflowStepV2): WorkflowStepV2 {
  const continuation = STITCH_EDGES.get(step.planStepId);
  if (continuation !== undefined) {
    return { ...step, next: continuation };
  }

  // Header note 3: after a cold login the route dialog covers the stop list, so
  // the run must be allowed to close on either one.
  if (step.planStepId === "auth-tap-submit" && step.kind === "BRIDGE_ACTION") {
    return {
      ...step,
      continueGate: {
        anyOf: [NESY_FACTS.ROUTE_LIST_READY, NESY_FACTS.ROUTE_DIALOG_READY, NESY_FACTS.LOGIN_REJECTED],
        noneOf: [NESY_FACTS.SESSION_EXPIRED_DIALOG_PRESENT],
        deadlineMs: 30_000,
        unknownPolicy: "RETRY",
      },
    };
  }

  if (CONFIRMATORY_WAIT_IDS.has(step.planStepId) && step.kind === "WAIT_EVENT") {
    return { ...step, timeoutMs: CONFIRMATORY_WAIT_BUDGET_MS, onTimeout: "CONTINUE" };
  }

  return step;
}

const STEPS: readonly WorkflowStepV2[] = LEGS.flatMap((leg) => leg.steps).map(stitchStep);

// ───────────────────────────────────────────────────────────────────────────
//  Merged declarations
// ───────────────────────────────────────────────────────────────────────────

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/** Dedupes by `name`, first leg wins. Inputs of the same name are one value. */
function mergeByName<T extends { name: string }>(entries: readonly T[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const entry of entries) {
    if (seen.has(entry.name)) continue;
    seen.add(entry.name);
    merged.push(entry);
  }
  return merged;
}

/**
 * Merges capability requirements without silently hardening an optional one.
 *
 * `wait_any` is declared OPTIONAL with a `SEQUENTIAL_LEGS` fallback by open-stop
 * precisely so a Bridge v1 device can still run the plan (B-13). Deduping to
 * "first wins" would keep that; deduping to `requires(...)` — as a plain string
 * union would — would reject those devices outright. A hard requirement anywhere
 * still wins over an optional one.
 */
function mergeCapabilities(
  entries: readonly WorkflowCapabilityRequirement[],
): WorkflowCapabilityRequirement[] {
  const byCapability = new Map<string, WorkflowCapabilityRequirement>();
  for (const entry of entries) {
    const existing = byCapability.get(entry.capability);
    if (existing === undefined) {
      byCapability.set(entry.capability, entry);
      continue;
    }
    if (existing.optional && !entry.optional) byCapability.set(entry.capability, entry);
  }
  return [...byCapability.values()];
}

/** Dedupes oracle requirements by fact key, earliest leg wins. */
function mergeOracleRequirements(entries: readonly OracleRequirement[]): OracleRequirement[] {
  const seen = new Set<string>();
  const merged: OracleRequirement[] = [];
  for (const entry of entries) {
    if (seen.has(entry.factKey)) continue;
    seen.add(entry.factKey);
    merged.push(entry);
  }
  return merged;
}

/**
 * Merges macro output fields, renaming a name two legs give different meanings.
 *
 * Tour approval and complete-delivery both publish a field called `confirmed`,
 * from `REMOTE.TOUR_APPROVAL_CONFIRMED` and `REMOTE.DELIVERY_CONFIRMED`. A
 * name-only dedupe would have dropped the delivery one and left the composition
 * reporting a tour approval as its delivery result.
 */
function mergeOutputFields(): MacroOutputField[] {
  const byName = new Map<string, MacroOutputField>();
  const merged: MacroOutputField[] = [];
  for (const leg of LEGS) {
    for (const field of leg.macro.output.fields) {
      const existing = byName.get(field.name);
      if (existing === undefined) {
        byName.set(field.name, field);
        merged.push(field);
        continue;
      }
      if (existing.factKey === field.factKey) continue;
      const renamed: MacroOutputField = { ...field, name: `${leg.prefix}${capitalize(field.name)}` };
      byName.set(renamed.name, renamed);
      merged.push(renamed);
    }
  }
  return merged;
}

const IR_CAPABILITIES = mergeCapabilities(LEGS.flatMap((leg) => leg.capabilityRequirements));

const GENERIC_IR: WorkflowIrV2 = irDocument({
  workflowId: NESY_FULL_COURIER_DAY_WORKFLOW_KEY,
  name: "Full Courier Day",
  sourceRef: NESY_FULL_COURIER_DAY_MACRO_KEY,
  inputs: mergeByName(LEGS.flatMap((leg) => leg.inputs)),
  variables: LEGS.flatMap((leg) => leg.variables),
  steps: STEPS,
  entryStepId: LEGS[0]!.entryStepId,
  capabilityRequirements: IR_CAPABILITIES,
  sourceMap: LEGS.flatMap((leg) => leg.sourceMap),
});

const EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_FULL_COURIER_DAY_MACRO_KEY,
  authoredBy: "COMPILER",
  genericIr: GENERIC_IR,
  irSourceMap: GENERIC_IR.sourceMap,
  domainSourceMap: [
    {
      ref: "ds-full-day-0",
      macroRef: NESY_FULL_COURIER_DAY_MACRO_KEY,
      planStepIds: STEPS.map((step) => step.planStepId),
      note:
        "Seven legs chained on their closing assertions. Step ids and variables are namespaced per leg; " +
        "four screen re-waits are confirmatory because the previous leg's gate already consumed the fact.",
    },
    ...LEGS.map((leg) => ({
      ref: `ds-full-day-${leg.prefix}`,
      macroRef: leg.macro.macroKey,
      planStepIds: leg.steps.map((step) => step.planStepId),
      sliceRef: leg.sliceRef,
      note: leg.note,
    })),
  ],
};

// ───────────────────────────────────────────────────────────────────────────
//  Bridge plan
// ───────────────────────────────────────────────────────────────────────────

/**
 * Legs are concatenated in run order with their step ids namespaced.
 *
 * The login tap's `awaitFactKey` moves to the route dialog for the same reason
 * its continue gate does. Everything else is carried through verbatim, including
 * process-parcel's two entries for `tap-input-confirm` — that shape is the source
 * macro's and changing it here would hide it rather than fix it.
 */
const BRIDGE_PLAN: BridgeFlowPlanSnapshot = {
  macroRef: NESY_FULL_COURIER_DAY_MACRO_KEY,
  authoredBy: "COMPILER",
  requiredCapabilityRefs: uniqueStrings([
    ...LEGS.flatMap((leg) => leg.macro.bridgeFlowPlanSnapshot?.requiredCapabilityRefs ?? []),
    "verdict.core.bridge.scroll-to-item",
  ]),
  legs: LEGS.flatMap((leg) =>
    (leg.macro.bridgeFlowPlanSnapshot?.legs ?? []).map((bridgeLeg) => {
      const planStepId = `${leg.prefix}-${bridgeLeg.planStepId}`;
      return planStepId === "auth-tap-submit"
        ? { ...bridgeLeg, planStepId, awaitFactKey: NESY_FACTS.ROUTE_DIALOG_READY }
        : { ...bridgeLeg, planStepId };
    }),
  ),
};

// ───────────────────────────────────────────────────────────────────────────
//  Interrupt policy
// ───────────────────────────────────────────────────────────────────────────

/**
 * The union of what the legs drive, plus the push notification list.
 *
 * Header note 5. `unlistedSurfacePolicy` applies to anything missing from THIS
 * policy's lists, so a surface one leg drives and the composition forgets would
 * raise OPERATOR_ATTENTION on the happy path.
 */
const INTERRUPT_POLICY: InterruptPolicy = {
  handledSurfaceRefs: uniqueStrings([
    ...LEGS.flatMap((leg) => leg.macro.interruptPolicy.handledSurfaceRefs),
    NESY_SURFACES.notificationListDialog,
  ]),
  fatalSurfaceRefs: uniqueStrings(LEGS.flatMap((leg) => leg.macro.interruptPolicy.fatalSurfaceRefs)),
  unlistedSurfacePolicy: "OPERATOR_ATTENTION",
  // Seven legs are seven times the exposure of one, and the notification list can
  // be re-raised by a second push, so the per-run budget is raised with the
  // number of legs rather than left at a single slice's 3.
  maxHandledInterrupts: 8,
};

// ───────────────────────────────────────────────────────────────────────────
//  Macro
// ───────────────────────────────────────────────────────────────────────────

const PRECONDITIONS: readonly MacroPrecondition[] = NESY_LOGIN_MACRO.preconditions;

export const NESY_FULL_COURIER_DAY_IR = GENERIC_IR;

/** Run order, for tests and for anything rendering the composition. */
export const NESY_FULL_COURIER_DAY_LEG_MACRO_KEYS: readonly string[] = LEGS.map(
  (leg) => leg.macro.macroKey,
);

export const NESY_FULL_COURIER_DAY_MACRO: MacroDefinition = {
  macroKey: NESY_FULL_COURIER_DAY_MACRO_KEY,
  actionRef: NESY_ACTIONS.login,
  displayName: "Full Courier Day",
  businessMeaning:
    "A courier signs in, takes today's route, loads a parcel onto the schedule, gets the tour approved, " +
    "opens the stop that parcel created, processes it and completes the delivery — one continuous run, " +
    "so every hand-off between those steps is exercised by the state the previous step actually produced.",
  notResponsibleFor: uniqueStrings([
    ...LEGS.flatMap((leg) => leg.macro.notResponsibleFor),
    "judging any one of the seven legs on its own — a failure here says the DAY broke, and the " +
      "single-macro workflows are what attribute it to a leg",
    "multi-parcel and multi-stop days: this is one parcel through one stop, and the nested FOR_EACH " +
      "reference workflow is where fan-out is modelled",
  ]),
  input: { fields: mergeByName(LEGS.flatMap((leg) => leg.macro.input.fields)) },
  output: { fields: mergeOutputFields() },
  // Login's, not the union — header note 6.
  preconditions: PRECONDITIONS,
  allowedRegistryRefs: {
    screenRefs: uniqueStrings(LEGS.flatMap((leg) => leg.macro.allowedRegistryRefs.screenRefs)),
    surfaceRefs: uniqueStrings([
      ...LEGS.flatMap((leg) => leg.macro.allowedRegistryRefs.surfaceRefs),
      NESY_SURFACES.notificationListDialog,
    ]),
    entityTypeRefs: uniqueStrings(LEGS.flatMap((leg) => leg.macro.allowedRegistryRefs.entityTypeRefs)),
    targetRefs: uniqueStrings(LEGS.flatMap((leg) => leg.macro.allowedRegistryRefs.targetRefs)),
    factKeys: uniqueStrings([
      ...LEGS.flatMap((leg) => leg.macro.allowedRegistryRefs.factKeys),
      NESY_FACTS.ROUTE_DIALOG_READY,
      NESY_FACTS.NOTIFICATION_LIST_PRESENT,
    ]),
    queryRefs: uniqueStrings(LEGS.flatMap((leg) => leg.macro.allowedRegistryRefs.queryRefs)),
    adapterOperationRefs: uniqueStrings(
      LEGS.flatMap((leg) => leg.macro.allowedRegistryRefs.adapterOperationRefs),
    ),
  },
  oracleTemplate: {
    // "Are we there yet" for the whole run is the LAST leg's question.
    continueGate: LEGS[LEGS.length - 1]!.macro.oracleTemplate.continueGate,
    finalOracle: {
      requirements: mergeOracleRequirements(LEGS.flatMap((leg) => leg.finalOracleRequirements)),
    },
    notResponsibleFor: uniqueStrings(
      LEGS.flatMap((leg) => leg.macro.oracleTemplate.notResponsibleFor ?? []),
    ),
  },
  interruptPolicy: INTERRUPT_POLICY,
  requiredCapabilityRefs: uniqueStrings([
    ...LEGS.flatMap((leg) => leg.macro.requiredCapabilityRefs),
    ...IR_CAPABILITIES.filter((entry) => !entry.optional).map((entry) => entry.capability),
    "verdict.core.bridge.scroll-to-item",
  ]),
  expansionSnapshot: EXPANSION,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
};
