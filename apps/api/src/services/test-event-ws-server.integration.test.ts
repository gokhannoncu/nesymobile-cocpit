/**
 * ===========================================================================
 *  WS SERVER end-to-end: real socket, real PostgreSQL  (plan Faz 0.2)
 *
 *  Proves the thing that unit tests cannot: a device frame arriving on an actual
 *  WebSocket gets durably accepted and acked, and the ACK carries the
 *  post-COMMIT watermark.
 *
 *  Requires `VERDICT_DB_IT=1` and `DATABASE_URL`; otherwise SKIPPED, never
 *  silently passed. All rows are namespaced by a unique run id and deleted at the
 *  end, so it is safe against a shared database.
 * ===========================================================================
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { prisma } from "@nesy/db";
import { TEST_EVENT_WS_PORT, TestEventWsServer } from "./test-event-ws-server.js";
import type { LogcatSniffer } from "./logcat-sniffer.js";
import type { TestBridgeEvent } from "./test-event-bridge.js";

const ENABLED = process.env.VERDICT_DB_IT === "1" && Boolean(process.env.DATABASE_URL);
const suite = ENABLED ? describe : describe.skip;

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
    taskId: "",
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

const waitFor = async (predicate: () => boolean, ms = 8_000): Promise<void> => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("timed out waiting for condition");
};

suite("WS server durable ingest", () => {
  let socket: WebSocket;
  let received: { frames: Record<string, unknown>[] };

  beforeAll(async () => {
    TestEventWsServer.addSink(fakeSniffer);
    TestEventWsServer.ensureStarted();
    // ingestReady is decided asynchronously on `listening`.
    await waitFor(() => TestEventWsServer.isIngestReady());

    socket = new WebSocket(`ws://127.0.0.1:${TEST_EVENT_WS_PORT}/nesy`);
    received = collector(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
  });

  afterAll(async () => {
    socket?.close();
    TestEventWsServer.removeSink(fakeSniffer);
    await prisma.$executeRaw`DELETE FROM verdict_inbox  WHERE run_id = ${RUN}`;
    await prisma.$executeRaw`DELETE FROM verdict_gap    WHERE run_id = ${RUN}`;
    await prisma.$executeRaw`DELETE FROM verdict_stream WHERE run_id = ${RUN}`;
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

  it("a frame with an unusable seq is neither injected nor persisted", async () => {
    received.frames.length = 0;
    const before = injected.length;
    socket.send(JSON.stringify({ v: 1, runId: RUN, sessionId: SESSION, event: "SCREEN_READY" }));
    await new Promise((r) => setTimeout(r, 1_500));
    expect(injected.length).toBe(before);
    expect(received.frames).toEqual([]);
  });
});
