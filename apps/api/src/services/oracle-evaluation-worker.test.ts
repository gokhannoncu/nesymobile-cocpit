import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'
import { describe, expect, it } from 'vitest'

import { BridgeFlowEvidenceRuntime } from './bridgeflow-evidence-runtime.js'
import {
  OracleEvaluationWorker,
  type OracleRevisionPersistencePort,
} from './oracle-evaluation-worker.js'

const scope = {
  runId: 'run-1',
  occurrenceId: 'occ-1',
  iterationKey: 'iteration-1',
}

function evidence(lane: 'RECEIPT_SAFE' | 'ORDERED_REQUIRED'): NormalizedEvidenceFact {
  return {
    factKey: 'delivery.persisted',
    occurrenceId: scope.occurrenceId,
    iterationKey: scope.iterationKey,
    observedAtMs: Date.now(),
    freshnessMaxAgeMs: 10_000,
    plane: 'APP',
    subtype: 'sdk',
    value: true,
    authority: 'PRIMARY',
    deliveryLane: lane,
    rawEventId: `event-${lane}`,
    reducerTrace: ['sdk-event'],
  }
}

function persistenceFixture() {
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

describe('OracleEvaluationWorker', () => {
  it('advances Continue Gate from an early receipt-safe wakeup and persists its reason', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const { persistence, revisions } = persistenceFixture()
    const worker = new OracleEvaluationWorker({ runtime, persistence })

    const resultPromise = worker.runContinueGate({
      ...scope,
      policy: {
        allOf: ['delivery.persisted'],
        deadlineMs: 1_000,
        unknownPolicy: 'RETRY',
      },
      startedAtMs: Date.now(),
    })
    queueMicrotask(() => {
      runtime.publish({
        runId: scope.runId,
        fact: evidence('RECEIPT_SAFE'),
        revision: 1,
        lane: 'RECEIPT_SAFE',
        correlationStatus: 'CORRELATED',
        trust: 'RESOLVER_ACCEPTED',
      })
    })

    const result = await resultPromise

    expect(result.status).toBe('SATISFIED')
    expect(revisions).toHaveLength(2)
    expect(revisions[1]).toMatchObject({
      evaluatorKind: 'CONTINUE_GATE',
      revision: 2,
      evidenceRefs: ['delivery.persisted'],
      reason: 'continue gate satisfied by current receipt-safe facts',
    })
  })

  it('allows only ordered evidence to eventually satisfy Final Oracle', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const { persistence, revisions } = persistenceFixture()
    const worker = new OracleEvaluationWorker({ runtime, persistence })

    runtime.publish({
      runId: scope.runId,
      fact: evidence('RECEIPT_SAFE'),
      revision: 1,
      lane: 'RECEIPT_SAFE',
      correlationStatus: 'CORRELATED',
      trust: 'RESOLVER_ACCEPTED',
    })
    const resultPromise = worker.runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'delivery.persisted',
          obligation: 'REQUIRED',
          timing: 'EVENTUAL',
          deadlineMs: 1_000,
          onTimeout: 'INCONCLUSIVE',
        }],
      },
      startedAtMs: Date.now(),
    })
    queueMicrotask(() => {
      runtime.publish({
        runId: scope.runId,
        fact: evidence('ORDERED_REQUIRED'),
        revision: 2,
        lane: 'ORDERED_REQUIRED',
        correlationStatus: 'CORRELATED',
        trust: 'RESOLVER_ACCEPTED',
      })
    })

    const result = await resultPromise

    expect(result.status).toBe('SATISFIED')
    expect(result.evaluation.productVerdict).toBe('PASS_ONLINE')
    expect(revisions.at(-1)).toMatchObject({
      evaluatorKind: 'FINAL_ORACLE',
      revision: 2,
      evidenceRefs: ['delivery.persisted'],
    })
  })

  it('deterministically applies eventual onTimeout policy', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const { persistence, revisions } = persistenceFixture()
    const worker = new OracleEvaluationWorker({
      runtime,
      persistence,
      clock: () => 10,
    })

    const result = await worker.runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'delivery.persisted',
          obligation: 'REQUIRED',
          timing: 'EVENTUAL',
          deadlineMs: 10,
          onTimeout: 'FAIL',
        }],
      },
      startedAtMs: 0,
    })

    expect(result.status).toBe('VIOLATED')
    expect(result.evaluation.productVerdict).toBe('FAIL_PRODUCT')
    expect(revisions).toHaveLength(1)
  })

  it('reports an ordered poison block without inventing root cause or PASS', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const { persistence, revisions } = persistenceFixture()
    const worker = new OracleEvaluationWorker({ runtime, persistence })
    const resultPromise = worker.runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'delivery.persisted',
          obligation: 'REQUIRED',
          timing: 'EVENTUAL',
          deadlineMs: 1_000,
          onTimeout: 'INCONCLUSIVE',
        }],
      },
      startedAtMs: Date.now(),
    })
    queueMicrotask(() => {
      runtime.block(scope, {
        revision: 1,
        reason: 'ordered lane poison row',
        evidenceRef: 'durable:run-1:session-1:41',
      })
    })

    const result = await resultPromise

    expect(result).toMatchObject({
      status: 'BLOCKED',
      reason: 'ordered lane poison row',
      evidenceRef: 'durable:run-1:session-1:41',
    })
    expect(
      revisions.some(
        (revision) =>
          'productVerdict' in revision.evaluation &&
          revision.evaluation.productVerdict.startsWith('PASS'),
      ),
    ).toBe(false)
  })

  it('run_e68ca3ae: proof 12 units before EVENTUAL deadline satisfies Final Oracle', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const { persistence, revisions } = persistenceFixture()
    const deadlineMs = 2_000
    const proofAtMs = deadlineMs - 500
    let adapterCalls = 0
    let evidenceRevision = 22
    const startedAtMs = Date.now()
    const worker = new OracleEvaluationWorker({
      runtime,
      persistence,
      refreshFacts: (work) => {
        adapterCalls += 1
        if (Date.now() - startedAtMs < proofAtMs) return
        evidenceRevision += 1
        runtime.publish({
          runId: work.runId,
          fact: {
            ...evidence('ORDERED_REQUIRED'),
            factKey: 'REMOTE.DELIVERY_STATUS_COMPLETED',
            observedAtMs: Date.now(),
          },
          revision: evidenceRevision,
          lane: 'ORDERED_REQUIRED',
          correlationStatus: 'CORRELATED',
          trust: 'RESOLVER_ACCEPTED',
        })
      },
    })

    const result = await worker.runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'REMOTE.DELIVERY_STATUS_COMPLETED',
          obligation: 'REQUIRED',
          timing: 'EVENTUAL',
          deadlineMs,
          onTimeout: 'INCONCLUSIVE',
        }],
      },
      startedAtMs,
    })
    const elapsedMs = Date.now() - startedAtMs
    const last = revisions.at(-1)

    expect(result.status).toBe('SATISFIED')
    expect(result.evaluation.productVerdict).toBe('PASS_ONLINE')
    expect(adapterCalls).toBeGreaterThan(1)
    expect(last?.lastEvidenceRevision).toBeGreaterThan(22)
    expect(elapsedMs).toBeLessThan(deadlineMs)
  })

  it('run_4a9a7ff4: source event before deadline satisfies on the timeout flush', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const { persistence, revisions } = persistenceFixture()
    const deadlineMs = 250
    const startedAtMs = Date.now()
    const sourceEventAtMs = startedAtMs + 100
    let flushed = 0
    const worker = new OracleEvaluationWorker({
      runtime,
      persistence,
      flushFacts: (work) => {
        flushed += 1
        runtime.publish({
          runId: work.runId,
          fact: {
            ...evidence('ORDERED_REQUIRED'),
            factKey: 'REMOTE.DELIVERY_STATUS_COMPLETED',
            observedAtMs: sourceEventAtMs,
          },
          revision: 23,
          lane: 'ORDERED_REQUIRED',
          correlationStatus: 'CORRELATED',
          trust: 'RESOLVER_ACCEPTED',
        })
      },
    })

    const result = await worker.runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'REMOTE.DELIVERY_STATUS_COMPLETED',
          obligation: 'REQUIRED',
          timing: 'EVENTUAL',
          deadlineMs,
          onTimeout: 'INCONCLUSIVE',
        }],
      },
      startedAtMs,
    })

    expect(result.status).toBe('SATISFIED')
    expect(result.evaluation.productVerdict).toBe('PASS_ONLINE')
    expect(flushed).toBe(1)
    expect(revisions.at(-1)?.lastEvidenceRevision).toBe(23)
    expect(Date.now() - startedAtMs).toBeGreaterThanOrEqual(deadlineMs)
    expect(Date.now() - startedAtMs).toBeLessThan(deadlineMs + 2_000)
  })

  it('does not satisfy EVENTUAL from a request that started in-window when the source event is late', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const { persistence } = persistenceFixture()
    const deadlineMs = 250
    const startedAtMs = Date.now()
    const worker = new OracleEvaluationWorker({
      runtime,
      persistence,
      flushFacts: (work) => {
        runtime.publish({
          runId: work.runId,
          fact: {
            ...evidence('ORDERED_REQUIRED'),
            factKey: 'REMOTE.DELIVERY_STATUS_COMPLETED',
            observedAtMs: startedAtMs + deadlineMs + 50,
          },
          revision: 23,
          lane: 'ORDERED_REQUIRED',
          correlationStatus: 'CORRELATED',
          trust: 'RESOLVER_ACCEPTED',
        })
      },
    })

    const result = await worker.runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'REMOTE.DELIVERY_STATUS_COMPLETED',
          obligation: 'REQUIRED',
          timing: 'EVENTUAL',
          deadlineMs,
          onTimeout: 'INCONCLUSIVE',
        }],
      },
      startedAtMs,
    })

    expect(result.status).toBe('INCONCLUSIVE')
    expect(result.evaluation.productVerdict).toBe('INCONCLUSIVE')
  })

  it('keeps EVENTUAL INCONCLUSIVE when every refresh still sees empty proof', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const { persistence, revisions } = persistenceFixture()
    let adapterCalls = 0
    const startedAtMs = Date.now()
    const worker = new OracleEvaluationWorker({
      runtime,
      persistence,
      refreshFacts: () => {
        adapterCalls += 1
      },
    })

    const result = await worker.runFinalOracle({
      ...scope,
      policy: {
        requirements: [{
          factKey: 'REMOTE.DELIVERY_STATUS_COMPLETED',
          obligation: 'REQUIRED',
          timing: 'EVENTUAL',
          deadlineMs: 700,
          onTimeout: 'INCONCLUSIVE',
        }],
      },
      startedAtMs,
    })

    expect(result.status).toBe('INCONCLUSIVE')
    expect(result.evaluation.productVerdict).toBe('INCONCLUSIVE')
    expect(result.evaluation.evaluationFailureClass).toBe('EVIDENCE_INSUFFICIENT')
    expect(adapterCalls).toBeGreaterThan(1)
    expect(revisions.at(-1)?.lastEvidenceRevision).toBe(0)
    expect(Date.now() - startedAtMs).toBeGreaterThanOrEqual(700)
  })

  it('honors cancellation while waiting', async () => {
    const runtime = new BridgeFlowEvidenceRuntime()
    const { persistence } = persistenceFixture()
    const worker = new OracleEvaluationWorker({ runtime, persistence })
    const controller = new AbortController()
    const resultPromise = worker.runContinueGate({
      ...scope,
      policy: {
        allOf: ['delivery.persisted'],
        deadlineMs: 1_000,
        unknownPolicy: 'RETRY',
      },
      startedAtMs: Date.now(),
      signal: controller.signal,
    })
    controller.abort()

    await expect(resultPromise).resolves.toMatchObject({ status: 'CANCELLED' })
  })
})
