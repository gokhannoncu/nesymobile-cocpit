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
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@nesy/db";
import { LogcatSniffer } from "./logcat-sniffer.js";
import { WorkflowRunner } from "./workflow-runner.js";
import { resolveWorkflowAppId } from "./yaml-generator.js";
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

/** Candidate locations of the maestro CLI jar that embeds the Android driver APKs. */
function maestroClientJarCandidates(): string[] {
  const home = os.homedir();
  const fromEnv = process.env.MAESTRO_HOME
    ? [path.join(process.env.MAESTRO_HOME, "lib", "maestro-client.jar")]
    : [];
  return [
    ...fromEnv,
    "C:/maestro/maestro/lib/maestro-client.jar",
    path.join(home, ".maestro", "lib", "maestro-client.jar"),
    "/opt/maestro/lib/maestro-client.jar",
    "/usr/local/lib/maestro/lib/maestro-client.jar",
  ];
}

/**
 * Pre-installs the maestro Android driver (`dev.mobile.maestro` + `.test`) from the
 * SAME jar the CLI uses (guaranteeing a version match), so runs can pass
 * `--no-reinstall-driver` and skip the per-run driver install/uninstall (~2-4s).
 * Best-effort: any failure (jar not found, no `unzip`, adb error) returns false and
 * the caller falls back to Maestro managing the driver itself — never breaks a run.
 */
async function ensureMaestroDriverInstalled(deviceId: string): Promise<boolean> {
  const jar = maestroClientJarCandidates().find((p) => fs.existsSync(p));
  if (!jar) return false;

  const outDir = path.join(os.tmpdir(), "nesy-maestro-driver");
  try {
    fs.mkdirSync(outDir, { recursive: true });
    // Extract the two embedded APKs (jar is a zip). `unzip -o -j` flattens paths.
    await execFileAsync("unzip", ["-o", "-j", jar, "maestro-app.apk", "maestro-server.apk", "-d", outDir], {
      timeout: 30000,
    });
    const serverApk = path.join(outDir, "maestro-server.apk");
    const appApk = path.join(outDir, "maestro-app.apk");
    if (!fs.existsSync(serverApk) || !fs.existsSync(appApk)) return false;

    // -r replace, -t allow test packages, -d allow version downgrade (jar may be
    // older/newer than a leftover install).
    await adb(deviceId, ["install", "-r", "-t", "-d", serverApk], 60000);
    await adb(deviceId, ["install", "-r", "-t", "-d", appApk], 60000);
    return true;
  } catch {
    return false;
  }
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
  /** Per-appId guard: the Samsung compat dialog is dismissed once, not per run. */
  private readonly compatDismissedApps = new Set<string>();
  /** True once the maestro driver is pre-installed → runs pass --no-reinstall-driver. */
  private driverPreinstalled = false;

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

    // Pre-install the maestro driver once so runs can pass --no-reinstall-driver
    // (skips ~2-4s of per-run driver install/uninstall). Best-effort.
    this.driverPreinstalled = await ensureMaestroDriverInstalled(this.deviceId);
    console.log(
      `[DeviceWorker:${this.deviceId}] maestro driver pre-install: ${this.driverPreinstalled ? "ok (--no-reinstall-driver enabled)" : "skipped (driver managed per-run)"}`,
    );
  }

  /**
   * One-time-per-app dismissal of the Samsung system "app compatibility" warning
   * (debuggable build / 16KB page size). It only appears on the first launch after
   * install or data-clear, but when present it covers the app and silently sinks a
   * run (every probe WARNs, Maestro still exits 0). Formerly an inline Maestro guard
   * on every LAUNCH_APP (~6.9s/run of cold-start hierarchy fetch); moved here so it
   * costs nothing on the steady-state path. Best-effort: never throws, never blocks
   * the run. Launches the app to surface the dialog, then taps "Don't show again"
   * (permanent per-install suppression) so subsequent Maestro launches are clean.
   */
  private async dismissCompatDialogOnce(runId: string): Promise<void> {
    let appId: string;
    try {
      const run = await prisma.workflowRun.findUnique({ where: { id: runId }, include: { version: true } });
      const nodes = (run?.version?.nodes as unknown as Parameters<typeof resolveWorkflowAppId>[0]) ?? [];
      appId = resolveWorkflowAppId(nodes);
    } catch {
      return;
    }
    if (!appId || this.compatDismissedApps.has(appId)) return;
    this.compatDismissedApps.add(appId);

    try {
      await adb(this.deviceId, ["shell", "monkey", "-p", appId, "-c", "android.intent.category.LAUNCHER", "1"]);
      await new Promise((r) => setTimeout(r, 3500));
      const xml = await adb(this.deviceId, ["exec-out", "uiautomator", "dump", "/dev/tty"], 10000);
      if (!/Uyumlulu|compatib|Bir Daha Göster|Don.t show again/i.test(xml)) return; // no dialog — normal case

      const btn =
        xml.match(/text="(?:Bir Daha Göster[^"]*|Don.t show again)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) ??
        xml.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="(?:Bir Daha Göster[^"]*|Don.t show again)"/) ??
        xml.match(/resource-id="android:id\/button1"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (!btn) return;
      const x = Math.round((Number(btn[1]) + Number(btn[3])) / 2);
      const y = Math.round((Number(btn[2]) + Number(btn[4])) / 2);
      await adb(this.deviceId, ["shell", "input", "tap", String(x), String(y)]);
      console.log(`[DeviceWorker:${this.deviceId}] dismissed Samsung compat dialog for ${appId} (once)`);
    } catch (err) {
      console.warn(`[DeviceWorker:${this.deviceId}] compat-dialog dismiss (best-effort) failed:`, err instanceof Error ? err.message : err);
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
        // One-time-per-app Samsung compat-dialog dismissal (replaces the per-run
        // Maestro guard). Best-effort, runs before the first run of each app.
        await this.dismissCompatDialogOnce(next.runId);
        // Restart the persistent logcat stream if the previous one died
        // (device reconnect, adb server restart). start() is a no-op when alive.
        this.sniffer.start();

        this.activeRunId = next.runId;
        try {
          await WorkflowRunner.execute(next.runId, {
            sniffer: this.sniffer,
            wsEventsEnabled: TestEventWsServer.isRunning(),
            skipDriverReinstall: this.driverPreinstalled,
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
