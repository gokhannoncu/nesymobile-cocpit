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

export const TEST_EVENT_WS_PORT = 8765;
const WS_PATH = "/nesy";

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
        const event = parseWsFrame(String(data));
        if (!event) return;
        // Mark the transport for diagnostics before fan-out.
        const wsEvent: TestBridgeEvent = { ...event, raw: `WS|${event.raw.replace(/^.*NESY_TEST_EVENT\|/, "")}` };
        for (const sink of this.sinks) {
          sink.injectTestEvent(wsEvent);
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

  addSink(sniffer: LogcatSniffer): void {
    this.sinks.add(sniffer);
  }

  removeSink(sniffer: LogcatSniffer): void {
    this.sinks.delete(sniffer);
  }
}

export const TestEventWsServer = new TestEventWsServerImpl();
