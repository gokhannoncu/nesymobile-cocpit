/**
 * Full courier day — the seven-leg composition.
 *
 * These tests are written against the FOUR things a concatenation would have got
 * wrong (see the macro header), because those are the failures that only appear
 * once the legs run back to back and are therefore the ones a refactor is most
 * likely to reintroduce.
 */

import { hashWorkflowIrV2, validateWorkflowIrV2 } from "@nesy/workflow-contract";
import { describe, expect, it } from "vitest";
import { buildNesyCourierBundle } from "./bundle.js";
import { NESY_COMPLETE_DELIVERY_MACRO } from "./macros/complete-delivery.js";
import {
  NESY_FULL_COURIER_DAY_IR as IR,
  NESY_FULL_COURIER_DAY_LEG_MACRO_KEYS,
  NESY_FULL_COURIER_DAY_MACRO as MACRO,
  NESY_FULL_COURIER_DAY_MACRO_KEY,
  NESY_FULL_COURIER_DAY_WORKFLOW_KEY,
} from "./macros/full-courier-day.js";
import { NESY_LOAD_TO_VEHICLE_MACRO } from "./macros/load-to-vehicle.js";
import { NESY_LOGIN_MACRO } from "./macros/login.js";
import { NESY_OPEN_STOP_MACRO } from "./macros/open-stop.js";
import { NESY_PROCESS_PARCEL_MACRO } from "./macros/process-parcel.js";
import { NESY_SELECT_ROUTE_MACRO } from "./macros/select-route.js";
import { NESY_TOUR_APPROVAL_MACRO } from "./macros/tour-approval-lifecycle.js";
import { NESY_COURIER_INDEPENDENT_WORKFLOWS, NESY_WORKFLOWS } from "./profiles/workflows.js";
import { NESY_FACTS } from "./registries/facts.js";
import { NESY_SURFACES } from "./registries/screens.js";

const LEG_PREFIXES = ["auth", "route", "load", "permit", "visit", "item", "deliver"] as const;

/** The chain the composition claims to drive, in product order. */
const CHAIN: readonly { exit: string; entry: string }[] = [
  { exit: "auth-assert-login", entry: "route-read-current-route" },
  { exit: "route-assert-selection", entry: "load-wait-stop-list-ready" },
  { exit: "load-assert-loaded", entry: "permit-read-current-schedule" },
  // The visit leg now opens by WAITING for the stop list rather than probing it
  // straight away; see open-stop 1.43.0.
  { exit: "permit-assert-approved", entry: "visit-wait-stop-list-ready" },
  { exit: "visit-assert-correct-item", entry: "item-wait-task-list" },
  { exit: "item-assert-delivery-started", entry: "deliver-wait-flow" },
];

function step(planStepId: string) {
  const found = IR.steps.find((entry) => entry.planStepId === planStepId);
  if (found === undefined) throw new Error(`no step "${planStepId}"`);
  return found;
}

describe("full courier day composition", () => {
  it("validates as WorkflowIR v2", () => {
    const issues = validateWorkflowIrV2(IR, {
      availableCapabilities: IR.capabilityRequirements.map((entry) => entry.capability),
    });
    expect(issues).toEqual([]);
  });

  it("registers as one independent workflow built from one composed macro", () => {
    expect(NESY_WORKFLOWS.fullCourierDay).toBe(NESY_FULL_COURIER_DAY_WORKFLOW_KEY);
    const workflow = NESY_COURIER_INDEPENDENT_WORKFLOWS.find(
      (entry) => entry.workflowKey === NESY_FULL_COURIER_DAY_WORKFLOW_KEY,
    );
    // Seven macroRefs would be seven expansion snapshots, and an empty canvas can
    // only auto-materialize from one.
    expect(workflow?.macroRefs).toEqual([NESY_FULL_COURIER_DAY_MACRO_KEY]);
    expect(workflow?.fragmentRefs).toEqual([]);
    expect(workflow?.occurrenceScope).toBe("INDEPENDENT");
    expect(workflow?.producesTerminalVerdict).toBe(true);
  });

  it("ships in the bundle's macro registry", () => {
    const macroKeys = buildNesyCourierBundle().registries.macros.map((entry) => entry.macroKey);
    expect(macroKeys).toContain(NESY_FULL_COURIER_DAY_MACRO_KEY);
  });

  it("composes the seven product legs in the courier's own order", () => {
    expect(NESY_FULL_COURIER_DAY_LEG_MACRO_KEYS).toEqual([
      NESY_LOGIN_MACRO.macroKey,
      NESY_SELECT_ROUTE_MACRO.macroKey,
      NESY_LOAD_TO_VEHICLE_MACRO.macroKey,
      NESY_TOUR_APPROVAL_MACRO.macroKey,
      NESY_OPEN_STOP_MACRO.macroKey,
      NESY_PROCESS_PARCEL_MACRO.macroKey,
      NESY_COMPLETE_DELIVERY_MACRO.macroKey,
    ]);
  });

  // ── 1. namespacing ──────────────────────────────────────────────────────
  //
  // Nine step ids and five variables collide across these macros. Without a
  // namespace the IR is invalid; worse, if it validated, `tap-row` would mean the
  // route row and the stop row at once.

  it("namespaces every step id and variable, so no leg can shadow another", () => {
    const unprefixed = IR.steps
      .map((entry) => entry.planStepId)
      .filter((id) => !LEG_PREFIXES.some((prefix) => id.startsWith(`${prefix}-`)));
    expect(unprefixed).toEqual([]);

    const names = IR.variables.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(IR.steps.map((entry) => entry.planStepId)).size).toBe(IR.steps.length);
  });

  it("keeps the colliding ids of both source legs as distinct steps", () => {
    for (const id of [
      "route-tap-row",
      "visit-tap-row",
      "load-tap-input-confirm",
      "item-tap-input-confirm",
      "route-read-local-schedule",
      "load-read-local-schedule",
      "item-resolve-scan-field",
      "deliver-resolve-scan-field",
    ]) {
      expect(step(id).planStepId).toBe(id);
    }
  });

  it("rewrites operands that address a step or a variable by name", () => {
    // A step-id head: select-route compares the requested route against the
    // offered projection.
    const offered = step("route-check-offered");
    if (offered.kind !== "CONDITION") throw new Error("expected CONDITION");
    const condition = offered.condition;
    if (condition.kind !== "comparison") throw new Error("expected comparison");
    expect(condition.right).toMatchObject({ path: "route-read-offered-routes.match_key" });
    expect(offered.onTrue).toBe("route-resolve-spinner");
    expect(offered.onFalse).toBe("route-report-not-offered");

    // A variable head: the delivery queue branch reads its own output variable.
    const branch = step("deliver-branch-on-queue");
    if (branch.kind !== "SWITCH") throw new Error("expected SWITCH");
    expect(branch.branches[0]?.condition).toMatchObject({
      right: { path: "deliverQueueRows.pending_count" },
    });
    expect(branch.branches[0]?.next).toBe("deliver-await-queue-drain");
    expect(branch.default.next).toBe("deliver-verify-backend-status");
  });

  it("rewrites a variable named inside a step's args, not just the fields that hold one", () => {
    /**
     * run_237cb164: the first composed run that had to open the route spinner
     * asked the device to scroll to row "-" and got `missing_scroll_target`. The
     * leg had renamed `offeredRouteRows` to `routeOfferedRouteRows`; the arg
     * still pointed at the old name, and a `var.` reference in a VALUE was not
     * covered by the key-name rewrite. Every earlier run had found the route
     * already selected and skipped the branch, so nothing executed the dangling
     * reference.
     */
    const scroll = step("route-scroll-to-row");
    if (scroll.kind !== "BRIDGE_ACTION") throw new Error("expected BRIDGE_ACTION");
    expect(scroll.args?.["rowIndex"]).toBe("var.routeOfferedRouteRows.route_index");

    // No leg may leave a `var.` reference pointing at a name it renamed away.
    const declared = new Set(IR.variables.map((variable) => variable.name));
    const dangling: string[] = [];
    const walk = (value: unknown, planStepId: string): void => {
      if (typeof value === "string" && value.startsWith("var.")) {
        const head = value.slice("var.".length).split(".")[0];
        if (head !== undefined && !declared.has(head)) dangling.push(`${planStepId}: ${value}`);
        return;
      }
      if (Array.isArray(value)) {
        for (const entry of value) walk(entry, planStepId);
        return;
      }
      if (typeof value === "object" && value !== null) {
        for (const entry of Object.values(value)) walk(entry, planStepId);
      }
    };
    for (const entry of IR.steps) walk(entry, entry.planStepId);
    expect(dangling).toEqual([]);
  });

  it("re-points cleanup compensation at the namespaced steps it compensates", () => {
    const cleanups = IR.steps.filter((entry) => entry.kind === "CLEANUP");
    expect(cleanups.map((entry) => entry.planStepId)).toEqual([
      "auth-clear-session",
      "permit-release-approval-fixture",
      "item-close-input",
    ]);
    for (const cleanup of cleanups) {
      if (cleanup.kind !== "CLEANUP") throw new Error("expected CLEANUP");
      // Every compensated id must be a step that exists, or teardown silently
      // compensates nothing.
      for (const id of cleanup.compensatesStepIds) expect(step(id).planStepId).toBe(id);
      expect(cleanup.runOnFailure).toBe(cleanup.planStepId !== "auth-clear-session");
    }
    const permitCleanup = cleanups.find((entry) => entry.planStepId === "permit-release-approval-fixture");
    if (permitCleanup?.kind !== "CLEANUP") throw new Error("expected CLEANUP");
    expect(permitCleanup.spec?.operationRef).toBe("nesy.backoffice.reject-tour-request");
    expect(permitCleanup.spec?.role).toBe("TEARDOWN");
    expect(permitCleanup.spec?.idempotencyKey).toBe("run.input.scheduleId");
  });

  // ── 2. stitching ────────────────────────────────────────────────────────

  it("continues each leg's closing assertion into the next leg's entry", () => {
    expect(IR.entryStepId).toBe("auth-prepare-startup-permissions");
    for (const { exit, entry } of CHAIN) {
      const assertion = step(exit);
      expect(assertion.kind).toBe("ASSERT_FACT");
      expect(assertion.next).toBe(entry);
    }
    // The last leg is the only terminal one.
    expect(step("deliver-assert-confirmed").next).toBeNull();
  });

  it("leaves the not-offered path as a failing dead end", () => {
    // Falling through here would have started loading a vehicle for a route the
    // backend never offered.
    expect(step("route-report-not-offered").next).toBeNull();
    expect(step("route-report-not-offered").kind).toBe("ASSERT_FACT");
  });

  it("keeps every leg's own final oracle policy on its assertion", () => {
    // The evidence compiler accumulates these across steps, so the run is judged
    // on all seven legs rather than only the last one.
    //
    // The load leg carries TWO, because a load has two distinguishable outcomes:
    // the product refused (`load-assert-load-refused`, requirements timing out
    // INCONCLUSIVE) and the product said nothing (`load-assert-loaded`, timing
    // out FAIL). Only one of them is ever reached — see `check-load-refused`.
    const withPolicy = IR.steps.filter((entry) => entry.finalOraclePolicy !== undefined);
    expect(withPolicy.map((entry) => entry.planStepId)).toEqual([
      "auth-assert-login",
      "route-assert-selection",
      "load-assert-loaded",
      "load-assert-load-refused",
      "permit-assert-approved",
      "visit-assert-correct-item",
      "item-assert-delivery-started",
      "deliver-assert-confirmed",
    ]);
  });

  it("routes a refused load to the untested terminal, not the failing one", () => {
    // The regression, measured on run_38810dc0: the canvas held a barcode whose
    // parcel had been delivered an hour earlier, the app said so in its own
    // words, the refusal dialog was tapped away, and the run reported
    // FAIL_PRODUCT for a product that had behaved correctly.
    const branch = step("load-check-load-refused");
    if (branch.kind !== "CONDITION") throw new Error("expected CONDITION");
    expect(branch.onTrue).toBe("load-read-parcel-state");
    expect(branch.onFalse).toBe("load-assert-load-refused");
    // Being unsure is not a refusal: the strict terminal is the default.
    expect(branch.onUnknown).toBe("load-read-parcel-state");

    const refused = step("load-assert-load-refused");
    expect(refused.next).toBeNull();
    expect(
      refused.finalOraclePolicy?.requirements.every((r) => r.onTimeout === "INCONCLUSIVE"),
    ).toBe(true);
    // And the strict terminal still blames the product when nothing was said.
    expect(
      step("load-assert-loaded").finalOraclePolicy?.requirements.every((r) => r.onTimeout === "FAIL"),
    ).toBe(true);
  });

  // ── 3. the post-login gate ──────────────────────────────────────────────

  it("admits the route dialog as a post-login closing condition", () => {
    const tapSubmit = step("auth-tap-submit");
    if (tapSubmit.kind !== "BRIDGE_ACTION") throw new Error("expected BRIDGE_ACTION");
    // A cold PIN login lands on the dialog ON TOP of the stop list, so waiting for
    // the list alone timed out a run whose PIN was accepted.
    expect(tapSubmit.continueGate?.anyOf).toEqual(
      expect.arrayContaining([
        NESY_FACTS.ROUTE_LIST_READY,
        NESY_FACTS.ROUTE_DIALOG_READY,
        NESY_FACTS.LOGIN_REJECTED,
      ]),
    );
    const bridgeLeg = MACRO.bridgeFlowPlanSnapshot?.legs.find(
      (leg) => leg.planStepId === "auth-tap-submit",
    );
    expect(bridgeLeg?.awaitFactKey).toBe(NESY_FACTS.ROUTE_DIALOG_READY);
  });

  // ── 4. re-waits the previous leg already proved ──────────────────────────

  it("makes a re-wait for an already-consumed fact confirmatory instead of fatal", () => {
    // Manifest 1.21.1: a device event is stamped with the occurrence the host last
    // seeded, so a wait for a fact the PREVIOUS leg's gate consumed looks under its
    // own occurrence and never finds it. FAIL here hung a correct run.
    for (const id of [
      "route-wait-dialog",
      "load-wait-stop-list-ready",
      "item-wait-task-list",
      "deliver-wait-flow",
    ]) {
      const wait = step(id);
      if (wait.kind !== "WAIT_EVENT") throw new Error(`${id} should be WAIT_EVENT`);
      expect(wait.onTimeout).toBe("CONTINUE");
      expect(wait.timeoutMs).toBeLessThanOrEqual(8_000);
    }
  });

  it("starts with the PIN target after queue-owned interaction readiness", () => {
    const first = step("auth-resolve-pin-field");
    expect(first.kind).toBe("RESOLVE_TARGET");
    expect(IR.steps.some((entry) => entry.planStepId === "auth-wait-login-ready")).toBe(false);
  });

  // ── 5. interrupts ───────────────────────────────────────────────────────

  it("handles the push notification list, which only this composition meets", () => {
    // The push arrives during the approval leg and the NEXT leg works the stop
    // list underneath it. The standalone approval workflow ends before this bites.
    expect(MACRO.interruptPolicy.handledSurfaceRefs).toContain(NESY_SURFACES.notificationListDialog);
    expect(MACRO.allowedRegistryRefs.surfaceRefs).toContain(NESY_SURFACES.notificationListDialog);
    // Surfaces the legs drive themselves must stay listed, or the happy path
    // raises OPERATOR_ATTENTION on a dialog the run opened on purpose.
    expect(MACRO.interruptPolicy.handledSurfaceRefs).toContain(NESY_SURFACES.tourRoutingDialog);
    expect(MACRO.interruptPolicy.handledSurfaceRefs).toContain(NESY_SURFACES.scannerSurface);
    expect(MACRO.interruptPolicy.maxHandledInterrupts).toBeGreaterThanOrEqual(LEG_PREFIXES.length);
  });

  // ── 6. preconditions and the oracle ─────────────────────────────────────

  it("requires only what must be true BEFORE the run starts", () => {
    // Unioning the legs' preconditions would make the run unstartable: open-stop
    // wants stops already loaded and approval wants no approval to exist yet.
    expect(MACRO.preconditions).toEqual(NESY_LOGIN_MACRO.preconditions);
    const refs = MACRO.preconditions.map((entry) => entry.ref);
    expect(refs).not.toContain(NESY_FACTS.AVAILABLE_STOPS_LOADED);
    expect(refs).not.toContain(NESY_FACTS.ACTIVE_STOP_MATCHES);
  });

  it("builds the final oracle from the assertions, not from the drifted templates", () => {
    const factKeys = MACRO.oracleTemplate.finalOracle.requirements.map((entry) => entry.factKey);
    // One requirement from each leg, so no leg's evidence was dropped.
    expect(factKeys).toEqual(
      expect.arrayContaining([
        NESY_FACTS.USER_SESSION_AVAILABLE_APP,
        NESY_FACTS.SELECTED_ROUTE_OBSERVED,
        NESY_FACTS.PARCEL_IN_SCHEDULE,
        NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
        NESY_FACTS.ACTIVE_STOP_MATCHES,
        NESY_FACTS.DELIVERY_FLOW_STARTED,
        NESY_FACTS.DELIVERY_CONFIRMED,
      ]),
    );
    // process-parcel's `oracleTemplate` still asks for these two; its ASSERT_FACT
    // does not, and 1.21.0 is the reason. Merging templates would have failed a
    // correct day on a local write this branch never performs.
    expect(factKeys).not.toContain(NESY_FACTS.PARCEL_RECORD_PERSISTED);
    expect(factKeys).not.toContain(NESY_FACTS.SESSION_ISOLATION_ASSERTED);
    // No fact may be judged twice under two obligations.
    expect(new Set(factKeys).size).toBe(factKeys.length);
  });

  it("asks the last leg's question as the whole run's continue gate", () => {
    expect(MACRO.oracleTemplate.continueGate).toEqual(
      NESY_COMPLETE_DELIVERY_MACRO.oracleTemplate.continueGate,
    );
  });

  // ── inputs, outputs, capabilities ───────────────────────────────────────

  it("declares each leg's inputs once, sharing the ones that mean the same thing", () => {
    const names = IR.inputs.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    // `routeCode` is declared by BOTH select-route and tour approval and is one
    // value in one run.
    expect(names).toContain("routeCode");
    // The three barcode inputs stay separate: a day may load several parcels and
    // deliver one of them. See the macro header.
    expect(names).toEqual(expect.arrayContaining(["scanValue", "scanPayload", "consignmentNumber"]));
    expect(names[0]).toBe("pin");
  });

  it("renames an output two legs give different meanings", () => {
    const outputs = MACRO.output.fields;
    const names = outputs.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    // Both approval and delivery publish `confirmed`. A name-only dedupe would
    // have reported the tour approval as the delivery result.
    expect(outputs.find((entry) => entry.name === "confirmed")?.factKey).toBe(
      NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
    );
    expect(outputs.find((entry) => entry.name === "deliverConfirmed")?.factKey).toBe(
      NESY_FACTS.DELIVERY_CONFIRMED,
    );
  });

  it("does not harden an optional capability into a hard requirement", () => {
    // open-stop declares `wait_any` optional with a fallback precisely so a Bridge
    // v1 device can still run the plan (B-13).
    const waitAny = IR.capabilityRequirements.find((entry) => entry.capability === "wait_any");
    expect(waitAny?.optional).toBe(true);
    expect(waitAny?.fallback).toBe("SEQUENTIAL_LEGS");
    const names = IR.capabilityRequirements.map((entry) => entry.capability);
    expect(new Set(names).size).toBe(names.length);
  });

  // ── provenance ──────────────────────────────────────────────────────────

  it("traces every step back to the macro that authored it", () => {
    const domainSourceMap = MACRO.expansionSnapshot?.domainSourceMap ?? [];
    expect(domainSourceMap.map((entry) => entry.macroRef)).toEqual(
      expect.arrayContaining([NESY_FULL_COURIER_DAY_MACRO_KEY, ...NESY_FULL_COURIER_DAY_LEG_MACRO_KEYS]),
    );
    // Union of the per-leg entries must be every step, so no step is unattributed.
    const attributed = new Set(
      domainSourceMap
        .filter((entry) => entry.macroRef !== NESY_FULL_COURIER_DAY_MACRO_KEY)
        .flatMap((entry) => entry.planStepIds),
    );
    expect(attributed.size).toBe(IR.steps.length);
    expect(IR.sourceMap.map((entry) => entry.planStepId).every((id) => attributed.has(id))).toBe(true);
  });

  it("hashes deterministically", () => {
    expect(hashWorkflowIrV2(IR)).toBe(hashWorkflowIrV2(IR));
  });
});
