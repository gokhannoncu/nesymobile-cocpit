import { prisma } from "@nesy/db";
import type {
  DiagnosticCaptureAudit,
  DiagnosticCaptureAuditSink,
} from "./CapturePolicyEngine.js";

/**
 * Durable audit sink for successful, skipped, and failed host captures.
 *
 * The policy engine awaits this write: a heap dump without an audit row is not
 * treated as a completed diagnostic action.
 */
export class DiagnosticCaptureStore implements DiagnosticCaptureAuditSink {
  async record(audit: DiagnosticCaptureAudit): Promise<void> {
    await prisma.verdictDiagnosticCapture.create({
      data: {
        captureId: audit.captureId,
        runId: audit.runId,
        sessionId: audit.sessionId,
        level: audit.level,
        triggerEvent: audit.triggerEvent,
        status: audit.status,
        screen: audit.screen,
        operation: audit.operation,
        spanId: audit.spanId,
        pid: audit.pid,
        markerPreMonoTs: audit.markerPreMonoTs,
        markerPostMonoTs: audit.markerPostMonoTs,
        artifactRef: audit.artifactRef,
        mappingFileRef: audit.mappingFileRef,
        sensitive: audit.sensitive,
        skippedReason: audit.skippedReason,
        errorMessage: audit.errorMessage,
        buildProfile: audit.buildProfile,
        requestedBy: audit.requestedBy,
        optInApprovedBy: audit.optInApprovedBy,
        optInApprovedAt: audit.optInApprovedAt,
        createdAt: audit.createdAt,
        completedAt: audit.completedAt,
      },
    });
  }
}
