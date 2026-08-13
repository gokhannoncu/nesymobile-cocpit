import { describe, expect, it } from "vitest";
import {
  parseTestEventLine,
  parseGetStateOutput,
  TestEventDeduper,
  validateHealthSnapshot,
  validateMemorySnapshot,
  type TestBridgeEvent,
} from "./test-event-bridge.js";

describe("control telemetry snapshot validation", () => {
  it("accepts additive health and memory records", () => {
    expect(
      validateHealthSnapshot({
        pid: 123,
        apiLevel: 36,
        inCriticalSpan: false,
        heapUsedMb: 40,
        heapMaxMb: 128,
        nativeHeapMb: 8,
        gcCount: 2,
        blockingGcTimeMs: 5,
        crashedSince: false,
        anrRisk: { blockedMs: 450, level: "HIGH" },
        eventsEmitted: 100,
        droppedSince: 1,
        gapEntriesUsed: 4,
        gapUsableEntries: 12,
        wal: "ok",
        gapEntries: [{ from: 3, to: 4 }],
        wsAuth: { status: "authenticated" },
        futureField: { retained: true },
      }),
    ).toBe(true);
    expect(
      validateMemorySnapshot({
        pid: 123,
        heapUsedBytes: 1_234,
        heapCommittedBytes: 2_000,
        heapMaxBytes: 4_000,
        nativeAllocatedBytes: 500,
        lowMemory: false,
        futureCounter: 99,
      }),
    ).toBe(true);
  });

  it("rejects malformed known fields without rejecting unknown fields", () => {
    expect(validateHealthSnapshot({ pid: "123", futureField: true })).toBe(false);
    expect(validateHealthSnapshot({ wal: 42, futureField: true })).toBe(false);
    expect(validateHealthSnapshot({ gapEntries: ["bad"], futureField: true })).toBe(false);
    expect(
      validateHealthSnapshot({
        anrRisk: { blockedMs: "450", level: "HIGH" },
        futureField: true,
      }),
    ).toBe(false);
    expect(validateMemorySnapshot({ rssBytes: -1, futureField: true })).toBe(false);
    expect(validateMemorySnapshot({ heapUsedBytes: "1", futureField: true })).toBe(false);
    expect(validateMemorySnapshot({ futureField: true })).toBe(true);
  });
});

function makeEvent(overrides: Partial<TestBridgeEvent> = {}): TestBridgeEvent {
  return {
    v: 1,
    runId: "run-1",
    sessionId: "session-a",
    seq: 1,
    ts: 0,
    monoTs: 0,
    screen: "",
    event: "SCREEN_READY",
    taskId: "",
    raw: "",
    ...overrides,
  };
}

describe("parseTestEventLine", () => {
  it("parses a NESY_TEST_EVENT line with logcat time prefix", () => {
    const json = JSON.stringify({
      v: 1,
      runId: "run-42",
      sessionId: "abc-123",
      seq: 7,
      ts: 1789000000000,
      monoTs: 5555,
      screen: "DeliveryFragment",
      event: "DELIVERY_PERSISTED",
      taskId: "T-1",
      success: true,
      spanId: "session-1:42",
      data: { request_name: "DeliverParcels" },
    });
    const line = `07-20 06:31:02.123 I/NESY_TEST_EVENT( 1234): NESY_TEST_EVENT|${json}`;

    const event = parseTestEventLine(line);

    expect(event).not.toBeNull();
    expect(event?.runId).toBe("run-42");
    expect(event?.sessionId).toBe("abc-123");
    expect(event?.seq).toBe(7);
    expect(event?.event).toBe("DELIVERY_PERSISTED");
    expect(event?.taskId).toBe("T-1");
    expect(event?.success).toBe(true);
    expect(event?.spanId).toBe("session-1:42");
    expect(event?.data?.request_name).toBe("DeliverParcels");
    expect(event?.raw).toBe(line);
  });

  it("ignores legacy NESY_AUTO_BRIDGE lines and malformed payloads", () => {
    expect(
      parseTestEventLine("07-20 06:31:02.123 D/NESY_AUTO_BRIDGE( 1234): ACTION: CHECK_LOGIN | STATUS: SUCCESS | TASK_ID:  | DATA: {}"),
    ).toBeNull();
    expect(parseTestEventLine("NESY_TEST_EVENT|not-json")).toBeNull();
    expect(parseTestEventLine('NESY_TEST_EVENT|{"broken":')).toBeNull();
    // missing required sessionId/event fields
    expect(parseTestEventLine('NESY_TEST_EVENT|{"v":1,"seq":3}')).toBeNull();
  });
});

describe("TestEventDeduper", () => {
  it("accepts monotonic seq and rejects replays per (runId, sessionId)", () => {
    const deduper = new TestEventDeduper();

    expect(deduper.accept(makeEvent({ seq: 1 }))).toBe(true);
    expect(deduper.accept(makeEvent({ seq: 2 }))).toBe(true);
    // WebSocket ring-buffer replay of the same events
    expect(deduper.accept(makeEvent({ seq: 1 }))).toBe(false);
    expect(deduper.accept(makeEvent({ seq: 2 }))).toBe(false);
    expect(deduper.accept(makeEvent({ seq: 3 }))).toBe(true);
  });

  it("treats a new sessionId as a fresh sequence (mid-run app restart)", () => {
    const deduper = new TestEventDeduper();

    expect(deduper.accept(makeEvent({ sessionId: "session-a", seq: 5 }))).toBe(true);
    // App restarted: new process, new sessionId, seq starts over — must NOT be dropped
    expect(deduper.accept(makeEvent({ sessionId: "session-b", seq: 1 }))).toBe(true);
    expect(deduper.accept(makeEvent({ sessionId: "session-b", seq: 2 }))).toBe(true);
  });
});

describe("parseGetStateOutput", () => {
  it("parses GET_STATE broadcast output (RESULT_OK)", () => {
    const stdout = [
      "Broadcasting: Intent { act=com.arasdigital.nesymobile.GET_STATE flg=0x400000 cmp=com.arasdigital.nesymobile.test/com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver }",
      'Broadcast completed: result=-1, data="{"is_logged_in":"true","route_selected":"true","route_name":"R-102","schedule_loaded":"true","schedule_id":"S-9","current_screen":"StopListFragment","run_id":"run-42","session_id":"abc","seq":"14"}"',
    ].join("\n");

    const state = parseGetStateOutput(stdout);

    expect(state).not.toBeNull();
    expect(state?.isLoggedIn).toBe(true);
    expect(state?.routeSelected).toBe(true);
    expect(state?.routeName).toBe("R-102");
    expect(state?.scheduleLoaded).toBe(true);
    expect(state?.currentScreen).toBe("StopListFragment");
    expect(state?.runId).toBe("run-42");
  });

  it("returns null on RESULT_CANCELED (mobile watchdog timeout)", () => {
    const stdout = 'Broadcast completed: result=0, data="ERROR:STATE_TIMEOUT"';
    expect(parseGetStateOutput(stdout)).toBeNull();
  });

  it("returns null when data is not JSON", () => {
    const stdout = 'Broadcast completed: result=-1, data="ERROR:STATE_FAILED:SQLiteException"';
    expect(parseGetStateOutput(stdout)).toBeNull();
  });

  it("returns null when data payload is missing", () => {
    expect(parseGetStateOutput("Broadcast completed: result=-1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
//  Faz 0.2 — schema version and seq validation
// ---------------------------------------------------------------------------

describe("parseTestEventLine — v1/v2 and seq validation (Faz 0.2)", () => {
  const line = (fields: Record<string, unknown>) =>
    `NESY_TEST_EVENT|${JSON.stringify({
      v: 1,
      runId: "run-1",
      sessionId: "s1",
      seq: 7,
      ts: 1,
      monoTs: 2,
      screen: "S",
      event: "SCREEN_READY",
      taskId: "",
      ...fields,
    })}`;

  it("accepts v=1 and v=2", () => {
    expect(parseTestEventLine(line({ v: 1 }))?.v).toBe(1);
    expect(parseTestEventLine(line({ v: 2 }))?.v).toBe(2);
  });

  it("rejects an unknown schema version instead of guessing", () => {
    expect(parseTestEventLine(line({ v: 3 }))).toBeNull();
    expect(parseTestEventLine(line({ v: undefined }))).toBeNull();
  });

  it("REJECTS a missing seq instead of substituting -1", () => {
    // The old behaviour turned a missing seq into -1, and the deduper let seq < 0
    // through unconditionally — silently disabling dedupe for exactly the
    // malformed events most likely to be replays.
    expect(parseTestEventLine(line({ seq: undefined }))).toBeNull();
    expect(parseTestEventLine(line({ seq: "7" }))).toBeNull();
    expect(parseTestEventLine(line({ seq: 0 }))).toBeNull();
    expect(parseTestEventLine(line({ seq: -1 }))).toBeNull();
    expect(parseTestEventLine(line({ seq: 1.5 }))).toBeNull();
  });

  it("the deduper no longer has a bypass, so every accepted event is deduped", () => {
    const deduper = new TestEventDeduper();
    const event = parseTestEventLine(line({ seq: 5 }))!;
    expect(deduper.accept(event)).toBe(true);
    expect(deduper.accept(event)).toBe(false);
  });
});
