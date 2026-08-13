import { prisma } from "@nesy/db";

import { getVerdictDurableRuntime } from "./verdict-wait-event.js";

export type TelemetryMeasurementState =
  | "MEASURED"
  | "PARTIAL"
  | "UNAVAILABLE";

export interface TelemetrySectionMeta {
  measurementState: TelemetryMeasurementState;
  source: readonly string[];
}

export interface RunTelemetryDto {
  apiVersion: "verdict-run-telemetry.v1";
  runId: string;
  measurementState: TelemetryMeasurementState;
  summary: {
    durationMs: number | null;
    eventCount: number | null;
    memoryPeakBytes: number | null;
    riskCounts: { warning: number; error: number; critical: number } | null;
    httpCount: number | null;
    httpErrorRate: number | null;
    httpP50Ms: number | null;
    httpP95Ms: number | null;
    spanCount: number | null;
  };
  memorySamples: readonly Record<string, unknown>[];
  httpCalls: readonly Record<string, unknown>[];
  spans: readonly Record<string, unknown>[];
  incidents: readonly Record<string, unknown>[];
  eventBuckets: readonly { startMs: number; count: number }[];
  latestHealth: Record<string, unknown> | null;
  streamHealth: readonly Record<string, unknown>[];
  diagnosticCaptures: readonly Record<string, unknown>[];
  sections: Readonly<Record<string, TelemetrySectionMeta>>;
}

type Row = Record<string, unknown>;

export interface RunTelemetryBuildInput {
  runId: string;
  run: Row;
  events: readonly Row[];
  snapshots: readonly Row[];
  streamHealth: readonly Row[];
  diagnosticCaptures: readonly Row[];
  nowMs?: number;
}

export async function getRunTelemetry(
  runId: string,
): Promise<RunTelemetryDto | null> {
  const runRows = await prisma.$queryRaw<Row[]>`
    SELECT
      wr.id,
      wr."startedAt" AS "startedAt",
      wr."completedAt" AS "completedAt",
      wr.duration,
      wr.spans,
      wr."deviceId" AS "deviceId",
      wr."workflowId" AS "workflowId",
      wr."versionId" AS "versionId",
      w.slug AS "workflowSlug",
      w.name AS "workflowName",
      bfr.run_session_id AS "runSessionId"
    FROM workflow_runs wr
    LEFT JOIN workflows w ON w.id = wr."workflowId"
    LEFT JOIN bridgeflow_run_runtime bfr ON bfr.run_id = wr.id
    WHERE wr.id = ${runId}
    LIMIT 1
  `;
  const run = runRows[0];
  if (!run) return null;

  const [events, snapshots, diagnosticCaptures, durableHealth] =
    await Promise.all([
      prisma.$queryRaw<Row[]>`
        SELECT payload, received_at AS "receivedAt", session_id AS "sessionId", seq
        FROM verdict_inbox
        WHERE run_id = ${runId}
        ORDER BY received_at ASC, seq ASC
      `,
      prisma.$queryRaw<Row[]>`
        SELECT kind, captured_at AS "capturedAt", payload,
               measurement_state AS "measurementState", source, session_id AS "sessionId"
        FROM verdict_run_telemetry_snapshot
        WHERE run_id = ${runId}
        ORDER BY captured_at ASC
      `,
      prisma.$queryRaw<Row[]>`
        SELECT capture_id AS "captureId", level, trigger_event AS "triggerEvent",
               status, screen, operation, span_id AS "spanId", sensitive,
               skipped_reason AS "skippedReason", created_at AS "createdAt",
               completed_at AS "completedAt"
        FROM verdict_diagnostic_capture
        WHERE run_id = ${runId}
        ORDER BY created_at ASC
      `,
      getVerdictDurableRuntime()
        .health()
        .catch(() => null),
    ]);

  const streamHealth = durableHealth
    ? durableHealth.streams.filter((stream) => stream.runId === runId)
    : [];

  return buildRunTelemetry({
    runId,
    run,
    events,
    snapshots,
    streamHealth: streamHealth as unknown as Row[],
    diagnosticCaptures,
  });
}

export function buildRunTelemetry(
  input: RunTelemetryBuildInput,
): RunTelemetryDto {
  const runStartedAt = timestamp(input.run.startedAt);
  const eventRows = input.events.flatMap((row) => {
    const payload = record(row.payload);
    return payload ? [{ row, payload }] : [];
  });
  const eventTimes = eventRows.map(({ row, payload }) =>
    eventTimestamp(payload, row),
  );
  const relativeOrigin =
    runStartedAt ??
    minOrNull(eventTimes.filter((value): value is number => value !== null));

  const memorySamples = input.snapshots.flatMap((row) => {
    if (row.kind !== "MEMORY") return [];
    const payload = record(row.payload);
    if (!payload) return [];
    const sample = safeMemorySample(
      payload,
      relativeMs(timestamp(row.capturedAt), relativeOrigin),
    );
    return sample ? [sample] : [];
  });

  for (const { row, payload } of eventRows) {
    if (payload.event !== "MEMORY_PRESSURE_DETECTED") continue;
    const memoryPayload = record(payload.data) ?? payload;
    const sample = safeMemorySample(
      memoryPayload,
      relativeMs(eventTimestamp(payload, row), relativeOrigin),
    );
    if (sample) memorySamples.push({ ...sample, sourceEvent: payload.event });
  }

  const httpCalls = eventRows.flatMap(({ row, payload }) => {
    if (
      payload.event !== "HTTP_CALL" &&
      payload.event !== "HTTP_RESPONSE_RECEIVED" &&
      payload.event !== "HTTP_REQUEST_COMPLETED"
    ) {
      return [];
    }
    const data = record(payload.data) ?? {};
    const durationMs = numericValue(data.durationMs ?? payload.durationMs);
    const code = numericValue(
      data.code ?? payload.code ?? data.status ?? data.statusCode,
    );
    const success =
      typeof payload.success === "boolean"
        ? payload.success
        : code === null
          ? null
          : code >= 200 && code < 400;
    return [{
      atMs: relativeMs(eventTimestamp(payload, row), relativeOrigin),
      requestId: safeIdentifier(payload.requestId),
      method: safeMethod(data.method ?? payload.method),
      host: safeHost(data.host ?? payload.host),
      path: safePath(data.path ?? payload.path ?? data.url),
      code,
      status: code,
      success,
      durationMs: durationMs !== null && durationMs >= 0 ? durationMs : null,
      bytesIn: nonNegative(data.bytes_in ?? payload.bytes_in),
      bytesOut: nonNegative(data.bytes_out ?? payload.bytes_out),
    }];
  });

  const rawSpans = input.run.spans;
  const workflowSpansDeclared = Array.isArray(rawSpans);
  const workflowSpans = workflowSpansDeclared
    ? rawSpans.flatMap((value: unknown) => {
        const span = record(value);
        if (!span) return [];
        const startMs = finiteNumber(span.startMs);
        const durationMs = finiteNumber(span.durationMs);
        if (startMs === null || startMs < 0 || durationMs === null || durationMs < 0) {
          return [];
        }
        return [{
          name: safeText(span.name, 120) ?? "unnamed",
          startMs,
          durationMs,
          status: safeText(span.status, 40),
          spanId: safeIdentifier(span.spanId),
          parentSpanId: safeIdentifier(span.parentSpanId),
          operation: safeText(span.operation, 120),
          source: "workflow_runs.spans",
        }];
      })
    : [];
  const durableSpanEvents = eventRows.filter(
    ({ payload }) => payload.event === "SPAN_ENDED",
  );
  const durableSpans = durableSpanEvents.flatMap(({ row, payload }) => {
    const data = record(payload.data) ?? {};
    const durationMs = nonNegative(data.durationMs ?? payload.durationMs);
    if (durationMs === null) return [];
    const endMs = relativeMs(eventTimestamp(payload, row), relativeOrigin);
    const explicitStartMs = nonNegative(data.startMs ?? payload.startMs);
    const startMs =
      explicitStartMs ??
      (endMs === null ? null : Math.max(0, endMs - durationMs));
    if (startMs === null) return [];
    const operation = safeText(data.operation ?? payload.operation, 120);
    const status =
      safeText(data.status ?? payload.status, 40) ??
      (typeof payload.success === "boolean"
        ? payload.success
          ? "OK"
          : "ERROR"
        : null);
    return [{
      name: safeText(data.name ?? payload.name, 120) ?? operation ?? "unnamed",
      startMs,
      durationMs,
      status,
      spanId: safeIdentifier(payload.spanId ?? data.spanId),
      parentSpanId: safeIdentifier(payload.parentSpanId ?? data.parentSpanId),
      operation,
      source: "verdict_inbox:SPAN_ENDED",
    }];
  });
  const spans = mergeTelemetrySpans(workflowSpans, durableSpans);
  const spansMeasured =
    workflowSpansDeclared || durableSpanEvents.length > 0;
  const spansPartial =
    (workflowSpansDeclared && workflowSpans.length !== rawSpans.length) ||
    durableSpans.length !== durableSpanEvents.length ||
    (runStartedAt === null && durableSpans.length > 0);

  const incidents = eventRows.flatMap(({ row, payload }) => {
    const event = typeof payload.event === "string" ? payload.event : "";
    const severity = incidentSeverity(event);
    if (!severity) return [];
    const data = record(payload.data) ?? {};
    return [{
      atMs: relativeMs(eventTimestamp(payload, row), relativeOrigin),
      event,
      severity,
      screen: safeText(payload.screen, 100),
      operation: safeText(data.operation, 100),
      spanId: safeIdentifier(payload.spanId),
    }];
  });

  const latestHealthRow = [...input.snapshots]
    .reverse()
    .find((row) => row.kind === "HEALTH" && record(row.payload) !== null);
  const latestHealthPayload = latestHealthRow
    ? record(latestHealthRow.payload)
    : null;
  const latestHealth = latestHealthPayload
    ? safeHealth(latestHealthPayload, relativeMs(timestamp(latestHealthRow?.capturedAt), relativeOrigin))
    : null;

  const runEnded = [...eventRows]
    .reverse()
    .find(({ payload }) => payload.event === "RUN_ENDED");
  const runEndedData = runEnded ? record(runEnded.payload.data) ?? {} : {};
  const runEndedDurationMs = nonNegative(
    runEndedData.durationMs ?? runEnded?.payload.durationMs,
  );
  const runEndedEventsEmitted = nonNegative(
    runEndedData.eventsEmitted ??
      runEnded?.payload.eventsEmitted ??
      runEndedData.events,
  );
  const duration = resolveDuration(
    input.run,
    input.nowMs ?? Date.now(),
    runEndedDurationMs,
  );
  const workflowEventCount =
    nonNegative(input.run.eventCount) ??
    nonNegative(input.run.eventsEmitted);
  const eventCount =
    workflowEventCount ??
    runEndedEventsEmitted ??
    (eventRows.length > 0 ? eventRows.length : null);
  const eventCountSource =
    workflowEventCount !== null
      ? "workflow_runs.eventCount"
      : runEndedEventsEmitted !== null
        ? "verdict_inbox:RUN_ENDED.eventsEmitted"
        : eventRows.length > 0
          ? "verdict_inbox:row_count"
          : null;
  const eventBuckets = bucketEvents(eventTimes, relativeOrigin, 5_000);
  const httpDurations = httpCalls.flatMap((call) =>
    typeof call.durationMs === "number" ? [call.durationMs] : [],
  );
  const httpFailures = httpCalls.filter((call) => call.success === false).length;
  const memoryPeakBytes = maxOrNull(
    memorySamples.flatMap((sample) =>
      typeof sample.peakBytes === "number" ? [sample.peakBytes] : [],
    ),
  );
  const riskCounts =
    incidents.length === 0
      ? null
      : {
          warning: incidents.filter((item) => item.severity === "warning").length,
          error: incidents.filter((item) => item.severity === "error").length,
          critical: incidents.filter((item) => item.severity === "critical").length,
        };
  const durationMs = duration.value;
  const summarySources = [
    duration.source,
    eventCountSource,
    memoryPeakBytes === null ? null : "verdict_run_telemetry_snapshot",
  ].filter((source): source is string => source !== null);
  const summaryUsesSdkFallback =
    duration.source?.startsWith("verdict_inbox:RUN_ENDED") === true ||
    eventCountSource?.startsWith("verdict_inbox:RUN_ENDED") === true;
  const sections: Record<string, TelemetrySectionMeta> = {
    summary: {
      measurementState:
        durationMs === null && eventRows.length === 0 && memoryPeakBytes === null
          ? "UNAVAILABLE"
          : durationMs !== null && eventCount !== null && !summaryUsesSdkFallback
            ? "MEASURED"
            : "PARTIAL",
      source: summarySources,
    },
    events: section(eventRows.length > 0, ["verdict_inbox"]),
    eventBuckets: section(eventBuckets.length > 0, ["verdict_inbox"]),
    memorySamples: section(memorySamples.length > 0, [
      "verdict_run_telemetry_snapshot:MEMORY",
      "verdict_inbox:MEMORY_PRESSURE_DETECTED",
    ]),
    httpCalls: section(httpCalls.length > 0, ["verdict_inbox:HTTP_*"]),
    spans: {
      measurementState: !spansMeasured
        ? "UNAVAILABLE"
        : spansPartial
          ? "PARTIAL"
          : "MEASURED",
      source: [
        ...(workflowSpansDeclared ? ["workflow_runs.spans"] : []),
        ...(durableSpanEvents.length > 0
          ? ["verdict_inbox:SPAN_ENDED"]
          : []),
        ...(runStartedAt === null && durableSpans.length > 0
          ? ["relative-origin:first-event"]
          : []),
      ],
    },
    incidents: section(incidents.length > 0, ["verdict_inbox:risk-events"]),
    latestHealth: section(latestHealth !== null, [
      "verdict_run_telemetry_snapshot:HEALTH",
    ]),
    streamHealth: section(input.streamHealth.length > 0, [
      "verdict_stream",
      "verdict_inbox",
      "verdict_run_closure",
    ]),
    diagnosticCaptures: section(input.diagnosticCaptures.length > 0, [
      "verdict_diagnostic_capture",
    ]),
  };
  if (relativeOrigin !== null && runStartedAt === null && eventRows.length > 0) {
    sections.events = {
      measurementState: "PARTIAL",
      source: ["verdict_inbox", "relative-origin:first-event"],
    };
  }

  return {
    apiVersion: "verdict-run-telemetry.v1",
    runId: input.runId,
    measurementState: overallState(Object.values(sections)),
    summary: {
      durationMs,
      eventCount,
      memoryPeakBytes,
      riskCounts,
      httpCount: httpCalls.length > 0 ? httpCalls.length : null,
      httpErrorRate:
        httpCalls.length > 0 ? httpFailures / httpCalls.length : null,
      httpP50Ms: percentile(httpDurations, 0.5),
      httpP95Ms: percentile(httpDurations, 0.95),
      spanCount: spansMeasured ? spans.length : null,
    },
    memorySamples,
    httpCalls,
    spans,
    incidents,
    eventBuckets,
    latestHealth,
    streamHealth: input.streamHealth.map(safeStreamHealth),
    diagnosticCaptures: input.diagnosticCaptures.map(safeDiagnosticCapture),
    sections,
  };
}

function safeMemorySample(
  payload: Row,
  atMs: number | null,
): Record<string, unknown> | null {
  const heapUsedBytes =
    nonNegative(payload.heapUsedBytes) ??
    nonNegative(payload.javaHeapUsedBytes) ??
    nonNegative(payload.usedBytes);
  const heapCommittedBytes = nonNegative(payload.heapCommittedBytes);
  const heapMaxBytes =
    nonNegative(payload.heapMaxBytes) ??
    nonNegative(payload.javaHeapMaxBytes);
  const nativeAllocatedBytes =
    nonNegative(payload.nativeAllocatedBytes) ??
    nonNegative(payload.nativeHeapAllocatedBytes);
  const rssBytes = nonNegative(payload.rssBytes);
  const pssBytes = nonNegative(payload.pssBytes);
  const pressurePeakBytes = mbToBytes(payload.memoryPeakMb);
  const pressureBeforeBytes = mbToBytes(payload.memoryBeforeMb);
  const allocatedBytes =
    heapUsedBytes === null && nativeAllocatedBytes === null
      ? null
      : (heapUsedBytes ?? 0) + (nativeAllocatedBytes ?? 0);
  const totalBytes =
    pressurePeakBytes ??
    rssBytes ??
    pssBytes ??
    allocatedBytes ??
    pressureBeforeBytes;
  if (totalBytes === null) return null;
  return {
    atMs,
    pid: positiveInteger(payload.pid),
    totalBytes,
    peakBytes: pressurePeakBytes ?? totalBytes,
    heapUsedBytes,
    heapCommittedBytes,
    heapMaxBytes,
    nativeAllocatedBytes,
    rssBytes,
    pssBytes,
    // Legacy aliases remain projected while consumers migrate to SDK names.
    javaHeapUsedBytes: nonNegative(payload.javaHeapUsedBytes),
    javaHeapMaxBytes: nonNegative(payload.javaHeapMaxBytes),
    nativeHeapAllocatedBytes: nonNegative(payload.nativeHeapAllocatedBytes),
    lowMemory:
      typeof payload.lowMemory === "boolean" ? payload.lowMemory : null,
  };
}

function safeHealth(payload: Row, atMs: number | null): Row {
  const wal = record(payload.wal);
  const anrRisk = record(payload.anrRisk);
  const wsAuth = record(payload.wsAuth);
  const gapPublish = record(payload.gapPublish);
  const gapEntries = Array.isArray(payload.gapEntries)
    ? payload.gapEntries
    : Array.isArray(payload.gaps)
      ? payload.gaps
      : Array.isArray(gapPublish?.entries)
        ? gapPublish.entries
        : null;
  return {
    atMs,
    pid: positiveInteger(payload.pid),
    apiLevel: positiveInteger(payload.apiLevel),
    profileable:
      typeof payload.profileable === "boolean" ? payload.profileable : null,
    inCriticalSpan:
      typeof payload.inCriticalSpan === "boolean"
        ? payload.inCriticalSpan
        : null,
    heapUsedMb: nonNegative(payload.heapUsedMb),
    heapMaxMb: nonNegative(payload.heapMaxMb),
    nativeHeapMb: nonNegative(payload.nativeHeapMb),
    gcCount: nonNegative(payload.gcCount),
    blockingGcTimeMs: nonNegative(payload.blockingGcTimeMs),
    crashedSince: safeCrashSince(payload.crashedSince),
    anrRisk: typeof payload.anrRisk === "boolean" ? payload.anrRisk : null,
    anrBlockedMs: nonNegative(anrRisk?.blockedMs),
    anrLevel: safeState(anrRisk?.level),
    eventsEmitted: nonNegative(payload.eventsEmitted),
    droppedSince: nonNegative(payload.droppedSince),
    gapEntriesUsed: nonNegative(payload.gapEntriesUsed),
    gapUsableEntries: nonNegative(payload.gapUsableEntries),
    screen: safeText(payload.screen, 100),
    operation: safeText(payload.operation, 100),
    spanId: safeIdentifier(payload.spanId),
    walState:
      safeState(payload.wal) ??
      safeState(wal?.state ?? wal?.status),
    gapEntryCount: gapEntries?.filter((entry) => record(entry) !== null).length ?? null,
    wsAuthState:
      safeState(payload.wsAuth) ??
      safeState(wsAuth?.state ?? wsAuth?.status),
    gapPublishState: safeState(gapPublish?.state),
  };
}

function safeStreamHealth(row: Row): Row {
  return {
    runId: safeIdentifier(row.runId),
    sessionId: safeIdentifier(row.sessionId),
    contiguousSeq: decimalString(row.contiguousSeq),
    receiptPending: nonNegative(row.receiptPending),
    orderedLag: nonNegative(row.orderedLag),
    oldestUnprocessedAgeMs: nonNegative(row.oldestUnprocessedAgeMs),
    lastReceiptDispatchLatencyMs: nonNegative(row.lastReceiptDispatchLatencyMs),
    maxAttempt: nonNegative(row.maxAttempt),
    deadLetteredCount: nonNegative(row.deadLetteredCount),
    lateEventCount: nonNegative(row.lateEventCount),
    closedAt: safeIsoTimestamp(row.closedAt),
  };
}

function safeDiagnosticCapture(row: Row): Row {
  return {
    captureId: safeIdentifier(row.captureId),
    level: safeText(row.level, 40),
    triggerEvent: safeText(row.triggerEvent, 80),
    status: safeText(row.status, 40),
    screen: safeText(row.screen, 100),
    operation: safeText(row.operation, 100),
    spanId: safeIdentifier(row.spanId),
    sensitive: row.sensitive === true,
    skippedReason: safeText(row.skippedReason, 80),
    createdAt: safeIsoTimestamp(row.createdAt),
    completedAt: safeIsoTimestamp(row.completedAt),
  };
}

function section(measured: boolean, source: readonly string[]): TelemetrySectionMeta {
  return {
    measurementState: measured ? "MEASURED" : "UNAVAILABLE",
    source,
  };
}

function overallState(
  sections: readonly TelemetrySectionMeta[],
): TelemetryMeasurementState {
  const measured = sections.filter(
    (item) => item.measurementState === "MEASURED",
  ).length;
  if (measured === 0) return "UNAVAILABLE";
  return measured === sections.length ? "MEASURED" : "PARTIAL";
}

function resolveDuration(
  run: Row,
  nowMs: number,
  runEndedDurationMs: number | null,
): { value: number | null; source: string | null } {
  const explicit = finiteNumber(run.duration);
  if (explicit !== null && explicit >= 0) {
    return { value: explicit, source: "workflow_runs.duration" };
  }
  const start = timestamp(run.startedAt);
  const completed = timestamp(run.completedAt);
  if (start !== null && completed !== null && completed >= start) {
    return {
      value: completed - start,
      source: "workflow_runs.startedAt+completedAt",
    };
  }
  if (runEndedDurationMs !== null) {
    return {
      value: runEndedDurationMs,
      source: "verdict_inbox:RUN_ENDED.durationMs",
    };
  }
  return start !== null && nowMs >= start
    ? { value: nowMs - start, source: "workflow_runs.startedAt:live" }
    : { value: null, source: null };
}

function mergeTelemetrySpans(
  workflowSpans: readonly Row[],
  durableSpans: readonly Row[],
): Row[] {
  const merged = workflowSpans.map((span) => ({ ...span }));
  for (const durable of durableSpans) {
    const durableSpanId = safeIdentifier(durable.spanId);
    const match = merged.findIndex((candidate) => {
      const candidateSpanId = safeIdentifier(candidate.spanId);
      if (durableSpanId && candidateSpanId) return durableSpanId === candidateSpanId;
      return (
        candidate.name === durable.name &&
        candidate.startMs === durable.startMs &&
        candidate.durationMs === durable.durationMs
      );
    });
    if (match < 0) {
      merged.push({ ...durable });
      continue;
    }
    const authoritative = merged[match]!;
    merged[match] = {
      ...durable,
      ...authoritative,
      status: authoritative.status ?? durable.status ?? null,
      spanId: authoritative.spanId ?? durable.spanId ?? null,
      parentSpanId:
        authoritative.parentSpanId ?? durable.parentSpanId ?? null,
      operation: authoritative.operation ?? durable.operation ?? null,
      source: "workflow_runs.spans+verdict_inbox:SPAN_ENDED",
    };
  }
  return merged.sort(
    (left, right) =>
      Number(left.startMs ?? 0) - Number(right.startMs ?? 0),
  );
}

function eventTimestamp(payload: Row, row: Row): number | null {
  const payloadTs = finiteNumber(payload.ts);
  return payloadTs !== null && payloadTs > 1_000_000_000_000
    ? payloadTs
    : timestamp(row.receivedAt);
}

function relativeMs(
  value: number | null,
  origin: number | null,
): number | null {
  return value === null || origin === null ? null : Math.max(0, value - origin);
}

function bucketEvents(
  times: readonly (number | null)[],
  origin: number | null,
  bucketMs: number,
): { startMs: number; count: number }[] {
  if (origin === null) return [];
  const buckets = new Map<number, number>();
  for (const value of times) {
    if (value === null) continue;
    const startMs = Math.floor(Math.max(0, value - origin) / bucketMs) * bucketMs;
    buckets.set(startMs, (buckets.get(startMs) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([startMs, count]) => ({ startMs, count }));
}

export function percentile(
  values: readonly number[],
  ratio: number,
): number | null {
  if (values.length === 0) return null;
  const sorted = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.max(0, Math.ceil(ratio * sorted.length) - 1);
  return sorted[Math.min(index, sorted.length - 1)] ?? null;
}

function incidentSeverity(
  event: string,
): "warning" | "error" | "critical" | null {
  if (event === "ANR_LIKELY" || event.includes("CRASH") || event.includes("FATAL")) {
    return "critical";
  }
  if (event === "ANR_RISK_DETECTED" || event === "MEMORY_PRESSURE_DETECTED") {
    return "warning";
  }
  if (event === "UNEXPECTED_SCREEN") return "error";
  if (event.includes("ERROR") || event.includes("FAILED")) return "error";
  return null;
}

function safePath(value: unknown): string | null {
  const text = safeText(value, 256);
  if (!text) return null;
  try {
    if (/^https?:\/\//i.test(text)) {
      const url = new URL(text);
      return url.pathname.slice(0, 256);
    }
  } catch {
    return null;
  }
  return text.split(/[?#]/, 1)[0]?.slice(0, 256) || null;
}

function safeMethod(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z]{3,10}$/.test(value)
    ? value
    : null;
}

function safeHost(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 253) {
    return null;
  }
  const host = value.toLowerCase();
  return /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[a-f0-9:]+\])(?::\d{1,5})?$/.test(
    host,
  )
    ? host
    : null;
}

function safeIdentifier(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,160}$/.test(value)
    ? value
    : null;
}

function safeText(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, max)
    : null;
}

function safeCrashSince(value: unknown): boolean | number | string | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    (/^\d{1,20}$/.test(value) ||
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) ||
      /^(?:none|unknown)$/i.test(value))
  ) {
    return value;
  }
  return null;
}

function safeState(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,40}$/.test(value)
    ? value
    : null;
}

function safeIsoTimestamp(value: unknown): string | null {
  const parsed = timestamp(value);
  return parsed === null ? null : new Date(parsed).toISOString();
}

function timestamp(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return finiteNumber(value);
}

function record(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function nonNegative(value: unknown): number | null {
  const number = numericValue(value);
  return number !== null && number >= 0 ? number : null;
}

function decimalString(value: unknown): string | null {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (Number.isSafeInteger(value) && Number(value) >= 0) return String(value);
  return null;
}

function mbToBytes(value: unknown): number | null {
  const number = numericValue(value);
  return number !== null && number >= 0 ? Math.round(number * 1024 * 1024) : null;
}

function minOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

function maxOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
