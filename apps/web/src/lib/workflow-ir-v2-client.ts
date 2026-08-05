/**
 * Editor-side seam onto the shared WorkflowIR v2 contract (Phase 4A).
 *
 * The point of this file is that it imports the SAME package the API imports.
 * Before v2 the editor and the host each carried their own workflow types, and
 * the two drifted in the way duplicated types always do: a field the editor
 * happily wrote and the host silently ignored. A shared contract only helps if
 * both sides actually consume it, so this seam exists to keep that true — and
 * the accompanying test fails if the editor grows a parallel type again.
 *
 * No route cutover happens here; Phase 4A is a contract phase.
 */

import {
  parseWorkflowIrV2,
  type WorkflowIrIssue,
  type WorkflowIrV2,
  type WorkflowStepKind,
  WORKFLOW_STEP_KINDS,
} from "@nesy/workflow-contract";

export type { WorkflowIrV2, WorkflowIrIssue, WorkflowStepKind };
export { WORKFLOW_STEP_KINDS };

/** One issue, shaped for the editor's inline error display. */
export interface EditorValidationIssue {
  /** JSON path into the document, e.g. `steps[2].timeoutMs`. */
  path: string;
  code: string;
  message: string;
  /** Step the issue belongs to, when the path names one. */
  planStepId?: string;
}

export interface EditorValidationResult {
  valid: boolean;
  issues: readonly EditorValidationIssue[];
}

const STEP_INDEX_PATTERN = /^steps\[(\d+)\]/;

/**
 * Validates a draft document and maps each issue back to its step.
 *
 * Resolving the step id here rather than in the component means the editor
 * underlines the offending node instead of showing a modal full of JSON paths —
 * the difference between an error an author can fix and one they can only report.
 */
export function validateWorkflowDraft(draft: unknown): EditorValidationResult {
  const result = parseWorkflowIrV2(draft);
  if (result.ok) return { valid: true, issues: [] };

  const steps = Array.isArray((draft as { steps?: unknown })?.steps) ? (draft as { steps: unknown[] }).steps : [];

  const issues = result.issues.map((issue) => {
    const match = STEP_INDEX_PATTERN.exec(issue.path);
    const index = match?.[1] === undefined ? -1 : Number.parseInt(match[1], 10);
    const step = index >= 0 ? steps[index] : undefined;
    const planStepId =
      typeof step === "object" && step !== null && typeof (step as { planStepId?: unknown }).planStepId === "string"
        ? (step as { planStepId: string }).planStepId
        : undefined;
    return {
      path: issue.path,
      code: issue.code,
      message: issue.message,
      ...(planStepId === undefined ? {} : { planStepId }),
    };
  });

  return { valid: false, issues };
}

/** Groups issues by step id for per-node badges. Unattributed issues use `"$"`. */
export function groupIssuesByStep(issues: readonly EditorValidationIssue[]): Record<string, EditorValidationIssue[]> {
  const grouped: Record<string, EditorValidationIssue[]> = {};
  for (const issue of issues) {
    const key = issue.planStepId ?? "$";
    (grouped[key] ??= []).push(issue);
  }
  return grouped;
}
