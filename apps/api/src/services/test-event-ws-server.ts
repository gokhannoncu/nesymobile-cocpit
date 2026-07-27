/**
 * Test Event WebSocket Server — host side of the mobile WS transport.
 *
 * The mobile app's WebSocketTestEventSink connects to ws://127.0.0.1:8765/nesy
 * (device-local; `adb reverse tcp:8765 tcp:8765` maps it to this server) and:
 * - sends a `hello` frame on connect
 * - replays the last 256 buffered events (EventBuffer), then streams live ones
 *
 * All connected devices share the single host port — attribution and replay
 * protection are handled downstream by each sniffer's runId filter and
 * (runId, sessionId, seq) dedupe, which is exactly why replay is safe.
 *
 * Structured events received here are injected into the registered device
 * sniffers (see LogcatSniffer.injectTestEvent); logcat stays as the parallel
 * fallback/diagnostic channel.
 */

import { WebSocketServer, type WebSocket } from "ws";
import type { LogcatSniffer } from "./logcat-sniffer.js";
import { parseTestEventLine, type TestBridgeEvent } from "./test-event-bridge.js";
import { ingestFrame, type IngestFrame } from "./verdict-ingest.js";
import { runFanoutOnce } from "./verdict-fanout.js";
import { prisma } from "@nesy/db";

export const TEST_EVENT_WS_PORT = 8765;
const WS_PATH = "/nesy";

/**
 * Escape hatch. The durable path costs one small transaction per frame; if that
 * ever needs to be off on a busy shared database, this turns it off without a
 * code change. Absent = ON, because a feature that ships disabled is not
 * deployed, and Faz 0.2 exists so the host is READY before Faz 2 needs it.
 */
const INGEST_DISABLED = process.env.VERDICT_INGEST_DISABLED === "1";

/**
 * A device frame that is not a test event.
 *
 * Only `gap` is acted on today. The exact device-side gap frame shape is fixed in
 * Faz 2 when the SDK starts emitting it; this accepts the documented field names
 * and ignores anything else rather than guessing.
 */
function parseControlFrame(data: string): IngestFrame | null {
  try {
    const f = JSON.parse(data.trim()) as Record<string, unknown>;
    if (f.type !== "gap" && f.type !== "sequence_gap") return null;
    const str = (v: unknown) => (typeof v === "number" ? String(v) : typeof v === "string" ? v : null);
    const runId = typeof f.runId === "string" ? f.runId : null;
    const sessionId = typeof f.sessionId === "string" ? f.sessionId : null;
    const generation = str(f.generation);
    const fromSeq = str(f.fromSeq ?? f.from);
    const toSeq = str(f.toSeq ?? f.to);
    if (!runId || !sessionId || !generation || !fromSeq || !toSeq) return null;
    return {
      kind: "gap",
      runId,
      sessionId,
      generation,
      fromSeq,
      toSeq,
      reason: typeof f.reason === "string" ? f.reason : "unspecified",
    };
  } catch {
    return null;
  }
}

function parseWsFrame(data: string): TestBridgeEvent | null {
  const trimmed = data.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    // Control frames (hello, ping, ...) are not test events.
    if (typeof parsed.type === "string" && typeof parsed.event !== "string") {
      return null;
    }
  } catch {
    return null;
  }

  // Reuse the logcat line parser: it validates and normalizes the same schema.
  return parseTestEventLine(`NESY_TEST_EVENT|${trimmed}`);
}

class TestEventWsServerImpl {
  private server: WebSocketServer | null = null;
  private readonly sinks = new Set<LogcatSniffer>();
  private connectionCount = 0;
  /**
   * Whether the durable path is usable. Decided ONCE at start-up rather than per
   * frame: if the migration has not been applied, every frame would otherwise log
   * the same error forever.
   */
  private ingestReady = false;

  /**
   * Verifies the ingest tables exist before claiming the durable path works.
   *
   * A missing table is reported LOUDLY and the durable path stays off — but the
   * WS server keeps running, because the synchronous sink path is what current
   * runs depend on and it does not need the database at all.
   */
  private async checkIngestReady(): Promise<void> {
    if (INGEST_DISABLED) {
      console.warn("[TestEventWS] durable ingest DISABLED by VERDICT_INGEST_DISABLED=1");
      return;
    }
    try {
      await prisma.$queryRaw`SELECT 1 FROM verdict_stream LIMIT 1`;
      this.ingestReady = true;
      console.log("[TestEventWS] durable ingest enabled (at-least-once ACKs active)");
    } catch (err) {
      console.error(
        "[TestEventWS] durable ingest UNAVAILABLE — verdict_* tables missing? " +
          "Events still reach sniffers, but NO ACKs are sent and the device cannot " +
          "release its WAL. Run: pnpm --filter @nesy/db exec prisma migrate deploy. " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  /**
   * Durable acceptance for one frame, then the ACK.
   *
   * ⚠️ The ACK goes out only after the transaction COMMITS. Acking earlier would
   * let the device delete a WAL record the host does not have — the whole reason
   * this path exists (C.5.3).
   *
   * Fan-out is NOT done here. The ordered single-consumer worker is nudged
   * instead; doing it inline would let seq 412 reach consumers before 411,
   * because the stream row lock is released at COMMIT.
   */
  private async acceptDurable(socket: WebSocket, frame: IngestFrame): Promise<void> {
    const res = await ingestFrame(frame);
    if (!res.ok) {
      // No ACK. A PROTOCOL_VIOLATION in particular must NOT be acked: the device
      // would clear a journal entry for a range the host never recorded.
      console.error(`[TestEventWS] ingest rejected (${res.code}):`, res.detail);
      return;
    }
    const send = (payload: unknown) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
    };
    send({
      type: "event_ack",
      runId: frame.runId,
      sessionId: frame.sessionId,
      // Decimal string: seq is a Kotlin Long and JSON numbers lose precision
      // past 2^53. The device parses it with BigInt.
      lastContiguousSeq: res.lastContiguousSeq.toString(),
    });
    if (res.ackGeneration !== undefined) {
      // Only this (or a cumulative ack >= toSeq) lets the device clear the gap
      // entry from its ControlJournal.
      send({
        type: "gap_ack",
        runId: frame.runId,
        sessionId: frame.sessionId,
        generation: res.ackGeneration.toString(),
      });
    }
    if (res.fullRescan) {
      console.warn(
        `[TestEventWS] pending_above overflowed for ${frame.runId}/${frame.sessionId} — ` +
          `cursor recomputed from persisted state. More than 10k concurrent holes is not normal.`,
      );
    }
    // Nudge, do not process. The worker holds a DB lease, so a second nudge while
    // one is running is a no-op rather than a duplicate delivery.
    void runFanoutOnce(frame.runId, frame.sessionId, async () => {
      // No consumer yet: the oracle is still fed by the synchronous sink path
      // below during the dual-write period. Faz 2 replaces that with this worker,
      // and `processed_at` is what makes the switch resumable.
    }).catch((err: unknown) => {
      console.warn("[TestEventWS] fan-out nudge failed:", err instanceof Error ? err.message : err);
    });
  }

  ensureStarted(): void {
    if (this.server) return;

    try {
      this.server = new WebSocketServer({
        host: "127.0.0.1",
        port: TEST_EVENT_WS_PORT,
        path: WS_PATH,
      });
    } catch (err) {
      console.warn("[TestEventWS] failed to start server:", err instanceof Error ? err.message : err);
      this.server = null;
      return;
    }

    this.server.on("listening", () => {
      console.log(`[TestEventWS] listening on ws://127.0.0.1:${TEST_EVENT_WS_PORT}${WS_PATH}`);
      void this.checkIngestReady();
    });

    this.server.on("error", (err: Error) => {
      // EADDRINUSE etc. — logcat fallback keeps working, so log and move on.
      console.warn("[TestEventWS] server error:", err.message);
    });

    this.server.on("connection", (socket: WebSocket) => {
      this.connectionCount += 1;
      const connectionId = this.connectionCount;
      console.log(`[TestEventWS] device connection #${connectionId} established`);

      socket.on("message", (data) => {
        const raw = String(data);

        // A gap frame is not a test event: it never reaches the sniffers, only
        // the durable path.
        const control = parseControlFrame(raw);
        if (control) {
          if (this.ingestReady) void this.acceptDurable(socket, control);
          return;
        }

        const event = parseWsFrame(raw);
        if (!event) return;

        // DUAL WRITE, deliberately (mirrors the mobile side's dual-emit).
        //
        // The synchronous sink injection below is what current runs depend on and
        // it stays byte-for-byte unchanged — switching the oracle's feed to the
        // durable worker in the same step would couple every existing run to
        // database latency and availability. The durable path runs alongside so
        // the host is READY; Faz 2 removes the synchronous one.
        const wsEvent: TestBridgeEvent = { ...event, raw: `WS|${event.raw.replace(/^.*NESY_TEST_EVENT\|/, "")}` };
        for (const sink of this.sinks) {
          sink.injectTestEvent(wsEvent);
        }

        if (this.ingestReady) {
          void this.acceptDurable(socket, {
            kind: "event",
            runId: event.runId,
            sessionId: event.sessionId,
            seq: String(event.seq),
            payload: event,
          });
        }
      });

      socket.on("close", () => {
        console.log(`[TestEventWS] device connection #${connectionId} closed`);
      });

      socket.on("error", (err: Error) => {
        console.warn(`[TestEventWS] connection #${connectionId} error:`, err.message);
      });
    });
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  /** True when frames are being durably accepted and acked. */
  isIngestReady(): boolean {
    return this.ingestReady;
  }

  addSink(sniffer: LogcatSniffer): void {
    this.sinks.add(sniffer);
  }

  removeSink(sniffer: LogcatSniffer): void {
    this.sinks.delete(sniffer);
  }
}

export const TestEventWsServer = new TestEventWsServerImpl();
