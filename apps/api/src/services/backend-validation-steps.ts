/**
 * Persist progress + HTTP capture for derived `__bv__*` WorkflowStepResult rows.
 */

import { prisma } from "@nesy/db";
import {
  backendValidationStepId,
  buildBackendValidationOutput,
  maskSensitiveHeaders,
  type BackendHttpCapture,
  type BackendValidationKind,
  type DerivedBackendValidation,
} from "./backend-validation-lane.js";

export async function markBackendValidationRunning(runId: string, sourceNodeId: string): Promise<void> {
  const stepNodeId = backendValidationStepId(sourceNodeId);
  await prisma.workflowStepResult.updateMany({
    where: { runId, nodeId: stepNodeId, status: { in: ["pending", "running"] } },
    data: { status: "running", startedAt: new Date(), errorMessage: null },
  });
}

export async function completeBackendValidationStep(opts: {
  runId: string;
  validation: DerivedBackendValidation;
  passed: boolean;
  detail: string;
  requests?: BackendHttpCapture[];
}): Promise<void> {
  const { runId, validation, passed, detail, requests = [] } = opts;
  const started = await prisma.workflowStepResult.findFirst({
    where: { runId, nodeId: validation.stepNodeId },
    select: { startedAt: true },
  });
  const startedAt = started?.startedAt ?? new Date();
  const completedAt = new Date();
  const duration = Math.max(0, completedAt.getTime() - startedAt.getTime());

  const maskedRequests = requests.map((r) => ({
    ...r,
    headers: maskSensitiveHeaders(r.headers),
  }));

  await prisma.workflowStepResult.updateMany({
    where: { runId, nodeId: validation.stepNodeId },
    data: {
      status: passed ? "success" : "failed",
      startedAt,
      completedAt,
      duration,
      errorMessage: passed ? null : detail,
      output: buildBackendValidationOutput({
        sourceNodeId: validation.sourceNodeId,
        sourceNodeType: validation.sourceNodeType,
        sourceTitle: validation.sourceTitle,
        validationKind: validation.kind,
        verdict: passed ? "passed" : "failed",
        detail,
        requests: maskedRequests,
      }),
    },
  });
}

export async function failPendingBackendValidations(
  runId: string,
  validations: DerivedBackendValidation[],
  reason: string,
): Promise<void> {
  for (const validation of validations) {
    const existing = await prisma.workflowStepResult.findFirst({
      where: { runId, nodeId: validation.stepNodeId },
      select: { status: true },
    });
    if (!existing || existing.status === "success" || existing.status === "failed") continue;
    await completeBackendValidationStep({
      runId,
      validation,
      passed: false,
      detail: reason,
      requests: [],
    });
  }
}

export function validationKindLabel(kind: BackendValidationKind): string {
  switch (kind) {
    case "server_step":
      return "Server step";
    case "logcat_backend":
      return "Logcat backend";
    default:
      return "EventTower";
  }
}
