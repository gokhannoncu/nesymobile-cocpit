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
import { gapGenerationAccepted, ingestFrame, type IngestFrame } from "./verdict-ingest.js";
import { MonotoneStreamWatermarks } from "./verdict-stream-order.js";
import {
  SyncDurableComparisonRecorder,
  payloadFingerprint,
  type DurableInboxRow,
} from "./verdict-durable-runtime.js";
import { getVerdictDurableRuntime } from "./verdict-wait-event.js";
import { getBridgeFlowEvidenceRuntime } from "./bridgeflow-evidence-runtime.js";
import { createPrismaEvidenceJourneyWriter } from "./evidence-journey-writer.js";
import { BridgeFlowEvidenceSources } from "./bridgeflow-evidence-source-registry.js";
import { DurableBridgeFlowEvidenceIngest } from "./bridgeflow-durable-evidence-ingest.js";
import { RunSecretRegistry } from "./run-secret-registry.js";
import { prisma } from "@nesy/db";

export { BridgeFlowEvidenceSources } from "./bridgeflow-evidence-source-registry.js";

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
 * Removes the synchronous sink from the primary production path (Faz 2 cutover).
 *
 * Default OFF — i.e. the sync sink still runs — and that default is the rollback
 * plan. Flipping this to `1` is the entire cutover, and flipping it back is the
 * entire rollback; there is no code change and no migration in either direction.
 * It must not be flipped for a stream until `VERDICT_COMPARE_MODE=1` has shown
 * the two paths produce identical logical evidence (B.5: "synchronous sink yalnız
 * karşılaştırmalı geçişte bulunabilir").
 */
const SYNC_SINK_DISABLED = process.env.VERDICT_SYNC_SINK_DISABLED === "1";
const WS_AUTH_REQUIRED = process.env.VERDICT_WS_AUTH_REQUIRED !== "0";

export function parseOrderedDurableEvent(row: DurableInboxRow): TestBridgeEvent {
  const serialized = JSON.stringify(row.payload);
  const event = parseTestEventLine(`NESY_TEST_EVENT|${serialized}`);
  if (!event) {
    throw new Error(
      `malformed ordered durable event ${row.runId}/${row.sessionId}/${row.seq.toString()}`,
    );
  }
  return {
    ...event,
    raw: `DB|${serialized}`,
  };
}

export async function consumeOrderedDurableEvidenceRow(
  row: DurableInboxRow,
  options: {
    evidence: Pick<
      DurableBridgeFlowEvidenceIngest,
      "persist" | "publish" | "observeOrderedBlock" | "observeMalformedOrderedRow"
    >;
    onEvent(event: TestBridgeEvent): void;
  },
): Promise<void> {
  const audit = {
    runId: row.runId,
    sessionId: row.sessionId,
    seq: row.seq.toString(),
    rawEventRef: `durable:${row.runId}:${row.sessionId}:${row.seq.toString()}`,
  };
  let durableEvent: TestBridgeEvent;
  try {
    durableEvent = parseOrderedDurableEvent(row);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await options.evidence.observeMalformedOrderedRow(audit, reason);
    throw error;
  }
  try {
    const prepared = await options.evidence.persist(
      durableEvent,
      "ORDERED_REQUIRED",
      audit,
    );
    options.onEvent(durableEvent);
    options.evidence.publish(prepared);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await options.evidence.observeOrderedBlock(row.payload, audit, reason);
    throw error;
  }
}

/**
 * Records both paths' observations so their equality can be asserted.
 *
 * Off by default because it accumulates per-event observations in memory: an
 * always-on comparison recorder in a long-lived API process is a leak, and a
 * cutover gate that degrades production is not a gate anyone will use.
 *
 * Read per frame rather than captured at module load, unlike the two flags
 * above. Those decide a startup behaviour; this one has to be switchable by the
 * equality test, and an ESM module constant cannot be — imports are hoisted, so
 * the test would have to set the variable before its own import statement ran.
 * The cost is one string comparison per event on a path that already does a
 * database transaction.
 */
const compareModeEnabled = (): boolean => process.env.VERDICT_COMPARE_MODE === "1";
const bridgeFlowEvidenceWriter = createPrismaEvidenceJourneyWriter();
export const BridgeFlowDurableEvidence = new DurableBridgeFlowEvidenceIngest({
  resolver: BridgeFlowEvidenceSources,
  writer: bridgeFlowEvidenceWriter,
  runtime: getBridgeFlowEvidenceRuntime(),
});

/**
 * A device frame that is not a test event: a gap the device CLAIMS happened.
 *
 * The SDK emits this today (`WebSocketSink.publishPendingGaps`, `TYPE_GAP`) for a
 * committed gap — the deletion is durable and the range is genuinely gone. An
 * uncommitted gap is a question instead and goes to [parseGapStatusFrame]; the two
 * must not be confused, because ingesting a question would record a loss the
 * device never claimed.
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

export interface HeartbeatFrame {
  runId: string | null;
  sessionId: string | null;
  wal: string | null;
  ws: string | null;
}

export interface StreamHeartbeatLiveness {
  lastBeatAt: number;
  wal: string | null;
  ws: string | null;
}

function hasUsableEventSeq(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/**
 * Recognises the SDK's unsequenced, WAL-bypass heartbeat before the shared
 * structured-event parser can reject its deliberately absent `seq`.
 *
 * `type: "heartbeat"` is authoritative and is always liveness-only. A legacy
 * `BRIDGE_HEARTBEAT` carrying a usable seq is intentionally not matched here,
 * so it remains ingestable exactly as it was before the WAL-bypass frame was
 * introduced.
 */
function parseHeartbeatFrame(data: string): HeartbeatFrame | null {
  try {
    const frame = JSON.parse(data.trim()) as Record<string, unknown>;
    const isWalBypassHeartbeat = frame.type === "heartbeat";
    const isUnsequencedStructuredHeartbeat =
      frame.event === "BRIDGE_HEARTBEAT" && !hasUsableEventSeq(frame.seq);
    if (!isWalBypassHeartbeat && !isUnsequencedStructuredHeartbeat) return null;

    const heartbeatData =
      typeof frame.data === "object" && frame.data !== null && !Array.isArray(frame.data)
        ? (frame.data as Record<string, unknown>)
        : {};
    return {
      runId: typeof frame.runId === "string" && frame.runId !== "" ? frame.runId : null,
      sessionId:
        typeof frame.sessionId === "string" && frame.sessionId !== "" ? frame.sessionId : null,
      wal: typeof heartbeatData.wal === "string" ? heartbeatData.wal : null,
      ws: typeof heartbeatData.ws === "string" ? heartbeatData.ws : null,
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

export interface IncomingFrameHandlers {
  onControl(frame: IngestFrame): void;
  onHeartbeat(frame: HeartbeatFrame): void;
  onEvent(event: TestBridgeEvent): void;
  /** Optional so existing routing tests keep compiling; the server always supplies it. */
  onGapStatus?(frame: GapStatusQueryFrame): void;
}

interface AuthenticatedWsStream {
  runId: string;
  sessionId: string;
}

function parseHelloFrame(data: string): {
  runId: string
  sessionId: string
  nonce: string
  timestampMillis: number
  signature: string
} | null {
  try {
    const frame = JSON.parse(data.trim()) as Record<string, unknown>
    if (frame.type !== 'hello') return null
    const runId = typeof frame.runId === 'string' ? frame.runId : ''
    const sessionId = typeof frame.sessionId === 'string' ? frame.sessionId : ''
    const nonce = typeof frame.nonce === 'string' ? frame.nonce : ''
    const signature = typeof frame.sig === 'string' ? frame.sig : ''
    const ts = typeof frame.ts === 'number' ? frame.ts : Number(frame.ts)
    if (!runId || !sessionId || !nonce || !signature || !Number.isFinite(ts)) return null
    return { runId, sessionId, nonce, timestampMillis: ts, signature }
  } catch {
    return null
  }
}

function sameStream(auth: AuthenticatedWsStream | null, runId: string | null, sessionId: string | null): boolean {
  if (!WS_AUTH_REQUIRED) return true
  return auth !== null && auth.runId === runId && auth.sessionId === sessionId
}

/**
 * The device asking whether we already accepted a gap generation (C.5.1c).
 *
 * Carries no range on purpose: the device is asking precisely because it does not
 * know what we hold, and a range it supplied would be a claim rather than a
 * question.
 */
export interface GapStatusQueryFrame {
  runId: string;
  sessionId: string;
  generation: string;
}

export function parseGapStatusFrame(data: string): GapStatusQueryFrame | null {
  try {
    const f = JSON.parse(data.trim()) as Record<string, unknown>;
    if (f.type !== "gap_status") return null;
    const runId = typeof f.runId === "string" ? f.runId : null;
    const sessionId = typeof f.sessionId === "string" ? f.sessionId : null;
    const generation =
      typeof f.generation === "number"
        ? String(f.generation)
        : typeof f.generation === "string"
          ? f.generation
          : null;
    if (!runId || !sessionId || !generation) return null;
    return { runId, sessionId, generation };
  } catch {
    return null;
  }
}

/**
 * Keeps control, unsequenced heartbeat, and durable event routing mutually
 * exclusive. Exported to let the wire-level routing contract be unit tested
 * without opening port 8765 or requiring PostgreSQL.
 */
export function routeIncomingWsFrame(data: string, handlers: IncomingFrameHandlers): void {
  // Before `parseControlFrame`: `gap_status` is a QUESTION, not a gap to ingest.
  // Routing it to `onControl` would record a gap the device never claimed had
  // happened, which is the one outcome the ask-first protocol exists to prevent.
  const gapStatus = parseGapStatusFrame(data);
  if (gapStatus) {
    handlers.onGapStatus?.(gapStatus);
    return;
  }

  const control = parseControlFrame(data);
  if (control) {
    handlers.onControl(control);
    return;
  }

  const heartbeat = parseHeartbeatFrame(data);
  if (heartbeat) {
    handlers.onHeartbeat(heartbeat);
    return;
  }

  const event = parseWsFrame(data);
  if (event) handlers.onEvent(event);
}

export class HeartbeatLivenessStore {
  private readonly lastHeartbeatByStream = new Map<string, StreamHeartbeatLiveness>();

  constructor(private readonly now: () => number = Date.now) {}

  record(frame: HeartbeatFrame): StreamHeartbeatLiveness | null {
    if (!frame.runId || !frame.sessionId) return null;
    const liveness = {
      lastBeatAt: this.now(),
      wal: frame.wal,
      ws: frame.ws,
    };
    this.lastHeartbeatByStream.set(this.streamKey(frame.runId, frame.sessionId), liveness);
    return liveness;
  }

  get(runId: string, sessionId: string): StreamHeartbeatLiveness | undefined {
    const liveness = this.lastHeartbeatByStream.get(this.streamKey(runId, sessionId));
    return liveness ? { ...liveness } : undefined;
  }

  private streamKey(runId: string, sessionId: string): string {
    return JSON.stringify([runId, sessionId]);
  }
}

class TestEventWsServerImpl {
  private server: WebSocketServer | null = null;
  private readonly sinks = new Set<LogcatSniffer>();
  private readonly heartbeatLiveness = new HeartbeatLivenessStore();
  private connectionCount = 0;
  /**
   * Whether the durable path is usable. Decided ONCE at start-up rather than per
   * frame: if the migration has not been applied, every frame would otherwise log
   * the same error forever.
   */
  private ingestReady = false;
  private readonly sentAckThrough = new MonotoneStreamWatermarks();
  /**
   * Sync-vs-durable equality evidence. Populated only under
   * `VERDICT_COMPARE_MODE=1`; exposed so the health route and the integration
   * suite can read the report without reaching into the WS server's internals.
   */
  private readonly comparison = new SyncDurableComparisonRecorder();
  /** Registered once, on the first successful ingest-readiness check. */
  private orderedConsumerRegistered = false;

  private streamKey(runId: string, sessionId: string): string {
    return JSON.stringify([runId, sessionId]);
  }

  /**
   * Hands a persisted inbox row to the same sink seam OracleEngine uses.
   * Parsing again at this trust boundary prevents a malformed JSONB payload
   * from being marked processed without ever reaching a consumer.
   *
   * This is the ORDERED lane's consumer: it runs below the contiguous watermark,
   * under the stream lease, and a throw here stops the stream at this seq rather
   * than skipping it (see `verdict-ordered-evidence-bus.ts`).
   */
  private async consumeDurableRow(row: DurableInboxRow): Promise<void> {
    await consumeOrderedDurableEvidenceRow(row, {
      evidence: BridgeFlowDurableEvidence,
      onEvent: (durableEvent) => {
        for (const sink of this.sinks) sink.injectTestEvent(durableEvent);
      },
    });

    if (compareModeEnabled()) {
      this.comparison.recordDurable({
        runId: row.runId,
        sessionId: row.sessionId,
        seq: row.seq.toString(),
        fingerprint: payloadFingerprint(row.payload),
      });
    }
  }

  /**
   * Registers the ordered consumer and replays anything a previous process left
   * behind.
   *
   * Both happen here rather than at module load: the runtime construction
   * touches Prisma, and the restart scan is only meaningful once the tables are
   * known to exist.
   */
  private async startDurableRuntime(): Promise<void> {
    const runtime = getVerdictDurableRuntime();
    if (!this.orderedConsumerRegistered) {
      runtime.registerOrderedConsumer((row) => this.consumeDurableRow(row));
      this.orderedConsumerRegistered = true;
    }
    try {
      // Closes the commit-before-publish crash window: rows this process never
      // saw are found from persisted state, not from remembered intent.
      const scan = await runtime.bootstrap();
      if (scan.receiptStreams > 0 || scan.orderedStreams > 0) {
        console.log(
          `[TestEventWS] restart recovery: ${scan.receiptStreams} receipt-pending, ` +
            `${scan.orderedStreams} ordered-pending stream(s) resumed`,
        );
      }
    } catch (err) {
      console.warn(
        "[TestEventWS] durable restart scan failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  /** Sync-vs-durable equality report. Empty unless `VERDICT_COMPARE_MODE=1`. */
  getComparisonReport(): ReturnType<SyncDurableComparisonRecorder["report"]> {
    return this.comparison.report();
  }

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
      await this.startDurableRuntime();
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
    if (frame.kind === "event") {
      const audit = {
        runId: frame.runId,
        sessionId: frame.sessionId,
        seq: frame.seq,
        rawEventRef: `durable:${frame.runId}:${frame.sessionId}:${frame.seq}`,
      };
      try {
        const prepared = await BridgeFlowDurableEvidence.persist(
          frame.payload,
          "RECEIPT_SAFE",
          audit,
        );
        BridgeFlowDurableEvidence.publish(prepared);
      } catch (error) {
        console.warn(
          "[TestEventWS] receipt-safe evidence persistence failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }
    const send = (payload: unknown) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
    };
    const wireAck = this.sentAckThrough.advance(
      frame.runId,
      frame.sessionId,
      res.lastContiguousSeq,
    );
    send({
      type: "event_ack",
      runId: frame.runId,
      sessionId: frame.sessionId,
      // Decimal string: seq is a Kotlin Long and JSON numbers lose precision
      // past 2^53. The device parses it with BigInt.
      lastContiguousSeq: wireAck.toString(),
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
    // Post-COMMIT, both lanes. The receipt lane can publish this row immediately
    // even if it sits above a hole; the ordered lane drains only below the
    // watermark. Neither is the delivery guarantee — the guarantee is the
    // committed row plus the restart scan.
    getVerdictDurableRuntime().nudge({ runId: frame.runId, sessionId: frame.sessionId });
  }

  /**
   * Answers `gap_status` — the device's ask-first question after a crash between
   * reserving a gap entry and committing it.
   *
   * Without this answer the device is stuck by design: its contract forbids a blind
   * send after a timeout (C.5.1c-O), so an unanswered question means the entry is
   * never released. The gap ring is small (7 usable entries) and a full ring makes
   * `prepareGap` refuse, which leaves the WAL in `space_exhausted` — and a WAL that
   * cannot append emits NOTHING. The observed end state is a device reporting
   * `wal=space_exhausted events_emitted=0 ws=connected` while every UI fact the
   * oracle waits for silently never arrives.
   *
   * Silence is the correct response when we cannot prove an answer, so an
   * unreadable database or a disabled ingest path sends nothing at all rather than
   * guessing: a wrong `true` erases real evidence, a wrong `false` reports the same
   * loss twice.
   */
  private async answerGapStatus(socket: WebSocket, frame: GapStatusQueryFrame): Promise<void> {
    if (!this.ingestReady) return;
    const accepted = await gapGenerationAccepted(
      frame.runId,
      frame.sessionId,
      frame.generation,
    );
    if (accepted === null) {
      console.warn(
        `[TestEventWS] gap_status for ${frame.runId}/${frame.sessionId} ` +
          `generation ${frame.generation} could not be answered; staying silent ` +
          `(the device keeps the entry, which is the safe end of this protocol)`,
      );
      return;
    }
    if (socket.readyState !== socket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "gap_status_result",
        runId: frame.runId,
        sessionId: frame.sessionId,
        generation: frame.generation,
        // String, not boolean: the device compares against "true".
        accepted: accepted ? "true" : "false",
      }),
    );
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
      let authenticated: AuthenticatedWsStream | null = null;

      socket.on("message", (data) => {
        const raw = String(data);
        if (WS_AUTH_REQUIRED && authenticated === null) {
          const hello = parseHelloFrame(raw);
          if (hello === null) {
            console.warn(`[TestEventWS] unauthenticated frame rejected on connection #${connectionId}`);
            return;
          }
          if (!RunSecretRegistry.verifyHello(hello)) {
            console.warn(`[TestEventWS] hello auth failed for ${hello.runId}/${hello.sessionId}`);
            socket.close(1008, "auth_failed");
            return;
          }
          const sig = RunSecretRegistry.hostSignature(hello);
          if (sig === undefined) {
            socket.close(1008, "auth_unavailable");
            return;
          }
          authenticated = { runId: hello.runId, sessionId: hello.sessionId };
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify({
              type: "auth",
              runId: hello.runId,
              sessionId: hello.sessionId,
              nonce: hello.nonce,
              ts: hello.timestampMillis,
              sig,
            }));
          }
          return;
        }
        routeIncomingWsFrame(raw, {
          // A gap frame is not a test event: it never reaches the sniffers, only
          // the durable path.
          onControl: (control) => {
            if (!sameStream(authenticated, control.runId, control.sessionId)) return;
            if (this.ingestReady) void this.acceptDurable(socket, control);
          },
          onGapStatus: (query) => {
            if (!sameStream(authenticated, query.runId, query.sessionId)) return;
            void this.answerGapStatus(socket, query);
          },
          // Heartbeats deliberately have no seq and bypass the WAL. They update
          // host liveness only; they never reach acceptDurable or the sniffers.
          onHeartbeat: (heartbeat) => {
            if (!sameStream(authenticated, heartbeat.runId, heartbeat.sessionId)) return;
            const liveness = this.heartbeatLiveness.record(heartbeat);
            console.debug(
              liveness
                ? `[TestEventWS] heartbeat ${heartbeat.runId}/${heartbeat.sessionId} ` +
                    `wal=${liveness.wal ?? "unknown"} ws=${liveness.ws ?? "unknown"}`
                : `[TestEventWS] heartbeat on connection #${connectionId} missing stream identity`,
            );
          },
          onEvent: (event) => {
            if (!sameStream(authenticated, event.runId, event.sessionId)) return;
            // DUAL WRITE, deliberately (mirrors the mobile side's dual-emit).
            //
            // The synchronous sink injection below is what current runs depend on and
            // it stays byte-for-byte unchanged — switching the oracle's feed to the
            // durable worker in the same step would couple every existing run to
            // database latency and availability. The durable path runs alongside so
            // the host is READY; Faz 2 removes the synchronous one.
            const wsEvent: TestBridgeEvent = {
              ...event,
              raw: `WS|${event.raw.replace(/^.*NESY_TEST_EVENT\|/, "")}`,
            };
            if (!SYNC_SINK_DISABLED) {
              for (const sink of this.sinks) {
                sink.injectTestEvent(wsEvent);
              }
              if (compareModeEnabled()) {
                // Recorded from the SYNC path's own view of the event, before it
                // ever reaches the database. Comparing the durable path against
                // a re-read of the durable row would prove nothing.
                this.comparison.recordSync({
                  runId: event.runId,
                  sessionId: event.sessionId,
                  seq: String(event.seq),
                  fingerprint: payloadFingerprint(event),
                });
              }
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
          },
        });
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

  /** Latest host-observed heartbeat for future health/stuck-run checks. */
  getLastHeartbeat(runId: string, sessionId: string): StreamHeartbeatLiveness | undefined {
    return this.heartbeatLiveness.get(runId, sessionId);
  }

  addSink(sniffer: LogcatSniffer): void {
    this.sinks.add(sniffer);
  }

  removeSink(sniffer: LogcatSniffer): void {
    this.sinks.delete(sniffer);
  }
}

export const TestEventWsServer = new TestEventWsServerImpl();
