import { randomUUID } from "node:crypto";
import type {
  DiagnosticCapture,
  DiagnosticCapturePolicy,
  DiagnosticLevel,
} from "@nesy/control-contract";

const MIB = 1024 * 1024;
const DEFAULT_EXPECTED_HEAP_DUMP_BYTES = 200 * MIB;
const D2_MEMORY_GROWTH_THRESHOLD_MB = 64;

export const DEFAULT_DIAGNOSTIC_CAPTURE_POLICY: DiagnosticCapturePolicy = {
  enabled: {
    D1_MEMINFO: true,
    D2_PERFETTO: true,
    D3_HEAPDUMP: false,
  },
  cooldownMs: {
    D1_MEMINFO: 30_000,
    D2_PERFETTO: 5 * 60_000,
    D3_HEAPDUMP: 15 * 60_000,
  },
  quotaPerRun: {
    D1_MEMINFO: 20,
    D2_PERFETTO: 3,
    D3_HEAPDUMP: 1,
  },
  inhibitDuringCriticalSpan: true,
  minFreeSpaceMultiplier: 3,
};

export type DiagnosticBuildProfile =
  | "development"
  | "test"
  | "automationRelease"
  | "production";

export interface DiagnosticHealthSnapshot {
  /** Existing get_health fields; no additional mobile wire names are required. */
  pid: number;
  apiLevel: number;
  profileable: boolean;
  inCriticalSpan: boolean;
  screen: string;
  operation: string | null;
  spanId: string | null;
}

export interface DiagnosticRequestContext {
  serial: string;
  packageName: string;
  runId: string;
  sessionId: string;
  screen: string;
  operation: string | null;
  spanId: string | null;
  buildProfile: DiagnosticBuildProfile;
  requestedBy: string;
  /** Field-profile D2 is opt-in; dev/test D2 uses the normal ladder. */
  d2OptIn?: boolean;
  /** Exact R8 mapping.txt for the installed minified build. */
  mappingFilePath?: string;
}

export interface MemoryPressureDetected extends DiagnosticRequestContext {
  /** Existing SDK wire name. */
  event: "MEMORY_PRESSURE_DETECTED";
  memoryBeforeMb?: number;
  memoryPeakMb?: number;
}

export interface HeapDumpOptIn {
  approvedBy: string;
  approvedAt: Date;
}

export interface HeapDumpRequest extends DiagnosticRequestContext {
  optIn?: HeapDumpOptIn;
  expectedDumpBytes?: number;
}

export interface DiagnosticHealthProbe {
  /** Reads the existing SDK `get_health` response immediately before capture. */
  getHealth(context: DiagnosticRequestContext): Promise<DiagnosticHealthSnapshot>;
}

export interface DiagnosticMarkerGateway {
  /**
   * Calls the existing SDK `mark_diagnostic(label, captureId)` operation and
   * returns its decimal `monoTs` string.
   */
  markDiagnostic(input: {
    serial: string;
    packageName: string;
    captureId: string;
    label: string;
  }): Promise<string>;
}

export interface DiagnosticOsExecutor {
  captureMeminfo(input: {
    serial: string;
    pid: number;
    captureId: string;
  }): Promise<{ artifactPath: string }>;
  capturePerfetto(input: {
    serial: string;
    captureId: string;
  }): Promise<{ artifactPath: string }>;
  captureHeapDump(input: {
    serial: string;
    packageName: string;
    captureId: string;
  }): Promise<{ artifactPath: string }>;
  deviceFreeBytes(serial: string): Promise<number>;
  storeMappingFile?(captureId: string, sourcePath: string): Promise<string>;
}

export type DiagnosticSkippedReason = NonNullable<DiagnosticCapture["skippedReason"]>;
export type DiagnosticCaptureStatus = "captured" | "skipped" | "failed";

export interface DiagnosticCaptureAudit {
  captureId: string;
  level: DiagnosticLevel;
  runId: string;
  sessionId: string;
  /** MEMORY_PRESSURE_DETECTED is a mobile event; manual_opt_in is host-only audit text. */
  triggerEvent: "MEMORY_PRESSURE_DETECTED" | "manual_opt_in";
  status: DiagnosticCaptureStatus;
  screen: string;
  operation: string | null;
  spanId: string | null;
  pid: number | null;
  markerPreMonoTs: string | null;
  markerPostMonoTs: string | null;
  artifactRef: string | null;
  mappingFileRef: string | null;
  sensitive: boolean;
  skippedReason: DiagnosticSkippedReason | null;
  errorMessage: string | null;
  buildProfile: DiagnosticBuildProfile;
  requestedBy: string;
  optInApprovedBy: string | null;
  optInApprovedAt: Date | null;
  createdAt: Date;
  completedAt: Date;
}

export interface DiagnosticCaptureAuditSink {
  record(audit: DiagnosticCaptureAudit): Promise<void>;
}

export type CaptureOutcome =
  | { status: "captured"; level: DiagnosticLevel; capture: DiagnosticCapture }
  | {
      status: "skipped";
      captureId: string;
      level: DiagnosticLevel;
      skippedReason: DiagnosticSkippedReason;
    }
  | {
      status: "failed";
      captureId: string;
      level: DiagnosticLevel;
      error: string;
    };

interface CapturePolicyEngineOptions {
  diagnostics: DiagnosticOsExecutor;
  healthProbe: DiagnosticHealthProbe;
  markerGateway: DiagnosticMarkerGateway;
  auditSink: DiagnosticCaptureAuditSink;
  policy?: DiagnosticCapturePolicy;
  now?: () => number;
  newCaptureId?: () => string;
}

interface RunBudget {
  counts: Record<DiagnosticLevel, number>;
  lastStartedAt: Partial<Record<DiagnosticLevel, number>>;
}

interface PressureSequence {
  spanId: string | null;
  count: number;
}

interface PendingCapture {
  level: DiagnosticLevel;
  context: DiagnosticRequestContext;
  triggerEvent: DiagnosticCaptureAudit["triggerEvent"];
  optIn?: HeapDumpOptIn;
  expectedDumpBytes?: number;
}

/**
 * D1 → D2 policy ladder plus explicit-only D3.
 *
 * State is intentionally per engine instance and resettable per run. The
 * workflow runtime should create one instance per worker/process and call
 * resetRun after terminal run cleanup.
 */
export class CapturePolicyEngine {
  private readonly diagnostics: DiagnosticOsExecutor;
  private readonly healthProbe: DiagnosticHealthProbe;
  private readonly markerGateway: DiagnosticMarkerGateway;
  private readonly auditSink: DiagnosticCaptureAuditSink;
  private readonly policy: DiagnosticCapturePolicy;
  private readonly now: () => number;
  private readonly newCaptureId: () => string;

  private readonly budgets = new Map<string, RunBudget>();
  private readonly pressureSequences = new Map<string, PressureSequence>();
  private readonly criticalQueue = new Map<string, PendingCapture>();

  constructor(options: CapturePolicyEngineOptions) {
    validatePolicy(options.policy ?? DEFAULT_DIAGNOSTIC_CAPTURE_POLICY);
    this.diagnostics = options.diagnostics;
    this.healthProbe = options.healthProbe;
    this.markerGateway = options.markerGateway;
    this.auditSink = options.auditSink;
    this.policy = options.policy ?? DEFAULT_DIAGNOSTIC_CAPTURE_POLICY;
    this.now = options.now ?? Date.now;
    this.newCaptureId = options.newCaptureId ?? (() => `cap-${randomUUID()}`);
  }

  /**
   * Existing MEMORY_PRESSURE_DETECTED adapter.
   *
   * A normal first pressure earns D1 only. A consecutive second pressure in the
   * same non-null span, or >64 MiB growth inside a span, additionally earns D2.
   */
  async onMemoryPressure(event: MemoryPressureDetected): Promise<CaptureOutcome[]> {
    const sequence = this.nextPressureSequence(event.runId, event.spanId);
    const growthMb =
      event.memoryBeforeMb !== undefined && event.memoryPeakMb !== undefined
        ? event.memoryPeakMb - event.memoryBeforeMb
        : null;
    const earnsD2 =
      (event.spanId !== null && sequence.count >= 2) ||
      (growthMb !== null && growthMb > D2_MEMORY_GROWTH_THRESHOLD_MB);

    const pending: PendingCapture[] = [];
    if (this.policy.enabled.D1_MEMINFO) {
      pending.push({
        level: "D1_MEMINFO",
        context: event,
        triggerEvent: "MEMORY_PRESSURE_DETECTED",
      });
    }
    if (earnsD2 && this.policy.enabled.D2_PERFETTO) {
      pending.push({
        level: "D2_PERFETTO",
        context: event,
        triggerEvent: "MEMORY_PRESSURE_DETECTED",
      });
    }

    const outcomes: CaptureOutcome[] = [];
    for (const request of pending) {
      outcomes.push(await this.attempt(request));
    }
    return outcomes;
  }

  /**
   * D3 has no automatic path. The caller must make a separate, user-authorized
   * request, and automationRelease/production remain forbidden even then.
   */
  async requestHeapDump(request: HeapDumpRequest): Promise<CaptureOutcome> {
    return await this.attempt({
      level: "D3_HEAPDUMP",
      context: request,
      triggerEvent: "manual_opt_in",
      optIn: request.optIn,
      expectedDumpBytes: request.expectedDumpBytes,
    });
  }

  /**
   * Re-evaluates captures deferred by the CRITICAL-span forbidden window.
   * `get_health` is polled again for every entry; a still-open critical span is
   * never bypassed by a stale SPAN_ENDED notification.
   */
  async drainCriticalSpanQueue(runId: string): Promise<CaptureOutcome[]> {
    const entries = [...this.criticalQueue.entries()]
      .filter(([, pending]) => pending.context.runId === runId);
    const outcomes: CaptureOutcome[] = [];
    for (const [key, pending] of entries) {
      this.criticalQueue.delete(key);
      outcomes.push(await this.attempt(pending));
    }
    return outcomes;
  }

  resetRun(runId: string): void {
    this.budgets.delete(runId);
    this.pressureSequences.delete(runId);
    for (const [key, pending] of this.criticalQueue) {
      if (pending.context.runId === runId) this.criticalQueue.delete(key);
    }
  }

  private async attempt(pending: PendingCapture): Promise<CaptureOutcome> {
    const { level, context } = pending;
    const captureId = assertCaptureId(this.newCaptureId());
    const startedAtMs = this.now();
    const sensitive = level === "D3_HEAPDUMP";

    const skip = async (
      skippedReason: DiagnosticSkippedReason,
      health: DiagnosticHealthSnapshot | null,
      queue = false,
    ): Promise<CaptureOutcome> => {
      if (queue) this.enqueue(pending);
      await this.auditSink.record(
        this.auditFor(pending, {
          captureId,
          status: "skipped",
          sensitive,
          pid: health?.pid ?? null,
          skippedReason,
          createdAt: new Date(startedAtMs),
          completedAt: new Date(this.now()),
        }),
      );
      return { status: "skipped", captureId, level, skippedReason };
    };

    if (level === "D3_HEAPDUMP") {
      if (
        !this.policy.enabled.D3_HEAPDUMP ||
        !pending.optIn ||
        isFieldProfile(context.buildProfile)
      ) {
        return await skip("opt_in_missing", null);
      }
    }
    if (
      level === "D2_PERFETTO" &&
      isFieldProfile(context.buildProfile) &&
      context.d2OptIn !== true
    ) {
      return await skip("opt_in_missing", null);
    }

    let health: DiagnosticHealthSnapshot;
    try {
      health = await this.healthProbe.getHealth(context);
      validateHealth(health);
    } catch (error) {
      return await this.fail(
        pending,
        captureId,
        sensitive,
        startedAtMs,
        null,
        null,
        null,
        null,
        error,
      );
    }

    if (this.policy.inhibitDuringCriticalSpan && health.inCriticalSpan) {
      return await skip("critical_span", health, true);
    }

    if (level !== "D1_MEMINFO") {
      if (health.apiLevel < 29) return await skip("api_too_low", health);
      if (!health.profileable) return await skip("not_profileable", health);
    }

    const budget = this.budgetFor(context.runId);
    if (budget.counts[level] >= this.policy.quotaPerRun[level]) {
      return await skip("quota", health);
    }
    const previousStart = budget.lastStartedAt[level];
    if (
      previousStart !== undefined &&
      startedAtMs - previousStart < this.policy.cooldownMs[level]
    ) {
      return await skip("cooldown", health);
    }

    if (level === "D3_HEAPDUMP") {
      const expectedBytes = pending.expectedDumpBytes ?? DEFAULT_EXPECTED_HEAP_DUMP_BYTES;
      if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0) {
        return await this.fail(
          pending,
          captureId,
          sensitive,
          startedAtMs,
          health.pid,
          null,
          null,
          null,
          new Error("expectedDumpBytes must be a positive safe integer"),
        );
      }
      try {
        const freeBytes = await this.diagnostics.deviceFreeBytes(context.serial);
        if (freeBytes < expectedBytes * this.policy.minFreeSpaceMultiplier) {
          return await skip("low_disk", health);
        }
      } catch (error) {
        return await this.fail(
          pending,
          captureId,
          sensitive,
          startedAtMs,
          health.pid,
          null,
          null,
          null,
          error,
        );
      }
    }

    // Reserve budget when the capture is about to begin. A failed OS capture
    // still consumed device time and therefore counts against cooldown/quota.
    budget.counts[level] += 1;
    budget.lastStartedAt[level] = startedAtMs;

    const labels = markerLabels(level);
    let markerPreMonoTs: string | null = null;
    let markerPostMonoTs: string | null = null;
    let artifactRef: string | null = null;
    let mappingFileRef: string | null = null;

    try {
      markerPreMonoTs = validateMonoTs(
        await this.markerGateway.markDiagnostic({
          serial: context.serial,
          packageName: context.packageName,
          captureId,
          label: labels.pre,
        }),
      );

      artifactRef = await this.executeOsCapture(level, context, health.pid, captureId);

      if (
        level !== "D1_MEMINFO" &&
        context.mappingFilePath &&
        this.diagnostics.storeMappingFile
      ) {
        mappingFileRef = await this.diagnostics.storeMappingFile(
          captureId,
          context.mappingFilePath,
        );
      }

      markerPostMonoTs = validateMonoTs(
        await this.markerGateway.markDiagnostic({
          serial: context.serial,
          packageName: context.packageName,
          captureId,
          label: labels.post,
        }),
      );
    } catch (error) {
      if (markerPreMonoTs !== null && markerPostMonoTs === null) {
        try {
          markerPostMonoTs = validateMonoTs(
            await this.markerGateway.markDiagnostic({
              serial: context.serial,
              packageName: context.packageName,
              captureId,
              label: labels.post,
            }),
          );
        } catch {
          // The original capture/marker error remains the primary audit reason.
        }
      }
      return await this.fail(
        pending,
        captureId,
        sensitive,
        startedAtMs,
        health.pid,
        markerPreMonoTs,
        markerPostMonoTs,
        artifactRef,
        error,
        mappingFileRef,
      );
    }

    const capture: DiagnosticCapture = {
      captureId,
      level,
      runId: context.runId,
      sessionId: context.sessionId,
      screen: context.screen || health.screen,
      operation: context.operation ?? health.operation,
      spanId: context.spanId ?? health.spanId,
      pid: health.pid,
      markerPreMonoTs,
      markerPostMonoTs,
      artifactPath: artifactRef,
      ...(mappingFileRef ? { mappingFileRef } : {}),
      sensitive,
    };

    await this.auditSink.record(
      this.auditFor(pending, {
        captureId,
        status: "captured",
        sensitive,
        pid: health.pid,
        markerPreMonoTs,
        markerPostMonoTs,
        artifactRef,
        mappingFileRef,
        createdAt: new Date(startedAtMs),
        completedAt: new Date(this.now()),
      }),
    );
    return { status: "captured", level, capture };
  }

  private async executeOsCapture(
    level: DiagnosticLevel,
    context: DiagnosticRequestContext,
    pid: number,
    captureId: string,
  ): Promise<string> {
    switch (level) {
      case "D1_MEMINFO":
        return (
          await this.diagnostics.captureMeminfo({
            serial: context.serial,
            pid,
            captureId,
          })
        ).artifactPath;
      case "D2_PERFETTO":
        return (
          await this.diagnostics.capturePerfetto({
            serial: context.serial,
            captureId,
          })
        ).artifactPath;
      case "D3_HEAPDUMP":
        return (
          await this.diagnostics.captureHeapDump({
            serial: context.serial,
            packageName: context.packageName,
            captureId,
          })
        ).artifactPath;
    }
  }

  private async fail(
    pending: PendingCapture,
    captureId: string,
    sensitive: boolean,
    startedAtMs: number,
    pid: number | null,
    markerPreMonoTs: string | null,
    markerPostMonoTs: string | null,
    artifactRef: string | null,
    error: unknown,
    mappingFileRef: string | null = null,
  ): Promise<CaptureOutcome> {
    const message = error instanceof Error ? error.message : String(error);
    await this.auditSink.record(
      this.auditFor(pending, {
        captureId,
        status: "failed",
        sensitive,
        pid,
        markerPreMonoTs,
        markerPostMonoTs,
        artifactRef,
        mappingFileRef,
        errorMessage: message,
        createdAt: new Date(startedAtMs),
        completedAt: new Date(this.now()),
      }),
    );
    return { status: "failed", captureId, level: pending.level, error: message };
  }

  private auditFor(
    pending: PendingCapture,
    fields: Pick<
      DiagnosticCaptureAudit,
      "captureId" | "status" | "sensitive" | "pid" | "createdAt" | "completedAt"
    > &
      Partial<
        Pick<
          DiagnosticCaptureAudit,
          | "markerPreMonoTs"
          | "markerPostMonoTs"
          | "artifactRef"
          | "mappingFileRef"
          | "skippedReason"
          | "errorMessage"
        >
      >,
  ): DiagnosticCaptureAudit {
    const { context } = pending;
    return {
      captureId: fields.captureId,
      level: pending.level,
      runId: context.runId,
      sessionId: context.sessionId,
      triggerEvent: pending.triggerEvent,
      status: fields.status,
      screen: context.screen,
      operation: context.operation,
      spanId: context.spanId,
      pid: fields.pid,
      markerPreMonoTs: fields.markerPreMonoTs ?? null,
      markerPostMonoTs: fields.markerPostMonoTs ?? null,
      artifactRef: fields.artifactRef ?? null,
      mappingFileRef: fields.mappingFileRef ?? null,
      sensitive: fields.sensitive,
      skippedReason: fields.skippedReason ?? null,
      errorMessage: fields.errorMessage ?? null,
      buildProfile: context.buildProfile,
      requestedBy: context.requestedBy,
      optInApprovedBy: pending.optIn?.approvedBy ?? null,
      optInApprovedAt: pending.optIn?.approvedAt ?? null,
      createdAt: fields.createdAt,
      completedAt: fields.completedAt,
    };
  }

  private enqueue(pending: PendingCapture): void {
    const { context, level } = pending;
    const key = [
      context.runId,
      level,
      context.screen,
      context.operation ?? "",
      context.spanId ?? "",
    ].join("|");
    this.criticalQueue.set(key, pending);
  }

  private budgetFor(runId: string): RunBudget {
    const existing = this.budgets.get(runId);
    if (existing) return existing;
    const created: RunBudget = {
      counts: {
        D1_MEMINFO: 0,
        D2_PERFETTO: 0,
        D3_HEAPDUMP: 0,
      },
      lastStartedAt: {},
    };
    this.budgets.set(runId, created);
    return created;
  }

  private nextPressureSequence(runId: string, spanId: string | null): PressureSequence {
    const previous = this.pressureSequences.get(runId);
    const next: PressureSequence =
      spanId !== null && previous?.spanId === spanId
        ? { spanId, count: previous.count + 1 }
        : { spanId, count: 1 };
    this.pressureSequences.set(runId, next);
    return next;
  }
}

function markerLabels(level: DiagnosticLevel): { pre: string; post: string } {
  switch (level) {
    case "D1_MEMINFO":
      return { pre: "meminfo_pre", post: "meminfo_post" };
    case "D2_PERFETTO":
      return { pre: "perfetto_pre", post: "perfetto_post" };
    case "D3_HEAPDUMP":
      return { pre: "heapdump_pre", post: "heapdump_post" };
  }
}

function isFieldProfile(profile: DiagnosticBuildProfile): boolean {
  return profile === "automationRelease" || profile === "production";
}

function validateMonoTs(value: string): string {
  if (!/^\d+$/.test(value)) {
    throw new Error("mark_diagnostic returned a non-decimal monoTs");
  }
  return value;
}

function assertCaptureId(value: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error("newCaptureId returned an unsafe capture id");
  }
  return value;
}

function validateHealth(health: DiagnosticHealthSnapshot): void {
  if (!Number.isSafeInteger(health.pid) || health.pid <= 0) {
    throw new Error("get_health returned an invalid pid");
  }
  if (!Number.isSafeInteger(health.apiLevel) || health.apiLevel <= 0) {
    throw new Error("get_health returned an invalid apiLevel");
  }
}

function validatePolicy(policy: DiagnosticCapturePolicy): void {
  const levels: DiagnosticLevel[] = ["D1_MEMINFO", "D2_PERFETTO", "D3_HEAPDUMP"];
  for (const level of levels) {
    if (!Number.isFinite(policy.cooldownMs[level]) || policy.cooldownMs[level] < 0) {
      throw new Error(`Invalid cooldown for ${level}`);
    }
    if (
      !Number.isSafeInteger(policy.quotaPerRun[level]) ||
      policy.quotaPerRun[level] < 0
    ) {
      throw new Error(`Invalid quota for ${level}`);
    }
  }
  if (
    !Number.isFinite(policy.minFreeSpaceMultiplier) ||
    policy.minFreeSpaceMultiplier < 1
  ) {
    throw new Error("minFreeSpaceMultiplier must be >= 1");
  }
}
