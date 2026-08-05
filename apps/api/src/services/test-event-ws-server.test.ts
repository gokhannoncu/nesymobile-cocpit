import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeOrderedDurableEvidenceRow,
  HeartbeatLivenessStore,
  parseOrderedDurableEvent,
  routeIncomingWsFrame,
} from "./test-event-ws-server.js";
import { DurableBridgeFlowEvidenceIngest } from "./bridgeflow-durable-evidence-ingest.js";
import { BridgeFlowEvidenceRuntime } from "./bridgeflow-evidence-runtime.js";
import {
  EvidenceJourneyWriter,
  InMemoryEvidenceJourneyPersistence,
} from "./evidence-journey-writer.js";
import { StaticEvidenceSourceResolver } from "./evidence-source-resolver.js";
import { OracleEvaluationWorker } from "./oracle-evaluation-worker.js";

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

describe("ordered durable consumer parsing", () => {
  it("throws on a malformed ordered row so the cursor cannot mark it processed", () => {
    expect(() =>
      parseOrderedDurableEvent({
        runId: "run-malformed",
        sessionId: "session-malformed",
        seq: 7n,
        payload: {
          v: 2,
          runId: "run-malformed",
          sessionId: "session-malformed",
          event: "DELIVERY_PERSISTED",
          data: { occurrenceId: "occ-1" },
        },
        receivedAt: new Date(0),
        receiptDispatchedAt: null,
        processedAt: null,
        attempt: 0,
        lastError: null,
        nextRetryAt: null,
        deadLetteredAt: null,
      }),
    ).toThrow("malformed ordered durable event");
  });

  it("blocks immediately and after hydration when malformed parsing fails", async () => {
    const scope = {
      runId: "run-malformed",
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
    };
    const persistence = new InMemoryEvidenceJourneyPersistence();
    const persistRunBlock = persistence.persistRunBlock.bind(persistence);
    let releaseDurableWrite!: () => void;
    let markDurableWriteStarted!: () => void;
    const durableWriteStarted = new Promise<void>((resolve) => {
      markDurableWriteStarted = resolve;
    });
    const durableWriteRelease = new Promise<void>((resolve) => {
      releaseDurableWrite = resolve;
    });
    persistence.persistRunBlock = async (block) => {
      markDurableWriteStarted();
      await durableWriteRelease;
      await persistRunBlock(block);
    };
    const runtime = new BridgeFlowEvidenceRuntime();
    const resolver = new StaticEvidenceSourceResolver([]);
    const ingest = new DurableBridgeFlowEvidenceIngest({
      resolver,
      writer: new EvidenceJourneyWriter(persistence),
      runtime,
    });
    const row = {
      runId: scope.runId,
      sessionId: "session-malformed",
      seq: 7n,
      payload: {
        v: 2,
        runId: scope.runId,
        sessionId: "session-malformed",
        ts: 5,
        event: "DELIVERY_PERSISTED",
        taskId: "task-1",
        data: {
          occurrenceId: scope.occurrenceId,
          factValue: "true",
        },
      },
      receivedAt: new Date(0),
      receiptDispatchedAt: null,
      processedAt: null,
      attempt: 0,
      lastError: null,
      nextRetryAt: null,
      deadLetteredAt: null,
    };
    const positivePublication = {
      runId: scope.runId,
      revision: 1,
      lane: "ORDERED_REQUIRED" as const,
      correlationStatus: "CORRELATED" as const,
      trust: "RESOLVER_ACCEPTED" as const,
      fact: {
        factKey: "delivery.persisted",
        occurrenceId: scope.occurrenceId,
        iterationKey: scope.iterationKey,
        observedAtMs: 5,
        freshnessMaxAgeMs: 1_000,
        plane: "APP" as const,
        subtype: "sdk",
        value: true as const,
        authority: "PRIMARY" as const,
        deliveryLane: "ORDERED_REQUIRED" as const,
        rawEventId: "positive-before-poison",
        reducerTrace: ["trusted:test"],
      },
    };
    runtime.publish(positivePublication);

    const consuming = consumeOrderedDurableEvidenceRow(row, {
      evidence: ingest,
      onEvent: () => undefined,
    });
    const rejected = expect(consuming).rejects.toThrow("malformed ordered durable event");
    await durableWriteStarted;
    const blockWhileDurableWritePending = runtime.blockedState(scope);
    await expectFinalOracleBlocked(runtime, scope);
    releaseDurableWrite();
    await rejected;
    expect(blockWhileDurableWritePending).toMatchObject({
      reason: expect.stringContaining("malformed ordered durable event"),
    });
    expect(persistence.runBlocks).toHaveLength(1);

    const restarted = new BridgeFlowEvidenceRuntime();
    const restartedIngest = new DurableBridgeFlowEvidenceIngest({
      resolver,
      writer: new EvidenceJourneyWriter(persistence),
      runtime: restarted,
    });
    await restartedIngest.hydrate(scope);
    restarted.publish(positivePublication);
    await expectFinalOracleBlocked(restarted, scope);
  });

  it("forces the committed audit run block when malformed payload looks legacy", async () => {
    const scope = {
      runId: "run-malformed-legacy",
      occurrenceId: "occ-legacy",
      iterationKey: "iteration-legacy",
    };
    const persistence = new InMemoryEvidenceJourneyPersistence();
    const runtime = new BridgeFlowEvidenceRuntime();
    const resolver = new StaticEvidenceSourceResolver([]);
    const ingest = new DurableBridgeFlowEvidenceIngest({
      resolver,
      writer: new EvidenceJourneyWriter(persistence),
      runtime,
    });
    const positivePublication = {
      runId: scope.runId,
      revision: 1,
      lane: "ORDERED_REQUIRED" as const,
      correlationStatus: "CORRELATED" as const,
      trust: "RESOLVER_ACCEPTED" as const,
      fact: {
        factKey: "delivery.persisted",
        occurrenceId: scope.occurrenceId,
        iterationKey: scope.iterationKey,
        observedAtMs: 5,
        freshnessMaxAgeMs: 1_000,
        plane: "APP" as const,
        subtype: "sdk",
        value: true as const,
        authority: "PRIMARY" as const,
        deliveryLane: "ORDERED_REQUIRED" as const,
        rawEventId: "positive-before-legacy-poison",
        reducerTrace: ["trusted:test"],
      },
    };
    runtime.publish(positivePublication);

    await expect(
      consumeOrderedDurableEvidenceRow(
        {
          runId: scope.runId,
          sessionId: "session-malformed-legacy",
          seq: 8n,
          payload: {
            v: 2,
            runId: scope.runId,
            sessionId: "session-malformed-legacy",
            ts: 5,
            event: "LEGACY_EVENT",
            taskId: "task-1",
            data: {},
          },
          receivedAt: new Date(0),
          receiptDispatchedAt: null,
          processedAt: null,
          attempt: 0,
          lastError: null,
          nextRetryAt: null,
          deadLetteredAt: null,
        },
        { evidence: ingest, onEvent: () => undefined },
      ),
    ).rejects.toThrow("malformed ordered durable event");
    expect(runtime.blockedState(scope)).toMatchObject({
      reason: expect.stringContaining("malformed ordered durable event"),
    });
    expect(persistence.runBlocks).toHaveLength(1);
    await expectFinalOracleBlocked(runtime, scope);

    const restarted = new BridgeFlowEvidenceRuntime();
    const restartedIngest = new DurableBridgeFlowEvidenceIngest({
      resolver,
      writer: new EvidenceJourneyWriter(persistence),
      runtime: restarted,
    });
    await restartedIngest.hydrate(scope);
    restarted.publish(positivePublication);
    await expectFinalOracleBlocked(restarted, scope);
  });

  it("keeps a valid legacy no-correlation ordered row as a no-op", async () => {
    const persistence = new InMemoryEvidenceJourneyPersistence();
    const runtime = new BridgeFlowEvidenceRuntime();
    const ingest = new DurableBridgeFlowEvidenceIngest({
      resolver: new StaticEvidenceSourceResolver([]),
      writer: new EvidenceJourneyWriter(persistence),
      runtime,
    });
    const onEvent = vi.fn();

    await consumeOrderedDurableEvidenceRow(
      {
        runId: "run-valid-legacy",
        sessionId: "session-valid-legacy",
        seq: 9n,
        payload: {
          v: 2,
          runId: "run-valid-legacy",
          sessionId: "session-valid-legacy",
          seq: 9,
          ts: 5,
          event: "LEGACY_EVENT",
          taskId: "task-1",
          data: {},
        },
        receivedAt: new Date(0),
        receiptDispatchedAt: null,
        processedAt: null,
        attempt: 0,
        lastError: null,
        nextRetryAt: null,
        deadLetteredAt: null,
      },
      { evidence: ingest, onEvent },
    );

    expect(onEvent).toHaveBeenCalledOnce();
    expect(persistence.runBlocks).toHaveLength(0);
    expect(
      runtime.blockedState({
        runId: "run-valid-legacy",
        occurrenceId: "any",
        iterationKey: "root",
      }),
    ).toBeUndefined();
  });
});

async function expectFinalOracleBlocked(
  runtime: BridgeFlowEvidenceRuntime,
  scope: { runId: string; occurrenceId: string; iterationKey: string },
): Promise<void> {
  const result = await new OracleEvaluationWorker({
    runtime,
    clock: () => 10,
    persistence: {
      async loadOracleCheckpoint() {
        return { latestRevision: 0, lastEvidenceRevision: 0 };
      },
      async persistOracleRevision() {
        throw new Error("blocked evaluation must not persist");
      },
    },
  }).runFinalOracle({
    ...scope,
    startedAtMs: 0,
    policy: {
      requirements: [
        {
          factKey: "delivery.persisted",
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
      ],
    },
  });
  expect(result.status).toBe("BLOCKED");
}
