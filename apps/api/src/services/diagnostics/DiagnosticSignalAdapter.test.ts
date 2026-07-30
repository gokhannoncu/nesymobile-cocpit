import { describe, expect, it } from "vitest";
import type { TestBridgeEvent } from "../test-event-bridge.js";
import {
  toDiagnosticHealthSnapshot,
  toDiagnosticMarker,
  toMemoryPressureDetected,
} from "./DiagnosticSignalAdapter.js";

function event(overrides: Partial<TestBridgeEvent>): TestBridgeEvent {
  return {
    v: 1,
    runId: "run-1",
    sessionId: "session-1",
    seq: 1,
    ts: 1,
    monoTs: 9000,
    screen: "DeliveryScreen",
    event: "SCREEN_READY",
    taskId: "",
    raw: "",
    ...overrides,
  };
}

describe("DiagnosticSignalAdapter", () => {
  it("adapts the existing MEMORY_PRESSURE_DETECTED fields", () => {
    const adapted = toMemoryPressureDetected(
      event({
        event: "MEMORY_PRESSURE_DETECTED",
        spanId: "session-1:42",
        data: {
          operation: "loadDeliveries",
          memoryBeforeMb: "20",
          memoryPeakMb: "90",
        },
      }),
      {
        serial: "emulator-5554",
        packageName: "com.arasdigital.nesymobile.automation",
        buildProfile: "test",
        requestedBy: "tester",
      },
    );

    expect(adapted).toMatchObject({
      event: "MEMORY_PRESSURE_DETECTED",
      screen: "DeliveryScreen",
      operation: "loadDeliveries",
      spanId: "session-1:42",
      memoryBeforeMb: 20,
      memoryPeakMb: 90,
    });
  });

  it("extracts existing DIAGNOSTIC_MARKER anchors", () => {
    expect(
      toDiagnosticMarker(
        event({
          event: "DIAGNOSTIC_MARKER",
          spanId: "session-1:42",
          data: {
            label: "meminfo_pre",
            captureId: "cap-7",
            markerMonoTs: "918273645",
          },
        }),
      ),
    ).toEqual({
      event: "DIAGNOSTIC_MARKER",
      captureId: "cap-7",
      label: "meminfo_pre",
      monoTs: "918273645",
      spanId: "session-1:42",
    });
  });

  it("validates get_health pid/apiLevel/profileable and CRITICAL state", () => {
    expect(
      toDiagnosticHealthSnapshot({
        pid: 321,
        apiLevel: 35,
        profileable: true,
        inCriticalSpan: false,
        screen: "DeliveryScreen",
        operation: "loadDeliveries",
        spanId: "session-1:42",
      }),
    ).toEqual({
      pid: 321,
      apiLevel: 35,
      profileable: true,
      inCriticalSpan: false,
      screen: "DeliveryScreen",
      operation: "loadDeliveries",
      spanId: "session-1:42",
    });
    expect(toDiagnosticHealthSnapshot({ pid: 0, apiLevel: 28 })).toBeNull();
  });
});
