import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RunTelemetrySampler,
  type RunTelemetrySnapshotWrite,
} from "./run-telemetry-sampler.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("RunTelemetrySampler", () => {
  it("times out safely and never overlaps a still-settling cycle", async () => {
    vi.useFakeTimers();
    let healthCalls = 0;
    let memoryCalls = 0;
    const writes: RunTelemetrySnapshotWrite[] = [];
    const never = new Promise<null>(() => undefined);
    const sampler = new RunTelemetrySampler({
      runId: "run-1",
      sessionId: "session-1",
      intervalMs: 10,
      timeoutMs: 5,
      sampleHealth: () => {
        healthCalls += 1;
        return never;
      },
      sampleMemory: async () => {
        memoryCalls += 1;
        return { rssBytes: 10 };
      },
      persist: async (row) => {
        writes.push(row);
      },
    });

    sampler.start();
    await vi.advanceTimersByTimeAsync(100);

    expect(healthCalls).toBe(1);
    expect(memoryCalls).toBe(1);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.kind).toBe("MEMORY");
    expect(sampler.isActive()).toBe(true);
    expect(sampler.hasScheduledTimer()).toBe(false);

    await sampler.stop();
    expect(sampler.hasScheduledTimer()).toBe(false);
  });

  it("persists an explicit final capture and removes every timer", async () => {
    vi.useFakeTimers();
    const writes: RunTelemetrySnapshotWrite[] = [];
    let now = 1_000;
    const sampler = new RunTelemetrySampler({
      runId: "run-final",
      sessionId: "session-final",
      intervalMs: 5_000,
      timeoutMs: 100,
      clock: () => now,
      sampleHealth: async () => ({ pid: 7, future: true }),
      sampleMemory: async () => ({ rssBytes: 42 }),
      persist: async (row) => {
        writes.push(row);
      },
    });

    sampler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toHaveLength(2);
    expect(sampler.hasScheduledTimer()).toBe(true);

    now = 2_000;
    await sampler.stop({ finalCapture: true });
    await vi.advanceTimersByTimeAsync(0);

    expect(writes).toHaveLength(4);
    expect(writes.slice(2).map((row) => row.kind).sort()).toEqual([
      "HEALTH",
      "MEMORY",
    ]);
    expect(writes[2]?.capturedAt.getTime()).toBe(2_000);
    expect(sampler.isActive()).toBe(false);
    expect(sampler.hasScheduledTimer()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("swallows persistence failures and remains stoppable", async () => {
    vi.useFakeTimers();
    const logger = vi.fn();
    const sampler = new RunTelemetrySampler({
      runId: "run-db-down",
      sessionId: "session-db-down",
      intervalMs: 50,
      timeoutMs: 10,
      sampleHealth: async () => ({ pid: 9 }),
      sampleMemory: async () => null,
      persist: async () => {
        throw new Error("database unavailable");
      },
      logger,
    });

    sampler.start();
    await vi.advanceTimersByTimeAsync(0);
    await sampler.stop();

    expect(logger).toHaveBeenCalledWith(
      "[RunTelemetrySampler] snapshot persistence unavailable",
      expect.objectContaining({ kind: "HEALTH" }),
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
