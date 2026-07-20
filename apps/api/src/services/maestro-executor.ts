/**
 * Maestro Executor
 *
 * Spawns `maestro test <yaml>` and parses stdout line-by-line
 * using Node.js readline for reliable step tracking.
 */

import { spawn, execSync } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { EventEmitter } from "node:events";

export interface StepEvent {
  type: "start" | "done" | "fail";
  nodeId: string;
  nodeType: string;
  message?: string;
  timestamp: number;
  warnings?: number;
}

export interface MaestroResult {
  exitCode: number | null;
  signal: string | null;
  output: string;
  duration: number;
}

/** Server-side backend verification request emitted by the NESY_BACKEND_CHECK marker. */
export interface BackendCheckEvent {
  nodeId: string;
  shipmentRef: string;
  /** Expected event short codes / numeric codes (any one match passes). */
  codes: string[];
  /** Delay before the first backend poll, in ms. */
  delayMs: number;
}

export function formatMaestroFailure(result: MaestroResult): string {
  const summary = `Maestro exited with code ${result.exitCode}`;
  const detail = result.output.trim();
  return detail ? `${summary}\n${detail}` : summary;
}

export interface MaestroSpawnSpec {
  command: string;
  args: string[];
  windowsHide: boolean;
}

export function resolveMaestroSpawn(
  args: string[],
  overrides: {
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
  } = {},
): MaestroSpawnSpec {
  const currentPlatform = overrides.platform ?? process.platform;
  const env = overrides.env ?? process.env;
  const maestroPath =
    env.MAESTRO_PATH?.trim() ||
    (currentPlatform === "win32" ? "maestro.bat" : "maestro");

  if (currentPlatform === "win32") {
    const unsafeArgumentIndex = args.findIndex((arg) =>
      /[\r\n"&|<>()^%!]/.test(arg),
    );
    if (unsafeArgumentIndex !== -1) {
      throw new Error(
        `Unsafe character in Maestro argument at index ${unsafeArgumentIndex}`,
      );
    }

    return {
      command: env.ComSpec?.trim() || "cmd.exe",
      args: ["/d", "/s", "/c", maestroPath, ...args],
      windowsHide: true,
    };
  }

  return {
    command: maestroPath,
    args,
    windowsHide: false,
  };
}

const STEP_START_PATTERN = /NESY_STEP::START::(?<nodeId>[^:]+)::(?<nodeType>[^'")\s]+)/;
const STEP_DONE_PATTERN = /NESY_STEP::DONE::(?<nodeId>[^:]+)::(?<nodeType>[^'")\s]+)/;
const STEP_FAIL_PATTERN = /NESY_STEP::FAIL::(?<nodeId>[^:]+)::(?<message>.+)/;
const BACKEND_CHECK_PATTERN =
  /NESY_BACKEND_CHECK::(?<nodeId>[^:]+)::(?<shipmentRef>[^:]*)::(?<codes>[^:]*)::(?<delayMs>\d+)/;

export class MaestroExecutor extends EventEmitter {
  private yamlPath: string;
  private deviceId?: string;
  private debugOutputDir?: string;
  private process: ReturnType<typeof spawn> | null = null;
  private outputLines: string[] = [];
  private startTime = 0;

  constructor(options: {
    yamlPath: string;
    deviceId?: string;
    debugOutputDir?: string;
  }) {
    super();
    this.yamlPath = options.yamlPath;
    this.deviceId = options.deviceId;
    this.debugOutputDir = options.debugOutputDir;
  }

  getProcess() {
    return this.process;
  }

  async execute(): Promise<MaestroResult> {
    this.startTime = Date.now();

    const args: string[] = ["test", this.yamlPath];

    if (this.deviceId) {
      args.unshift("--device", this.deviceId);
    }

    if (this.debugOutputDir) {
      args.push("--debug-output", this.debugOutputDir);
    }

    return new Promise<MaestroResult>((resolve) => {
      const spawnSpec = resolveMaestroSpawn(args);

      this.process = spawn(spawnSpec.command, spawnSpec.args, {
        cwd: path.dirname(this.yamlPath),
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: spawnSpec.windowsHide,
      });

      this.emit("spawned", this.process);

      const rl = createInterface({ input: this.process.stdout! });
      const rlErr = createInterface({ input: this.process.stderr! });

      rl.on("line", (line: string) => {
        this.outputLines.push(line);
        this.parseLine(line);
      });

      rlErr.on("line", (line: string) => {
        this.outputLines.push(`[stderr] ${line}`);
        this.parseLine(line);
      });

      this.process.on("close", (code, signal) => {
        rl.close();
        rlErr.close();

        const result: MaestroResult = {
          exitCode: code,
          signal: signal?.toString() ?? null,
          output: this.outputLines.join("\n"),
          duration: Date.now() - this.startTime,
        };

        this.emit("complete", result);
        resolve(result);
      });

      this.process.on("error", (err) => {
        const result: MaestroResult = {
          exitCode: -1,
          signal: null,
          output: `Process error: ${err.message}\n${this.outputLines.join("\n")}`,
          duration: Date.now() - this.startTime,
        };

        this.emit("error", err);
        this.emit("complete", result);
        resolve(result);
      });
    });
  }

  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGKILL");
    }
    this.cleanupDevice();
  }

  private cleanupDevice(): void {
    const deviceArgs = this.deviceId ? ["-s", this.deviceId] : [];
    const packages = ["dev.mobile.maestro", "dev.mobile.maestro.test"];

    for (const pkg of packages) {
      try {
        execSync(
          `adb ${deviceArgs.join(" ")} shell am force-stop ${pkg}`,
          { timeout: 5000, stdio: "ignore" },
        );
      } catch {
        // adb not available or device disconnected
      }
    }
  }

  private activeStepWarnings = 0;

  private parseLine(line: string): void {
    const startMatch = line.match(STEP_START_PATTERN);
    if (startMatch?.groups?.nodeId && startMatch.groups.nodeType) {
      this.activeStepWarnings = 0;
      const event: StepEvent = {
        type: "start",
        nodeId: startMatch.groups.nodeId,
        nodeType: startMatch.groups.nodeType,
        timestamp: Date.now(),
      };
      this.emit("step", event);
      return;
    }

    const doneMatch = line.match(STEP_DONE_PATTERN);
    if (doneMatch?.groups?.nodeId && doneMatch.groups.nodeType) {
      const event: StepEvent = {
        type: "done",
        nodeId: doneMatch.groups.nodeId,
        nodeType: doneMatch.groups.nodeType,
        timestamp: Date.now(),
        warnings: this.activeStepWarnings,
      };
      this.activeStepWarnings = 0;
      this.emit("step", event);
      return;
    }

    const backendMatch = line.match(BACKEND_CHECK_PATTERN);
    if (backendMatch?.groups?.nodeId) {
      const codes = (backendMatch.groups.codes ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const event: BackendCheckEvent = {
        nodeId: backendMatch.groups.nodeId,
        shipmentRef: (backendMatch.groups.shipmentRef ?? "").trim(),
        codes,
        delayMs: Number(backendMatch.groups.delayMs ?? "5000"),
      };
      this.emit("backendCheck", event);
      return;
    }

    const failMatch = line.match(STEP_FAIL_PATTERN);
    if (failMatch?.groups?.nodeId) {
      const event: StepEvent = {
        type: "fail",
        nodeId: failMatch.groups.nodeId,
        nodeType: "",
        message: failMatch.groups.message,
        timestamp: Date.now(),
      };
      this.activeStepWarnings = 0;
      this.emit("step", event);
      return;
    }

    if (line.includes(" WARN ") || line.includes(" WARNED ")) {
      this.activeStepWarnings++;
    }

    this.emit("output", line);
  }
}
