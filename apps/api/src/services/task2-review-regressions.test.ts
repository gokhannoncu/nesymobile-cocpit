import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'
import { describe, expect, it } from 'vitest'

import {
  StaticEvidenceSourceResolver,
  resolveBridgeFlowDurableEvent,
} from './evidence-source-resolver.js'
import {
  BridgeFlowEvidenceRuntime,
  type EvidencePublication,
} from './bridgeflow-evidence-runtime.js'
import {
  EvidenceJourneyWriter,
  InMemoryEvidenceJourneyPersistence,
  hydrateEvidenceScope,
} from './evidence-journey-writer.js'
import { DurableBridgeFlowEvidenceIngest } from './bridgeflow-durable-evidence-ingest.js'
import {
  OracleEvaluationWorker,
  type OracleRevisionPersistencePort,
} from './oracle-evaluation-worker.js'

const scope = {
  runId: 'run-1',
  occurrenceId: 'occ-1',
  iterationKey: 'iteration-1',
}

const resolver = new StaticEvidenceSourceResolver([
  {
    sourceEvent: 'DELIVERY_PERSISTED',
    factKey: 'delivery.persisted',
    plane: 'APP',
    subtype: 'sdk',
    authority: 'CONFIRMATORY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: 1_000,
    valueField: 'factValue',
  },
])

function rawEvent(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    sessionId: 'session-1',
    ts: 100,
    event: 'DELIVERY_PERSISTED',
    taskId: 'task-1',
    data: {
      occurrenceId: 'occ-1',
      iterationKey: 'iteration-1',
      factValue: 'true',
    },
    ...overrides,
  }
}

const audit = {
  runId: 'run-1',
  sessionId: 'session-1',
  seq: '9223372036854775807',
  rawEventRef: 'durable:run-1:session-1:9223372036854775807',
}

function fact(
  lane: 'RECEIPT_SAFE' | 'ORDERED_REQUIRED',
  overrides: Partial<NormalizedEvidenceFact> = {},
): NormalizedEvidenceFact {
  return {
    factKey: 'delivery.persisted',
    occurrenceId: scope.occurrenceId,
    iterationKey: scope.iterationKey,
    observedAtMs: 100,
    freshnessMaxAgeMs: 10_000,
    plane: 'APP',
    subtype: 'sdk',
    value: true,
    authority: 'CONFIRMATORY',
    deliveryLane: lane,
    rawEventId: 'event-1',
    reducerTrace: ['trusted:DELIVERY_PERSISTED'],
    ...overrides,
  }
}

function publication(
  revision: number,
  lane: 'RECEIPT_SAFE' | 'ORDERED_REQUIRED',
  overrides: Partial<NormalizedEvidenceFact> = {},
): EvidencePublication {
  return {
    runId: scope.runId,
    fact: fact(lane, overrides),
    revision,
    lane,
    correlationStatus: 'CORRELATED',
    trust: 'RESOLVER_ACCEPTED',
  }
}

describe('Task 2 reviewer regressions', () => {
  it('derives fact identity and authority only from a trusted source definition', () => {
    const accepted = resolveBridgeFlowDurableEvent(
      rawEvent(),
      'ORDERED_REQUIRED',
      resolver,
      audit,
    )
    expect(accepted).toMatchObject({
      status: 'ACCEPTED',
      publication: {
        trust: 'RESOLVER_ACCEPTED',
        fact: {
          factKey: 'delivery.persisted',
          plane: 'APP',
          subtype: 'sdk',
          authority: 'CONFIRMATORY',
        },
      },
    })

    expect(
      resolveBridgeFlowDurableEvent(
        rawEvent({
          data: {
            occurrenceId: 'occ-1',
            iterationKey: 'iteration-1',
            factValue: 'true',
            authority: 'PRIMARY',
          },
        }),
        'ORDERED_REQUIRED',
        resolver,
        audit,
      ),
    ).toMatchObject({ status: 'REJECTED', blocking: true })
    expect(
      resolveBridgeFlowDurableEvent(
        rawEvent({ event: 'UNKNOWN_SOURCE' }),
        'ORDERED_REQUIRED',
        resolver,
        audit,
      ),
    ).toMatchObject({ status: 'REJECTED', blocking: true })
  })

  it('distinguishes legacy no-context from malformed partial correlation without throwing', () => {
    expect(
      resolveBridgeFlowDurableEvent(rawEvent({ data: {} }), 'RECEIPT_SAFE', resolver, audit),
    ).toEqual({ status: 'LEGACY_NO_CONTEXT' })
    expect(() =>
      resolveBridgeFlowDurableEvent(
        rawEvent({ data: { occurrenceId: 'occ-1' } }),
        'ORDERED_REQUIRED',
        resolver,
        audit,
      ),
    ).not.toThrow()
    expect(
      resolveBridgeFlowDurableEvent(
        rawEvent({ data: { occurrenceId: 'occ-1' } }),
        'ORDERED_REQUIRED',
        resolver,
        audit,
      ),
    ).toMatchObject({ status: 'REJECTED', blocking: true, runId: 'run-1' })
  })

  it('rejects non-finite timestamps, invalid confidence, and identity mismatch', () => {
    expect(
      resolveBridgeFlowDurableEvent(
        rawEvent({ ts: Number.POSITIVE_INFINITY }),
        'ORDERED_REQUIRED',
        resolver,
        audit,
      ),
    ).toMatchObject({ status: 'REJECTED' })
    expect(
      resolveBridgeFlowDurableEvent(
        rawEvent({
          data: {
            occurrenceId: 'occ-1',
            iterationKey: 'iteration-1',
            factValue: 'true',
            confidence: '1.1',
          },
        }),
        'ORDERED_REQUIRED',
        resolver,
        audit,
      ),
    ).toMatchObject({ status: 'REJECTED' })
    expect(
      resolveBridgeFlowDurableEvent(
        rawEvent({ runId: 'spoofed-run' }),
        'ORDERED_REQUIRED',
        resolver,
        audit,
      ),
    ).toMatchObject({ status: 'REJECTED' })
  })

  it('allocates bounded logical revisions independent of 64-bit inbox seq and replays idempotently', async () => {
    const persistence = new InMemoryEvidenceJourneyPersistence()
    const writer = new EvidenceJourneyWriter(persistence)
    const resolved = resolveBridgeFlowDurableEvent(
      rawEvent(),
      'ORDERED_REQUIRED',
      resolver,
      audit,
    )
    expect(resolved.status).toBe('ACCEPTED')
    if (resolved.status !== 'ACCEPTED') return

    const first = await writer.writeResolved(resolved)
    const replay = await writer.writeResolved(resolved)
    const later = await writer.writeResolved({
      ...resolved,
      audit: {
        ...resolved.audit,
        seq: '9223372036854775808',
        rawEventRef: 'durable:run-1:session-1:9223372036854775808',
      },
    })

    expect([first.revision, replay.revision, later.revision]).toEqual([1, 1, 2])
    expect(persistence.rows).toHaveLength(2)
    expect(persistence.rows.every((row) => row.revision <= 2_147_483_647)).toBe(true)
  })

  it('hydrates trusted persisted facts after a publish crash and filters mismatched hydration', async () => {
    const persistence = new InMemoryEvidenceJourneyPersistence()
    const writer = new EvidenceJourneyWriter(persistence)
    const resolved = resolveBridgeFlowDurableEvent(
      rawEvent(),
      'ORDERED_REQUIRED',
      resolver,
      audit,
    )
    if (resolved.status !== 'ACCEPTED') throw new Error('fixture must resolve')
    await writer.writeResolved(resolved)

    const restarted = new BridgeFlowEvidenceRuntime()
    restarted.hydrate([
      ...(await persistence.loadEvidenceScope(scope)),
      { ...publication(9, 'ORDERED_REQUIRED'), correlationStatus: 'MISMATCH' },
    ])

    expect(restarted.currentFacts(scope, 200, 'ORDERED_REQUIRED')).toEqual([
      expect.objectContaining({ factKey: 'delivery.persisted', authority: 'CONFIRMATORY' }),
    ])
    const anotherRestart = new BridgeFlowEvidenceRuntime()
    await hydrateEvidenceScope(scope, persistence, anotherRestart)
    expect(anotherRestart.latestRevision(scope, 'ORDERED_REQUIRED')).toBe(1)
  })

  it('persists before publication and converts ordered poison into a runtime block', async () => {
    const persistence = new InMemoryEvidenceJourneyPersistence()
    const runtime = new BridgeFlowEvidenceRuntime()
    const ingest = new DurableBridgeFlowEvidenceIngest({
      resolver,
      writer: new EvidenceJourneyWriter(persistence),
      runtime,
    })

    const prepared = await ingest.persist(rawEvent(), 'ORDERED_REQUIRED', audit)
    expect(prepared.status).toBe('ACCEPTED')
    expect(runtime.latestRevision(scope, 'ORDERED_REQUIRED')).toBe(0)
    if (prepared.status !== 'ACCEPTED') return
    ingest.publish(prepared)
    expect(runtime.latestRevision(scope, 'ORDERED_REQUIRED')).toBe(1)

    ingest.observeOrderedBlock(rawEvent(), audit, 'ordered dead-letter poison')
    expect(runtime.blockedState(scope)).toMatchObject({
      reason: 'ordered dead-letter poison',
    })
  })

  it('gives deadline and cancellation precedence over already-ready evidence', async () => {
    let now = 100
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => now })
    runtime.publish(publication(1, 'ORDERED_REQUIRED'))
    await expect(
      runtime.waitForRevision({
        scope,
        afterRevision: 0,
        deadlineAtMs: 100,
        lane: 'ORDERED_REQUIRED',
      }),
    ).resolves.toEqual({ status: 'TIMEOUT' })

    const controller = new AbortController()
    const racingSignal = {
      get aborted() {
        return controller.signal.aborted
      },
      addEventListener(...args: Parameters<AbortSignal['addEventListener']>) {
        controller.abort()
        controller.signal.addEventListener(...args)
      },
      removeEventListener: controller.signal.removeEventListener.bind(controller.signal),
    } as AbortSignal
    now = 0
    await expect(
      runtime.waitForRevision({
        scope,
        afterRevision: 1,
        deadlineAtMs: 1_000,
        signal: racingSignal,
      }),
    ).resolves.toEqual({ status: 'CANCELLED' })
  })

  it('closes listeners and lets orchestration evict completed scope state', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const ingest = new DurableBridgeFlowEvidenceIngest({
      resolver,
      writer: new EvidenceJourneyWriter(new InMemoryEvidenceJourneyPersistence()),
      runtime,
    })
    runtime.publish(publication(1, 'RECEIPT_SAFE'))
    runtime.publish({
      ...publication(1, 'RECEIPT_SAFE'),
      runId: 'run-10',
    })
    const waiting = runtime.waitForRevision({
      scope,
      afterRevision: 1,
      deadlineAtMs: Date.now() + 1_000,
    })
    ingest.closeScope(scope, 'occurrence completed')
    await expect(waiting).resolves.toMatchObject({ status: 'CLOSED' })
    expect(runtime.scopeStats(scope)).toMatchObject({ listeners: 0, publications: 1, closed: true })
    expect(() => runtime.publish(publication(2, 'RECEIPT_SAFE'))).toThrow(
      'evidence scope is closed',
    )

    runtime.blockRun(scope.runId, { revision: 2, reason: 'run block' })
    ingest.evictScope(scope)
    expect(runtime.scopeStats(scope)).toEqual({
      listeners: 0,
      publications: 0,
      blocked: false,
      closed: false,
    })
  })

  it('checks pre-existing block, cancellation, and deadline before persisting PASS', async () => {
    const scenarios = [
      { kind: 'BLOCKED' as const },
      { kind: 'CANCELLED' as const },
      { kind: 'DEADLINE' as const },
    ]
    for (const scenario of scenarios) {
      const runtime = new BridgeFlowEvidenceRuntime()
      runtime.publish(publication(1, 'ORDERED_REQUIRED', { observedAtMs: 0 }))
      const controller = new AbortController()
      if (scenario.kind === 'BLOCKED') {
        runtime.block(scope, { revision: 2, reason: 'poison' })
      }
      if (scenario.kind === 'CANCELLED') controller.abort()
      const { persistence, revisions } = oraclePersistence()
      const worker = new OracleEvaluationWorker({
        runtime,
        persistence,
        clock: () => (scenario.kind === 'DEADLINE' ? 10 : 0),
      })
      const result = await worker.runFinalOracle({
        ...scope,
        policy: {
          requirements: [{
            factKey: 'delivery.persisted',
            obligation: 'REQUIRED',
            timing: 'EVENTUAL',
            deadlineMs: 10,
            onTimeout: 'INCONCLUSIVE',
          }],
        },
        startedAtMs: 0,
        signal: controller.signal,
      })

      expect(result.status).toBe(scenario.kind === 'DEADLINE' ? 'INCONCLUSIVE' : scenario.kind)
      expect(
        revisions.some(
          (record) =>
            'productVerdict' in record.evaluation &&
            record.evaluation.productVerdict.startsWith('PASS'),
        ),
      ).toBe(false)
    }
  })

  it('rechecks block and cancellation after fact collection but before persistence', async () => {
    for (const race of ['BLOCK', 'CANCEL'] as const) {
      const controller = new AbortController()
      const runtime = new BridgeFlowEvidenceRuntime()
      runtime.publish(publication(1, 'ORDERED_REQUIRED', { observedAtMs: 0 }))
      const currentFacts = runtime.currentFacts.bind(runtime)
      runtime.currentFacts = ((...args: Parameters<typeof currentFacts>) => {
        if (race === 'BLOCK') runtime.block(scope, { revision: 2, reason: 'raced poison' })
        else controller.abort()
        return currentFacts(...args)
      }) as typeof runtime.currentFacts
      const { persistence, revisions } = oraclePersistence()
      const result = await new OracleEvaluationWorker({
        runtime,
        persistence,
        clock: () => 0,
      }).runFinalOracle({
        ...scope,
        policy: {
          requirements: [{
            factKey: 'delivery.persisted',
            obligation: 'REQUIRED',
            timing: 'EVENTUAL',
            deadlineMs: 10,
            onTimeout: 'INCONCLUSIVE',
          }],
        },
        startedAtMs: 0,
        signal: controller.signal,
      })
      expect(result.status).toBe(race === 'BLOCK' ? 'BLOCKED' : 'CANCELLED')
      expect(revisions).toHaveLength(0)
    }
  })

  it('wakes Continue Gate at stableForMs without requiring another revision', async () => {
    const startedAtMs = Date.now()
    const runtime = new BridgeFlowEvidenceRuntime()
    runtime.publish(
      publication(1, 'RECEIPT_SAFE', {
        observedAtMs: startedAtMs,
        freshnessMaxAgeMs: 1_000,
      }),
    )
    const { persistence, revisions } = oraclePersistence()
    const result = await new OracleEvaluationWorker({ runtime, persistence }).runContinueGate({
      ...scope,
      policy: {
        allOf: ['delivery.persisted'],
        stableForMs: 25,
        deadlineMs: 500,
        unknownPolicy: 'RETRY',
      },
      startedAtMs,
    })

    expect(result.status).toBe('SATISFIED')
    expect(revisions).toHaveLength(2)
  })

  it('resumes evaluation revision/cursor and does not re-walk current publications', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    runtime.publish(publication(5, 'RECEIPT_SAFE', { factKey: 'unrelated.fact' }))
    const controller = new AbortController()
    const { persistence, revisions } = oraclePersistence({
      latestRevision: 7,
      lastEvidenceRevision: 5,
    })
    setTimeout(() => controller.abort(), 20)

    const result = await new OracleEvaluationWorker({ runtime, persistence }).runContinueGate({
      ...scope,
      policy: {
        allOf: ['delivery.persisted'],
        deadlineMs: 500,
        unknownPolicy: 'RETRY',
      },
      startedAtMs: Date.now(),
      signal: controller.signal,
    })

    expect(result.status).toBe('CANCELLED')
    expect(revisions.map((record) => record.revision)).toEqual([8])
    expect(revisions[0]?.lastEvidenceRevision).toBe(5)
  })
})

function oraclePersistence(
  checkpoint = { latestRevision: 0, lastEvidenceRevision: 0 },
) {
  const revisions: Parameters<OracleRevisionPersistencePort['persistOracleRevision']>[0][] = []
  const persistence: OracleRevisionPersistencePort = {
    async loadOracleCheckpoint() {
      return checkpoint
    },
    async persistOracleRevision(record) {
      revisions.push(record)
    },
  }
  return { persistence, revisions }
}
