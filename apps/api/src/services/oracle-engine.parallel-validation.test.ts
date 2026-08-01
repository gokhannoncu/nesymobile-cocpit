/**
 * FAZ 8.0 parallel-validation gate.
 *
 * During the mobile dual-emit window, one business occurrence is visible as
 * both a NESY_AUTO_BRIDGE line and a structured NESY_TEST_EVENT frame. This
 * suite parses the legacy half as an independent reference, feeds only the
 * structured half to the production OracleEngine, and compares the resulting
 * node evidence + verdict. Detail strings are deliberately excluded: transport
 * wording may change, while oracle kind/status and completion must not.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogcatSniffer, parseLogcatLine, type LogcatEvent } from "./logcat-sniffer.js";
import type { TestBridgeEvent } from "./test-event-bridge.js";

const db = vi.hoisted(() => ({
  updateMany: vi.fn(async () => ({ count: 1 })),
}));

vi.mock("@nesy/db", () => ({
  prisma: {
    workflowStepResult: {
      updateMany: db.updateMany,
    },
  },
}));

import { OracleEngine, type OracleEvidence, type OracleKind } from "./oracle-engine.js";

type EvidenceStatus = OracleEvidence["status"];

interface NodeSpec {
  type: string;
  required: OracleKind[];
}

interface EventPair {
  legacy: string;
  structured: TestBridgeEvent;
}

interface ParallelFixture {
  channel: string;
  nodes: NodeSpec[];
  pairs: EventPair[];
  /** device_error predates the frozen 12-action contract and fails all running nodes directly. */
  globalFailure?: true;
}

interface VerdictSnapshot {
  complete: boolean;
  failed: boolean;
  missing: OracleKind[];
  failedOracles: OracleKind[];
}

interface EngineInternals {
  evidence: Map<string, Map<OracleKind, OracleEvidence>>;
  verdict(nodeId: string): VerdictSnapshot;
}

const idFor = (type: string) => `node-${type}`;

function legacyLine(
  action: string,
  status: string,
  taskId: string,
  data: Record<string, string> = {},
): string {
  return (
    `01-01 00:00:00.000 D/NESY_AUTO_BRIDGE( 1234): ` +
    `ACTION: ${action} | STATUS: ${status} | TASK_ID: ${taskId} | DATA: ${JSON.stringify(data)}`
  );
}

let seq = 0;

function structured(
  event: string,
  action: string | undefined,
  success: boolean,
  taskId: string,
  data: Record<string, string> = {},
): TestBridgeEvent {
  seq += 1;
  return {
    v: 1,
    runId: "run-parallel",
    sessionId: "session-parallel",
    seq,
    ts: 1_789_000_000_000 + seq,
    monoTs: 100_000 + seq,
    screen: "FixtureScreen",
    event,
    action,
    taskId,
    success,
    data,
    raw: `NESY_TEST_EVENT|fixture-${seq}`,
  };
}

const fixtures: ParallelFixture[] = [
  {
    channel: "verify",
    nodes: [{ type: "VERIFY_BACKEND_STATE", required: ["backend"] }],
    pairs: [{
      legacy: legacyLine("VERIFY_BACKEND", "SUCCESS", "request-42"),
      structured: structured("LEGACY", "VERIFY_BACKEND", true, "request-42"),
    }],
  },
  {
    channel: "validate_stoplist",
    nodes: [{ type: "VALIDATE_STOPLIST", required: ["mobileEvent"] }],
    pairs: [{
      legacy: legacyLine("VALIDATE_STOPLIST", "SUCCESS", "", { item_count: "0" }),
      structured: structured("LEGACY", "VALIDATE_STOPLIST", true, "", { item_count: "0" }),
    }],
  },
  {
    channel: "request_tour_start",
    nodes: [{ type: "REQUEST_TOUR_START", required: ["mobileEvent"] }],
    pairs: [{
      legacy: legacyLine("REQUEST_TOUR_START", "SUCCESS", "tour-7"),
      structured: structured("LEGACY", "REQUEST_TOUR_START", true, "tour-7"),
    }],
  },
  {
    channel: "deliver_parcel",
    nodes: [{ type: "DELIVERY_OPERATION", required: ["mobileEvent", "backend"] }],
    pairs: [
      {
        legacy: legacyLine("DELIVER_PARCEL", "SUCCESS", "parcel-1", { step: "COMPLETED" }),
        structured: structured(
          "DELIVERY_UI_COMPLETED",
          "DELIVER_PARCEL",
          true,
          "parcel-1",
          { step: "COMPLETED" },
        ),
      },
      {
        legacy: legacyLine("DELIVER_PARCEL", "SUCCESS", "parcel-1", { step: "BACKEND_CONFIRMED" }),
        structured: structured(
          "DELIVERY_RESPONSE_RECEIVED",
          "DELIVER_PARCEL",
          true,
          "parcel-1",
          { step: "BACKEND_CONFIRMED" },
        ),
      },
    ],
  },
  {
    channel: "scan_parcel",
    nodes: [{ type: "SCAN_BARCODE", required: ["mobileEvent"] }],
    pairs: [{
      legacy: legacyLine("SCAN_PARCEL", "ERROR", "parcel-bad"),
      structured: structured("PARCEL_SCANNED", "SCAN_PARCEL", false, "parcel-bad"),
    }],
  },
  {
    channel: "load_to_vehicle",
    nodes: [{ type: "LOAD_TO_VEHICLE", required: ["mobileEvent"] }],
    pairs: ["FETCH_SHIPMENT", "CREATE_TASK", "FETCH_SCHEDULE"].map((step) => ({
      legacy: legacyLine("LOAD_TO_VEHICLE", "SUCCESS", "parcel-load", { step }),
      structured: structured("VEHICLE_LOADING_STEP", "LOAD_TO_VEHICLE", true, "parcel-load", { step }),
    })),
  },
  {
    channel: "search_stop",
    nodes: [
      { type: "OPEN_SHIPMENT", required: ["mobileEvent"] },
      { type: "OPEN_PARCEL", required: ["mobileEvent"] },
    ],
    pairs: [{
      legacy: legacyLine("SEARCH_STOP", "ERROR", "missing-stop"),
      structured: structured("LEGACY", "SEARCH_STOP", false, "missing-stop"),
    }],
  },
  {
    channel: "open_stop",
    nodes: [
      { type: "OPEN_SHIPMENT", required: ["mobileEvent"] },
      { type: "OPEN_PARCEL", required: ["mobileEvent"] },
    ],
    pairs: [{
      legacy: legacyLine("OPEN_STOP", "SUCCESS", "stop-80"),
      structured: structured("LEGACY", "OPEN_STOP", true, "stop-80"),
    }],
  },
  {
    channel: "device_error",
    nodes: [{ type: "OPEN_PARCEL", required: ["mobileEvent"] }],
    globalFailure: true,
    pairs: [{
      // Historical sniffer branch; ERROR is not one of A.4.1's frozen 12 actions.
      legacy: legacyLine("ERROR", "ERROR", "", { message: "forced logout" }),
      structured: structured("UNEXPECTED_SCREEN", undefined, false, "", {
        reason: "forced_logout",
        detail: "forced logout",
      }),
    }],
  },
];

function statusFromLegacy(status: string): EvidenceStatus | null {
  if (status === "SUCCESS") return "passed";
  if (status === "FAIL" || status === "FAILED" || status === "ERROR") return "failed";
  return null;
}

/** Minimal, transport-independent model of the pre-8.0 legacy handlers. */
class LegacyReferenceOracle {
  readonly evidence = new Map<string, Map<OracleKind, EvidenceStatus>>();
  globalFailure = false;
  private readonly loadSteps = new Map<string, Map<string, string>>();

  constructor(private readonly nodeTypes: string[]) {}

  consume(event: LogcatEvent): void {
    const status = statusFromLegacy(event.status);
    switch (event.action) {
      case "VERIFY_BACKEND":
        if (status === "passed") this.record(["VERIFY_BACKEND_STATE"], "backend", "passed");
        return;
      case "VALIDATE_STOPLIST":
        if (status) this.record(["VALIDATE_STOPLIST"], "mobileEvent", status);
        return;
      case "REQUEST_TOUR_START":
        if (status) this.record(["REQUEST_TOUR_START"], "mobileEvent", status);
        return;
      case "DELIVER_PARCEL": {
        const step = event.data?.step;
        if (step === "COMPLETED") {
          this.record(["DELIVERY_OPERATION"], "mobileEvent", "passed");
        } else if (step === "BACKEND_CONFIRMED") {
          this.record(["DELIVERY_OPERATION"], "backend", "passed");
        } else if (step === "BACKEND_FAILED") {
          this.record(["DELIVERY_OPERATION"], "backend", "failed");
        } else if (step !== "BACKEND_RETRY" && status === "passed") {
          this.record(["DELIVERY_OPERATION"], "mobileEvent", "passed");
          this.record(["DELIVERY_OPERATION"], "backend", "passed");
        } else if (step !== "BACKEND_RETRY" && status === "failed") {
          this.record(["DELIVERY_OPERATION"], "mobileEvent", "failed");
        }
        return;
      }
      case "SCAN_PARCEL":
        if (status) this.record(["SCAN_BARCODE"], "mobileEvent", status);
        return;
      case "LOAD_TO_VEHICLE": {
        const step = event.data?.step;
        if (!step || !status) return;
        const steps = this.loadSteps.get(event.taskId ?? "unknown") ?? new Map<string, string>();
        steps.set(String(step), event.status);
        this.loadSteps.set(event.taskId ?? "unknown", steps);
        const required = ["FETCH_SHIPMENT", "CREATE_TASK", "FETCH_SCHEDULE"];
        if (required.every((name) => steps.has(name))) {
          const result = required.every((name) => steps.get(name) === "SUCCESS") ? "passed" : "failed";
          this.record(["LOAD_TO_VEHICLE"], "mobileEvent", result);
        }
        return;
      }
      case "SEARCH_STOP":
        if (status === "failed") {
          this.record(["OPEN_SHIPMENT", "OPEN_PARCEL"], "mobileEvent", "failed");
        }
        return;
      case "OPEN_STOP":
        if (status === "passed") {
          this.record(["OPEN_SHIPMENT", "OPEN_PARCEL"], "mobileEvent", "passed");
        }
        return;
      case "ERROR":
        this.globalFailure = true;
    }
  }

  private record(types: string[], oracle: OracleKind, status: EvidenceStatus): void {
    for (const type of types) {
      if (!this.nodeTypes.includes(type)) continue;
      const nodeId = idFor(type);
      const byOracle = this.evidence.get(nodeId) ?? new Map<OracleKind, EvidenceStatus>();
      byOracle.set(oracle, status);
      this.evidence.set(nodeId, byOracle);
    }
  }
}

function referenceVerdict(
  required: OracleKind[],
  evidence: Map<OracleKind, EvidenceStatus> | undefined,
): VerdictSnapshot {
  const failedOracles = required.filter((kind) => evidence?.get(kind) === "failed");
  const missing = required.filter((kind) => {
    const status = evidence?.get(kind);
    return status !== "passed" && status !== "failed";
  });
  return {
    complete: missing.length === 0,
    failed: failedOracles.length > 0,
    missing,
    failedOracles,
  };
}

function evidenceStatuses(
  evidence: Map<OracleKind, OracleEvidence> | undefined,
): Map<OracleKind, EvidenceStatus> {
  return new Map([...(evidence ?? new Map()).entries()].map(([kind, item]) => [kind, item.status]));
}

async function feedStructured(engine: OracleEngine, events: TestBridgeEvent[]): Promise<void> {
  const sniffer = new LogcatSniffer({ runId: "run-parallel" });
  engine.attach((name, handler) => {
    sniffer.on(name, handler as unknown as (event: TestBridgeEvent) => void);
  });
  for (const event of events) {
    // Production entry point: runId filter + dedupe + structured wire fan-out.
    sniffer.injectTestEvent(event);
    // EventEmitter intentionally does not await listeners; let their DB promises drain.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

describe("FAZ 8.0 legacy/structured oracle parity", () => {
  beforeEach(() => {
    db.updateMany.mockClear();
  });

  it("covers the nine legacy oracle channels exactly once", () => {
    expect(fixtures.map((fixture) => fixture.channel)).toEqual([
      "verify",
      "validate_stoplist",
      "request_tour_start",
      "deliver_parcel",
      "scan_parcel",
      "load_to_vehicle",
      "search_stop",
      "open_stop",
      "device_error",
    ]);
  });

  it.each(fixtures)("$channel: paired occurrence produces the same node verdict", async (fixture) => {
    const parsedLegacy = fixture.pairs.map(({ legacy, structured: structuredEvent }) => {
      const parsed = parseLogcatLine(legacy);
      expect(parsed, `legacy fixture must parse: ${legacy}`).not.toBeNull();
      if (!parsed) throw new Error("legacy fixture did not parse");

      expect(structuredEvent.success).toBe(parsed.status === "SUCCESS");
      if (structuredEvent.action) expect(structuredEvent.action).toBe(parsed.action);
      if (structuredEvent.event !== "UNEXPECTED_SCREEN") {
        expect(structuredEvent.taskId).toBe(parsed.taskId);
        expect(structuredEvent.data ?? {}).toEqual(parsed.data ?? {});
      }
      return parsed;
    });

    const reference = new LegacyReferenceOracle(fixture.nodes.map((node) => node.type));
    for (const event of parsedLegacy) reference.consume(event);

    const nodes = fixture.nodes.map((node) => ({
      id: idFor(node.type),
      type: node.type,
      data: { config: { completionPolicy: { required: node.required } } },
    }));
    const engine = new OracleEngine(`run-${fixture.channel}`, nodes);
    await feedStructured(engine, fixture.pairs.map((pair) => pair.structured));

    if (fixture.globalFailure) {
      expect(reference.globalFailure).toBe(true);
      expect(db.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: "running" }),
        data: expect.objectContaining({ status: "failed" }),
      }));
      return;
    }

    const internals = engine as unknown as EngineInternals;
    for (const node of fixture.nodes) {
      const nodeId = idFor(node.type);
      const expectedEvidence = reference.evidence.get(nodeId) ?? new Map();
      expect(evidenceStatuses(internals.evidence.get(nodeId))).toEqual(expectedEvidence);

      const expectedVerdict = referenceVerdict(node.required, expectedEvidence);
      expect(internals.verdict(nodeId)).toEqual(expectedVerdict);

      const nodeWrites = db.updateMany.mock.calls
        .map(([input]) => input as { where?: { nodeId?: string }; data?: { status?: string } })
        .filter((input) => input.where?.nodeId === nodeId);
      expect(nodeWrites.at(-1)?.data?.status).toBe(expectedVerdict.failed ? "failed" : "success");
    }
  });
});
