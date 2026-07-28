import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HeartbeatLivenessStore,
  routeIncomingWsFrame,
} from "./test-event-ws-server.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TestEventWsServer heartbeat routing", () => {
  it("routes a seq-less SDK heartbeat to liveness without ingest or reject warning", () => {
    const frame = JSON.stringify({
      type: "heartbeat",
      v: 1,
      runId: "run-heartbeat",
      sessionId: "session-heartbeat",
      ts: 1_789_000_000_000,
      monoTs: 100_000,
      screen: "",
      event: "BRIDGE_HEARTBEAT",
      data: {
        uptime_ms: "99000",
        events_emitted: "42",
        wal: "ok",
        ws: "connected",
      },
    });
    const ingest = vi.fn();
    const injectEvent = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const liveness = new HeartbeatLivenessStore(() => 1_800_000_000_123);

    routeIncomingWsFrame(frame, {
      onControl: ingest,
      onHeartbeat: (heartbeat) => void liveness.record(heartbeat),
      onEvent: (event) => {
        injectEvent(event);
        ingest(event);
      },
    });

    expect(ingest).not.toHaveBeenCalled();
    expect(injectEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("rejecting event without a usable seq"),
    );
    expect(liveness.get("run-heartbeat", "session-heartbeat")).toEqual({
      lastBeatAt: 1_800_000_000_123,
      wal: "ok",
      ws: "connected",
    });
  });

  it("also recognises an unusable-seq structured heartbeat without a type marker", () => {
    const heartbeat = vi.fn();
    const event = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    routeIncomingWsFrame(
      JSON.stringify({
        v: 1,
        runId: "run-heartbeat",
        sessionId: "session-heartbeat",
        event: "BRIDGE_HEARTBEAT",
        data: { wal: "degraded", ws: "connected" },
      }),
      {
        onControl: vi.fn(),
        onHeartbeat: heartbeat,
        onEvent: event,
      },
    );

    expect(heartbeat).toHaveBeenCalledOnce();
    expect(event).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps a seq-bearing legacy BRIDGE_HEARTBEAT on the ingestable event path", () => {
    const heartbeat = vi.fn();
    const event = vi.fn();

    routeIncomingWsFrame(
      JSON.stringify({
        v: 1,
        runId: "legacy-run",
        sessionId: "legacy-session",
        seq: 7,
        ts: 1_789_000_000_000,
        monoTs: 100_000,
        screen: "",
        event: "BRIDGE_HEARTBEAT",
        taskId: "",
        data: { wal: "ok", ws: "connected" },
      }),
      {
        onControl: vi.fn(),
        onHeartbeat: heartbeat,
        onEvent: event,
      },
    );

    expect(heartbeat).not.toHaveBeenCalled();
    expect(event).toHaveBeenCalledWith(expect.objectContaining({ event: "BRIDGE_HEARTBEAT", seq: 7 }));
  });
});
