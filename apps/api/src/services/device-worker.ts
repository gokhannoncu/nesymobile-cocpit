/**
 * Device Worker — persistent per-device Bridge context.
 *
 * Phase 8 removes the legacy execution queue from this file. Workflow execution
 * now enters through Verdict runtime + BridgeFlowExecutionQueue; this registry
 * only owns device metadata, the SDK event reverse, and typed Bridge access.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { getAdbPathHint, resolveAdbPath } from "@nesy/platform-paths";
import { LogcatSniffer } from "./logcat-sniffer.js";
import { TestEventWsServer, TEST_EVENT_WS_PORT } from "./test-event-ws-server.js";
import { BridgeDeviceManager, BridgeUnavailableError } from "./bridge-device-manager.js";
import { createAdbFacade, resolveDeviceGatePolicy } from "./bridge-adb-facade.js";
import { BridgeDeviceGate } from "./bridge-device-gate.js";
import { disposeAdmissionScheduler } from "./bridge-admission.js";

const execFileAsync = promisify(execFile);

export { TEST_EVENT_WS_PORT };

export interface DeviceMetadata {
  model: string;
  androidVersion: string;
  sdkLevel: string;
  fetchedAt: number;
}

function adbBinary(): string {
  const resolved = resolveAdbPath();
  if (resolved === null) {
    throw new Error(`adb binary not found. ${getAdbPathHint()}`);
  }
  return resolved;
}

async function adb(deviceId: string, args: string[], timeoutMs = 8000): Promise<string> {
  const result = await execFileAsync(adbBinary(), ["-s", deviceId, ...args], {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });
  return String(result.stdout).trim();
}

export class DeviceWorker {
  readonly deviceId: string;
  readonly startedAt = Date.now();

  private readonly sniffer: LogcatSniffer;
  private activeRunId: string | null = null;
  private prepared = false;
  private metadata: DeviceMetadata | null = null;
  private bridge: BridgeDeviceManager | null = null;
  private bridgeFailure: BridgeUnavailableError | null = null;

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
      console.warn(`[DeviceWorker:${deviceId}] logcat stream closed — will restart on next bridge prepare`);
    });
  }

  getStatus() {
    return {
      deviceId: this.deviceId,
      startedAt: this.startedAt,
      activeRunId: this.activeRunId,
      queuedRunIds: [],
      queueLength: 0,
      logcatRunning: this.sniffer.isRunning(),
      logcatError: this.sniffer.lastError(),
      metadata: this.metadata,
    };
  }

  async acquireBridge(runId: string, sessionId: string, runEpoch: number): Promise<BridgeDeviceManager> {
    await this.prepare();
    // Evidence first: a run whose telemetry stream is down cannot satisfy a
    // single oracle, and its only symptom used to be every continue gate timing
    // out with nothing in the run record explaining why. Twelve hours of runs
    // were lost to exactly that, so this is now a refusal rather than a warning.
    this.ensureSnifferRunning();
    // The sniffer is persistent per device while runs are sequential. Its
    // structured-event filter therefore has to move with the active run; otherwise
    // the first run after process start works and later runs drop perfectly valid
    // NESY_TEST_EVENT frames as "different run".
    this.sniffer.setRunId(runId);
    if (this.bridge) {
      // Reuse the connection, NOT the previous run's identity. The manager is
      // cached per device, so without this every run after the first drove the
      // device under run #1's fence.
      this.bridge.rebindScope({ runId, sessionId, runEpoch });
      await this.bridge.ensureReady();
      this.activeRunId = runId;
      this.bridge.getScheduler().setState({ activeRunId: runId });
      return this.bridge;
    }

    const manager = new BridgeDeviceManager({
      deviceId: this.deviceId,
      gate: new BridgeDeviceGate(createAdbFacade(), resolveDeviceGatePolicy()),
      scope: { runId, sessionId, runEpoch },
      artifactRoot: path.join(os.tmpdir(), "nesy-bridge-artifacts"),
      logger: (message) => console.log(message),
    });

    try {
      await manager.ensureReady();
    } catch (err) {
      if (err instanceof BridgeUnavailableError) {
        this.bridgeFailure = err;
        console.error(
          `[DeviceWorker:${this.deviceId}] bridge preflight FAILED (${err.failure.check}): ` +
            `${err.failure.detail} — ${err.failure.remediation}`,
        );
      }
      await manager.dispose("preflight failed");
      throw err;
    }

    this.activeRunId = runId;
    manager.getScheduler().setState({ activeRunId: runId });
    this.bridge = manager;
    return manager;
  }

  getBridgeFailure(): BridgeUnavailableError | null {
    return this.bridgeFailure;
  }

  getBridge(): BridgeDeviceManager | null {
    return this.bridge;
  }

  dispose(): void {
    TestEventWsServer.removeSink(this.sniffer);
    this.sniffer.setRunId(undefined);
    this.sniffer.stop();
    const bridge = this.bridge;
    this.bridge = null;
    this.activeRunId = null;
    if (bridge) {
      void bridge.dispose("device worker disposed").catch((err: unknown) => {
        console.warn(
          `[DeviceWorker:${this.deviceId}] bridge dispose failed (leaked adb forward?):`,
          err instanceof Error ? err.message : err,
        );
      });
    }
    disposeAdmissionScheduler(this.deviceId);
  }

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
      this.prepared = false;
      console.warn(
        `[DeviceWorker:${this.deviceId}] metadata fetch failed:`,
        err instanceof Error ? err.message : err,
      );
    }

    TestEventWsServer.ensureStarted();
    TestEventWsServer.addSink(this.sniffer);

    // The WebSocket path is OPTIONAL and, measured, has never once carried an
    // event: all 17k stored events arrived over logcat. It used to share this
    // try block with `sniffer.start()`, placed last — so a failed `adb reverse`
    // or a rejected `setprop` silently took down the only channel that works.
    // Setting up an unused path must not be able to break the used one.
    try {
      await adb(this.deviceId, ["reverse", `tcp:${TEST_EVENT_WS_PORT}`, `tcp:${TEST_EVENT_WS_PORT}`]);
      await adb(this.deviceId, ["shell", "setprop", "debug.nesy.ws_enabled", "1"]);
      await adb(this.deviceId, ["shell", "setprop", "debug.nesy.ws_port", String(TEST_EVENT_WS_PORT)]);
      console.log(`[DeviceWorker:${this.deviceId}] adb reverse tcp:${TEST_EVENT_WS_PORT} + WS sysprops set`);
    } catch (err) {
      console.warn(
        `[DeviceWorker:${this.deviceId}] adb reverse/WS setup failed (logcat unaffected):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Starts the telemetry sniffer, or restarts it after the stream closed.
   *
   * Deliberately NOT inside [prepare]: that method returns early on
   * `this.prepared`, so the "will restart on next bridge prepare" promise in the
   * close handler was unreachable — once logcat closed (device unplugged, adb
   * server restarted, phone asleep) it stayed closed for the life of the
   * process, and every later run produced a run record with no events in it.
   *
   * @throws when the stream cannot be started, because a run without telemetry
   *   is a run that cannot reach a verdict.
   */
  private ensureSnifferRunning(): void {
    if (this.sniffer.isRunning()) return;

    console.log(`[DeviceWorker:${this.deviceId}] telemetry sniffer down — starting`);
    if (this.sniffer.start()) return;

    const detail = this.sniffer.lastError() ?? "unknown reason";
    throw new Error(
      `[DeviceWorker:${this.deviceId}] telemetry sniffer could not start: ${detail}. ` +
        `A run started now would record no SDK events and every oracle would ` +
        `time out with no stated cause.`,
    );
  }
}

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
    return Array.from(workers.values()).map((worker) => worker.getStatus());
  },

  dispose(deviceId: string): void {
    const worker = workers.get(deviceId);
    if (worker) {
      worker.dispose();
      workers.delete(deviceId);
    }
  },
};
