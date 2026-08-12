import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'
import { describe, expect, it } from 'vitest'

import {
  BridgeFlowEvidenceRuntime,
} from './bridgeflow-evidence-runtime.js'
import {
  StaticEvidenceSourceResolver,
  resolveBridgeFlowDurableEvent,
} from './evidence-source-resolver.js'

const accepted = {
  correlationStatus: 'CORRELATED' as const,
  trust: 'RESOLVER_ACCEPTED' as const,
}

const fact = (
  overrides: Partial<NormalizedEvidenceFact> = {},
): NormalizedEvidenceFact => ({
  factKey: 'delivery.persisted',
  occurrenceId: 'occ-1',
  iterationKey: 'iteration-1',
  observedAtMs: 100,
  freshnessMaxAgeMs: 1_000,
  plane: 'APP',
  subtype: 'sdk',
  value: true,
  authority: 'PRIMARY',
  deliveryLane: 'RECEIPT_SAFE',
  rawEventId: 'event-1',
  reducerTrace: ['sdk-event'],
  ...overrides,
})

describe('BridgeFlowEvidenceRuntime', () => {
  it('filters wrong iteration and stale facts before evaluation', () => {
    // Staleness is judged when the fact is ACCEPTED, so the clock has to sit on
    // the same synthetic timeline as `observedAtMs` for this to mean anything.
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => 100 })
    runtime.publish({
      runId: 'run-1',
      fact: fact(),
      revision: 1,
      lane: 'RECEIPT_SAFE',
      ...accepted,
    })
    runtime.publish({
      runId: 'run-1',
      fact: fact({ iterationKey: 'iteration-2', rawEventId: 'event-2' }),
      revision: 2,
      lane: 'RECEIPT_SAFE',
      ...accepted,
    })
    runtime.publish({
      runId: 'run-1',
      fact: fact({ observedAtMs: 0, freshnessMaxAgeMs: 10, rawEventId: 'event-3' }),
      revision: 3,
      lane: 'ORDERED_REQUIRED',
      ...accepted,
    })
    runtime.publish({
      runId: 'run-1',
      fact: fact({ rawEventId: 'event-4' }),
      revision: 4,
      lane: 'ORDERED_REQUIRED',
      correlationStatus: 'MISMATCH',
      trust: 'RESOLVER_ACCEPTED',
    })

    expect(
      runtime.currentFacts(
        { runId: 'run-1', occurrenceId: 'occ-1', iterationKey: 'iteration-1' },
        200,
      ),
    ).toEqual([fact()])
  })

  it('keeps an accepted fact readable after its freshness window elapses', () => {
    // The device measurement behind this: a request event satisfied its continue
    // gate, an optional 120s push wait ran, and by the time the final oracle
    // asked, the event had aged out of its own occurrence. Every REQUIRED fact
    // reported REQUIRED_TIMEOUT while every producing step had SUCCEEDED.
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => 100 })
    const scope = { runId: 'run-1', occurrenceId: 'occ-1', iterationKey: 'iteration-1' }
    runtime.publish({
      runId: 'run-1',
      fact: fact({ observedAtMs: 100, freshnessMaxAgeMs: 1_000 }),
      revision: 1,
      lane: 'ORDERED_REQUIRED',
      ...accepted,
    })

    // Read well beyond the window. Nothing about the observation changed.
    expect(runtime.currentFacts(scope, 500_000)).toHaveLength(1)
  })

  it('still refuses an observation that was already stale when offered', () => {
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => 10_000 })
    const scope = { runId: 'run-1', occurrenceId: 'occ-1', iterationKey: 'iteration-1' }
    runtime.publish({
      runId: 'run-1',
      // Observed 10 seconds ago under a 1 second window: too old to enter.
      fact: fact({ observedAtMs: 0, freshnessMaxAgeMs: 1_000 }),
      revision: 1,
      lane: 'ORDERED_REQUIRED',
      ...accepted,
    })

    expect(runtime.currentFacts(scope, 10_000)).toEqual([])
  })

  it('tags receipt-safe wakeups separately from ordered authority', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const scope = { runId: 'run-1', occurrenceId: 'occ-1', iterationKey: 'iteration-1' }
    const waiting = runtime.waitForRevision({
      scope,
      afterRevision: 0,
      deadlineAtMs: Date.now() + 1_000,
    })

    runtime.publish({
      runId: 'run-1',
      fact: fact(),
      revision: 1,
      lane: 'RECEIPT_SAFE',
      ...accepted,
    })

    await expect(waiting).resolves.toMatchObject({
      status: 'EVIDENCE',
      revision: 1,
      lane: 'RECEIPT_SAFE',
    })
    expect(runtime.currentFacts(scope, 200, 'ORDERED_REQUIRED')).toEqual([])
  })

  it('bounds subscriptions by deadline and cancellation', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const scope = { runId: 'run-1', occurrenceId: 'occ-1', iterationKey: 'iteration-1' }
    await expect(
      runtime.waitForRevision({ scope, afterRevision: 0, deadlineAtMs: Date.now() }),
    ).resolves.toEqual({ status: 'TIMEOUT' })

    const controller = new AbortController()
    controller.abort()
    await expect(
      runtime.waitForRevision({
        scope,
        afterRevision: 0,
        deadlineAtMs: Date.now() + 1_000,
        signal: controller.signal,
      }),
    ).resolves.toEqual({ status: 'CANCELLED' })
  })

  it('ignores durable events without BridgeFlow correlation context', () => {
    const runtime = new BridgeFlowEvidenceRuntime()

    expect(
      resolveBridgeFlowDurableEvent(
        {
          runId: 'run-1',
          sessionId: 'session-1',
          seq: 1,
          ts: 100,
          event: 'DELIVERY_PERSISTED',
          taskId: 'task-1',
          data: {},
        },
        'RECEIPT_SAFE',
        new StaticEvidenceSourceResolver([]),
        {
          runId: 'run-1',
          sessionId: 'session-1',
          seq: '1',
          rawEventRef: 'durable:run-1:session-1:1',
        },
      ),
    ).toEqual({ status: 'LEGACY_NO_CONTEXT' })
    expect(runtime.currentFacts(
      { runId: 'run-1', occurrenceId: 'occ-1', iterationKey: 'iteration-1' },
      100,
    )).toEqual([])
  })
})
