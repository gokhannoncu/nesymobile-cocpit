import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AdbDiagnostics,
  parseDfAvailableBytes,
  type DiagnosticCommandRunner,
} from "./AdbDiagnostics.js";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "verdict-diagnostics-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("AdbDiagnostics", () => {
  it("captures D1 meminfo using the OS command and writes a local artefact", async () => {
    const commands: string[][] = [];
    const runner: DiagnosticCommandRunner = async (_command, args) => {
      commands.push(args);
      return { stdout: "Applications Memory Usage\nTOTAL PSS: 42", stderr: "" };
    };
    const diagnostics = new AdbDiagnostics({
      artifactsRoot: await temporaryRoot(),
      adbPath: "/fake/adb",
      runner,
    });

    const result = await diagnostics.captureMeminfo({
      serial: "emulator-5554",
      captureId: "cap-1",
      pid: 321,
    });

    expect(commands).toEqual([
      ["-s", "emulator-5554", "shell", "dumpsys", "meminfo", "321"],
    ]);
    expect(await fs.readFile(result.artifactPath, "utf8")).toContain("TOTAL PSS: 42");
  });

  it("always removes the remote Perfetto file when pull fails", async () => {
    const commands: string[][] = [];
    const runner: DiagnosticCommandRunner = async (_command, args) => {
      commands.push(args);
      if (args[2] === "pull") throw new Error("device disconnected");
      return { stdout: "", stderr: "" };
    };
    const diagnostics = new AdbDiagnostics({
      artifactsRoot: await temporaryRoot(),
      adbPath: "/fake/adb",
      runner,
    });

    await expect(
      diagnostics.capturePerfetto({
        serial: "emulator-5554",
        captureId: "cap-perfetto",
      }),
    ).rejects.toThrow("device disconnected");

    expect(commands[0]).toEqual([
      "-s",
      "emulator-5554",
      "shell",
      "perfetto",
      "-o",
      "/data/misc/perfetto-traces/verdict-cap-perfetto.perfetto-trace",
      "-t",
      "8s",
      "-b",
      "16mb",
      "mem",
      "sched",
    ]);
    expect(commands.at(-1)).toEqual([
      "-s",
      "emulator-5554",
      "shell",
      "rm",
      "-f",
      "/data/misc/perfetto-traces/verdict-cap-perfetto.perfetto-trace",
    ]);
  });

  it("stages heap dumps only in /data/local/tmp and cleans after pull", async () => {
    const commands: string[][] = [];
    const runner: DiagnosticCommandRunner = async (_command, args) => {
      commands.push(args);
      return { stdout: "", stderr: "" };
    };
    const diagnostics = new AdbDiagnostics({
      artifactsRoot: await temporaryRoot(),
      adbPath: "/fake/adb",
      runner,
    });

    await diagnostics.captureHeapDump({
      serial: "R5CT-device",
      captureId: "cap-heap",
      packageName: "com.arasdigital.nesymobile.automation",
    });

    expect(commands[0]).toEqual([
      "-s",
      "R5CT-device",
      "shell",
      "am",
      "dumpheap",
      "com.arasdigital.nesymobile.automation",
      "/data/local/tmp/verdict-cap-heap.hprof",
    ]);
    expect(commands[1]?.slice(0, 4)).toEqual([
      "-s",
      "R5CT-device",
      "pull",
      "/data/local/tmp/verdict-cap-heap.hprof",
    ]);
    expect(commands[2]).toEqual([
      "-s",
      "R5CT-device",
      "shell",
      "rm",
      "-f",
      "/data/local/tmp/verdict-cap-heap.hprof",
    ]);
  });
});

describe("parseDfAvailableBytes", () => {
  it("parses Android toybox df output as bytes", () => {
    const output = [
      "Filesystem     1K-blocks    Used Available Use% Mounted on",
      "/dev/block/dm-8  58472784 7392160  51080624  13% /data",
    ].join("\n");

    expect(parseDfAvailableBytes(output)).toBe(51_080_624 * 1024);
  });

  it("rejects an unrecognised df response instead of assuming free space", () => {
    expect(() => parseDfAvailableBytes("Filesystem unavailable")).toThrow(
      "Unable to parse",
    );
  });
});
