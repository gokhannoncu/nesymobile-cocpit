import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'
import { describe, expect, it } from 'vitest'

import { DurableBridgeFlowEvidenceIngest } from './bridgeflow-durable-evidence-ingest.js'
import {
  BridgeFlowEvidenceRuntime,
  type EvidencePublication,
} from './bridgeflow-evidence-runtime.js'
import {
  EvidenceJourneyWriter,
  InMemoryEvidenceJourneyPersistence,
} from './evidence-journey-writer.js'
import {
  StaticEvidenceSourceResolver,
  resolveBridgeFlowDurableEvent,
} from './evidence-source-resolver.js'
import {
  OracleEvaluationWorker,
  type OracleRevisionPersistencePort,
} from './oracle-evaluation-worker.js'

const scope = {
  runId: 'run-final-review',
  occurrenceId: 'occ-1',
  iterationKey: 'iteration-1',
}

const audit = {
  runId: scope.runId,
  sessionId: 'session-1',
  seq: '9223372036854775807',
  rawEventRef: `durable:${scope.runId}:session-1:9223372036854775807`,
}

const resolver = new StaticEvidenceSourceResolver([
  {
    sourceEvent: 'DELIVERY_PERSISTED',
    factKey: 'delivery.persisted',
    plane: 'APP',
    subtype: 'sdk',
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: 10_000,
    valueField: 'factValue',
  },
])

function rawEvent(event = 'DELIVERY_PERSISTED') {
  return {
    runId: scope.runId,
    sessionId: audit.sessionId,
    ts: 5,
    event,
    taskId: 'task-1',
    data: {
      occurrenceId: scope.occurrenceId,
      iterationKey: scope.iterationKey,
      factValue: 'true',
    },
  }
}

function fact(
  factKey: string,
  observedAtMs: number,
  authority: 'PRIMARY' | 'CONFIRMATORY' | 'FALLBACK' = 'PRIMARY',
): NormalizedEvidenceFact {
  return {
    factKey,
    occurrenceId: scope.occurrenceId,
    iterationKey: scope.iterationKey,
    observedAtMs,
    freshnessMaxAgeMs: 10_000,
    plane: 'APP',
    subtype: 'sdk',
    value: true,
    authority,
    deliveryLane: 'ORDERED_REQUIRED',
    rawEventId: `event:${factKey}:${observedAtMs}`,
    reducerTrace: ['trusted:test'],
  }
}

function publication(
  revision: number,
  evidence: NormalizedEvidenceFact,
): EvidencePublication {
  return {
    runId: scope.runId,
    fact: evidence,
    revision,
    lane: evidence.deliveryLane,
    correlationStatus: 'CORRELATED',
    trust: 'RESOLVER_ACCEPTED',
  }
}

describe('Task 2 final reviewer regressions', () => {
  it('keeps confirmatory evidence diagnostic and refuses Final Oracle PASS without PRIMARY', async () => {
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => 0 })
    runtime.publish(publication(1, fact('delivery.persisted', 5, 'CONFIRMATORY')))
    const { persistence, revisions } = oraclePersistence()

    const result = await new OracleEvaluationWorker({
      runtime,
      persistence,
      clock: () => 10,
    }).runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'delivery.persisted',
          obligation: 'REQUIRED',
          timing: 'IMMEDIATE',
          onTimeout: 'FAIL',
        }],
      },
      startedAtMs: 0,
    })

    expect(result.status).not.toBe('SATISFIED')
    expect(
      revisions.some(
        (record) =>
          'productVerdict' in record.evaluation &&
          record.evaluation.productVerdict.startsWith('PASS'),
      ),
    ).toBe(false)
  })

  it('persists receipt and ordered lanes as distinct deterministic evidence rows', async () => {
    const persistence = new InMemoryEvidenceJourneyPersistence()
    const writer = new EvidenceJourneyWriter(persistence)
    const receipt = resolveBridgeFlowDurableEvent(rawEvent(), 'RECEIPT_SAFE', resolver, audit)
    const ordered = resolveBridgeFlowDurableEvent(rawEvent(), 'ORDERED_REQUIRED', resolver, audit)
    if (receipt.status !== 'ACCEPTED' || ordered.status !== 'ACCEPTED') {
      throw new Error('fixtures must resolve')
    }

    const receiptRow = await writer.writeResolved(receipt)
    const orderedRow = await writer.writeResolved(ordered)

    expect(persistence.rows).toHaveLength(2)
    expect(receiptRow.idempotencyKey).not.toBe(orderedRow.idempotencyKey)
    expect(persistence.rows.map((row) => row.normalizedFact.deliveryLane).sort()).toEqual([
      'ORDERED_REQUIRED',
      'RECEIPT_SAFE',
    ])
    const restarted = new BridgeFlowEvidenceRuntime({ now: () => 0 })
    restarted.hydrate(await persistence.loadEvidenceScope(scope))
    expect(restarted.currentFacts(scope, 10, 'ORDERED_REQUIRED')).toHaveLength(1)
  })

  it('honors each eventual requirement deadline while retaining earlier valid facts', async () => {
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => 0 })
    runtime.publish(publication(1, fact('early.fact', 11)))
    runtime.publish(publication(2, fact('late.fact', 50)))
    const { persistence } = oraclePersistence()
    const result = await new OracleEvaluationWorker({
      runtime,
      persistence,
      clock: () => 60,
    }).runFinalOracle({
      ...scope,
      policy: {
        requirements: [
          {
            factKey: 'early.fact',
            obligation: 'REQUIRED',
            timing: 'EVENTUAL',
            deadlineMs: 10,
            onTimeout: 'FAIL',
          },
          {
            factKey: 'late.fact',
            obligation: 'REQUIRED',
            timing: 'EVENTUAL',
            deadlineMs: 100,
            onTimeout: 'INCONCLUSIVE',
          },
        ],
      },
      startedAtMs: 0,
    })

    expect(result.status).toBe('VIOLATED')
    if (!('evaluation' in result)) throw new Error('expected evaluation')
    expect(result.evaluation.requirementsByFact['early.fact']?.state).toBe('REQUIRED_TIMEOUT')
    expect(result.evaluation.requirementsByFact['late.fact']?.state).toBe('SATISFIED')
  })

  it('persists ordered rejection so restart hydration remains blocked', async () => {
    const persistence = new InMemoryEvidenceJourneyPersistence()
    const firstRuntime = new BridgeFlowEvidenceRuntime({ now: () => 0 })
    const firstIngest = new DurableBridgeFlowEvidenceIngest({
      resolver,
      writer: new EvidenceJourneyWriter(persistence),
      runtime: firstRuntime,
    })

    // A MALFORMED frame, not merely an undeclared one. An event the resolver was
    // never told about is a diagnostic and is ignored; a frame that claims a
    // correlation tuple and then only half-supplies it is broken, and that is what
    // must stop the lane.
    const contradicts = {
      ...rawEvent(),
      data: {
        occurrenceId: scope.occurrenceId,
        iterationKey: scope.iterationKey,
        factValue: 'true',
        factKey: 'something.else',
      },
    }
    await expect(
      firstIngest.persist(contradicts, 'ORDERED_REQUIRED', audit),
    ).rejects.toThrow('ordered evidence rejected')
    expect(persistence.rows).toEqual([
      expect.objectContaining({
        journeyState: 'BLOCKED',
        normalizedFact: expect.objectContaining({ deliveryLane: 'ORDERED_REQUIRED' }),
      }),
    ])

    const restartedRuntime = new BridgeFlowEvidenceRuntime({ now: () => 0 })
    const restartedIngest = new DurableBridgeFlowEvidenceIngest({
      resolver,
      writer: new EvidenceJourneyWriter(persistence),
      runtime: restartedRuntime,
    })
    await restartedIngest.hydrate(scope)
    expect(restartedRuntime.blockedState(scope)).toMatchObject({
      reason: expect.stringContaining('does not match trusted source definition'),
    })
    restartedRuntime.publish(publication(2, fact('delivery.persisted', 6)))
    const { persistence: oraclePort } = oraclePersistence()
    const result = await new OracleEvaluationWorker({
      runtime: restartedRuntime,
      persistence: oraclePort,
      clock: () => 10,
    }).runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'delivery.persisted',
          obligation: 'REQUIRED',
          timing: 'IMMEDIATE',
          onTimeout: 'FAIL',
        }],
      },
      startedAtMs: 0,
    })
    expect(result.status).toBe('BLOCKED')
  })

  it('evaluates a no-eventual policy exactly once without an Infinity timer', async () => {
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => 0 })
    runtime.waitForRevision = async () => {
      throw new Error('no-eventual policy must not subscribe')
    }
    const { persistence, revisions } = oraclePersistence()
    const result = await new OracleEvaluationWorker({
      runtime,
      persistence,
      clock: () => 10,
    }).runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'delivery.persisted',
          obligation: 'REQUIRED',
          timing: 'IMMEDIATE',
          onTimeout: 'FAIL',
          applicabilityCondition: { allOf: ['route.applicable'] },
        }],
      },
      startedAtMs: 0,
    })

    expect(result.status).toBe('INCONCLUSIVE')
    expect(revisions).toHaveLength(1)
  })

  it('retains valid pre-deadline facts and refs in the timeout revision', async () => {
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => 0 })
    runtime.publish(publication(1, fact('persisted.fact', 5)))
    const { persistence, revisions } = oraclePersistence()
    const result = await new OracleEvaluationWorker({
      runtime,
      persistence,
      clock: () => 20,
    }).runFinalOracle({
      ...scope,
      policy: {
        requirements: [
          {
            factKey: 'persisted.fact',
            obligation: 'REQUIRED',
            timing: 'EVENTUAL',
            deadlineMs: 20,
            onTimeout: 'FAIL',
          },
          {
            factKey: 'missing.fact',
            obligation: 'REQUIRED',
            timing: 'EVENTUAL',
            deadlineMs: 20,
            onTimeout: 'INCONCLUSIVE',
          },
        ],
      },
      startedAtMs: 0,
    })

    expect(result.status).toBe('INCONCLUSIVE')
    expect(revisions.at(-1)?.evidenceRefs).toEqual(['persisted.fact'])
    if (!('evaluation' in result)) throw new Error('expected evaluation')
    expect(result.evaluation.requirementsByFact['persisted.fact']?.state).toBe('SATISFIED')
  })

  it('fails the worker when immutable Oracle persistence rejects a collision', async () => {
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => 0 })
    runtime.publish(publication(1, fact('delivery.persisted', 5)))
    const persistence: OracleRevisionPersistencePort = {
      async loadOracleCheckpoint() {
        return { latestRevision: 0, lastEvidenceRevision: 0 }
      },
      async persistOracleRevision() {
        throw new Error('oracle revision collision')
      },
    }

    await expect(
      new OracleEvaluationWorker({ runtime, persistence, clock: () => 10 }).runFinalOracle({
        ...scope,
        policy: {
          requirements: [{
            factKey: 'delivery.persisted',
            obligation: 'REQUIRED',
            timing: 'IMMEDIATE',
            onTimeout: 'FAIL',
          }],
        },
        startedAtMs: 0,
      }),
    ).rejects.toThrow('oracle revision collision')
  })

  it('hydrates a durable run-level poison before evaluating existing positive facts', async () => {
    const persistence = new InMemoryEvidenceJourneyPersistence()
    const firstRuntime = new BridgeFlowEvidenceRuntime({ now: () => 0 })
    const firstIngest = new DurableBridgeFlowEvidenceIngest({
      resolver,
      writer: new EvidenceJourneyWriter(persistence),
      runtime: firstRuntime,
    })
    const incompleteCorrelation = {
      ...rawEvent(),
      data: {
        occurrenceId: scope.occurrenceId,
        factValue: 'true',
      },
    }

    await expect(
      firstIngest.persist(incompleteCorrelation, 'ORDERED_REQUIRED', audit),
    ).rejects.toThrow('ordered evidence rejected')
    expect(persistence.runBlocks).toEqual([
      expect.objectContaining({
        runId: scope.runId,
        reason: expect.stringContaining('partial or malformed'),
      }),
    ])

    const restartedRuntime = new BridgeFlowEvidenceRuntime({ now: () => 0 })
    const restartedIngest = new DurableBridgeFlowEvidenceIngest({
      resolver,
      writer: new EvidenceJourneyWriter(persistence),
      runtime: restartedRuntime,
    })
    await restartedIngest.hydrate(scope)
    restartedRuntime.publish(publication(1, fact('delivery.persisted', 5)))
    const { persistence: oraclePort } = oraclePersistence()
    const result = await new OracleEvaluationWorker({
      runtime: restartedRuntime,
      persistence: oraclePort,
      clock: () => 10,
    }).runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'delivery.persisted',
          obligation: 'REQUIRED',
          timing: 'IMMEDIATE',
          onTimeout: 'FAIL',
        }],
      },
      startedAtMs: 0,
    })
    expect(result.status).toBe('BLOCKED')
  })

  it('persists at each pending requirement deadline without new evidence', async () => {
    let nowMs = 0
    const wakeBoundaries: number[] = []
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => nowMs })
    runtime.waitForRevision = async (request) => {
      if (request.wakeAtMs === undefined) {
        throw new Error('pending policy boundary was not scheduled')
      }
      wakeBoundaries.push(request.wakeAtMs)
      nowMs = request.wakeAtMs
      return { status: 'TIMER' }
    }
    const { persistence, revisions } = oraclePersistence()

    const result = await new OracleEvaluationWorker({
      runtime,
      persistence,
      clock: () => nowMs,
    }).runFinalOracle({
      ...scope,
      policy: {
        requirements: [
          {
            factKey: 'early.fact',
            obligation: 'REQUIRED',
            timing: 'EVENTUAL',
            deadlineMs: 10,
            onTimeout: 'FAIL',
          },
          {
            factKey: 'late.fact',
            obligation: 'REQUIRED',
            timing: 'EVENTUAL',
            deadlineMs: 100,
            onTimeout: 'INCONCLUSIVE',
          },
        ],
      },
      startedAtMs: 0,
    })

    expect(result.status).toBe('INCONCLUSIVE')
    expect(wakeBoundaries).toEqual([10, 100])
    expect(revisions).toHaveLength(3)
    expect(
      'requirementsByFact' in revisions[1]!.evaluation
        ? revisions[1]!.evaluation.requirementsByFact
        : {},
    ).toMatchObject({
      'early.fact': { state: 'REQUIRED_TIMEOUT' },
      'late.fact': { state: 'PENDING' },
    })
  })
})

function oraclePersistence() {
  const revisions: Parameters<OracleRevisionPersistencePort['persistOracleRevision']>[0][] = []
  const persistence: OracleRevisionPersistencePort = {
    async loadOracleCheckpoint() {
      return { latestRevision: 0, lastEvidenceRevision: 0 }
    },
    async persistOracleRevision(record) {
      revisions.push(record)
    },
  }
  return { persistence, revisions }
}
