import type {
  DeviceHealthSnapshot,
  DeviceMemorySnapshot,
} from "@nesy/control-contract";
import type { Prisma, PrismaClient } from "@nesy/db";

import {
  getDeviceHealth,
  getDeviceMemorySnapshot,
} from "./test-event-bridge.js";

export type RunTelemetrySnapshotKind = "HEALTH" | "MEMORY";

export interface RunTelemetrySnapshotWrite {
  runId: string;
  sessionId: string;
  kind: RunTelemetrySnapshotKind;
  capturedAt: Date;
  payload: Record<string, unknown>;
  measurementState: "MEASURED" | "PARTIAL";
  source: "VERDICT_CONTROL";
}

export interface RunTelemetrySamplerOptions {
  runId: string;
  sessionId: string;
  intervalMs?: number;
  timeoutMs?: number;
  clock?: () => number;
  sampleHealth: () => Promise<DeviceHealthSnapshot | null>;
  sampleMemory: () => Promise<DeviceMemorySnapshot | null>;
  persist: (snapshot: RunTelemetrySnapshotWrite) => Promise<void>;
  logger?: (message: string, detail?: unknown) => void;
}

type TimedResult<T> =
  | { state: "value"; value: T | null }
  | { state: "unavailable" };

/**
 * Bounded best-effort sampler. Cycles never overlap, including when a timed-out
 * transport promise is still settling. Unsupported older mobile builds simply
 * produce no row and can never block or fail the owning workflow.
 */
export class RunTelemetrySampler {
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly clock: () => number;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active: Promise<void> | null = null;

  constructor(private readonly options: RunTelemetrySamplerOptions) {
    this.intervalMs = positive(options.intervalMs, 5_000);
    this.timeoutMs = positive(options.timeoutMs, 2_000);
    this.clock = options.clock ?? Date.now;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.capture();
  }

  async stop(options?: { finalCapture?: boolean }): Promise<void> {
    this.running = false;
    this.clearTimer();
    if (options?.finalCapture) await this.captureFinal();
  }

  async captureFinal(): Promise<boolean> {
    this.running = false;
    this.clearTimer();
    const activeAtStop = this.active;
    if (activeAtStop) {
      await settleWithin(activeAtStop, this.timeoutMs);
      if (this.active === activeAtStop) return false;
    }
    return this.capture();
  }

  isActive(): boolean {
    return this.active !== null;
  }

  hasScheduledTimer(): boolean {
    return this.timer !== null;
  }

  private async capture(): Promise<boolean> {
    if (this.active) return false;

    const capturedAt = new Date(this.clock());
    const health = Promise.resolve().then(this.options.sampleHealth);
    const memory = Promise.resolve().then(this.options.sampleMemory);
    const persistence = Promise.all([
      within(health, this.timeoutMs),
      within(memory, this.timeoutMs),
    ]).then(async ([healthResult, memoryResult]) => {
      const writes: Promise<void>[] = [];
      if (healthResult.state === "value" && healthResult.value !== null) {
        writes.push(this.persist("HEALTH", capturedAt, healthResult.value));
      }
      if (memoryResult.state === "value" && memoryResult.value !== null) {
        writes.push(this.persist("MEMORY", capturedAt, memoryResult.value));
      }
      await Promise.all(writes);
    });

    const guard = Promise.allSettled([health, memory, persistence])
      .then(() => undefined)
      .finally(() => {
        if (this.active !== guard) return;
        this.active = null;
        if (this.running) this.schedule();
      });
    this.active = guard;

    await persistence.catch((error) => {
      this.options.logger?.("[RunTelemetrySampler] capture failed closed", {
        runId: this.options.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    return true;
  }

  private async persist(
    kind: RunTelemetrySnapshotKind,
    capturedAt: Date,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.options.persist({
        runId: this.options.runId,
        sessionId: this.options.sessionId,
        kind,
        capturedAt,
        payload,
        measurementState: "MEASURED",
        source: "VERDICT_CONTROL",
      });
    } catch (error) {
      this.options.logger?.("[RunTelemetrySampler] snapshot persistence unavailable", {
        runId: this.options.runId,
        kind,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private schedule(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.capture();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}

export function createRunTelemetrySampler(input: {
  prisma: PrismaClient;
  runId: string;
  sessionId: string;
  deviceId: string;
  applicationId: string;
  intervalMs?: number;
  timeoutMs?: number;
  clock?: () => number;
  logger?: (message: string, detail?: unknown) => void;
}): RunTelemetrySampler {
  return new RunTelemetrySampler({
    runId: input.runId,
    sessionId: input.sessionId,
    ...(input.intervalMs === undefined ? {} : { intervalMs: input.intervalMs }),
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    ...(input.clock === undefined ? {} : { clock: input.clock }),
    ...(input.logger === undefined ? {} : { logger: input.logger }),
    sampleHealth: () => getDeviceHealth(input.deviceId, input.applicationId),
    sampleMemory: () =>
      getDeviceMemorySnapshot(input.deviceId, input.applicationId),
    persist: async (snapshot) => {
      await input.prisma.verdictRunTelemetrySnapshot.create({
        data: {
          ...snapshot,
          payload: snapshot.payload as Prisma.InputJsonValue,
        },
      });
    },
  });
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback;
}

function within<T>(promise: Promise<T>, timeoutMs: number): Promise<TimedResult<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ state: "unavailable" }),
      timeoutMs,
    );
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve({ state: "value", value });
      },
      () => {
        clearTimeout(timer);
        resolve({ state: "unavailable" });
      },
    );
  });
}

async function settleWithin(promise: Promise<void>, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    timer.unref?.();
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}
