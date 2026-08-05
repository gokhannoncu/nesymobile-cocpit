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
