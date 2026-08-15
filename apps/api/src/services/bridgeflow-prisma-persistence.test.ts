import { readFile } from 'node:fs/promises'

import { buildRunManifest, createInitialStepOutcome } from '@nesy/execution-contract'
import { describe, expect, it, vi } from 'vitest'

const canonicalOracleKey = vi.hoisted(() =>
  vi.fn(() => 'canonical-oracle-revision-key'),
)

vi.mock('@nesy/execution-contract', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nesy/execution-contract')>()
  return {
    ...actual,
    buildOracleRevisionIdempotencyKey: canonicalOracleKey,
  }
})

import {
  PrismaExecutionPersistence,
  type PrismaRuntimeClient,
} from './bridgeflow-prisma-persistence.js'

function delegate() {
  return {
    create: vi.fn(async () => ({})),
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
    findUnique: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: 0 })),
    upsert: vi.fn(async () => ({})),
  }
}

function clientFixture(): PrismaRuntimeClient {
  const client = {
    bridgeFlowRunRuntime: delegate(),
    bridgeFlowStepOccurrence: delegate(),
    bridgeFlowActionTransition: delegate(),
    bridgeFlowWaitEvent: delegate(),
    bridgeFlowOracleEvaluation: delegate(),
    $queryRaw: vi.fn(async () => []),
  }
  return {
    ...client,
    $transaction: vi.fn(async (operation: (tx: typeof client) => unknown) =>
      operation(client)),
  } as unknown as PrismaRuntimeClient
}

describe('PrismaExecutionPersistence', () => {
  it('durably maps executor records to BridgeFlow runtime tables', async () => {
    const client = clientFixture()
    const persistence = new PrismaExecutionPersistence(
      client,
      () => new Date('2026-08-05T14:00:00.000Z'),
    )
    const manifest = buildRunManifest({
      runId: 'run-1',
      workflowRef: 'workflow/demo',
      workflowVersion: 1,
      engineType: 'BRIDGEFLOW',
      compiledPlanRef: 'plan-1',
      compiledPlanHash: 'sha256:plan',
      domainPackKey: 'courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:pack',
      workflowIrSchemaVersion: 1,
      compilerVersion: 'phase-4c',
      bridgeProtocolVersion: '1',
      sdkProtocolVersion: '1',
      runEpochMs: 42,
      profile: {
        profileKey: 'default',
        profileVersion: '1',
        releaseGate: false,
      },
      reducerGraphDigest: 'sha256:graph',
    })

    await persistence.persistRunStart({ runId: 'run-1', engineType: 'BRIDGEFLOW', manifest })
    await persistence.persistStepOccurrence({
      runId: 'run-1',
      occurrenceId: 'occ-1',
      planStepId: 'step-1',
      occurrenceIndex: 0,
      iterationKey: 'root',
      requestId: 'request-1',
      startedAtMs: Date.parse('2026-08-05T13:59:00.000Z'),
      outcome: { ...createInitialStepOutcome(), actionResult: 'SUCCEEDED' },
    })
    await persistence.persistActionTransition({
      runId: 'run-1',
      occurrenceId: 'occ-1',
      transition: {
        phase: 'EFFECT_VERIFIED',
        requestId: 'request-1',
        atMs: 50,
        evidenceRef: 'bridge:verified',
        terminal: 'SUCCEEDED',
      },
    })
    await persistence.persistRunResult({
      runId: 'run-1',
      result: {
        lifecycle: 'CLOSED',
        productVerdict: 'PASS_ONLINE',
        evaluationFailureClass: 'NONE',
        terminationReason: 'COMPLETED',
        cleanupResult: 'SUCCEEDED',
        resourceReleaseResult: 'RELEASED',
        schedulerDisposition: 'RELEASED',
        operationalDisposition: 'OK',
      },
    })

    expect(client.bridgeFlowRunRuntime.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { runId: 'run-1' },
        create: expect.objectContaining({ runEpochMs: 42n, compiledPlanHash: 'sha256:plan' }),
      }),
    )
    expect(client.bridgeFlowStepOccurrence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { runId_occurrenceId: { runId: 'run-1', occurrenceId: 'occ-1' } },
      }),
    )
    expect(client.bridgeFlowActionTransition.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          runId_occurrenceId_requestId_phase: {
            runId: 'run-1',
            occurrenceId: 'occ-1',
            requestId: 'request-1',
            phase: 'EFFECT_VERIFIED',
          },
        },
        create: expect.objectContaining({ occurrenceId: 'occ-1', atMs: 50n }),
      }),
    )
    expect(client.bridgeFlowRunRuntime.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productVerdict: 'PASS_ONLINE' }),
      }),
    )
  })

  it('upserts repeated Oracle revision one with one deterministic replay key', async () => {
    const client = clientFixture()
    const persistence = new PrismaExecutionPersistence(client)
    const record = {
      runId: 'run-1',
      occurrenceId: 'occ-1',
      evaluatorKind: 'FINAL_ORACLE' as const,
      evaluation: {
        outcome: 'SATISFIED' as const,
        productVerdict: 'PASS_ONLINE' as const,
        evaluationFailureClass: 'NONE' as const,
        requirementsByFact: {},
        evidenceRefs: ['fact:delivery'],
      },
    }
    vi.mocked(client.bridgeFlowOracleEvaluation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        idempotencyKey: 'canonical-oracle-revision-key',
        outcome: 'SATISFIED',
        productVerdict: 'PASS_ONLINE',
        evaluationFailureClass: 'NONE',
        requirements: { __worker: { lastEvidenceRevision: 0 } },
        evidenceRefs: ['fact:delivery'],
      } as never)

    await persistence.persistOracleEvaluation(record)
    await persistence.persistOracleEvaluation(record)

    const idempotencyKey = 'canonical-oracle-revision-key'
    expect(canonicalOracleKey).toHaveBeenCalledWith({
      runId: 'run-1',
      occurrenceId: 'occ-1',
      evaluatorKind: 'FINAL_ORACLE',
      revision: 1,
    })
    expect(client.bridgeFlowOracleEvaluation.create).toHaveBeenCalledTimes(1)
    expect(client.bridgeFlowOracleEvaluation.upsert).not.toHaveBeenCalled()
    expect(client.bridgeFlowOracleEvaluation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        runId: 'run-1',
        occurrenceId: 'occ-1',
        evaluatorKind: 'FINAL_ORACLE',
        revision: 1,
        idempotencyKey,
      }),
    })
  })

  it('upserts explicit Oracle worker revisions with evidence explanation', async () => {
    const client = clientFixture()
    const persistence = new PrismaExecutionPersistence(client)

    await persistence.persistOracleRevision({
      runId: 'run-1',
      occurrenceId: 'occ-1',
      evaluatorKind: 'CONTINUE_GATE',
      revision: 3,
      evaluation: {
        outcome: 'SATISFIED',
        completedAtMs: 200,
        evidenceRefs: ['delivery.persisted'],
        reason: 'continue gate satisfied by current receipt-safe facts',
      },
      evidenceRefs: ['delivery.persisted'],
      lastEvidenceRevision: 12,
      reason: 'continue gate satisfied by current receipt-safe facts',
    })

    expect(canonicalOracleKey).toHaveBeenLastCalledWith({
      runId: 'run-1',
      occurrenceId: 'occ-1',
      evaluatorKind: 'CONTINUE_GATE',
      revision: 3,
    })
    expect(client.bridgeFlowOracleEvaluation.create).toHaveBeenLastCalledWith(
      {
        data: expect.objectContaining({
          revision: 3,
          idempotencyKey: 'canonical-oracle-revision-key',
          requirements: {
            reason: 'continue gate satisfied by current receipt-safe facts',
            __worker: { lastEvidenceRevision: 12 },
          },
          evidenceRefs: ['delivery.persisted'],
        }),
      },
    )
  })

  it('fails closed when an existing Oracle revision has different immutable content', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowOracleEvaluation.findUnique).mockResolvedValue({
      runId: 'run-1',
      occurrenceId: 'occ-1',
      evaluatorKind: 'FINAL_ORACLE',
      revision: 1,
      idempotencyKey: 'canonical-oracle-revision-key',
      outcome: 'VIOLATED',
      productVerdict: 'FAIL_PRODUCT',
      evaluationFailureClass: 'NONE',
      requirements: {},
      evidenceRefs: [],
    } as never)
    const persistence = new PrismaExecutionPersistence(client)

    await expect(
      persistence.persistOracleRevision({
        runId: 'run-1',
        occurrenceId: 'occ-1',
        evaluatorKind: 'FINAL_ORACLE',
        revision: 1,
        lastEvidenceRevision: 1,
        evaluation: {
          outcome: 'SATISFIED',
          productVerdict: 'PASS_ONLINE',
          evaluationFailureClass: 'NONE',
          requirementsByFact: {},
          evidenceRefs: ['delivery.persisted'],
        },
        evidenceRefs: ['delivery.persisted'],
      }),
    ).rejects.toThrow('oracle revision collision')
    expect(client.bridgeFlowOracleEvaluation.create).not.toHaveBeenCalled()
  })

  it('rechecks immutable content after losing a concurrent Oracle create race', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowOracleEvaluation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        idempotencyKey: 'canonical-oracle-revision-key',
        outcome: 'VIOLATED',
        productVerdict: 'FAIL_PRODUCT',
        evaluationFailureClass: 'NONE',
        requirements: {},
        evidenceRefs: [],
      } as never)
    vi.mocked(client.bridgeFlowOracleEvaluation.create).mockRejectedValueOnce(
      new Error('unique constraint'),
    )
    const persistence = new PrismaExecutionPersistence(client)

    await expect(
      persistence.persistOracleRevision({
        runId: 'run-1',
        occurrenceId: 'occ-1',
        evaluatorKind: 'FINAL_ORACLE',
        revision: 1,
        lastEvidenceRevision: 1,
        evaluation: {
          outcome: 'SATISFIED',
          productVerdict: 'PASS_ONLINE',
          evaluationFailureClass: 'NONE',
          requirementsByFact: {},
          evidenceRefs: ['delivery.persisted'],
        },
        evidenceRefs: ['delivery.persisted'],
      }),
    ).rejects.toThrow('oracle revision collision')
    expect(client.bridgeFlowOracleEvaluation.findUnique).toHaveBeenCalledTimes(2)
  })

  it('loads the latest Oracle evaluation revision and evidence cursor', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowOracleEvaluation.findFirst).mockResolvedValue({
      revision: 7,
      requirements: { __worker: { lastEvidenceRevision: 12 } },
    } as never)
    const persistence = new PrismaExecutionPersistence(client)

    await expect(
      persistence.loadOracleCheckpoint({
        runId: 'run-1',
        occurrenceId: 'occ-1',
        evaluatorKind: 'FINAL_ORACLE',
      }),
    ).resolves.toEqual({ latestRevision: 7, lastEvidenceRevision: 12 })
  })

  it('atomically keeps the first durable wait terminal result', async () => {
    const client = clientFixture()
    const winner = {
      runId: 'run-race',
      occurrenceId: 'occ-race',
      waitPlanId: 'wait-plan',
      requestId: 'request-1',
      status: 'EXPECTED_MATCH',
      resultKey: 'ready',
      cancelStatus: null,
    }
    vi.mocked(client.bridgeFlowWaitEvent.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner as never)
    vi.mocked(client.bridgeFlowWaitEvent.create)
      .mockResolvedValueOnce(winner as never)
      .mockRejectedValueOnce(new Error('unique constraint'))
    const persistence = new PrismaExecutionPersistence(client)
    const base = {
      runId: 'run-race',
      occurrenceId: 'occ-race',
      waitPlanId: 'wait-plan',
      requestId: 'request-1',
    }

    const results = await Promise.all([
      persistence.settleWaitTerminal({
        ...base,
        status: 'EXPECTED_MATCH',
        key: 'ready',
      }),
      persistence.settleWaitTerminal({ ...base, status: 'TIMEOUT' }),
    ])

    expect(results.filter((result) => result.won)).toHaveLength(1)
    expect(results[0]?.result).toEqual(results[1]?.result)
    expect(client.bridgeFlowWaitEvent.upsert).not.toHaveBeenCalled()
  })

  it('claims a recovery lease with one conditional update winner', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.updateMany)
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 0 } as never)
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValueOnce({
      recoveryLeaseToken: 'token-1',
      recoveryLeaseEpoch: 1n,
      recoveryLeaseOwner: 'worker-1',
      recoveryLeaseExpiresAt: new Date('2026-08-05T16:01:00.000Z'),
    } as never)
    const persistence = new PrismaExecutionPersistence(client)
    const claim = {
      runId: 'run-claim',
      expectedVersion: '2026-08-05T16:00:00.000Z',
      expectedSchedulerDisposition: 'LEASED',
      leaseExpiresAtMs: Date.parse('2026-08-05T16:01:00.000Z'),
    }

    await expect(persistence.claimRecoveryLease({
      ...claim,
      workerId: 'worker-1',
      leaseToken: 'token-1',
    })).resolves.toMatchObject({ token: 'token-1', epoch: 1 })
    await expect(persistence.claimRecoveryLease({
      ...claim,
      workerId: 'worker-2',
      leaseToken: 'token-2',
    })).resolves.toBeUndefined()
  })

  it('rejects a stale recovery checkpoint revision', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryCheckpointRevision: 6,
      recoveryCheckpoint: null,
      recoveryLeaseToken: null,
      recoveryLeaseEpoch: 0n,
      recoveryLeaseExpiresAt: null,
    } as never)
    const persistence = new PrismaExecutionPersistence(client)

    await expect(persistence.persistRecoveryCheckpoint({
      runId: 'run-checkpoint',
      revision: 5,
      nextStepId: 'repeat',
      runtimeIterationKey: 'root',
      occurrenceCounts: { repeat: 5 },
      completedOccurrenceIds: [],
      completedIterationKeys: [],
      continuationStack: [],
      outcomeState: {
        unknownEffect: false,
        automationFailure: false,
        evidenceInsufficient: false,
        productVerdicts: [],
      },
    } as never)).rejects.toThrow(/revision/)
    expect(client.bridgeFlowRunRuntime.updateMany).not.toHaveBeenCalled()
  })

  it('fails closed when a terminal occurrence has no true next checkpoint', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryCheckpointRevision: 1,
      recoveryCheckpoint: {
          runId: 'run-terminal-cursor',
          revision: 1,
          nextStepId: 'already-terminal',
          runtimeIterationKey: 'root',
          occurrenceCounts: { 'already-terminal': 1 },
          completedOccurrenceIds: [],
          completedIterationKeys: [],
          continuationStack: [],
          outcomeState: {
            unknownEffect: false,
            automationFailure: false,
            evidenceInsufficient: false,
            productVerdicts: [],
          },
        },
      recoveryLeaseToken: 'lease-terminal',
      recoveryLeaseEpoch: 1n,
      recoveryLeaseOwner: 'worker-1',
      recoveryLeaseExpiresAt: new Date('2026-08-05T17:00:00.000Z'),
    } as never)
    vi.mocked(client.bridgeFlowStepOccurrence.findMany).mockResolvedValue([{
      occurrenceId: 'run-terminal-cursor:already-terminal:0',
      planStepId: 'already-terminal',
      occurrenceIndex: 0,
      iterationKey: 'root',
      lifecycle: 'COMPLETED',
      actionResult: 'SUCCEEDED',
      startedAt: new Date('2026-08-05T16:00:00.000Z'),
    }] as never)
    const persistence = new PrismaExecutionPersistence(
      client,
      () => new Date('2026-08-05T16:00:00.000Z'),
    )

    await expect(
      persistence.loadRecoverySnapshot('run-terminal-cursor'),
    ).rejects.toThrow(/safe checkpoint|reconciliation/i)
  })

  it('loads the exact safe next location without inferring from occurrence count', async () => {
    const client = clientFixture()
    const completedId = 'run-safe-next:completed:0'
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryCheckpointRevision: 3,
      recoveryCheckpoint: {
        runId: 'run-safe-next',
        revision: 3,
        nextStepId: 'true-next',
        runtimeIterationKey: 'root',
        occurrenceCounts: { completed: 1, 'true-next': 0 },
        completedOccurrenceIds: [completedId],
        completedIterationKeys: [],
        continuationStack: [],
        outcomeState: {
          unknownEffect: false,
          automationFailure: false,
          evidenceInsufficient: false,
          productVerdicts: [],
        },
      },
      recoveryLeaseToken: 'safe-token',
      recoveryLeaseEpoch: 3n,
      recoveryLeaseOwner: 'worker-safe',
      recoveryLeaseExpiresAt: new Date('2026-08-05T17:00:00.000Z'),
    } as never)
    vi.mocked(client.bridgeFlowStepOccurrence.findMany).mockResolvedValue([{
      occurrenceId: completedId,
      planStepId: 'completed',
      occurrenceIndex: 0,
      iterationKey: 'root',
      lifecycle: 'COMPLETED',
      actionResult: 'SUCCEEDED',
      startedAt: new Date('2026-08-05T15:59:00.000Z'),
    }] as never)
    const persistence = new PrismaExecutionPersistence(
      client,
      () => new Date('2026-08-05T16:00:00.000Z'),
    )

    await expect(persistence.loadRecoverySnapshot('run-safe-next')).resolves.toMatchObject({
      nextStepId: 'true-next',
      occurrenceCounts: { completed: 1, 'true-next': 0 },
      completedOccurrenceIds: [completedId],
      recoveryFence: { token: 'safe-token', epoch: 3 },
    })
  })

  it('returns a durable token and incremented epoch from lease claim', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.updateMany).mockResolvedValue({
      count: 1,
    } as never)
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryLeaseToken: 'lease-token-2',
      recoveryLeaseEpoch: 2n,
      recoveryLeaseOwner: 'worker-2',
      recoveryLeaseExpiresAt: new Date('2026-08-05T16:01:00.000Z'),
    } as never)
    const persistence = new PrismaExecutionPersistence(client)

    await expect(persistence.claimRecoveryLease({
      runId: 'run-fenced',
      expectedVersion: '2026-08-05T16:00:00.000Z',
      expectedSchedulerDisposition: 'LEASED',
      workerId: 'worker-2',
      leaseToken: 'lease-token-2',
      leaseExpiresAtMs: Date.parse('2026-08-05T16:01:00.000Z'),
    } as never)).resolves.toEqual({
      token: 'lease-token-2',
      epoch: 2,
      owner: 'worker-2',
      expiresAtMs: Date.parse('2026-08-05T16:01:00.000Z'),
    })
  })

  it('rejects every resumed write after its recovery fence expires', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryLeaseToken: 'lost-token',
      recoveryLeaseEpoch: 4n,
      recoveryLeaseExpiresAt: new Date('2026-08-05T15:59:59.000Z'),
    } as never)
    const persistence = new PrismaExecutionPersistence(
      client,
      () => new Date('2026-08-05T16:00:00.000Z'),
    )

    await expect(persistence.persistStepOccurrence({
      runId: 'run-expired',
      occurrenceId: 'occ-1',
      planStepId: 'step-1',
      occurrenceIndex: 0,
      iterationKey: 'root',
      requestId: 'request-1',
      startedAtMs: 1,
      recoveryFence: { token: 'lost-token', epoch: 4 },
      outcome: { ...createInitialStepOutcome(), actionResult: 'SUCCEEDED' },
    } as never)).rejects.toThrow(/fence|lease|expired/i)
    expect(client.bridgeFlowStepOccurrence.upsert).not.toHaveBeenCalled()
  })

  it('locks and validates the lease row inside the child-write transaction', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryLeaseToken: 'locked-token',
      recoveryLeaseEpoch: 5n,
      recoveryLeaseExpiresAt: new Date('2026-08-05T16:01:00.000Z'),
    } as never)
    const persistence = new PrismaExecutionPersistence(
      client,
      () => new Date('2026-08-05T16:00:00.000Z'),
    )

    await persistence.persistStepOccurrence({
      runId: 'run-locked',
      occurrenceId: 'occ-locked',
      planStepId: 'step-locked',
      occurrenceIndex: 0,
      iterationKey: 'root',
      requestId: 'request-locked',
      startedAtMs: 1,
      recoveryFence: { token: 'locked-token', epoch: 5 },
      outcome: { ...createInitialStepOutcome(), actionResult: 'SUCCEEDED' },
    } as never)

    expect(client.$transaction).toHaveBeenCalledTimes(1)
    expect(client.$queryRaw).toHaveBeenCalledTimes(1)
    expect(client.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      client.bridgeFlowStepOccurrence.upsert.mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY,
    )
  })

  it('locks the lease row before checkpoint CAS in the same transaction', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryCheckpointRevision: 0,
      recoveryCheckpoint: null,
      recoveryLeaseToken: 'checkpoint-token',
      recoveryLeaseEpoch: 1n,
      recoveryLeaseExpiresAt: new Date('2026-08-05T16:01:00.000Z'),
    } as never)
    vi.mocked(client.bridgeFlowRunRuntime.updateMany).mockResolvedValue({
      count: 1,
    } as never)
    const persistence = new PrismaExecutionPersistence(
      client,
      () => new Date('2026-08-05T16:00:00.000Z'),
    )

    await persistence.persistRecoveryCheckpoint({
      runId: 'run-checkpoint-lock',
      revision: 1,
      nextStepId: null,
      runtimeIterationKey: 'root',
      occurrenceCounts: {},
      completedOccurrenceIds: [],
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
      recoveryFence: { token: 'checkpoint-token', epoch: 1 },
    } as never)

    expect(client.$transaction).toHaveBeenCalledTimes(1)
    expect(client.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ maxWait: 10_000, timeout: 30_000 }),
    )
    expect(client.$queryRaw).toHaveBeenCalledTimes(1)
    expect(client.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      client.bridgeFlowRunRuntime.updateMany.mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY,
    )
  })

  it('accepts legal loop-frame removal only at the next checkpoint revision', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.updateMany).mockResolvedValue({
      count: 1,
    } as never)
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryCheckpointRevision: 7,
      recoveryCheckpoint: {
        runId: 'run-loop-cas',
        revision: 7,
        nextStepId: 'body',
        runtimeIterationKey: 'outer[1]',
        occurrenceCounts: { body: 2 },
        completedOccurrenceIds: ['occ-1'],
        completedIterationKeys: ['outer[0]'],
        continuationStack: [{
          loopStepId: 'outer',
          parentIterationKey: 'root',
          bodyStepId: 'body',
          stopBeforeStepId: 'done',
          returnStepId: 'done',
          currentIndex: 1,
          itemCount: 2,
          currentIterationKey: 'outer[1]',
        }],
        outcomeState: {
          unknownEffect: false,
          automationFailure: false,
          evidenceInsufficient: false,
          productVerdicts: [],
        },
      },
      recoveryLeaseToken: 'lease-7',
      recoveryLeaseEpoch: 7n,
      recoveryLeaseExpiresAt: new Date('2026-08-05T16:01:00.000Z'),
    } as never)
    const persistence = new PrismaExecutionPersistence(
      client,
      () => new Date('2026-08-05T16:00:00.000Z'),
    )

    await expect(persistence.persistRecoveryCheckpoint({
      runId: 'run-loop-cas',
      revision: 8,
      nextStepId: 'done',
      runtimeIterationKey: 'root',
      occurrenceCounts: { body: 2 },
      completedOccurrenceIds: ['occ-1'],
      completedIterationKeys: ['outer[0]', 'outer[1]'],
      continuationStack: [],
      outcomeState: {
        unknownEffect: false,
        automationFailure: false,
        evidenceInsufficient: false,
        productVerdicts: [],
      },
      recoveryFence: { token: 'lease-7', epoch: 7 },
    } as never)).resolves.toBeUndefined()
    expect(client.bridgeFlowRunRuntime.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recoveryCheckpointRevision: 7 }),
        data: expect.objectContaining({ recoveryCheckpointRevision: 8 }),
      }),
    )
  })

  it('rejects advancing a loop cursor before its prior iteration is completed', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryCheckpointRevision: 4,
      recoveryCheckpoint: {
        runId: 'run-skipped-loop',
        revision: 4,
        nextStepId: 'body',
        runtimeIterationKey: 'outer[0]',
        occurrenceCounts: {},
        completedOccurrenceIds: [],
        completedIterationKeys: [],
        continuationStack: [{
          loopStepId: 'outer',
          parentIterationKey: 'root',
          bodyStepId: 'body',
          stopBeforeStepId: 'done',
          returnStepId: 'done',
          currentIndex: 0,
          itemCount: 2,
          currentIterationKey: 'outer[0]',
        }],
        outcomeState: {
          stopped: false,
          unknownEffect: false,
          automationFailure: false,
          evidenceInsufficient: false,
          productVerdicts: [],
        },
      },
      recoveryLeaseToken: null,
      recoveryLeaseEpoch: 0n,
      recoveryLeaseExpiresAt: null,
    } as never)
    const persistence = new PrismaExecutionPersistence(client)

    await expect(persistence.persistRecoveryCheckpoint({
      runId: 'run-skipped-loop',
      revision: 5,
      nextStepId: 'body',
      runtimeIterationKey: 'outer[1]',
      occurrenceCounts: {},
      completedOccurrenceIds: [],
      completedIterationKeys: [],
      continuationStack: [{
        loopStepId: 'outer',
        parentIterationKey: 'root',
        bodyStepId: 'body',
        stopBeforeStepId: 'done',
        returnStepId: 'done',
        currentIndex: 1,
        itemCount: 2,
        currentIterationKey: 'outer[1]',
      }],
      outcomeState: {
        stopped: false,
        unknownEffect: false,
        automationFailure: false,
        evidenceInsufficient: false,
        productVerdicts: [],
      },
    } as never)).rejects.toThrow(/completed iteration|advance/i)
    expect(client.bridgeFlowRunRuntime.updateMany).not.toHaveBeenCalled()
  })

  it('rejects replacing equal-length verdict history', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryCheckpointRevision: 2,
      recoveryCheckpoint: {
        runId: 'run-verdict-history',
        revision: 2,
        nextStepId: null,
        runtimeIterationKey: 'root',
        occurrenceCounts: {},
        completedOccurrenceIds: [],
        completedIterationKeys: [],
        continuationStack: [],
        outcomeState: {
          stopped: true,
          unknownEffect: false,
          automationFailure: false,
          evidenceInsufficient: false,
          productVerdicts: ['PASS_ONLINE'],
        },
      },
      recoveryLeaseToken: null,
      recoveryLeaseEpoch: 0n,
      recoveryLeaseExpiresAt: null,
    } as never)
    const persistence = new PrismaExecutionPersistence(client)

    await expect(persistence.persistRecoveryCheckpoint({
      runId: 'run-verdict-history',
      revision: 3,
      nextStepId: null,
      runtimeIterationKey: 'root',
      occurrenceCounts: {},
      completedOccurrenceIds: [],
      completedIterationKeys: [],
      continuationStack: [],
      outcomeState: {
        stopped: true,
        unknownEffect: false,
        automationFailure: false,
        evidenceInsufficient: false,
        productVerdicts: ['FAIL_PRODUCT'],
      },
    } as never)).rejects.toThrow(/verdict|history|prefix/i)
    expect(client.bridgeFlowRunRuntime.updateMany).not.toHaveBeenCalled()
  })

  it('marks unknown effect and closes the run in one fenced transaction', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.findUnique).mockResolvedValue({
      recoveryLeaseToken: 'lease-9',
      recoveryLeaseEpoch: 9n,
      recoveryLeaseExpiresAt: new Date('2026-08-05T16:01:00.000Z'),
    } as never)
    vi.mocked(client.bridgeFlowStepOccurrence.updateMany).mockResolvedValue({
      count: 1,
    } as never)
    vi.mocked(client.bridgeFlowRunRuntime.updateMany).mockResolvedValue({
      count: 1,
    } as never)
    const persistence = new PrismaExecutionPersistence(
      client,
      () => new Date('2026-08-05T16:00:00.000Z'),
    )

    await persistence.markUnknownEffect({
      runId: 'run-unknown-fenced',
      occurrenceId: 'occ-1',
      requestId: 'request-1',
      recoveryFence: { token: 'lease-9', epoch: 9 },
    } as never)

    expect(client.$transaction).toHaveBeenCalledTimes(1)
    expect(client.bridgeFlowStepOccurrence.updateMany).toHaveBeenCalledTimes(1)
    expect(client.bridgeFlowRunRuntime.updateMany).toHaveBeenCalledTimes(1)
  })

  it('releases failed recovery into the scannable LEASED disposition', async () => {
    const client = clientFixture()
    vi.mocked(client.bridgeFlowRunRuntime.updateMany).mockResolvedValue({
      count: 1,
    } as never)
    const persistence = new PrismaExecutionPersistence(client)

    await persistence.releaseRecoveryLease({
      runId: 'run-retryable-release',
      workerId: 'worker-retryable',
      recoveryFence: { token: 'retryable-token', epoch: 6 },
      recoveryDisposition: 'RETRYABLE_FAILURE',
    } as never)

    expect(client.bridgeFlowRunRuntime.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        runId: 'run-retryable-release',
        recoveryLeaseToken: 'retryable-token',
        recoveryLeaseEpoch: 6n,
      }),
      data: expect.objectContaining({
        schedulerDisposition: 'LEASED',
        recoveryLeaseToken: null,
        recoveryLeaseExpiresAt: null,
      }),
    })
  })

  it('keeps revision uniqueness and published immutability in the durable schema', async () => {
    const schema = await readFile(
      new URL('../../../../packages/db/prisma/schema.prisma', import.meta.url),
      'utf8',
    )
    const migration = await readFile(
      new URL(
        '../../../../packages/db/prisma/migrations/20260805174000_phase5_local_completion_contracts/migration.sql',
        import.meta.url,
      ),
      'utf8',
    )

    expect(schema).not.toMatch(/idempotencyKey\s+String\s+@default\(cuid\(\)\)/)
    expect(schema).toContain(
      '@@unique([runId, occurrenceId, iterationKey, factKey, deliveryLane, revision], map: "bridgeflow_evidence_fact_revision_key")',
    )
    expect(schema).toContain(
      '@@unique([runId, occurrenceId, evaluatorKind, revision], map: "bridgeflow_oracle_evaluation_revision_key")',
    )
    expect(schema).toContain('model BridgeFlowEvidenceRunBlock {')
    expect(schema).toContain('bridgeflowRunBlocks BridgeFlowEvidenceRunBlock[]')
    expect(schema).toContain('recoveryLeaseToken')
    expect(schema).toContain('recoveryLeaseEpoch')
    expect(schema).toContain('recoveryCheckpointRevision')
    expect(schema).toContain('recoveryCheckpoint')
    expect(migration).toContain('CREATE TABLE "bridgeflow_evidence_run_block"')
    expect(migration).toContain('ADD COLUMN "recovery_lease_token" TEXT')
    expect(migration).toContain('ADD COLUMN "recovery_lease_epoch" BIGINT')
    expect(migration).toContain('ADD COLUMN "recovery_checkpoint" JSONB')
    expect(migration).toContain(
      'CREATE TRIGGER "verdict_domain_pack_version_immutable_trigger"',
    )
    expect(migration).toContain(
      'CREATE FUNCTION "protect_published_verdict_domain_pack_version"()',
    )
  })
})
