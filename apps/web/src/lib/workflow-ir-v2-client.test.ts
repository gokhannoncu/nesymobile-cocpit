import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { groupIssuesByStep, validateWorkflowDraft, WORKFLOW_STEP_KINDS } from "./workflow-ir-v2-client";

const FIXTURE_DIR = fileURLToPath(new URL("../../../../packages/workflow-contract/fixtures/workflow-ir-v2/", import.meta.url));

const fixture = (name: string): unknown => JSON.parse(readFileSync(`${FIXTURE_DIR}${name}`, "utf8"));

describe("editor-side WorkflowIR v2 validation", () => {
  it("consumes the shared contract rather than a web-local copy", () => {
    // The acceptance criterion is "API and Web use the same package", so the
    // import itself is the assertion: if someone re-declares these types under
    // apps/web, this file stops compiling against the shared union.
    const source = readFileSync(fileURLToPath(new URL("./workflow-ir-v2-client.ts", import.meta.url)), "utf8");
    expect(source).toContain('from "@nesy/workflow-contract"');
    expect(WORKFLOW_STEP_KINDS).toContain("FOR_EACH");
    expect(WORKFLOW_STEP_KINDS).toContain("REMOTE_ACTION");
  });

  it("accepts both generic domain fixtures", () => {
    expect(validateWorkflowDraft(fixture("courier-generic.json"))).toEqual({ valid: true, issues: [] });
    expect(validateWorkflowDraft(fixture("sports-content-generic.json"))).toEqual({ valid: true, issues: [] });
  });

  it("attributes an issue to the node the author has to fix", () => {
    const result = validateWorkflowDraft(fixture("invalid-fixed-wait.json"));
    expect(result.valid).toBe(false);
    const fixedWait = result.issues.find((i) => i.code === "FIXED_WAIT_FORBIDDEN");
    expect(fixedWait?.planStepId).toBe("s1");
    expect(fixedWait?.path).toBe("steps[0].sleepMs");
  });

  it("groups issues per step for inline badges", () => {
    const result = validateWorkflowDraft(fixture("invalid-unsafe-retry.json"));
    const grouped = groupIssuesByStep(result.issues);
    expect(Object.keys(grouped)).toContain("s1");
    expect(grouped.s1?.length).toBeGreaterThan(0);
  });

  it("does not throw on a half-typed draft", () => {
    expect(() => validateWorkflowDraft({ schemaVersion: 2, steps: [{}] })).not.toThrow();
    expect(validateWorkflowDraft(undefined).valid).toBe(false);
  });
});
