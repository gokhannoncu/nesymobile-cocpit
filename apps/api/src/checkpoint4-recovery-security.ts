/**
 * CHECKPOINT 4 local-only recovery/redaction probe. Do not commit.
 *
 * The secret/PIN sent to the fixed device are scanned in-memory against logcat
 * and the on-device Verdict WAL, then zeroed. Neither value is printed.
 */
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import {
  VerdictChannel,
  type AdbRunner,
} from "@nesy/control-channels";
import { createNodeAdbRunner } from "@nesy/control-channels/node";
import { asSecret } from "@nesy/control-contract";

const execFileAsync = promisify(execFile);
const adbPath =
  process.env.NESY_MOBILE_ADB_PATH ??
  "/Users/gokhanoncu/Library/Android/sdk/platform-tools/adb";
const serial = "R6CW400BC8N";
const applicationId = "com.arasdigital.nesymobile.rstest";
const runId = `checkpoint4-recovery-${Date.now()}`;
const secretBytes = randomBytes(32);
const secretText = secretBytes.toString("base64url");
const secret = asSecret(secretText);
const pinBytes = Buffer.from(`checkpoint4-pin-${randomBytes(12).toString("hex")}`);
const pinText = pinBytes.toString("utf8");

const adb: AdbRunner = createNodeAdbRunner({
  defaultTimeoutMs: 15_000,
  maxBufferBytes: 16 * 1024 * 1024,
});

async function adbText(args: string[], timeoutMs = 15_000): Promise<string> {
  return adb(serial, ["-s", serial, ...args], timeoutMs);
}

async function adbTextAllowFailure(
  args: string[],
  timeoutMs = 15_000,
): Promise<string> {
  try {
    return await adbText(args, timeoutMs);
  } catch (error) {
    const output = error as { stdout?: string; stderr?: string };
    return `${output.stdout ?? ""}${output.stderr ?? ""}`;
  }
}

async function adbBytes(args: string[], timeoutMs = 15_000): Promise<Buffer> {
  const { stdout } = await execFileAsync(adbPath, ["-s", serial, ...args], {
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    encoding: "buffer",
  });
  return stdout;
}

function check(name: string, value: unknown): void {
  console.log(`CHECK|${name}|${JSON.stringify(value)}`);
}

function safeControlResult(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const result = value as Record<string, unknown>;
  return {
    ok: result.ok,
    ...(result.ok === true ? { data: result.data } : { code: result.code, detail: result.detail }),
  };
}

await adbText(["logcat", "-c"]);
await adbText(["shell", "am", "force-stop", applicationId]);
const pidBefore = (
  await adbTextAllowFailure(["shell", "pidof", applicationId])
).trim();
check("force_stop_pid_before_set_run", pidBefore || null);

const ctx = { applicationId, adb };
const channel = new VerdictChannel();
const setRun = await channel.run(serial, {
  op: "set_run",
  requestId: "recovery-set-run",
  scope: runId,
  runId,
  secret,
  wsEnabled: true,
  wsPort: 8765,
  skipDeliveryWait: false,
  wakeStopped: true,
}, ctx);
check("recovery_set_run", safeControlResult(setRun));

const pidAfter = (await adbText(["shell", "pidof", applicationId])).trim();
check("force_stop_pid_after_set_run", pidAfter || null);
const packageState = await adbText(["shell", "dumpsys", "package", applicationId]);
const userState = packageState
  .split("\n")
  .find((line) => line.includes("User 0:"))
  ?.trim();
check("package_user_state_after_set_run", userState ?? null);

const login = await channel.run(serial, {
  op: "seed",
  requestId: "login-redaction-probe",
  scope: runId,
  verb: "login",
  params: {
    username: "checkpoint4-probe",
    pin: pinText,
  },
  wakeStopped: true,
}, ctx);
check("pin_probe_result", safeControlResult(login));

await new Promise((resolve) => setTimeout(resolve, 1_500));
const logcat = await adbBytes(["logcat", "-d", "-v", "threadtime"]);
const verdictFiles = (
  await adbText([
    "shell",
    `run-as ${applicationId} sh -c 'find no_backup/verdict/wal -maxdepth 1 -type f -print'`,
  ])
)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const walChunks: Buffer[] = [];
for (const file of verdictFiles) {
  walChunks.push(
    await adbBytes(["exec-out", "run-as", applicationId, "cat", file]),
  );
}
const wal = Buffer.concat(walChunks);
check("sensitive_scan", {
  logcatBytes: logcat.length,
  walBytes: wal.length,
  walFiles: verdictFiles.length,
  secretInLogcat: logcat.includes(secretText),
  secretInWal: wal.includes(secretText),
  pinInLogcat: logcat.includes(pinText),
  pinInWal: wal.includes(pinText),
});

const text = logcat.toString("utf8");
check("normal_command_anr_scan", {
  anr: /ANR in com\.arasdigital\.nesymobile\.rstest/i.test(text),
  fatal: /FATAL EXCEPTION[\s\S]{0,3000}com\.arasdigital\.nesymobile\.rstest/i.test(text),
  resultTimeout: /RESULT_TIMEOUT/i.test(text),
});
const sidecars = (
  await adbText([
    "shell",
    `run-as ${applicationId} sh -c 'find no_backup/verdict/control -type f 2>/dev/null | wc -l'`,
  ])
).trim();
check("sensitive_sidecars_remaining", sidecars);

secretBytes.fill(0);
pinBytes.fill(0);
process.exit(0);
