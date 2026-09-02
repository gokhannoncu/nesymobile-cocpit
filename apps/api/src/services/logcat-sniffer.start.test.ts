/**
 * Regression tests for the three defects that silently disabled telemetry.
 *
 * On 2026-09-02 twelve hours of runs completed with EMPTY event records: the
 * device was emitting `NESY_TEST_EVENT` lines the whole time, the sniffer was
 * not running, and every continue gate timed out citing a fact that had in fact
 * been produced. Nothing in a run record said the stream was down.
 *
 * Each test below pins one of the three reasons that was possible.
 */
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());
const resolveAdbPathMock = vi.hoisted(() => vi.fn());

// Only `spawn` is replaced; the rest of the module stays real, because other
// modules pulled in by this import graph use `execFile`.
vi.mock("node:child_process", async () => ({
  ...(await vi.importActual<typeof import("node:child_process")>("node:child_process")),
  spawn: spawnMock,
}));
vi.mock("@nesy/platform-paths", () => ({
  resolveAdbPath: resolveAdbPathMock,
  getAdbPathHint: () => "install platform-tools",
}));

const { LogcatSniffer } = await import("./logcat-sniffer.js");

/** A spawned process stand-in: pipes readline can consume, plus event wiring. */
function fakeProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter & { setEncoding?: () => void };
    stderr: EventEmitter;
    killed: boolean;
    kill: (signal?: string) => void;
  };
  const stdout = new EventEmitter() as EventEmitter & { setEncoding?: () => void };
  // readline calls these; an EventEmitter alone is enough for `line` wiring.
  Object.assign(stdout, { setEncoding: () => {}, resume: () => {}, pause: () => {}, readable: true });
  proc.stdout = stdout;
  proc.stderr = new EventEmitter();
  proc.killed = false;
  proc.kill = () => {
    proc.killed = true;
  };
  return proc;
}

describe("LogcatSniffer.start", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    resolveAdbPathMock.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves adb through the project resolver, not bare PATH", () => {
    // The original spawned "adb" from PATH while `DeviceWorker` in the same
    // process resolved an absolute path. Launched from an IDE or a pnpm script,
    // PATH has no platform-tools: the sniffer died with ENOENT and every other
    // adb call in the process kept working, so nothing looked broken.
    resolveAdbPathMock.mockReturnValue("/opt/android/platform-tools/adb");
    spawnMock.mockReturnValue(fakeProcess());

    const sniffer = new LogcatSniffer({ deviceId: "device-1" });
    expect(sniffer.start()).toBe(true);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [binary, args] = spawnMock.mock.calls[0]!;
    expect(binary).toBe("/opt/android/platform-tools/adb");
    expect(args).toEqual([
      "-s",
      "device-1",
      "logcat",
      "-T",
      "1",
      "-s",
      "NESY_AUTO_BRIDGE:D",
      "NESY_TEST_EVENT:I",
      "-v",
      "time",
    ]);
    expect(sniffer.isRunning()).toBe(true);
    expect(sniffer.lastError()).toBeNull();
  });

  it("reports a missing adb instead of disabling itself quietly", () => {
    resolveAdbPathMock.mockReturnValue(null);

    const sniffer = new LogcatSniffer({ deviceId: "device-1" });

    expect(sniffer.start()).toBe(false);
    expect(sniffer.isRunning()).toBe(false);
    expect(sniffer.lastError()).toContain("adb binary not found");
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("reports a spawn failure with its reason", () => {
    resolveAdbPathMock.mockReturnValue("/opt/android/platform-tools/adb");
    spawnMock.mockImplementation(() => {
      throw new Error("EACCES");
    });

    const sniffer = new LogcatSniffer({ deviceId: "device-1" });

    expect(sniffer.start()).toBe(false);
    expect(sniffer.lastError()).toBe("EACCES");
  });

  it("can be started again after the stream closed", () => {
    // The close handler promised a restart "on next bridge prepare" and
    // `prepare()` returned early on a flag, so the restart was unreachable.
    // Whatever owns the lifecycle, `start()` itself must be re-enterable.
    resolveAdbPathMock.mockReturnValue("/opt/android/platform-tools/adb");
    const first = fakeProcess();
    const second = fakeProcess();
    spawnMock.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const sniffer = new LogcatSniffer({ deviceId: "device-1" });
    sniffer.start();
    expect(sniffer.isRunning()).toBe(true);

    first.emit("close", 0);
    expect(sniffer.isRunning()).toBe(false);

    expect(sniffer.start()).toBe(true);
    expect(sniffer.isRunning()).toBe(true);
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it("is idempotent while already running", () => {
    resolveAdbPathMock.mockReturnValue("/opt/android/platform-tools/adb");
    spawnMock.mockReturnValue(fakeProcess());

    const sniffer = new LogcatSniffer({ deviceId: "device-1" });
    sniffer.start();
    sniffer.start();

    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});
