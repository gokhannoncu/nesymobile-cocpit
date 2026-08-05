import { describe, expect, it, vi } from 'vitest'

import { BridgeFlowEvidenceRuntime } from './bridgeflow-evidence-runtime.js'
import { DurableBridgeFlowEvidenceIngest } from './bridgeflow-durable-evidence-ingest.js'
import {
  EvidenceJourneyWriter,
  InMemoryEvidenceJourneyPersistence,
} from './evidence-journey-writer.js'
import { OracleEvaluationWorker } from './oracle-evaluation-worker.js'
import {
  BridgeFlowRecoveryWorker,
  type RecoveryExecutionCandidate,
  type RecoveryPersistencePort,
  type RecoverySnapshot,
} from './bridgeflow-recovery-worker.js'

function candidate(runId = 'run-recovery'): RecoveryExecutionCandidate {
  return {
    runId,
    revision: 1,
    lifecycle: 'RUNNING',
    schedulerDisposition: 'LEASED',
    version: '2026-08-05T16:00:00.000Z',
  }
}

function snapshot(runId = 'run-recovery'): RecoverySnapshot {
  return {
    runId,
    nextStepId: 'step-6',
    runtimeIterationKey: 'root',
    occurrenceCounts: { repeated: 6 },
    completedOccurrenceIds: Array.from(
      { length: 6 },
      (_, index) => `${runId}:repeated:${index}`,
    ),
    completedIterationKeys: [],
    continuationStack: [],
    outcomeState: {
      stopped: false,
      unknownEffect: false,
      automationFailure: false,
      evidenceInsufficient: false,
      productVerdicts: [],
      cleanupResult: 'SUCCEEDED',
      resourceReleaseResult: 'RELEASED',
      schedulerDisposition: 'RELEASED',
      operationalDisposition: 'OK',
    },
    evidenceScopes: [{
      runId,
      occurrenceId: `${runId}:repeated:6`,
      iterationKey: 'root',
    }],
  }
}

function persistenceFixture(
  execution = candidate(),
  recoverySnapshot = snapshot(execution.runId),
): RecoveryPersistencePort {
  let claimed = false
  let fence: { token: string; epoch: number } | undefined
  return {
    scanResumableExecutions: vi.fn(async () => [execution]),
    claimRecoveryLease: vi.fn(async (input) => {
      if (claimed) return undefined
      claimed = true
      fence = { token: input.leaseToken, epoch: 1 }
      return {
        ...fence,
        owner: input.workerId,
        expiresAtMs: input.leaseExpiresAtMs,
      }
    }),
    renewRecoveryLease: vi.fn(async () => true),
    loadRecoverySnapshot: vi.fn(async () => ({
      ...recoverySnapshot,
      recoveryFence: fence,
    })),
    markUnknownEffect: vi.fn(async () => undefined),
    releaseRecoveryLease: vi.fn(async () => undefined),
  }
}

describe('BridgeFlowRecoveryWorker', () => {
  it('marks a stale in-flight physical effect unknown without dispatching act', async () => {
    const execution = candidate('run-unknown')
    const recoverySnapshot: RecoverySnapshot = {
      ...snapshot(execution.runId),
      inFlightAction: {
        occurrenceId: 'run-unknown:action:0',
        requestId: 'request-1',
        phase: 'GESTURE_DISPATCHED',
      },
    }
    const persistence = persistenceFixture(execution, recoverySnapshot)
    const resume = vi.fn(async () => ({ status: 'RESUMED' as const }))
    const worker = new BridgeFlowRecoveryWorker({
      workerId: 'worker-1',
      persistence,
      evidence: { hydrate: vi.fn(async () => undefined) },
      executor: { resume },
      now: () => Date.parse('2026-08-05T16:10:00.000Z'),
      leaseMs: 30_000,
    })

    await expect(worker.runOnce()).resolves.toEqual([{
      runId: 'run-unknown',
      status: 'RECONCILIATION_REQUIRED',
    }])
    expect(persistence.markUnknownEffect).toHaveBeenCalledWith({
      runId: 'run-unknown',
      occurrenceId: 'run-unknown:action:0',
      requestId: 'request-1',
      recoveryFence: expect.objectContaining({ epoch: 1 }),
    })
    expect(resume).not.toHaveBeenCalled()
  })

  it('allows only one of two recovery workers to claim and resume a run', async () => {
    const persistence = persistenceFixture()
    const resume = vi.fn(async () => ({ status: 'RESUMED' as const }))
    const options = {
      persistence,
      evidence: { hydrate: vi.fn(async () => undefined) },
      executor: { resume },
      now: () => Date.parse('2026-08-05T16:10:00.000Z'),
      leaseMs: 30_000,
    }

    const [left, right] = await Promise.all([
      new BridgeFlowRecoveryWorker({ ...options, workerId: 'worker-left' }).runOnce(),
      new BridgeFlowRecoveryWorker({ ...options, workerId: 'worker-right' }).runOnce(),
    ])

    expect(resume).toHaveBeenCalledTimes(1)
    expect([...left, ...right].filter((result) => result.status === 'RESUMED')).toHaveLength(1)
  })

  it('hydrates occurrence and run-level evidence blocks before recovered Oracle work', async () => {
    const runId = 'run-recovery'
    const scope = {
      runId,
      occurrenceId: 'run-recovery:repeated:6',
      iterationKey: 'root',
    }
    const evidencePersistence = new InMemoryEvidenceJourneyPersistence()
    const writer = new EvidenceJourneyWriter(evidencePersistence)
    await writer.writeRunBlock(runId, {
      runId,
      sessionId: 'session-1',
      seq: '1',
      rawEventRef: 'ordered:poison:1',
    }, 'durable ordered poison')
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => 1_000 })
    const ingest = new DurableBridgeFlowEvidenceIngest({
      resolver: {} as never,
      writer,
      runtime,
    })
    const oracle = new OracleEvaluationWorker({
      runtime,
      persistence: {
        loadOracleCheckpoint: async () => ({
          latestRevision: 0,
          lastEvidenceRevision: 0,
        }),
        persistOracleRevision: async () => undefined,
      },
      clock: () => 1_000,
    })
    const persistence = persistenceFixture()
    vi.mocked(persistence.claimRecoveryLease).mockResolvedValue({
      token: 'recovery-token',
      epoch: 2,
      owner: 'worker-1',
      expiresAtMs: 2_000,
    } as never)
    vi.mocked(persistence.loadRecoverySnapshot).mockResolvedValue({
      ...snapshot(),
      recoveryFence: { token: 'recovery-token', epoch: 2 },
    })
    const resume = vi.fn(async (recovered: RecoverySnapshot) => {
      expect(recovered).toMatchObject({
        recoveryFence: { token: 'recovery-token', epoch: 2 },
      })
      const result = await oracle.runFinalOracle({
        ...scope,
        policy: { requirements: [] },
        startedAtMs: 900,
      })
      return {
        status: result.status === 'BLOCKED' ? 'BLOCKED' as const : 'PASS' as const,
      }
    })
    const worker = new BridgeFlowRecoveryWorker({
      workerId: 'worker-1',
      persistence,
      evidence: { hydrate: (hydrateScope) => ingest.hydrate(hydrateScope) },
      executor: { resume },
      now: () => Date.parse('2026-08-05T16:10:00.000Z'),
      leaseMs: 30_000,
    })

    await expect(worker.runOnce()).resolves.toEqual([{
      runId: 'run-recovery',
      status: 'BLOCKED',
    }])
    expect(runtime.blockedState(scope)).toMatchObject({
      reason: 'durable ordered poison',
    })
  })

  it('fails closed when no evidence scope exists for run-block hydration', async () => {
    const execution = candidate('run-no-scope')
    const persistence = persistenceFixture(execution, {
      ...snapshot(execution.runId),
      evidenceScopes: [],
    })
    const resume = vi.fn(async () => ({ status: 'PASS' as const }))
    const worker = new BridgeFlowRecoveryWorker({
      workerId: 'worker-1',
      persistence,
      evidence: { hydrate: vi.fn(async () => undefined) },
      executor: { resume },
      now: () => Date.parse('2026-08-05T16:10:00.000Z'),
      leaseMs: 30_000,
    })

    await expect(worker.runOnce()).resolves.toEqual([{
      runId: 'run-no-scope',
      status: 'FAILED',
    }])
    expect(resume).not.toHaveBeenCalled()
  })

  it('cannot report completion after losing lease renewal', async () => {
    const persistence = persistenceFixture()
    vi.mocked(persistence.renewRecoveryLease)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const worker = new BridgeFlowRecoveryWorker({
      workerId: 'worker-renewal',
      persistence,
      evidence: { hydrate: vi.fn(async () => undefined) },
      executor: { resume: vi.fn(async () => ({ status: 'RESUMED' as const })) },
      now: () => Date.parse('2026-08-05T16:10:00.000Z'),
      leaseMs: 30_000,
      tokenFactory: () => 'renewal-token',
    })

    await expect(worker.runOnce()).resolves.toEqual([{
      runId: 'run-recovery',
      status: 'FAILED',
    }])
  })

  it('releases nonterminal recovery failure into a scannable retry state', async () => {
    const execution = candidate('run-retry-release')
    const persistence = persistenceFixture(execution, {
      ...snapshot(execution.runId),
      evidenceScopes: [],
    })
    const worker = new BridgeFlowRecoveryWorker({
      workerId: 'worker-retry',
      persistence,
      evidence: { hydrate: vi.fn(async () => undefined) },
      executor: { resume: vi.fn(async () => ({ status: 'RESUMED' as const })) },
      now: () => Date.parse('2026-08-05T16:10:00.000Z'),
      leaseMs: 30_000,
      tokenFactory: () => 'retry-token',
    })

    await expect(worker.runOnce()).resolves.toEqual([{
      runId: 'run-retry-release',
      status: 'FAILED',
    }])
    expect(persistence.releaseRecoveryLease).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-retry-release',
        recoveryDisposition: 'RETRYABLE_FAILURE',
      }),
    )
  })

  it('awaits an interval renewal already in flight before reporting resumed', async () => {
    vi.useFakeTimers()
    try {
      const persistence = persistenceFixture()
      let renewalCalls = 0
      let resolveIntervalRenewal:
        ((owned: boolean) => void) | undefined
      vi.mocked(persistence.renewRecoveryLease).mockImplementation(async () => {
        renewalCalls += 1
        if (renewalCalls < 4) return true
        return new Promise<boolean>((resolve) => {
          resolveIntervalRenewal = resolve
        })
      })
      let resolveResume:
        ((result: { status: 'RESUMED' }) => void) | undefined
      const resume = vi.fn(() =>
        new Promise<{ status: 'RESUMED' }>((resolve) => {
          resolveResume = resolve
        }))
      const worker = new BridgeFlowRecoveryWorker({
        workerId: 'worker-inflight-renewal',
        persistence,
        evidence: { hydrate: vi.fn(async () => undefined) },
        executor: { resume },
        now: () => Date.parse('2026-08-05T16:10:00.000Z'),
        leaseMs: 30_000,
        tokenFactory: () => 'inflight-token',
      })
      const run = worker.runOnce()
      await vi.waitFor(() => expect(resume).toHaveBeenCalledTimes(1))
      await vi.advanceTimersByTimeAsync(10_000)
      expect(renewalCalls).toBe(4)

      resolveResume?.({ status: 'RESUMED' })
      let settled = false
      void run.then(() => {
        settled = true
      })
      await Promise.resolve()
      await Promise.resolve()
      expect(settled).toBe(false)

      resolveIntervalRenewal?.(false)
      await expect(run).resolves.toEqual([{
        runId: 'run-recovery',
        status: 'FAILED',
      }])
    } finally {
      vi.useRealTimers()
    }
  })
})
