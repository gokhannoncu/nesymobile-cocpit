/**
 * Login then select-route — composed IR stitches the two macros.
 */

import { hashWorkflowIrV2, validateWorkflowIrV2 } from "@nesy/workflow-contract";
import { describe, expect, it } from "vitest";
import {
  NESY_LOGIN_AND_SELECT_ROUTE_IR,
  NESY_LOGIN_AND_SELECT_ROUTE_MACRO,
  NESY_LOGIN_AND_SELECT_ROUTE_MACRO_KEY,
  NESY_LOGIN_AND_SELECT_ROUTE_WORKFLOW_KEY,
} from "./macros/login-and-select-route.js";
import { NESY_LOGIN_MACRO_KEY } from "./macros/login.js";
import { NESY_SELECT_ROUTE_MACRO_KEY } from "./macros/select-route.js";
import { NESY_FACTS } from "./registries/facts.js";
import { NESY_WORKFLOWS, NESY_COURIER_INDEPENDENT_WORKFLOWS } from "./profiles/workflows.js";

describe("login then select route composition", () => {
  it("registers as an independent pack workflow with one composed macro", () => {
    expect(NESY_WORKFLOWS.loginAndSelectRoute).toBe(NESY_LOGIN_AND_SELECT_ROUTE_WORKFLOW_KEY);
    const workflow = NESY_COURIER_INDEPENDENT_WORKFLOWS.find(
      (entry) => entry.workflowKey === NESY_LOGIN_AND_SELECT_ROUTE_WORKFLOW_KEY,
    );
    expect(workflow?.macroRefs).toEqual([NESY_LOGIN_AND_SELECT_ROUTE_MACRO_KEY]);
    expect(workflow?.producesTerminalVerdict).toBe(true);
  });

  it("validates as WorkflowIR v2", () => {
    const issues = validateWorkflowIrV2(NESY_LOGIN_AND_SELECT_ROUTE_IR, {
      availableCapabilities: NESY_LOGIN_AND_SELECT_ROUTE_IR.capabilityRequirements.map((c) => c.capability),
    });
    expect(issues).toEqual([]);
  });

  it("starts at PIN login and continues into the route dialog after assert-login", () => {
    expect(NESY_LOGIN_AND_SELECT_ROUTE_IR.entryStepId).toBe("wait-login-ready");
    const assertLogin = NESY_LOGIN_AND_SELECT_ROUTE_IR.steps.find((step) => step.planStepId === "assert-login");
    expect(assertLogin?.next).toBe("wait-dialog");
    expect(NESY_LOGIN_AND_SELECT_ROUTE_IR.steps.some((step) => step.planStepId === "assert-selection")).toBe(true);
  });

  it("admits the route dialog as a post-login closing condition", () => {
    const tapSubmit = NESY_LOGIN_AND_SELECT_ROUTE_IR.steps.find((step) => step.planStepId === "tap-submit");
    expect(tapSubmit?.kind).toBe("BRIDGE_ACTION");
    if (tapSubmit?.kind !== "BRIDGE_ACTION") throw new Error("expected BRIDGE_ACTION");
    expect(tapSubmit.continueGate?.anyOf).toEqual(
      expect.arrayContaining([NESY_FACTS.ROUTE_LIST_READY, NESY_FACTS.ROUTE_DIALOG_READY, NESY_FACTS.LOGIN_REJECTED]),
    );
  });

  it("declares pin, session correlation and route code as inputs", () => {
    expect(NESY_LOGIN_AND_SELECT_ROUTE_IR.inputs.map((input) => input.name)).toEqual([
      "pin",
      "sessionCorrelationId",
      "routeCode",
    ]);
  });

  it("keeps both original macros as domain source-map provenance", () => {
    const refs = NESY_LOGIN_AND_SELECT_ROUTE_MACRO.expansionSnapshot?.domainSourceMap.map((entry) => entry.macroRef) ?? [];
    expect(refs).toEqual(
      expect.arrayContaining([
        NESY_LOGIN_AND_SELECT_ROUTE_MACRO_KEY,
        NESY_LOGIN_MACRO_KEY,
        NESY_SELECT_ROUTE_MACRO_KEY,
      ]),
    );
  });

  it("hashes deterministically", () => {
    expect(hashWorkflowIrV2(NESY_LOGIN_AND_SELECT_ROUTE_IR)).toBe(hashWorkflowIrV2(NESY_LOGIN_AND_SELECT_ROUTE_IR));
  });
});
