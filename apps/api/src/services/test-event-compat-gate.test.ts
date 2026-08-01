import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseTestEventLine } from "./test-event-bridge.js";

interface CompatObservation {
  deviceId: string;
  line: string;
  /** False only after a documented sunset has removed the device from service. */
  active?: boolean;
}

interface CompatReport {
  acceptedEvents: number;
  rejectedStructuredLines: number;
  duplicateEvents: number;
  activeDevices: number;
  v1Events: number;
  v2Events: number;
  v1Devices: number;
  activeV1EventRate: number;
  activeV1DeviceRate: number;
}

type ExpectedGateDecision = "GO" | "NO_GO";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "test-event-compat",
);

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8").trim();
}

function logcat(payload: string): string {
  return `01-01 00:00:00.000 I/NESY_TEST_EVENT( 1234): NESY_TEST_EVENT|${payload}`;
}

/**
 * Lab/telemetry hook for Faz 8.1 step 3.
 *
 * The same event can arrive over logcat and WebSocket, so rates are calculated
 * after de-duplicating the production key plus deviceId. Inactive observations
 * are accepted only to model a documented, deliberate device sunset.
 */
function measureCompat(observations: CompatObservation[]): CompatReport {
  const seen = new Set<string>();
  const activeDeviceIds = new Set<string>();
  const v1DeviceIds = new Set<string>();
  let acceptedEvents = 0;
  let rejectedStructuredLines = 0;
  let duplicateEvents = 0;
  let v1Events = 0;
  let v2Events = 0;

  for (const observation of observations) {
    if (observation.active === false) continue;
    if (!observation.line.includes("NESY_TEST_EVENT|")) continue;

    const event = parseTestEventLine(observation.line);
    if (!event) {
      rejectedStructuredLines += 1;
      continue;
    }

    activeDeviceIds.add(observation.deviceId);
    const key = [observation.deviceId, event.runId, event.sessionId, event.seq].join("|");
    if (seen.has(key)) {
      duplicateEvents += 1;
      continue;
    }
    seen.add(key);
    acceptedEvents += 1;

    if (event.v === 1) {
      v1Events += 1;
      v1DeviceIds.add(observation.deviceId);
    } else if (event.v === 2) {
      v2Events += 1;
    }
  }

  return {
    acceptedEvents,
    rejectedStructuredLines,
    duplicateEvents,
    activeDevices: activeDeviceIds.size,
    v1Events,
    v2Events,
    v1Devices: v1DeviceIds.size,
    activeV1EventRate: acceptedEvents === 0 ? 0 : v1Events / acceptedEvents,
    activeV1DeviceRate:
      activeDeviceIds.size === 0 ? 0 : v1DeviceIds.size / activeDeviceIds.size,
  };
}

/** Empty or rejected-only samples must never produce a false zero-rate PASS. */
function isV1SunsetReady(report: CompatReport): boolean {
  return (
    report.acceptedEvents > 0 &&
    report.activeDevices > 0 &&
    report.rejectedStructuredLines === 0 &&
    report.v1Events === 0 &&
    report.v1Devices === 0
  );
}

describe("Faz 8.1 Cockpit v1/v2 compatibility gate", () => {
  it("parses the current mobile v=1 envelope with every additive SDK key", () => {
    const raw = fixture("mobile-v1-additive.json");
    const producerShape = JSON.parse(raw) as Record<string, unknown>;
    const parsed = parseTestEventLine(logcat(raw));

    // These four keys are additive diagnostics. The current Cockpit parser does
    // not consume them, and must continue parsing the frozen fields around them.
    expect(producerShape).toMatchObject({
      v: 1,
      legacyAction: "DELIVER_PARCEL",
      legacyStatus: "SUCCESS",
      payloadVersion: 2,
      droppedSince: 3,
    });
    expect(parsed).toMatchObject({
      v: 1,
      runId: "run-faz8",
      sessionId: "session-v1",
      seq: 41,
      event: "DELIVERY_PERSISTED",
      action: "DELIVER_PARCEL",
      status: "SUCCESS",
      success: true,
      spanId: "span-41",
      parentSpanId: "span-40",
      data: { attempt: "2" },
    });
  });

  it("accepts both rollout shapes and blocks while any active v1 remains", () => {
    const report = measureCompat([
      { deviceId: "device-v1", line: logcat(fixture("mobile-v1-additive.json")) },
      { deviceId: "device-v2", line: logcat(fixture("mobile-v2-additive.json")) },
    ]);

    expect(report).toMatchObject({
      acceptedEvents: 2,
      rejectedStructuredLines: 0,
      activeDevices: 2,
      v1Events: 1,
      v2Events: 1,
      v1Devices: 1,
      activeV1EventRate: 0.5,
      activeV1DeviceRate: 0.5,
    });
    expect(isV1SunsetReady(report)).toBe(false);
  });

  it("opens only on a non-empty, parse-clean, deduplicated all-v2 sample", () => {
    const v2 = logcat(fixture("mobile-v2-additive.json"));
    const ready = measureCompat([
      { deviceId: "device-v2", line: v2 },
      { deviceId: "device-v2", line: v2 }, // logcat/WS replay of the same event
      // Explicitly deactivated by the operator's documented sunset decision.
      { deviceId: "retired-v1", line: logcat(fixture("mobile-v1-additive.json")), active: false },
    ]);

    expect(ready).toMatchObject({
      acceptedEvents: 1,
      rejectedStructuredLines: 0,
      duplicateEvents: 1,
      activeDevices: 1,
      v1Events: 0,
      v2Events: 1,
      v1Devices: 0,
      activeV1EventRate: 0,
      activeV1DeviceRate: 0,
    });
    expect(isV1SunsetReady(ready)).toBe(true);
    expect(isV1SunsetReady(measureCompat([]))).toBe(false);

    const rejected = measureCompat([
      { deviceId: "device-v2", line: v2 },
      { deviceId: "device-bad", line: "NESY_TEST_EVENT|not-json" },
    ]);
    expect(rejected.rejectedStructuredLines).toBe(1);
    expect(isV1SunsetReady(rejected)).toBe(false);
  });

  // Intentional opt-in for an operator-supplied telemetry export; this is a
  // test-only gate and is not part of a Turbo task's cacheable build inputs.
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const capturePath = process.env.VERDICT_V1_GATE_CAPTURE?.trim();
  // A NO_GO expectation lets a rollout owner apply a known-v1 lab/device
  // capture without turning the verification run red. It never authorizes a
  // parser delete: the default remains GO and the measured decision is printed.
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const expectedDecision = (process.env.VERDICT_V1_GATE_EXPECT?.trim() || "GO") as ExpectedGateDecision;
  if (expectedDecision !== "GO" && expectedDecision !== "NO_GO") {
    throw new Error(`VERDICT_V1_GATE_EXPECT must be GO or NO_GO, got: ${expectedDecision}`);
  }
  if (capturePath) {
    it(`measures the external active-device capture as ${expectedDecision}`, () => {
      expect(existsSync(capturePath), `capture does not exist: ${capturePath}`).toBe(true);
      const observations = readFileSync(capturePath, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line) as CompatObservation);
      const report = measureCompat(observations);
      const decision: ExpectedGateDecision = isV1SunsetReady(report) ? "GO" : "NO_GO";

      expect(report.rejectedStructuredLines).toBe(0);
      expect(decision, JSON.stringify(report)).toBe(expectedDecision);
    });
  } else {
    it.skip("external active-device capture (set VERDICT_V1_GATE_CAPTURE)", () => undefined);
  }
});
