/**
 * Android OS diagnostic wrappers for plan B.5.4.
 *
 * This executor intentionally does not implement ControlExecutor: meminfo,
 * Perfetto, and heap dumps are OS observations, not commands sent to the app's
 * control plane.
 */
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getAdbPathHint, resolveAdbPath } from "@nesy/platform-paths";

const execFileAsync = promisify(execFile);

const PERFETTO_TIMEOUT_MS = 20_000;
const HEAP_DUMP_TIMEOUT_MS = 120_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;
const MAX_COMMAND_OUTPUT_BYTES = 32 * 1024 * 1024;
const DEVICE_DIAGNOSTIC_ROOT = "/data/local/tmp";

export interface DiagnosticCommandResult {
  stdout: string;
  stderr: string;
}

export type DiagnosticCommandRunner = (
  command: string,
  args: string[],
  options: { timeoutMs: number; maxBufferBytes: number },
) => Promise<DiagnosticCommandResult>;

const runCommand: DiagnosticCommandRunner = async (command, args, options) => {
  const result = await execFileAsync(command, args, {
    timeout: options.timeoutMs,
    maxBuffer: options.maxBufferBytes,
    encoding: "utf8",
  });
  return {
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
  };
};

export interface AdbDiagnosticsOptions {
  /** Local root for capture artefacts; each capture gets its own directory. */
  artifactsRoot: string;
  adbPath?: string;
  runner?: DiagnosticCommandRunner;
}

export interface CaptureTarget {
  serial: string;
  captureId: string;
}

export interface MeminfoTarget extends CaptureTarget {
  pid: number;
}

export interface PerfettoTarget extends CaptureTarget {
  durationSeconds?: number;
  bufferMb?: number;
}

export interface HeapDumpTarget extends CaptureTarget {
  packageName: string;
}

export class AdbDiagnostics {
  private readonly artifactsRoot: string;
  private readonly adbPath: string | null;
  private readonly runner: DiagnosticCommandRunner;

  constructor(options: AdbDiagnosticsOptions) {
    this.artifactsRoot = path.resolve(options.artifactsRoot);
    this.adbPath = options.adbPath?.trim() || resolveAdbPath();
    this.runner = options.runner ?? runCommand;
  }

  /**
   * D1: one binder-backed OS snapshot. dumpsys output carries no reliable
   * device timestamp, so CapturePolicyEngine brackets this call with existing
   * DIAGNOSTIC_MARKER events.
   */
  async captureMeminfo(target: MeminfoTarget): Promise<{ artifactPath: string }> {
    assertPid(target.pid);
    const directory = await this.captureDirectory(target.captureId);
    const artifactPath = path.join(directory, "meminfo.txt");
    const result = await this.adb(
      target.serial,
      ["shell", "dumpsys", "meminfo", String(target.pid)],
      DEFAULT_COMMAND_TIMEOUT_MS,
    );
    await fs.writeFile(artifactPath, result.stdout, "utf8");
    return { artifactPath };
  }

  /**
   * D2: fixed-duration, fixed-buffer Perfetto trace. The device-side file is
   * always removed, including command/pull failure.
   */
  async capturePerfetto(target: PerfettoTarget): Promise<{ artifactPath: string }> {
    const durationSeconds = boundedInteger(target.durationSeconds ?? 8, 1, 60, "durationSeconds");
    const bufferMb = boundedInteger(target.bufferMb ?? 16, 1, 128, "bufferMb");
    const safeCaptureId = assertSafeCaptureId(target.captureId);
    const directory = await this.captureDirectory(safeCaptureId);
    const artifactPath = path.join(directory, "trace.perfetto-trace");
    const remotePath = `${DEVICE_DIAGNOSTIC_ROOT}/verdict-${safeCaptureId}.perfetto-trace`;

    try {
      await this.adb(
        target.serial,
        [
          "shell",
          "perfetto",
          "-o",
          remotePath,
          "-t",
          `${durationSeconds}s`,
          "-b",
          `${bufferMb}mb`,
          "mem",
          "sched",
        ],
        Math.max(PERFETTO_TIMEOUT_MS, durationSeconds * 1_000 + 10_000),
      );
      await this.adb(target.serial, ["pull", remotePath, artifactPath], PERFETTO_TIMEOUT_MS);
      return { artifactPath };
    } finally {
      await this.removeRemoteBestEffort(target.serial, remotePath);
    }
  }

  /**
   * D3: heap dump into /data/local/tmp, immediate pull, unconditional cleanup.
   * The policy engine performs the >=3x free-space check before entering here.
   */
  async captureHeapDump(target: HeapDumpTarget): Promise<{ artifactPath: string }> {
    const packageName = assertPackageName(target.packageName);
    const safeCaptureId = assertSafeCaptureId(target.captureId);
    const directory = await this.captureDirectory(safeCaptureId);
    const artifactPath = path.join(directory, "heap.hprof");
    const remotePath = `${DEVICE_DIAGNOSTIC_ROOT}/verdict-${safeCaptureId}.hprof`;

    try {
      await this.adb(
        target.serial,
        ["shell", "am", "dumpheap", packageName, remotePath],
        HEAP_DUMP_TIMEOUT_MS,
      );
      await this.adb(target.serial, ["pull", remotePath, artifactPath], HEAP_DUMP_TIMEOUT_MS);
      return { artifactPath };
    } finally {
      await this.removeRemoteBestEffort(target.serial, remotePath);
    }
  }

  /** Available bytes on the same device partition used for D3 staging. */
  async deviceFreeBytes(serial: string): Promise<number> {
    const result = await this.adb(
      serial,
      ["shell", "df", "-k", DEVICE_DIAGNOSTIC_ROOT],
      DEFAULT_COMMAND_TIMEOUT_MS,
    );
    return parseDfAvailableBytes(result.stdout);
  }

  /**
   * Copies the exact build's R8 mapping into the capture directory.
   * automationRelease traces/dumps are not considered symbolication-ready
   * without this sidecar (plan B.5.5/Faz 7.2b).
   */
  async storeMappingFile(captureId: string, sourcePath: string): Promise<string> {
    const directory = await this.captureDirectory(captureId);
    const targetPath = path.join(directory, "mapping.txt");
    await fs.copyFile(path.resolve(sourcePath), targetPath);
    return targetPath;
  }

  private async captureDirectory(captureId: string): Promise<string> {
    const safeCaptureId = assertSafeCaptureId(captureId);
    const directory = path.join(this.artifactsRoot, safeCaptureId);
    await fs.mkdir(directory, { recursive: true });
    return directory;
  }

  private async adb(
    serial: string,
    args: string[],
    timeoutMs: number,
  ): Promise<DiagnosticCommandResult> {
    const adbPath = this.adbPath;
    if (!adbPath) {
      throw new Error(`adb binary not found. ${getAdbPathHint()}`);
    }
    const safeSerial = assertSerial(serial);
    return await this.runner(adbPath, ["-s", safeSerial, ...args], {
      timeoutMs,
      maxBufferBytes: MAX_COMMAND_OUTPUT_BYTES,
    });
  }

  private async removeRemoteBestEffort(serial: string, remotePath: string): Promise<void> {
    try {
      await this.adb(serial, ["shell", "rm", "-f", remotePath], DEFAULT_COMMAND_TIMEOUT_MS);
    } catch {
      // The primary capture/pull error owns the result. Cleanup is still always
      // attempted and a disconnected device cannot be cleaned synchronously.
    }
  }
}

export function parseDfAvailableBytes(output: string): number {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const columns = lines[index]!.split(/\s+/);
    const percentIndex = columns.findIndex((column) => /^\d+%$/.test(column));
    if (percentIndex < 2) continue;
    const availableKib = Number(columns[percentIndex - 1]);
    if (Number.isSafeInteger(availableKib) && availableKib >= 0) {
      return availableKib * 1024;
    }
  }

  throw new Error("Unable to parse available bytes from adb shell df output");
}

function assertSerial(serial: string): string {
  const value = serial.trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new Error("Invalid ADB serial");
  }
  return value;
}

function assertSafeCaptureId(captureId: string): string {
  const value = captureId.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error("Invalid diagnostic captureId");
  }
  return value;
}

function assertPackageName(packageName: string): string {
  const value = packageName.trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value)) {
    throw new Error("Invalid Android package name");
  }
  return value;
}

function assertPid(pid: number): void {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error("Invalid Android pid");
  }
}

function boundedInteger(value: number, min: number, max: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer in ${min}..${max}`);
  }
  return value;
}
