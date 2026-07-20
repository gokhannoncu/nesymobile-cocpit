/**
 * Device Worker — persistent per-device execution context + FIFO run queue.
 *
 * One worker per ADB device. The worker owns:
 * - a persistent logcat sniffer (started once, reused across runs)
 * - cached device metadata (model, Android version — fetched once)
 * - the `adb reverse tcp:8765` bridge for the WebSocket event channel
 * - a strictly sequential run queue (two runs can never hit the same device)
 *
 * Runs without a deviceId fall back to direct execution (legacy behavior):
 * no queue guarantees are possible when the target device is ambiguous.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@nesy/db";
import { LogcatSniffer } from "./logcat-sniffer.js";
import { WorkflowRunner } from "./workflow-runner.js";
import { TestEventWsServer, TEST_EVENT_WS_PORT } from "./test-event-ws-server.js";

const execFileAsync = promisify(execFile);

export { TEST_EVENT_WS_PORT };

export interface DeviceMetadata {
  model: string;
  androidVersion: string;
  sdkLevel: string;
  fetchedAt: number;
}

interface QueuedRun {
  runId: string;
  enqueuedAt: number;
}

async function adb(deviceId: string, args: string[], timeoutMs = 8000): Promise<string> {
  const result = await execFileAsync("adb", ["-s", deviceId, ...args], {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });
  return String(result.stdout).trim();
}

export class DeviceWorker {
  readonly deviceId: string;
  readonly startedAt = Date.now();

  private readonly sniffer: LogcatSniffer;
  private readonly queue: QueuedRun[] = [];
  private activeRunId: string | null = null;
  private processing = false;
  private prepared = false;
  private disposed = false;
  private metadata: DeviceMetadata | null = null;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.sniffer = new LogcatSniffer({ deviceId });
    this.sniffer.on("error", (err: unknown) => {
      console.warn(
        `[DeviceWorker:${deviceId}] sniffer error:`,
        err instanceof Error ? err.message : err,
      );
    });
    this.sniffer.on("close", () => {
      console.warn(`[DeviceWorker:${deviceId}] logcat stream closed — will restart on next run`);
    });
  }

  getStatus() {
    return {
      deviceId: this.deviceId,
      startedAt: this.startedAt,
      activeRunId: this.activeRunId,
      queuedRunIds: this.queue.map((q) => q.runId),
      queueLength: this.queue.length,
      logcatRunning: this.sniffer.isRunning(),
      metadata: this.metadata,
    };
  }

  /** Queue position: 0 = starts immediately, N = N runs ahead of it. */
  enqueue(runId: string): number {
    const position = this.queue.length + (this.activeRunId ? 1 : 0);
    this.queue.push({ runId, enqueuedAt: Date.now() });

    if (position > 0) {
      // Not starting immediately — surface it in the DB so the UI can show it.
      prisma.workflowRun
        .update({ where: { id: runId }, data: { status: "queued" } })
        .catch((err) => console.warn(`[DeviceWorker:${this.deviceId}] queued-status update failed:`, err));
    }

    void this.processQueue();
    return position;
  }

  /** Removes a not-yet-started run from the queue. Returns true when found. */
  removeFromQueue(runId: string): boolean {
    const index = this.queue.findIndex((q) => q.runId === runId);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    return true;
  }

  isActive(runId: string): boolean {
    return this.activeRunId === runId;
  }

  dispose(): void {
    this.disposed = true;
    TestEventWsServer.removeSink(this.sniffer);
    this.sniffer.stop();
  }

  /** One-time device preparation: metadata cache + adb reverse for the WS bridge. */
  private async prepare(): Promise<void> {
    if (this.prepared) return;
    this.prepared = true;

    try {
      const [model, androidVersion, sdkLevel] = await Promise.all([
        adb(this.deviceId, ["shell", "getprop", "ro.product.model"]),
        adb(this.deviceId, ["shell", "getprop", "ro.build.version.release"]),
        adb(this.deviceId, ["shell", "getprop", "ro.build.version.sdk"]),
      ]);
      this.metadata = { model, androidVersion, sdkLevel, fetchedAt: Date.now() };
      console.log(
        `[DeviceWorker:${this.deviceId}] prepared — ${model} (Android ${androidVersion}, SDK ${sdkLevel})`,
      );
    } catch (err) {
      // Metadata is best-effort; retry on next worker creation.
      this.prepared = false;
      console.warn(
        `[DeviceWorker:${this.deviceId}] metadata fetch failed:`,
        err instanceof Error ? err.message : err,
      );
    }

    // WebSocket event channel: start the shared host server, route its events
    // through this worker's sniffer (runId filter + dedupe), bridge the device
    // port, and enable the mobile sink for future cold starts via sysprop.
    TestEventWsServer.ensureStarted();
    TestEventWsServer.addSink(this.sniffer);

    try {
      await adb(this.deviceId, ["reverse", `tcp:${TEST_EVENT_WS_PORT}`, `tcp:${TEST_EVENT_WS_PORT}`]);
      await adb(this.deviceId, ["shell", "setprop", "debug.nesy.ws_enabled", "1"]);
      await adb(this.deviceId, ["shell", "setprop", "debug.nesy.ws_port", String(TEST_EVENT_WS_PORT)]);
      console.log(`[DeviceWorker:${this.deviceId}] adb reverse tcp:${TEST_EVENT_WS_PORT} + WS sysprops set`);
    } catch (err) {
      console.warn(
        `[DeviceWorker:${this.deviceId}] adb reverse/WS setup failed (logcat fallback stays active):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.disposed) return;
    this.processing = true;

    try {
      while (this.queue.length > 0 && !this.disposed) {
        const next = this.queue.shift();
        if (!next) break;

        // The run may have been cancelled (or deleted) while queued.
        const current = await prisma.workflowRun.findUnique({
          where: { id: next.runId },
          select: { status: true },
        });
        if (!current || current.status === "cancelled") {
          console.log(`[DeviceWorker:${this.deviceId}] skipping run ${next.runId} (${current?.status ?? "deleted"})`);
          continue;
        }

        await this.prepare();
        // Restart the persistent logcat stream if the previous one died
        // (device reconnect, adb server restart). start() is a no-op when alive.
        this.sniffer.start();

        this.activeRunId = next.runId;
        try {
          await WorkflowRunner.execute(next.runId, {
            sniffer: this.sniffer,
            wsEventsEnabled: TestEventWsServer.isRunning(),
          });
        } catch (err) {
          console.error(`[DeviceWorker:${this.deviceId}] run ${next.runId} failed:`, err);
        } finally {
          this.activeRunId = null;
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry + dispatch
// ─────────────────────────────────────────────────────────────────────────────

const workers = new Map<string, DeviceWorker>();

export const DeviceWorkerRegistry = {
  getOrCreate(deviceId: string): DeviceWorker {
    let worker = workers.get(deviceId);
    if (!worker) {
      worker = new DeviceWorker(deviceId);
      workers.set(deviceId, worker);
      console.log(`[DeviceWorkerRegistry] created worker for device ${deviceId}`);
    }
    return worker;
  },

  get(deviceId: string): DeviceWorker | undefined {
    return workers.get(deviceId);
  },

  list(): ReturnType<DeviceWorker["getStatus"]>[] {
    return Array.from(workers.values()).map((w) => w.getStatus());
  },

  dispose(deviceId: string): void {
    const worker = workers.get(deviceId);
    if (worker) {
      worker.dispose();
      workers.delete(deviceId);
    }
  },
};

/**
 * Entry point used by the HTTP routes: routes every run with a known device
 * through that device's sequential queue. Runs without a device fall back to
 * immediate execution.
 */
export function dispatchRun(runId: string, deviceId: string | null | undefined): { queuePosition: number } {
  if (!deviceId) {
    WorkflowRunner.execute(runId).catch((err: unknown) => {
      console.error(`[WorkflowRunner] Run ${runId} failed:`, err);
    });
    return { queuePosition: 0 };
  }

  const worker = DeviceWorkerRegistry.getOrCreate(deviceId);
  return { queuePosition: worker.enqueue(runId) };
}

/**
 * Cancel hook for queued runs: removes the run from its device queue when it
 * has not started yet. Returns true when the run was dequeued (no process to kill).
 */
export function removeRunFromQueues(runId: string): boolean {
  for (const worker of workers.values()) {
    if (worker.removeFromQueue(runId)) return true;
  }
  return false;
}
