/**
 * ===========================================================================
 *  WS SERVER end-to-end: real socket, real PostgreSQL  (plan Faz 0.2)
 *
 *  Proves the thing that unit tests cannot: a device frame arriving on an actual
 *  WebSocket gets durably accepted and acked, and the ACK carries the
 *  post-COMMIT watermark.
 *
 *  Requires `DATABASE_URL`; otherwise the suite fails before assertions. All
 *  rows are namespaced by a unique run id and deleted at the
 *  end, so it is safe against a shared database.
 * ===========================================================================
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { prisma } from "@nesy/db";
import { TEST_EVENT_WS_PORT, TestEventWsServer } from "./test-event-ws-server.js";
import type { LogcatSniffer } from "./logcat-sniffer.js";
import type { TestBridgeEvent } from "./test-event-bridge.js";
import { requireDatabaseUrlForIntegration } from "./db-integration-env.js";
import { RunSecretRegistry } from "./run-secret-registry.js";
import { ensureVerdictRunRow } from "./verdict-run-row.js";

requireDatabaseUrlForIntegration();

const RUN = `ws-it-${process.pid}-${process.hrtime.bigint().toString(36)}`;
const SESSION = "s1";

/** Minimal stand-in for the sniffer sink, to prove the synchronous path survives. */
const injected: TestBridgeEvent[] = [];
const fakeSniffer = {
  injectTestEvent: (e: TestBridgeEvent) => void injected.push(e),
} as unknown as LogcatSniffer;

const eventFrame = (seq: number) =>
  JSON.stringify({
    v: 1,
    runId: RUN,
    sessionId: SESSION,
    seq,
    ts: 1_789_000_000_000,
    monoTs: 100_000 + seq,
    screen: "FixtureScreen",
    event: "SCREEN_READY",
    taskId: "ws-task",
  });

/** Collects frames the SERVER sends back — today only ACKs. */
function collector(socket: WebSocket): { frames: Record<string, unknown>[] } {
  const frames: Record<string, unknown>[] = [];
  socket.on("message", (d) => {
    try {
      frames.push(JSON.parse(String(d)) as Record<string, unknown>);
    } catch {
      /* not JSON — ignore */
    }
  });
  return { frames };
}

const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  ms = 8_000,
): Promise<void> => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("timed out waiting for condition");
};

describe("WS server durable ingest", () => {
  let socket: WebSocket;
  let received: { frames: Record<string, unknown>[] };

  beforeAll(async () => {
    // Comparison mode is read per frame (see `compareModeEnabled`), so it can be
    // switched on here — the whole point of the sync-sink cutover gate is that
    // the equality it claims is measured on a REAL socket against a REAL
    // database, not on two in-memory arrays.
    process.env.VERDICT_COMPARE_MODE = "1";
    await prisma.$executeRaw`DELETE FROM verdict_inbox  WHERE run_id LIKE 'ws-it-%'`;
    await prisma.$executeRaw`DELETE FROM verdict_gap    WHERE run_id LIKE 'ws-it-%'`;
    await prisma.$executeRaw`DELETE FROM verdict_stream WHERE run_id LIKE 'ws-it-%'`;
    await prisma.$executeRaw`DELETE FROM workflow_runs  WHERE id LIKE 'ws-it-%'`;
    TestEventWsServer.addSink(fakeSniffer);
    await ensureVerdictRunRow(prisma, {
      runId: RUN,
      workflowRef: "ws-integration",
      deviceId: "ws-integration-device",
    });
    TestEventWsServer.ensureStarted();
    // ingestReady is decided asynchronously on `listening`.
    await waitFor(() => TestEventWsServer.isIngestReady());

    socket = new WebSocket(`ws://127.0.0.1:${TEST_EVENT_WS_PORT}/nesy`);
    received = collector(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    const ts = Date.now();
    const nonce = "ws-integration-nonce";
    const secret = RunSecretRegistry.issue({
      runId: RUN,
      deviceId: "ws-integration-device",
      appId: "com.arasdigital.nesymobile.rstest",
      nowMs: ts,
    });
    socket.send(JSON.stringify({
      type: "hello",
      runId: RUN,
      sessionId: SESSION,
      nonce,
      ts,
      sig: sign(String(secret), "app->host", RUN, SESSION, nonce, ts),
    }));
    await waitFor(() => received.frames.some((frame) => frame.type === "auth"));
  });

  afterAll(async () => {
    socket?.close();
    delete process.env.VERDICT_COMPARE_MODE;
    TestEventWsServer.removeSink(fakeSniffer);
    RunSecretRegistry.retire(RUN);
    await prisma.$executeRaw`DELETE FROM verdict_inbox  WHERE run_id = ${RUN}`;
    await prisma.$executeRaw`DELETE FROM verdict_gap    WHERE run_id = ${RUN}`;
    await prisma.$executeRaw`DELETE FROM verdict_stream WHERE run_id = ${RUN}`;
    await prisma.$executeRaw`DELETE FROM workflow_runs WHERE id = ${RUN}`;
    await prisma.$disconnect();
  });

  it("the ingest tables were found, so the durable path is on", () => {
    expect(TestEventWsServer.isIngestReady()).toBe(true);
  });

  it("an event frame is persisted and acked with the post-COMMIT watermark", async () => {
    socket.send(eventFrame(1));
    await waitFor(() => received.frames.some((f) => f.type === "event_ack"));

    const ack = received.frames.find((f) => f.type === "event_ack")!;
    expect(ack.runId).toBe(RUN);
    // Decimal STRING, not a number: seq is a Kotlin Long and JSON numbers lose
    // precision past 2^53.
    expect(ack.lastContiguousSeq).toBe("1");
    expect(typeof ack.lastContiguousSeq).toBe("string");

    const rows = await prisma.$queryRaw<{ seq: bigint }[]>`
      SELECT seq FROM verdict_inbox WHERE run_id = ${RUN} ORDER BY seq`;
    expect(rows.map((r) => r.seq)).toEqual([1n]);
  });

  it("the synchronous sniffer path still receives the event (dual write)", () => {
    // Current runs depend on this. Switching the oracle's feed to the durable
    // worker in the same step would couple every run to database latency.
    expect(injected.map((e) => e.seq)).toContain(1);
    expect(injected[0]!.raw.startsWith("WS|")).toBe(true);
  });

  it("the ordered durable fan-out also feeds the oracle sink after commit", async () => {
    await waitFor(() =>
      injected.some((event) => event.seq === 1 && event.raw.startsWith("DB|")),
    );
    await waitFor(async () => {
      const rows = await prisma.$queryRaw<{ processed_at: Date | null }[]>`
        SELECT processed_at FROM verdict_inbox
        WHERE run_id = ${RUN} AND session_id = ${SESSION} AND seq = 1`;
      return rows[0]?.processed_at instanceof Date;
    }, 20_000);
    const rows = await prisma.$queryRaw<{ processed_at: Date | null }[]>`
      SELECT processed_at FROM verdict_inbox
      WHERE run_id = ${RUN} AND session_id = ${SESSION} AND seq = 1`;
    expect(rows[0]?.processed_at).toBeInstanceOf(Date);
  });

  it("a hole holds the acked watermark back", async () => {
    received.frames.length = 0;
    socket.send(eventFrame(3));
    await waitFor(() => received.frames.some((f) => f.type === "event_ack"));
    const ack = received.frames.find((f) => f.type === "event_ack")!;
    // 3 arrived but 2 did not — acking "3" here would tell the device it may drop
    // seq 2 forever.
    expect(ack.lastContiguousSeq).toBe("1");
  });

  it("closing the hole moves the ack to the far side in one step", async () => {
    received.frames.length = 0;
    socket.send(eventFrame(2));
    await waitFor(() => received.frames.some((f) => f.type === "event_ack"));
    const ack = received.frames.find((f) => f.type === "event_ack")!;
    expect(ack.lastContiguousSeq).toBe("3");
  });

  it("a gap frame gets a gap_ack alongside the event_ack", async () => {
    received.frames.length = 0;
    socket.send(
      JSON.stringify({
        type: "gap",
        runId: RUN,
        sessionId: SESSION,
        generation: 1,
        fromSeq: 4,
        toSeq: 6,
        reason: "enospc",
      }),
    );
    await waitFor(() => received.frames.some((f) => f.type === "gap_ack"));

    const eventAck = received.frames.find((f) => f.type === "event_ack")!;
    const gapAck = received.frames.find((f) => f.type === "gap_ack")!;
    expect(eventAck.lastContiguousSeq).toBe("6");
    expect(gapAck.generation).toBe("1");

    // A gap is NOT a test event: it must not reach the sniffers.
    expect(injected.some((e) => e.seq === 4)).toBe(false);
  });

  it("a gap conflict is NOT acked", async () => {
    received.frames.length = 0;
    socket.send(
      JSON.stringify({
        type: "gap",
        runId: RUN,
        sessionId: SESSION,
        generation: 1,
        fromSeq: 4,
        toSeq: 99, // same generation, different range
        reason: "enospc",
      }),
    );
    // Give the server time to process and (wrongly) reply.
    await new Promise((r) => setTimeout(r, 2_000));
    expect(received.frames.filter((f) => f.type === "gap_ack")).toEqual([]);
    expect(received.frames.filter((f) => f.type === "event_ack")).toEqual([]);

    // And the stored range is untouched.
    const rows = await prisma.$queryRaw<{ to_seq: bigint }[]>`
      SELECT to_seq FROM verdict_gap WHERE run_id = ${RUN} AND generation = 1`;
    expect(rows[0]!.to_seq).toBe(6n);
  });

  it(
    "coalesces a burst without leaving an unprocessed fan-out tail",
    async () => {
      for (let seq = 7; seq <= 20; seq += 1) socket.send(eventFrame(seq));
      await waitFor(
        () =>
          injected.some(
            (event) => event.seq === 20 && event.raw.startsWith("DB|"),
          ),
        60_000,
      );
      await waitFor(async () => {
        const remaining = await prisma.verdictInbox.count({
          where: { runId: RUN, sessionId: SESSION, processedAt: null },
        });
        return remaining === 0;
      }, 60_000);

      const stream = await prisma.verdictStream.findUnique({
        where: { runId_sessionId: { runId: RUN, sessionId: SESSION } },
      });
      expect(stream?.contiguousSeq).toBe(20n);
    },
    30_000,
  );

  it(
    "the synchronous sink and the durable lane produce identical logical evidence",
    async () => {
      // THE CUTOVER GATE (B.5, RUN_PLAY 2.9). The synchronous sink cannot be
      // removed because the durable path "also works" — only because the two
      // produce the SAME logical evidence. The failure this guards against is
      // not "durable is broken" but "durable is subtly different", which would
      // surface as changed verdicts long after the sink was deleted.
      //
      // By this point the burst test above has driven 20 events through BOTH
      // paths on one socket, so the recorder has real dual-path data.
      const report = TestEventWsServer.getComparisonReport();

      expect(report.missingFromDurable).toEqual([]);
      expect(report.missingFromSync).toEqual([]);
      // The most dangerous case: same (runId, sessionId, seq), different content.
      expect(report.payloadMismatches).toEqual([]);
      expect(report.equal).toBe(true);
      // Guards against a vacuous pass: an empty recorder is "equal" too, and a
      // gate that passes when nothing was observed is not a gate.
      //
      // 17, not 20: this suite sends seq 1-3 and 7-20 as events, while 4-6 are a
      // GAP range the device declares it will never send. A gap is not a test
      // event, so neither path observes one — which is itself the correct
      // behaviour and is asserted separately above.
      expect(report.syncCount).toBeGreaterThanOrEqual(17);
      expect(report.durableCount).toBe(report.syncCount);
    },
    20_000,
  );

  it("a frame with an unusable seq is neither injected nor persisted", async () => {
    received.frames.length = 0;
    const before = injected.length;
    socket.send(JSON.stringify({ v: 1, runId: RUN, sessionId: SESSION, event: "SCREEN_READY" }));
    await new Promise((r) => setTimeout(r, 1_500));
    expect(injected.length).toBe(before);
    expect(received.frames).toEqual([]);
  });
});

function sign(
  secret: string,
  direction: "app->host" | "host->app",
  runId: string,
  sessionId: string,
  nonce: string,
  timestampMillis: number,
): string {
  return createHmac("sha256", Buffer.from(secret, "base64url"))
    .update(canonical(direction, runId, sessionId, nonce, timestampMillis))
    .digest("base64url");
}

function canonical(
  direction: "app->host" | "host->app",
  runId: string,
  sessionId: string,
  nonce: string,
  timestampMillis: number,
): Buffer {
  return Buffer.concat([
    lp("verdict-hmac-v1"),
    lp(direction),
    lp(runId),
    lp(sessionId),
    lp(nonce),
    lp(String(timestampMillis)),
  ]);
}

function lp(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
}
