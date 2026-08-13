import { describe, expect, it } from "vitest";

import {
  buildRunTelemetry,
  percentile,
} from "./run-telemetry-read-model.js";

describe("run telemetry read model", () => {
  it("aggregates memory, HTTP percentiles, incidents and relative timestamps", () => {
    const startedAt = new Date("2026-08-13T08:00:00.000Z");
    const events: Record<string, unknown>[] = [10, 20, 30, 100].map((durationMs, index) => ({
      receivedAt: new Date(startedAt.getTime() + index * 1_000),
      payload: {
        event: "HTTP_CALL",
        ts: startedAt.getTime() + index * 1_000,
        requestId: `request-${index}`,
        data: {
          method: "GET",
          host: "api.example.test",
          path: `/orders?token=secret-${index}`,
          code: index === 3 ? 503 : 200,
          durationMs,
          bytes_in: 100 + index,
          bytes_out: 20 + index,
          headers: { authorization: "Bearer secret" },
          responseBody: "sensitive",
        },
      },
    }));
    events.push({
      receivedAt: new Date(startedAt.getTime() + 4_000),
      payload: {
        event: "ANR_RISK_DETECTED",
        ts: startedAt.getTime() + 4_000,
        screen: "StopList",
        data: { operation: "load" },
      },
    });
    events.push({
      receivedAt: new Date(startedAt.getTime() + 350),
      payload: {
        event: "SPAN_ENDED",
        ts: startedAt.getTime() + 350,
        spanId: "span-load",
        parentSpanId: "span-root",
        data: {
          name: "load",
          operation: "load-routes",
          durationMs: 250,
          status: "OK",
        },
      },
    });
    events.push({
      receivedAt: new Date(startedAt.getTime() + 600),
      payload: {
        event: "SPAN_ENDED",
        ts: startedAt.getTime() + 600,
        spanId: "span-sdk-only",
        data: {
          operation: "render-list",
          durationMs: 100,
          status: "OK",
        },
      },
    });
    events.push({
      receivedAt: new Date(startedAt.getTime() + 4_750),
      payload: {
        event: "UNEXPECTED_SCREEN",
        ts: startedAt.getTime() + 4_750,
        screen: "UnknownDialog",
      },
    });
    events.push({
      receivedAt: new Date(startedAt.getTime() + 4_500),
      payload: {
        event: "MEMORY_PRESSURE_DETECTED",
        ts: startedAt.getTime() + 4_500,
        data: { memoryPeakMb: "1", operation: "load" },
      },
    });

    const dto = buildRunTelemetry({
      runId: "run-1",
      run: {
        startedAt,
        completedAt: new Date(startedAt.getTime() + 8_000),
        spans: [{
          name: "load",
          startMs: 100,
          durationMs: 250,
          spanId: "span-load",
        }],
      },
      events,
      snapshots: [
        {
          kind: "MEMORY",
          capturedAt: new Date(startedAt.getTime() + 2_500),
          payload: {
            rssBytes: 90,
            pid: 17,
            heapUsedBytes: 40,
            heapCommittedBytes: 80,
            heapMaxBytes: 160,
            nativeAllocatedBytes: 15,
            futureField: "preserved in storage only",
            authorization: "must-not-leak",
          },
        },
        {
          kind: "HEALTH",
          capturedAt: new Date(startedAt.getTime() + 3_000),
          payload: {
            pid: 17,
            apiLevel: 36,
            inCriticalSpan: false,
            heapUsedMb: 42,
            heapMaxMb: 128,
            nativeHeapMb: 7,
            gcCount: 3,
            blockingGcTimeMs: 12,
            crashedSince: false,
            anrRisk: { blockedMs: 450, level: "HIGH" },
            eventsEmitted: 200,
            droppedSince: 2,
            gapEntriesUsed: 4,
            gapUsableEntries: 12,
            wal: "degraded",
            gapEntries: [{ from: 4, to: 6, secret: "not-returned" }],
            wsAuth: { state: "authenticated", token: "not-returned" },
            futureSecret: "not-returned",
          },
        },
      ],
      streamHealth: [{ runId: "run-1", sessionId: "s-1", orderedLag: 2 }],
      diagnosticCaptures: [{
        captureId: "capture-1",
        level: "D1_MEMINFO",
        status: "captured",
        sensitive: false,
        artifactRef: "/private/raw/path",
        requestedBy: "operator@example.test",
      }],
      nowMs: startedAt.getTime() + 9_000,
    });

    expect(dto.summary).toMatchObject({
      durationMs: 8_000,
      eventCount: 9,
      memoryPeakBytes: 1_048_576,
      httpCount: 4,
      httpErrorRate: 0.25,
      httpP50Ms: 20,
      httpP95Ms: 100,
      spanCount: 2,
      riskCounts: { warning: 2, error: 1, critical: 0 },
    });
    expect(dto.httpCalls[0]).toMatchObject({
      atMs: 0,
      method: "GET",
      host: "api.example.test",
      path: "/orders",
      code: 200,
      bytesIn: 100,
      bytesOut: 20,
    });
    expect(dto.memorySamples[0]).toMatchObject({
      atMs: 2_500,
      totalBytes: 90,
      peakBytes: 90,
      pid: 17,
      heapUsedBytes: 40,
      heapCommittedBytes: 80,
      heapMaxBytes: 160,
      nativeAllocatedBytes: 15,
    });
    expect(dto.latestHealth).toMatchObject({
      atMs: 3_000,
      pid: 17,
      heapUsedMb: 42,
      heapMaxMb: 128,
      nativeHeapMb: 7,
      gcCount: 3,
      blockingGcTimeMs: 12,
      crashedSince: false,
      anrRisk: null,
      anrBlockedMs: 450,
      anrLevel: "HIGH",
      eventsEmitted: 200,
      droppedSince: 2,
      gapEntriesUsed: 4,
      gapUsableEntries: 12,
      walState: "degraded",
      gapEntryCount: 1,
      wsAuthState: "authenticated",
    });
    expect(dto.incidents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "UNEXPECTED_SCREEN",
          severity: "error",
        }),
      ]),
    );
    expect(dto.spans).toEqual([
      expect.objectContaining({
        name: "load",
        startMs: 100,
        durationMs: 250,
        spanId: "span-load",
        parentSpanId: "span-root",
        operation: "load-routes",
        source: "workflow_runs.spans+verdict_inbox:SPAN_ENDED",
      }),
      expect.objectContaining({
        name: "render-list",
        startMs: 500,
        durationMs: 100,
        spanId: "span-sdk-only",
        source: "verdict_inbox:SPAN_ENDED",
      }),
    ]);
    expect(dto.sections.spans).toEqual({
      measurementState: "MEASURED",
      source: ["workflow_runs.spans", "verdict_inbox:SPAN_ENDED"],
    });
    expect(dto.eventBuckets).toEqual([{ startMs: 0, count: 9 }]);

    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain("secret-");
    expect(serialized).not.toContain("Bearer");
    expect(serialized).not.toContain("/private/raw/path");
    expect(serialized).not.toContain("operator@example.test");
    expect(serialized).not.toContain("futureSecret");
    expect(serialized).not.toContain("not-returned");
  });

  it("uses RUN_ENDED summaries only when workflow values are missing", () => {
    const runEnded = {
      receivedAt: new Date(2_500),
      payload: {
        event: "RUN_ENDED",
        ts: 2_500,
        data: { durationMs: 1_200, eventsEmitted: 99 },
      },
    };
    const fallback = buildRunTelemetry({
      runId: "run-ended-fallback",
      run: { startedAt: new Date(1_000) },
      events: [runEnded],
      snapshots: [],
      streamHealth: [],
      diagnosticCaptures: [],
      nowMs: 10_000,
    });

    expect(fallback.summary.durationMs).toBe(1_200);
    expect(fallback.summary.eventCount).toBe(99);
    expect(fallback.sections.summary.measurementState).toBe("PARTIAL");
    expect(fallback.sections.summary.source).toEqual(
      expect.arrayContaining([
        "verdict_inbox:RUN_ENDED.durationMs",
        "verdict_inbox:RUN_ENDED.eventsEmitted",
      ]),
    );

    const authoritative = buildRunTelemetry({
      runId: "run-ended-authoritative",
      run: {
        startedAt: new Date(1_000),
        completedAt: new Date(1_777),
        duration: 777,
        eventCount: 10,
      },
      events: [runEnded],
      snapshots: [],
      streamHealth: [],
      diagnosticCaptures: [],
      nowMs: 10_000,
    });

    expect(authoritative.summary.durationMs).toBe(777);
    expect(authoritative.summary.eventCount).toBe(10);
    expect(authoritative.sections.summary.measurementState).toBe("MEASURED");
    expect(authoritative.sections.summary.source).toEqual(
      expect.arrayContaining([
        "workflow_runs.duration",
        "workflow_runs.eventCount",
      ]),
    );
    expect(authoritative.sections.summary.source).not.toContain(
      "verdict_inbox:RUN_ENDED.durationMs",
    );
  });

  it("derives current memory from heap plus native and accepts object WAL state", () => {
    const dto = buildRunTelemetry({
      runId: "run-exact-wire",
      run: { startedAt: new Date(1_000), spans: [] },
      events: [],
      snapshots: [
        {
          kind: "MEMORY",
          capturedAt: new Date(2_000),
          payload: {
            pid: 8,
            heapUsedBytes: 100,
            heapCommittedBytes: 200,
            heapMaxBytes: 500,
            nativeAllocatedBytes: 25,
          },
        },
        {
          kind: "HEALTH",
          capturedAt: new Date(2_000),
          payload: {
            wal: { status: "ok", path: "/sensitive" },
            crashedSince: "Bearer secret",
          },
        },
      ],
      streamHealth: [],
      diagnosticCaptures: [],
      nowMs: 2_000,
    });

    expect(dto.memorySamples[0]).toMatchObject({
      totalBytes: 125,
      peakBytes: 125,
      heapUsedBytes: 100,
      heapCommittedBytes: 200,
      heapMaxBytes: 500,
      nativeAllocatedBytes: 25,
    });
    expect(dto.summary.memoryPeakBytes).toBe(125);
    expect(dto.latestHealth).toMatchObject({
      walState: "ok",
      crashedSince: null,
    });
    expect(JSON.stringify(dto)).not.toContain("/sensitive");
    expect(JSON.stringify(dto)).not.toContain("Bearer secret");
  });

  it("keeps empty or malformed data fail closed instead of manufacturing zeros", () => {
    const dto = buildRunTelemetry({
      runId: "run-empty",
      run: { spans: "malformed", duration: -1 },
      events: [{ payload: "bad", receivedAt: "not-a-date" }],
      snapshots: [
        { kind: "MEMORY", payload: { rssBytes: "not-a-number" }, capturedAt: "bad" },
        { kind: "HEALTH", payload: ["bad"], capturedAt: "bad" },
      ],
      streamHealth: [],
      diagnosticCaptures: [],
      nowMs: 1_000,
    });

    expect(dto.measurementState).toBe("UNAVAILABLE");
    expect(dto.summary).toEqual({
      durationMs: null,
      eventCount: null,
      memoryPeakBytes: null,
      riskCounts: null,
      httpCount: null,
      httpErrorRate: null,
      httpP50Ms: null,
      httpP95Ms: null,
      spanCount: null,
    });
    expect(dto.memorySamples).toEqual([]);
    expect(dto.httpCalls).toEqual([]);
    expect(dto.eventBuckets).toEqual([]);
    expect(dto.latestHealth).toBeNull();
  });

  it("uses nearest-rank percentiles and rejects invalid samples", () => {
    expect(percentile([100, 10, 30, 20], 0.5)).toBe(20);
    expect(percentile([100, 10, 30, 20], 0.95)).toBe(100);
    expect(percentile([Number.NaN, -1], 0.5)).toBeNull();
    expect(percentile([], 0.95)).toBeNull();
  });
});
