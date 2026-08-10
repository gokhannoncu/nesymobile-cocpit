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
      metadata: this.metadata,
    };
  }

  async acquireBridge(runId: string, sessionId: string, runEpoch: number): Promise<BridgeDeviceManager> {
    await this.prepare();
    if (this.bridge) return this.bridge;

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

    try {
      await adb(this.deviceId, ["reverse", `tcp:${TEST_EVENT_WS_PORT}`, `tcp:${TEST_EVENT_WS_PORT}`]);
      await adb(this.deviceId, ["shell", "setprop", "debug.nesy.ws_enabled", "1"]);
      await adb(this.deviceId, ["shell", "setprop", "debug.nesy.ws_port", String(TEST_EVENT_WS_PORT)]);
      this.sniffer.start();
      console.log(`[DeviceWorker:${this.deviceId}] adb reverse tcp:${TEST_EVENT_WS_PORT} + WS sysprops set`);
    } catch (err) {
      console.warn(
        `[DeviceWorker:${this.deviceId}] adb reverse/WS setup failed:`,
        err instanceof Error ? err.message : err,
      );
    }
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
