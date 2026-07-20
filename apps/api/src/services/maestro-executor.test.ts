import assert from "node:assert/strict";
import { test } from "vitest";
import {
  formatMaestroFailure,
  resolveMaestroSpawn,
} from "./maestro-executor.js";

const maestroArgs = ["--device", "R6CW400BC8N", "test", "C:\\Temp\\flow.yaml"];

test("runs Maestro through cmd.exe on Windows", () => {
  const resolved = resolveMaestroSpawn(maestroArgs, {
    platform: "win32",
    env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
  });

  assert.deepEqual(resolved, {
    command: "C:\\Windows\\System32\\cmd.exe",
    args: ["/d", "/s", "/c", "maestro.bat", ...maestroArgs],
    windowsHide: true,
  });
});

test("honors MAESTRO_PATH through cmd.exe on Windows", () => {
  const resolved = resolveMaestroSpawn(maestroArgs, {
    platform: "win32",
    env: {
      ComSpec: "cmd.exe",
      MAESTRO_PATH: "C:\\maestro\\maestro\\bin\\maestro.bat",
    },
  });

  assert.deepEqual(resolved, {
    command: "cmd.exe",
    args: [
      "/d",
      "/s",
      "/c",
      "C:\\maestro\\maestro\\bin\\maestro.bat",
      ...maestroArgs,
    ],
    windowsHide: true,
  });
});

test("spawns Maestro directly on macOS and Linux", () => {
  for (const platform of ["darwin", "linux"] as const) {
    const resolved = resolveMaestroSpawn(maestroArgs, {
      platform,
      env: {},
    });

    assert.deepEqual(resolved, {
      command: "maestro",
      args: maestroArgs,
      windowsHide: false,
    });
  }
});

test("includes the process error output in Maestro failure messages", () => {
  const message = formatMaestroFailure({
    exitCode: -1,
    signal: null,
    output: "Process error: spawn maestro ENOENT",
    duration: 12,
  });

  assert.equal(
    message,
    "Maestro exited with code -1\nProcess error: spawn maestro ENOENT",
  );
});

test("rejects command-shell metacharacters in Windows Maestro arguments", () => {
  assert.throws(
    () =>
      resolveMaestroSpawn(["--device", "serial&whoami"], {
        platform: "win32",
        env: {},
      }),
    /Unsafe character in Maestro argument/,
  );
});
