/**
 * ===========================================================================
 *  HOST waitEvent + the composed durable runtime  (plan C.14 / D.2 / B.5)
 *
 *  ## Why waiting lives here and not on the device
 *
 *  `waitEvent` is NOT an SDK command (C.14). A device-side wait would hold a
 *  thread or coroutine for the duration, tie the wait to the app process's
 *  survival, and produce no evidence at all if the app were killed mid-wait.
 *  Waiting is a durable host subscription: the state lives in the inbox and the
 *  cursor, so a host restart resumes it and an app restart is irrelevant to it.
 *
 *  ## Why lane routing is a single function
 *
 *  Because the dangerous mistake is a *routing* mistake. Both buses expose
 *  `waitEvent`, and calling the wrong one is silently wrong rather than loudly
 *  wrong: an `ORDERED_REQUIRED` fact answered off the receipt lane opens a gate
 *  on evidence that has not been ordered yet. One router, one place where the
 *  registry's declared lane decides, and both buses additionally refuse a lane
 *  they do not own.
 * ===========================================================================
 */
import type {
  DurableStreamScope,
  EvidenceDeliveryContract,
  EvidenceDeliveryLane,
  WaitEventRequest,
  WaitEventResult,
} from "@nesy/control-contract";

import {
  DurableSubscriberRegistry,
  PrismaDurableEventStore,
  ReceiptLatencyTracker,
  StreamNudgeHub,
  readDurableRuntimeHealth,
  answerEmitOutcomeDiagnostic,
  type DurableEventStore,
} from "./verdict-durable-runtime.js";
import { DurableReceiptBus } from "./verdict-receipt-bus.js";
import { OrderedEvidenceBus, type OrderedConsumer } from "./verdict-ordered-evidence-bus.js";

/** How many streams one bootstrap scan will pick up. */
const BOOTSTRAP_STREAM_LIMIT = 1_000;

/**
 * A registry validation, not a runtime convenience.
 *
 * An order-sensitive fact declared `RECEIPT_SAFE` is the one error in this phase
 * that produces no symptom until a verdict is wrong — so it is rejected at the
 * point the contract is read, before any subscriber exists.
 */
export function assertDeliveryContractSound(contract: EvidenceDeliveryContract): void {
  if (contract.lane === "ORDERED_REQUIRED" && !contract.orderingReason) {
    throw new Error(
      `fact ${contract.factKey} is ORDERED_REQUIRED without an orderingReason; ` +
        `an unexplained ordering requirement gets downgraded by the next reader`,
    );
  }
  if (contract.lane === "RECEIPT_SAFE" && contract.idempotencyKey === "DERIVATION_ID") {
    throw new Error(
      `fact ${contract.factKey} is RECEIPT_SAFE but keyed on DERIVATION_ID; ` +
        `the receipt lane can only dedupe on the committed inbox row identity`,
    );
  }
}

/**
 * The composed durable runtime: one store, one nudge hub, two lanes.
 *
 * A class rather than loose functions because the two lanes must share the
 * nudge hub and the subscriber registry. Separate hubs would mean a post-commit
 * nudge wakes one lane and not the other, and the un-nudged lane would silently
 * degrade to poll-interval latency — working, but not for the reason anyone
 * believes.
 */
export class VerdictDurableRuntime {
  readonly store: DurableEventStore;
  readonly nudges: StreamNudgeHub;
  readonly subscribers: DurableSubscriberRegistry;
  readonly latency: ReceiptLatencyTracker;
  readonly receipts: DurableReceiptBus;
  readonly ordered: OrderedEvidenceBus;

  constructor(options: { store: DurableEventStore; pollIntervalMs?: number; now?: () => Date }) {
    this.store = options.store;
    this.nudges = new StreamNudgeHub();
    this.subscribers = new DurableSubscriberRegistry();
    this.latency = new ReceiptLatencyTracker();
    this.receipts = new DurableReceiptBus({
      store: this.store,
      nudges: this.nudges,
      subscribers: this.subscribers,
      latency: this.latency,
      pollIntervalMs: options.pollIntervalMs,
      now: options.now,
    });
    this.ordered = new OrderedEvidenceBus({
      store: this.store,
      nudges: this.nudges,
      subscribers: this.subscribers,
      pollIntervalMs: options.pollIntervalMs,
      now: options.now,
    });
  }

  /**
   * Post-commit nudge for BOTH lanes.
   *
   * The receipt lane is nudged first, deliberately: it is the low-latency
   * readiness path, and the ordered drain may take a lease and run for a while.
   */
  nudge(scope: DurableStreamScope): void {
    this.receipts.nudge(scope);
    this.ordered.nudge(scope);
  }

  registerOrderedConsumer(consume: OrderedConsumer): () => void {
    return this.ordered.registerConsumer(consume);
  }

  /** Routes a wait to the lane the request declares. */
  waitEvent(request: WaitEventRequest): Promise<WaitEventResult> {
    return request.lane === "RECEIPT_SAFE"
      ? this.receipts.waitEvent(request)
      : this.ordered.waitEvent(request);
  }

  /**
   * Routes a wait using a registry contract rather than a caller-chosen lane.
   *
   * This is the form production code should use: the lane comes from the fact's
   * declared delivery contract, so a caller cannot pick the convenient lane.
   */
  waitForFact(
    contract: EvidenceDeliveryContract,
    request: Omit<WaitEventRequest, "lane">,
  ): Promise<WaitEventResult> {
    assertDeliveryContractSound(contract);
    return this.waitEvent({ ...request, lane: contract.lane });
  }

  health(scope?: DurableStreamScope, now?: Date) {
    return readDurableRuntimeHealth(this.store, this.subscribers, this.latency, scope, now);
  }

  /** Bounded, side-effect-free answer to the SDK's "was seq N really durable?". */
  emitOutcomeDiagnostic(runId: string, sessionId: string, throughSeq: string) {
    return answerEmitOutcomeDiagnostic(this.store, { runId, sessionId, throughSeq });
  }

  /** Marks a stream as no longer accepting evidence. Idempotent; first close wins. */
  async closeRun(scope: DurableStreamScope, reason: string): Promise<void> {
    await this.store.closeRun(scope, reason, new Date());
    // Drain the ordered lane now, then wake both durable lanes.
    //
    // A real-device repeat exposed the commit→close race this used to leave:
    // `SURFACE_ROUTE_DIALOG_READY` was already below the contiguous watermark,
    // the product verdict closed as PASS from session/local evidence, but the
    // ordered row stayed `processed_at = NULL`, so the evidence journey missed
    // the `ORDERED_REQUIRED/CORRELATION` record. Closing a run is the last
    // in-process chance to drain committed evidence for that stream. The drain
    // is awaited because the run detail endpoint can be read immediately after
    // `CLOSED`; an async-only nudge would keep the audit journey racey.
    let retryAsync = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const stats = await this.ordered.drainOnce(scope);
      if (stats.skippedLocked) {
        retryAsync = true;
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 25);
          if (typeof timer.unref === "function") timer.unref();
        });
        continue;
      }
      if (stats.error !== undefined || stats.retryScheduledFor !== undefined) break;
      if (stats.processed === 0) {
        retryAsync = false;
        break;
      }
    }
    if (retryAsync) this.ordered.nudge(scope);
    this.nudge(scope);
  }

  /**
   * Restart recovery.
   *
   * This is the answer to the crash window the whole phase is about: the process
   * committed a row, then died before nudging. Nothing in memory remembers it —
   * but `receipt_dispatched_at IS NULL` and `processed_at IS NULL` do, so the
   * scan is a query over persisted state rather than a replay of lost
   * intentions. Idempotent by construction: re-nudging a stream whose rows are
   * already dispatched finds nothing to do.
   */
  async bootstrap(): Promise<{ receiptStreams: number; orderedStreams: number }> {
    const [receiptStreams, orderedStreams] = await Promise.all([
      this.store.listStreamsWithPendingReceipt(BOOTSTRAP_STREAM_LIMIT),
      this.store.listStreamsWithPendingOrdered(BOOTSTRAP_STREAM_LIMIT),
    ]);

    // De-duplicated: a stream pending in both lanes must be nudged once, not
    // twice — the nudge is idempotent, but double-counting it in the log would
    // misreport how much work the restart actually found.
    const seen = new Set<string>();
    for (const scope of [...receiptStreams, ...orderedStreams]) {
      const key = `${scope.runId} ${scope.sessionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      this.nudge(scope);
    }

    if (seen.size > 0) {
      console.log(
        `[VerdictDurableRuntime] restart scan resumed ${seen.size} stream(s) ` +
          `(receipt-pending=${receiptStreams.length}, ordered-pending=${orderedStreams.length})`,
      );
    }
    return { receiptStreams: receiptStreams.length, orderedStreams: orderedStreams.length };
  }
}

/**
 * Process-wide runtime, created lazily.
 *
 * Lazy because constructing it touches the Prisma client, and the unit suite
 * must be able to import this module — for `assertDeliveryContractSound` and the
 * lane router — without a database anywhere in sight.
 */
let runtime: VerdictDurableRuntime | null = null;

export function getVerdictDurableRuntime(): VerdictDurableRuntime {
  runtime ??= new VerdictDurableRuntime({ store: new PrismaDurableEventStore() });
  return runtime;
}

/** Test seam: swap the process-wide runtime. Never called by production code. */
export function setVerdictDurableRuntimeForTests(next: VerdictDurableRuntime | null): void {
  runtime = next;
}

export type { EvidenceDeliveryLane };
