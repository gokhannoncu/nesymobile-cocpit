import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { VerdictChannel, parseBroadcastPayload } from "@nesy/control-channels";
import { createNodeAdbRunner } from "@nesy/control-channels/node";
import { asSecret } from "@nesy/control-contract";
import { claimVerdictStreamOwner } from "./services/verdict-stream-owner.js";
import { RunSecretRegistry } from "./services/run-secret-registry.js";
import { TestEventWsServer } from "./services/test-event-ws-server.js";

const serial = process.env.VERDICT_DEVICE_SERIAL ?? "R6CW400BC8N";
const applicationId =
  process.env.VERDICT_APPLICATION_ID ?? "com.arasdigital.nesymobile.rstest";
const runId = `transport-cycle-${Date.now()}`;
const adbBinary =
  process.env.ADB_PATH ?? `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
const execFileAsync = promisify(execFile);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function adb(...args: string[]): Promise<string> {
  const result = await execFileAsync(adbBinary, ["-s", serial, ...args], {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  return result.stdout;
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(200);
  }
  return false;
}

function asHealthData(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const nested = record.data;
  const accepted =
    record.ok === true ||
    record.accepted === true ||
    record.type === "COMMAND_RESULT";
  if (accepted && nested && typeof nested === "object") {
    return nested as Record<string, unknown>;
  }
  if ("wsAuth" in record || "gapPublish" in record || "wal" in record) {
    return record;
  }
  return null;
}

function parseHealthPayload(raw: string): Record<string, unknown> | null {
  const broadcast = parseBroadcastPayload(raw);
  const candidates = [broadcast, ...raw.match(/\{[\s\S]*\}/g) ?? []].filter(
    (value): value is string => typeof value === "string" && value.includes("{"),
  );
  for (const candidate of candidates) {
    try {
      const health = asHealthData(JSON.parse(candidate));
      if (health) return health;
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function getHealth(attempt: number): Promise<Record<string, unknown> | null> {
  const nonce = randomBytes(16).toString("hex");
  const broadcastRaw = await adb(
    "shell",
    "am",
    "broadcast",
    "-n",
    `${applicationId}/com.verdict.sdk.core.VerdictControlReceiver`,
    "-a",
    `${applicationId}.VERDICT_CMD`,
    "--es",
    "op",
    "get_health",
    "--es",
    "cmd",
    "get_health",
    "--es",
    "requestId",
    `health-${runId}-${attempt}`,
    "--es",
    "scope",
    runId,
    "--es",
    "nonce",
    nonce,
  );
  const fromBroadcast = parseHealthPayload(broadcastRaw);
  if (fromBroadcast) return fromBroadcast;

  const dumpRaw = await adb(
    "shell",
    "dumpsys",
    "activity",
    "provider",
    `${applicationId}/com.verdict.sdk.core.VerdictDumpProvider`,
    "--verdict-command=get_health",
    `--request-id=health-${runId}-${attempt}`,
    `--scope=${runId}`,
    `--nonce=${nonce}`,
  );
  return parseHealthPayload(dumpRaw);
}

async function main(): Promise<void> {
  TestEventWsServer.ensureStarted();
  const ingestReady = await waitFor(() => TestEventWsServer.isIngestReady(), 5_000);
  if (!ingestReady) throw new Error("durable WS ingest did not become ready");

  const claimed = await claimVerdictStreamOwner({
    runId,
    deviceId: serial,
    appId: applicationId,
  });
  if (!claimed) throw new Error("run ownership claim failed");

  const secret = RunSecretRegistry.issue({
    runId,
    deviceId: serial,
    appId: applicationId,
  });

  await adb("reverse", "tcp:8765", "tcp:8765");
  await adb("shell", "am", "force-stop", applicationId);
  await adb("logcat", "-c");

  const channel = new VerdictChannel();
  const context = {
    applicationId,
    adb: createNodeAdbRunner(),
  };
  const setRun = await channel.run(serial, {
    op: "set_run",
    requestId: `set-${runId}`,
    scope: runId,
    runId,
    secret: asSecret(String(secret)),
    wsEnabled: true,
    wsPort: 8765,
    skipDeliveryWait: false,
    wakeStopped: true,
  }, context);
  if (!setRun.ok) throw new Error(`set_run failed: ${setRun.code} ${setRun.detail ?? ""}`);

  const authenticated = await waitFor(
    () => Number(TestEventWsServer.ingressDiagnostics().authenticated) >= 1,
    12_000,
  );

  let health: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await getHealth(attempt);
    if (result) health = result;
    const wsAuth = result?.wsAuth && typeof result.wsAuth === "object"
      ? result.wsAuth as Record<string, unknown>
      : null;
    const gapDrained =
      typeof result?.gapEntriesUsed === "number" && result.gapEntriesUsed === 0;
    if (wsAuth?.authenticated === true && gapDrained) break;
    await sleep(500);
  }

  await sleep(1_500);
  const ingress = TestEventWsServer.ingressDiagnostics();
  const logcat = await adb(
    "logcat",
    "-d",
    "-s",
    "NESY_TEST_EVENT:I",
    "OkHttp:D",
    "*:S",
  ).catch(() => "");

  const gapPublish = health?.gapPublish && typeof health.gapPublish === "object"
    ? health.gapPublish as Record<string, unknown>
    : null;
  console.log(JSON.stringify({
    runId,
    authenticated,
    setRunOk: setRun.ok,
    health: health
      ? {
          wal: health.wal,
          gapEntriesUsed: health.gapEntriesUsed,
          gapUsableEntries: health.gapUsableEntries,
          gapPublish,
          wsAuth: health.wsAuth,
        }
      : null,
    ingress,
    gapMismatch: {
      deviceFramesSent: gapPublish?.framesSent ?? null,
      hostGapFrames: ingress.gapFrames,
      hostGapStatusQueries: ingress.gapStatusQueries,
      hostUnrecognized: ingress.unrecognizedFrames,
      hostGapLikeParseMisses: ingress.gapLikeParseMisses,
      lastFrameTypes: ingress.lastFrameTypes,
      lastUnrecognizedPreview: ingress.lastUnrecognizedPreview,
      lastGapLikePreview: ingress.lastGapLikePreview,
    },
    relevantLogcat: logcat.split("\n").filter((line) =>
      /cleartext|websocket|auth|gap/i.test(line)
    ).slice(-30),
  }, null, 2));

  RunSecretRegistry.retire(runId);
  await adb("shell", "am", "force-stop", applicationId);
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error instanceof Error ? error.stack : error);
    await adb("shell", "am", "force-stop", applicationId).catch(() => undefined);
    process.exit(1);
  });
