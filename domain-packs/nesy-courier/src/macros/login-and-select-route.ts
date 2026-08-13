/**
 * ===========================================================================
 *  LOGIN + SELECT_ROUTE composed workflow  (courier day, first two legs)
 *
 *  The dedicated login and select-route workflows stay one-macro each: signing
 *  in is a precondition of route selection, and mixing them there would report
 *  a login defect as a route-selection failure.
 *
 *  This composition exists for the product path where those two things are one
 *  sitting: a cold start, PIN login, and the route dialog that appears because
 *  the courier has no route yet (expired session, first launch of the day).
 *  Driving only login then stopping leaves the dialog on screen; driving only
 *  select-route assumes a session a cold start does not have.
 *
 *  Glue that is NOT a straight concatenation:
 *
 *    1. `assert-login` continues into `wait-dialog` instead of ending the run.
 *    2. Login's tap-submit gate also admits `UI.ROUTE_DIALOG_READY`. After a
 *       cold login the dialog often sits on top of the stop list, so waiting
 *       only for `UI.ROUTE_LIST_READY` timed out a run whose PIN was accepted.
 *    3. Login's CLEANUP stays at the end and still runs on failure.
 *
 *  One expansion snapshot, so an empty canvas auto-materializes. The two
 *  original macros remain the source of each leg; this file only stitches them.
 * ===========================================================================
 */

import type { BridgeFlowPlanSnapshot, MacroDefinition, MacroExpansionSnapshot } from "@nesy/domain-pack-contracts";
import type { WorkflowStepV2 } from "@nesy/workflow-contract";
import { NESY_ADAPTER_QUERY_REFS } from "../registries/application.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_ACTIONS } from "../registries/screens.js";
import { NESY_LOGIN_MACRO, NESY_LOGIN_MACRO_KEY } from "./login.js";
import { NESY_SELECT_ROUTE_MACRO, NESY_SELECT_ROUTE_MACRO_KEY } from "./select-route.js";
import { irDocument, requires } from "./ir-authoring.js";

export const NESY_LOGIN_AND_SELECT_ROUTE_MACRO_KEY = "nesy.macro.login-and-select-route";
export const NESY_LOGIN_AND_SELECT_ROUTE_WORKFLOW_KEY = "nesy.workflow.login-and-select-route";

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function loginIr() {
  const snapshot = NESY_LOGIN_MACRO.expansionSnapshot;
  if (snapshot === undefined) throw new Error("nesy.macro.login is missing its expansion snapshot");
  return snapshot.genericIr;
}

function routeIr() {
  const snapshot = NESY_SELECT_ROUTE_MACRO.expansionSnapshot;
  if (snapshot === undefined) throw new Error("nesy.macro.select-route is missing its expansion snapshot");
  return snapshot.genericIr;
}

function stitchLoginSteps(steps: readonly WorkflowStepV2[], routeEntryStepId: string): WorkflowStepV2[] {
  return steps.map((step) => {
    if (step.planStepId === "assert-login") {
      return { ...step, next: routeEntryStepId };
    }
    if (step.planStepId === "tap-submit" && step.kind === "BRIDGE_ACTION") {
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
    return step;
  });
}

function mergeOracleRequirements<T extends { factKey: string }>(
  left: readonly T[],
  right: readonly T[],
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const requirement of [...left, ...right]) {
    if (seen.has(requirement.factKey)) continue;
    seen.add(requirement.factKey);
    merged.push(requirement);
  }
  return merged;
}

const LOGIN_IR = loginIr();
const ROUTE_IR = routeIr();

const STEPS: readonly WorkflowStepV2[] = [...stitchLoginSteps(LOGIN_IR.steps, ROUTE_IR.entryStepId), ...ROUTE_IR.steps];

const GENERIC_IR = irDocument({
  workflowId: NESY_LOGIN_AND_SELECT_ROUTE_WORKFLOW_KEY,
  name: "Courier PIN login then select route",
  sourceRef: NESY_LOGIN_AND_SELECT_ROUTE_MACRO_KEY,
  inputs: [...LOGIN_IR.inputs, ...ROUTE_IR.inputs],
  variables: [...LOGIN_IR.variables, ...ROUTE_IR.variables],
  steps: STEPS,
  entryStepId: LOGIN_IR.entryStepId,
  capabilityRequirements: unique([
    ...LOGIN_IR.capabilityRequirements.map((item) => item.capability),
    ...ROUTE_IR.capabilityRequirements.map((item) => item.capability),
    ...STEPS.flatMap((step) => step.capabilityRequirements.map((item) => item.capability)),
  ]).map((capability) => requires(capability)),
  sourceMap: [
    ...LOGIN_IR.sourceMap,
    ...ROUTE_IR.sourceMap,
  ],
});

const EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_LOGIN_AND_SELECT_ROUTE_MACRO_KEY,
  authoredBy: "COMPILER",
  genericIr: GENERIC_IR,
  irSourceMap: GENERIC_IR.sourceMap,
  domainSourceMap: [
    {
      ref: "ds-login-select-1",
      macroRef: NESY_LOGIN_AND_SELECT_ROUTE_MACRO_KEY,
      planStepIds: STEPS.map((step) => step.planStepId),
      note: "PIN login leg chained into route selection; tap-submit also admits the route dialog.",
    },
    {
      ref: "ds-login-select-login",
      macroRef: NESY_LOGIN_MACRO_KEY,
      planStepIds: LOGIN_IR.steps.map((step) => step.planStepId),
      sliceRef: "COURIER_LOGIN",
      note: "Login leg, with assert-login continuing into wait-dialog.",
    },
    {
      ref: "ds-login-select-route",
      macroRef: NESY_SELECT_ROUTE_MACRO_KEY,
      planStepIds: ROUTE_IR.steps.map((step) => step.planStepId),
      sliceRef: "SELECT_ROUTE",
      note: "Route-selection leg, unchanged from nesy.macro.select-route.",
    },
  ],
};

const loginBridge = NESY_LOGIN_MACRO.bridgeFlowPlanSnapshot;
const routeBridge = NESY_SELECT_ROUTE_MACRO.bridgeFlowPlanSnapshot;

const BRIDGE_PLAN: BridgeFlowPlanSnapshot = {
  macroRef: NESY_LOGIN_AND_SELECT_ROUTE_MACRO_KEY,
  authoredBy: "COMPILER",
  requiredCapabilityRefs: unique([
    ...(loginBridge?.requiredCapabilityRefs ?? []),
    ...(routeBridge?.requiredCapabilityRefs ?? []),
    "verdict.core.bridge.scroll-to-item",
  ]),
  legs: [
    ...(loginBridge?.legs ?? []).map((leg) =>
      leg.planStepId === "tap-submit"
        ? { ...leg, awaitFactKey: NESY_FACTS.ROUTE_DIALOG_READY }
        : leg,
    ),
    ...(routeBridge?.legs ?? []),
  ],
};

export const NESY_LOGIN_AND_SELECT_ROUTE_IR = GENERIC_IR;

export const NESY_LOGIN_AND_SELECT_ROUTE_MACRO: MacroDefinition = {
  macroKey: NESY_LOGIN_AND_SELECT_ROUTE_MACRO_KEY,
  actionRef: NESY_ACTIONS.login,
  displayName: "Courier PIN login then select route",
  businessMeaning:
    "A courier signs in with their device PIN through the product's own login screens, then selects the route they will work today.",
  notResponsibleFor: unique([
    ...NESY_LOGIN_MACRO.notResponsibleFor,
    ...NESY_SELECT_ROUTE_MACRO.notResponsibleFor,
    "judging login and route selection as two separate product claims — those stay on nesy.workflow.login and nesy.workflow.select-route",
  ]),
  input: {
    fields: [...NESY_LOGIN_MACRO.input.fields, ...NESY_SELECT_ROUTE_MACRO.input.fields],
  },
  output: {
    fields: [
      ...NESY_LOGIN_MACRO.output.fields,
      ...NESY_SELECT_ROUTE_MACRO.output.fields,
    ],
  },
  preconditions: NESY_LOGIN_MACRO.preconditions,
  allowedRegistryRefs: {
    screenRefs: unique([
      ...NESY_LOGIN_MACRO.allowedRegistryRefs.screenRefs,
      ...NESY_SELECT_ROUTE_MACRO.allowedRegistryRefs.screenRefs,
    ]),
    surfaceRefs: unique([
      ...NESY_LOGIN_MACRO.allowedRegistryRefs.surfaceRefs,
      ...NESY_SELECT_ROUTE_MACRO.allowedRegistryRefs.surfaceRefs,
    ]),
    entityTypeRefs: unique([
      ...NESY_LOGIN_MACRO.allowedRegistryRefs.entityTypeRefs,
      ...NESY_SELECT_ROUTE_MACRO.allowedRegistryRefs.entityTypeRefs,
    ]),
    targetRefs: unique([
      ...NESY_LOGIN_MACRO.allowedRegistryRefs.targetRefs,
      ...NESY_SELECT_ROUTE_MACRO.allowedRegistryRefs.targetRefs,
    ]),
    factKeys: unique([
      ...NESY_LOGIN_MACRO.allowedRegistryRefs.factKeys,
      ...NESY_SELECT_ROUTE_MACRO.allowedRegistryRefs.factKeys,
      NESY_FACTS.ROUTE_DIALOG_READY,
      NESY_FACTS.SCHEDULE_PERSISTED,
      NESY_FACTS.SCHEDULE_IS_TODAY,
      NESY_FACTS.SCHEDULE_IN_USE,
      NESY_FACTS.SCHEDULE_IN_USE_IS_TODAYS,
      NESY_FACTS.SCHEDULE_MATCHES_SELECTED_ROUTE,
    ]),
    queryRefs: unique([
      ...NESY_LOGIN_MACRO.allowedRegistryRefs.queryRefs,
      ...NESY_SELECT_ROUTE_MACRO.allowedRegistryRefs.queryRefs,
      NESY_ADAPTER_QUERY_REFS.offeredRoutes,
      NESY_ADAPTER_QUERY_REFS.dbSchedule,
      NESY_ADAPTER_QUERY_REFS.availableStops,
    ]),
    adapterOperationRefs: unique([
      ...NESY_LOGIN_MACRO.allowedRegistryRefs.adapterOperationRefs,
      ...NESY_SELECT_ROUTE_MACRO.allowedRegistryRefs.adapterOperationRefs,
    ]),
  },
  oracleTemplate: {
    continueGate: NESY_SELECT_ROUTE_MACRO.oracleTemplate.continueGate,
    finalOracle: {
      requirements: mergeOracleRequirements(
        NESY_LOGIN_MACRO.oracleTemplate.finalOracle.requirements,
        NESY_SELECT_ROUTE_MACRO.oracleTemplate.finalOracle.requirements,
      ),
    },
    notResponsibleFor: unique([
      ...(NESY_LOGIN_MACRO.oracleTemplate.notResponsibleFor ?? []),
      ...(NESY_SELECT_ROUTE_MACRO.oracleTemplate.notResponsibleFor ?? []),
    ]),
  },
  interruptPolicy: NESY_LOGIN_MACRO.interruptPolicy,
  requiredCapabilityRefs: unique([
    ...NESY_LOGIN_MACRO.requiredCapabilityRefs,
    ...NESY_SELECT_ROUTE_MACRO.requiredCapabilityRefs,
    "verdict.core.bridge.scroll-to-item",
  ]),
  expansionSnapshot: EXPANSION,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
};
