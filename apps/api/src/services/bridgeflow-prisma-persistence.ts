import { Prisma, prisma, type PrismaClient } from '@nesy/db'
import { batchPersistenceEnabled } from './diagnostics/live-profile-flags.js'
import {
  assertInjectedFaultRecord,
  planInjectedFault,
  type DeathProvenance,
  type FaultInjectionProvenance,
  type ObservedClass,
} from '@nesy/workflow-contract'
import type {
  ExecutionPersistencePort,
  PersistedActionTransition,
  PersistedOracleEvaluation,
  PersistedRunResult,
  PersistedRunStart,
  PersistedWaitResult,
} from '@nesy/bridgeflow-executor'
import {
  buildOracleRevisionIdempotencyKey,
  type ActionTransitionPhase,
  type StepOccurrence,
} from '@nesy/execution-contract'
import { publishRunLiveEvent, runLiveKeys, runLiveLevelFor } from './run-live-hub.js'
import type { OracleRevisionRecord } from './oracle-evaluation-worker.js'
import type {
  RecoveryExecutionCandidate,
  RecoveryPersistencePort,
  RecoverySnapshot,
} from './bridgeflow-recovery-worker.js'

type RecoveryFence = { token: string; epoch: number }

const FENCE_TRANSACTION_MAX_WAIT_MS = 10_000
const FENCE_TRANSACTION_TIMEOUT_MS = 30_000

type PersistedStepOccurrence = StepOccurrence & {
  startedAtMs?: number
  recoveryFence?: RecoveryFence
}

type PersistStepBoundaryInput = Parameters<NonNullable<ExecutionPersistencePort['persistStepStart']>>[0]
type PersistRecoveryCheckpointInput = Parameters<ExecutionPersistencePort['persistRecoveryCheckpoint']>[0]

interface CompleteRecoveryCheckpoint {
  runId: string
  revision?: number
  nextStepId: string | null
  runtimeIterationKey: string
  occurrenceCounts: Readonly<Record<string, number>>
  completedOccurrenceIds: readonly string[]
  completedIterationKeys: readonly string[]
  startedAtMsByOccurrenceId?: Readonly<Record<string, number>>
  continuationStack: RecoverySnapshot['continuationStack']
  outcomeState: RecoverySnapshot['outcomeState']
  recoveryFence?: RecoveryFence
  lastCompletedControl?: RecoverySnapshot['lastCompletedControl']
}

interface WaitTerminalSettlement {
  won: boolean
  result: PersistedWaitResult
}

export type PrismaRuntimeClient = Pick<
  PrismaClient,
  | 'bridgeFlowRunRuntime'
  | 'bridgeFlowStepOccurrence'
  | 'bridgeFlowActionTransition'
  | 'bridgeFlowWaitEvent'
  | 'bridgeFlowOracleEvaluation'
  | '$transaction'
  | '$queryRaw'
>

export class PrismaExecutionPersistence
  implements ExecutionPersistencePort, RecoveryPersistencePort {
  constructor(
    private readonly client: PrismaRuntimeClient,
    private readonly now: () => Date = () => new Date(),
  ) {
    // The executor selects the merged step boundaries by feature-detecting these
    // optional ports, so an own `undefined` is what returns an arm — or a
    // rollback — to the pre-batch serial path without a second build. It belongs
    // in the constructor because the execution queue builds this class directly
    // and would otherwise never see a factory-level switch.
    if (!batchPersistenceEnabled()) {
      Object.assign(this, {
        persistStepStart: undefined,
        persistStepCompletion: undefined,
        persistActionTransitions: undefined,
      })
    }
  }

  async persistRunStart(record: PersistedRunStart): Promise<RecoveryFence> {
    const { manifest } = record
    const profile = manifest.profile
    const now = this.now()
    const fenceToken = `exec:${record.runId}:${now.getTime()}`
    const leaseExpiresAt = new Date(now.getTime() + 60 * 60 * 1000)
    const data = {
      engineType: record.engineType,
      compiledPlanRef: manifest.compiledPlanRef,
      compiledPlanHash: manifest.compiledPlanHash,
      domainPackKey: manifest.domainPackKey,
      domainPackVersion: manifest.domainPackVersion,
      domainPackDigest: manifest.domainPackDigest,
      workflowIrSchemaVersion: manifest.workflowIrSchemaVersion,
      compilerVersion: manifest.compilerVersion,
      bridgeProtocolVersion: manifest.bridgeProtocolVersion,
      sdkProtocolVersion: manifest.sdkProtocolVersion,
      runEpochMs: BigInt(manifest.runEpochMs),
      runEpochUnit: manifest.runEpochUnit,
      profileSnapshot: toInputJson(profile),
      campaignId: profile.campaignId,
      buildRef: profile.buildRef,
      datasetRef: profile.datasetRef,
      deviceCell: profile.deviceCell,
      repetitionIndex: profile.repetitionIndex,
      faultPlanRef: profile.faultPlanRef,
      ...planInjectedFault({
        injectedFault: profile.injectedFault ?? null,
        injectedFaultHost: profile.injectedFaultHost ?? null,
      }),
      telemetryPolicyRef: profile.telemetryPolicyRef,
      releaseGate: profile.releaseGate,
      lifecycle: 'RUNNING',
      schedulerDisposition: 'LEASED',
      recoveryLeaseToken: fenceToken,
      recoveryLeaseEpoch: 1n,
      recoveryLeaseOwner: 'executor',
      recoveryLeaseExpiresAt: leaseExpiresAt,
      recoveryLeaseRenewedAt: now,
    }
    await this.client.bridgeFlowRunRuntime.upsert({
      where: { runId: record.runId },
      create: { runId: record.runId, ...data },
      update: data,
    })
    // Published only after the row exists: a live feed that announced a run
    // start the database then rejected would be the one account of the run, and
    // it would be wrong.
    publishRunLiveEvent({
      runId: record.runId,
      kind: 'RUN_STATUS',
      level: 'INFO',
      title: `Execution started · ${manifest.domainPackKey}@${manifest.domainPackVersion}`,
      // The watcher would otherwise announce the same RUNNING lifecycle from the
      // row this call just wrote.
      dedupeKey: runLiveKeys.runtime('RUNNING', '', ''),
      detail: {
        engineType: record.engineType,
        compiledPlanHash: manifest.compiledPlanHash,
        profileKey: profile.profileKey,
        releaseGate: profile.releaseGate,
      },
    })
    return { token: fenceToken, epoch: 1 }
  }

  async persistStepOccurrence(occurrence: PersistedStepOccurrence): Promise<void> {
    await this.withFence(occurrence.runId, occurrence.recoveryFence, (client) =>
      this.persistStepOccurrenceWithin(client, occurrence))
    this.publishStepOccurrence(occurrence)
  }

  async persistStepStart(input: PersistStepBoundaryInput): Promise<void> {
    const checkpoint = this.requireCompleteRecoveryCheckpoint(input.checkpoint)
    await this.withFence(input.occurrence.runId, input.occurrence.recoveryFence, async (client) => {
      await this.persistStepOccurrenceWithin(client, input.occurrence)
      await this.persistRecoveryCheckpointWithin(client, checkpoint)
    })
    this.publishStepOccurrence(input.occurrence)
  }

  async persistStepCompletion(input: PersistStepBoundaryInput): Promise<void> {
    const checkpoint = this.requireCompleteRecoveryCheckpoint(input.checkpoint)
    await this.withFence(input.occurrence.runId, input.occurrence.recoveryFence, async (client) => {
      await this.persistRecoveryCheckpointWithin(client, checkpoint)
      await this.persistStepOccurrenceWithin(client, input.occurrence)
    })
    this.publishStepOccurrence(input.occurrence)
  }

  async persistActionTransition(
    record: PersistedActionTransition & { recoveryFence?: RecoveryFence },
  ): Promise<void> {
    const transition = record.transition
    await this.withFence(record.runId, record.recoveryFence, (client) =>
      this.persistActionTransitionWithin(client, record))
    publishRunLiveEvent({
      runId: record.runId,
      kind: 'ACTION',
      level: transition.terminal === null ? 'INFO' : runLiveLevelFor(transition.terminal),
      title: `${record.occurrenceId} · ${transition.phase}`,
      atMs: transition.atMs,
      dedupeKey: runLiveKeys.action(record.occurrenceId, transition.requestId, transition.phase),
      detail: {
        occurrenceId: record.occurrenceId,
        requestId: transition.requestId,
        phase: transition.phase,
        terminal: transition.terminal,
        evidenceRef: transition.evidenceRef,
      },
    })
  }

  async persistActionTransitions(
    records: readonly (PersistedActionTransition & { recoveryFence?: RecoveryFence })[],
  ): Promise<void> {
    if (records.length === 0) return
    const first = records[0]!
    for (const record of records) {
      if (record.runId !== first.runId || record.recoveryFence?.token !== first.recoveryFence?.token ||
          record.recoveryFence?.epoch !== first.recoveryFence?.epoch) {
        throw new Error('batched action transitions must share one run fence')
      }
    }
    await this.withFence(first.runId, first.recoveryFence, async (client) => {
      for (const record of records) await this.persistActionTransitionWithin(client, record)
    })
    for (const record of records) {
      const transition = record.transition
      publishRunLiveEvent({
        runId: record.runId,
        kind: 'ACTION',
        level: transition.terminal === null ? 'INFO' : runLiveLevelFor(transition.terminal),
        title: `${record.occurrenceId} · ${transition.phase}`,
        atMs: transition.atMs,
        dedupeKey: runLiveKeys.action(record.occurrenceId, transition.requestId, transition.phase),
        detail: {
          occurrenceId: record.occurrenceId,
          requestId: transition.requestId,
          phase: transition.phase,
          terminal: transition.terminal,
          evidenceRef: transition.evidenceRef,
        },
      })
    }
  }

  async persistWaitResult(
    result: PersistedWaitResult & { recoveryFence?: RecoveryFence },
  ): Promise<void> {
    await this.settleWaitTerminal(result)
  }

  async settleWaitTerminal(
    result: PersistedWaitResult & { recoveryFence?: RecoveryFence },
  ): Promise<WaitTerminalSettlement> {
    const data = {
      requestId: result.requestId,
      status: result.status,
      resultKey: result.key,
      cancelStatus: result.cancelStatus,
      terminalAt: this.now(),
    }
    const where = {
      runId_occurrenceId_waitPlanId: {
        runId: result.runId,
        occurrenceId: result.occurrenceId,
        waitPlanId: result.waitPlanId,
      },
    }
    const select = {
      runId: true,
      occurrenceId: true,
      waitPlanId: true,
      requestId: true,
      status: true,
      resultKey: true,
      cancelStatus: true,
    } as const
    const settlement = await this.withFence(result.runId, result.recoveryFence, async (client) => {
    const existing = await client.bridgeFlowWaitEvent.findUnique({ where, select })
    if (existing !== null) {
      return { won: false, result: waitRow(existing) }
    }
    try {
      const created = await client.bridgeFlowWaitEvent.create({
        data: {
        runId: result.runId,
        occurrenceId: result.occurrenceId,
        waitPlanId: result.waitPlanId,
        ...data,
        },
        select,
      })
      return { won: true, result: waitRow(created) }
    } catch (error) {
      const raced = await client.bridgeFlowWaitEvent.findUnique({ where, select })
      if (raced === null) throw error
      return { won: false, result: waitRow(raced) }
    }
    })
    // Only the writer that settled the wait announces it. A loser republishing
    // the same terminal would show the operator two outcomes for one wait.
    if (settlement.won) {
      publishRunLiveEvent({
        runId: result.runId,
        kind: 'WAIT',
        level: runLiveLevelFor(result.status),
        title: `wait ${result.waitPlanId} → ${result.status}`,
        dedupeKey: runLiveKeys.wait(result.occurrenceId, result.waitPlanId, result.status),
        detail: {
          occurrenceId: result.occurrenceId,
          waitPlanId: result.waitPlanId,
          requestId: result.requestId,
          status: result.status,
          resultKey: result.key,
          cancelStatus: result.cancelStatus,
        },
      })
    }
    return settlement
  }

  async persistRecoveryCheckpoint(
    checkpoint: PersistRecoveryCheckpointInput,
  ): Promise<void> {
    const complete = this.requireCompleteRecoveryCheckpoint(checkpoint)
    await this.withFence(
      complete.runId,
      complete.recoveryFence,
      (client) => this.persistRecoveryCheckpointWithin(client, complete),
    )
  }

  /**
   * The executor's copy of an evaluation the Oracle worker may have already written.
   *
   * Two writers, one row: the worker persists a revision per evaluation pass, then
   * the executor persists the evaluation it was handed back. This used to write
   * `revision: 1` unconditionally, so as soon as a gate needed more than one pass —
   * `UNKNOWN` while waiting, then `TIMED_OUT` — the executor's write landed on the
   * worker's revision 1 with different content and the run died with
   * `oracle revision collision`. It stayed hidden only because a blocked gate never
   * evaluated at all.
   *
   * Revisions are an append-only audit, so the same content is a REPLAY (write
   * nothing) and different content is the NEXT revision (never an overwrite).
   */
  async persistOracleEvaluation(
    record: PersistedOracleEvaluation & { recoveryFence?: RecoveryFence },
  ): Promise<void> {
    const evidenceRefs = [...record.evaluation.evidenceRefs]
    const reason = 'reason' in record.evaluation ? record.evaluation.reason : undefined
    const latest = await this.client.bridgeFlowOracleEvaluation.findFirst({
      where: {
        runId: record.runId,
        occurrenceId: record.occurrenceId,
        evaluatorKind: record.evaluatorKind,
      },
      orderBy: { revision: 'desc' },
      select: { revision: true, outcome: true, evidenceRefs: true },
    })
    if (
      latest !== null &&
      latest.outcome === record.evaluation.outcome &&
      stableJson(latest.evidenceRefs) === stableJson(evidenceRefs)
    ) {
      return
    }
    await this.persistOracleRevision({
      ...record,
      revision: (latest?.revision ?? 0) + 1,
      lastEvidenceRevision: 0,
      evidenceRefs,
      ...(reason === undefined ? {} : { reason }),
    })
  }

  async loadOracleCheckpoint(input: {
    runId: string
    occurrenceId: string
    evaluatorKind: 'CONTINUE_GATE' | 'FINAL_ORACLE'
  }): Promise<{ latestRevision: number; lastEvidenceRevision: number }> {
    const latest = await this.client.bridgeFlowOracleEvaluation.findFirst({
      where: {
        runId: input.runId,
        occurrenceId: input.occurrenceId,
        evaluatorKind: input.evaluatorKind,
      },
      orderBy: { revision: 'desc' },
      select: { revision: true, requirements: true },
    })
    return latest === null
      ? { latestRevision: 0, lastEvidenceRevision: 0 }
      : {
          latestRevision: latest.revision,
          lastEvidenceRevision: readLastEvidenceRevision(latest.requirements),
        }
  }

  async persistOracleRevision(
    record: OracleRevisionRecord & { recoveryFence?: RecoveryFence },
  ): Promise<void> {
    const { evaluation, revision } = record
    const idempotencyKey = buildOracleRevisionIdempotencyKey({
      runId: record.runId,
      occurrenceId: record.occurrenceId,
      evaluatorKind: record.evaluatorKind,
      revision,
    })
    const data = {
      revision,
      idempotencyKey,
      outcome: evaluation.outcome,
      productVerdict: 'productVerdict' in evaluation ? evaluation.productVerdict : undefined,
      evaluationFailureClass:
        'evaluationFailureClass' in evaluation ? evaluation.evaluationFailureClass : undefined,
      requirements: toInputJson({
        ...('requirementsByFact' in evaluation
          ? evaluation.requirementsByFact
          : record.reason === undefined
            ? {}
            : { reason: record.reason }),
        __worker: { lastEvidenceRevision: record.lastEvidenceRevision },
      }),
      evidenceRefs: [...record.evidenceRefs],
    }
    const where = {
      runId_occurrenceId_evaluatorKind_revision: {
        runId: record.runId,
        occurrenceId: record.occurrenceId,
        evaluatorKind: record.evaluatorKind,
        revision,
      },
    }
    const create = {
      runId: record.runId,
      occurrenceId: record.occurrenceId,
      evaluatorKind: record.evaluatorKind,
      ...data,
    }
    const select = {
      idempotencyKey: true,
      outcome: true,
      productVerdict: true,
      evaluationFailureClass: true,
      requirements: true,
      evidenceRefs: true,
    } as const
    await this.withFence(record.runId, record.recoveryFence, async (client) => {
    const existing = await client.bridgeFlowOracleEvaluation.findUnique({ where, select })
    if (existing !== null) {
      assertSameOracleRevision(existing, data)
      return
    }
    try {
      await client.bridgeFlowOracleEvaluation.create({ data: create })
    } catch (error) {
      // Another worker may win the unique-key race between find and create.
      // Re-read and accept only an exact immutable replay.
      const raced = await client.bridgeFlowOracleEvaluation.findUnique({ where, select })
      if (raced === null) throw error
      assertSameOracleRevision(raced, data)
    }
    })
    publishRunLiveEvent({
      runId: record.runId,
      kind: 'ORACLE',
      level: runLiveLevelFor(evaluation.outcome),
      title: `${record.evaluatorKind} rev${revision} → ${evaluation.outcome}`,
      dedupeKey: runLiveKeys.oracle(
        record.occurrenceId,
        record.evaluatorKind,
        String(revision),
      ),
      detail: {
        occurrenceId: record.occurrenceId,
        evaluatorKind: record.evaluatorKind,
        revision,
        outcome: evaluation.outcome,
        productVerdict: data.productVerdict,
        evaluationFailureClass: data.evaluationFailureClass,
      },
    })
  }

  async persistObservedClass(input: {
    runId: string
    observedClass: ObservedClass
    deathProvenance?: DeathProvenance | null
  }): Promise<void> {
    const row = await this.client.bridgeFlowRunRuntime.findUnique({
      where: { runId: input.runId },
      select: {
        injectedFault: true,
        expectedClass: true,
        injectedFaultHost: true,
        deathProvenance: true,
      },
    })
    if (row === null) {
      throw new Error(`cannot persist observedClass: runtime row ${input.runId} is missing`)
    }
    const record = {
      injectedFault: row.injectedFault,
      expectedClass: row.expectedClass,
      observedClass: input.observedClass,
      injectedFaultHost: row.injectedFaultHost,
      deathProvenance: input.deathProvenance ?? row.deathProvenance,
    }
    assertInjectedFaultRecord(record as Parameters<typeof assertInjectedFaultRecord>[0])
    await this.client.bridgeFlowRunRuntime.update({
      where: { runId: input.runId },
      data: {
        observedClass: record.observedClass,
        deathProvenance: record.deathProvenance,
      },
    })
  }

  async persistFaultProvenance(input: {
    runId: string
    provenance: FaultInjectionProvenance
  }): Promise<void> {
    await this.client.bridgeFlowRunRuntime.updateMany({
      where: { runId: input.runId },
      data: {
        faultProvenance: input.provenance as unknown as Prisma.InputJsonValue,
      },
    })
  }

  async persistRunResult(
    record: PersistedRunResult & { recoveryFence?: RecoveryFence },
  ): Promise<void> {
    await this.withFence(record.runId, record.recoveryFence, (client) =>
      client.bridgeFlowRunRuntime.update({
      where: { runId: record.runId },
      data: {
        lifecycle: record.result.lifecycle,
        productVerdict: record.result.productVerdict,
        evaluationFailureClass: record.result.evaluationFailureClass,
        terminationReason: record.result.terminationReason,
        cleanupResult: record.result.cleanupResult,
        resourceReleaseResult: record.result.resourceReleaseResult,
        schedulerDisposition: record.result.schedulerDisposition,
        operationalDisposition: record.result.operationalDisposition,
      },
      }))
    publishRunLiveEvent({
      runId: record.runId,
      kind: 'RUN_RESULT',
      level: runLiveLevelFor(record.result.productVerdict),
      title: `Run ${record.result.lifecycle} · ${record.result.productVerdict}`,
      dedupeKey: runLiveKeys.runtime(
        record.result.lifecycle,
        record.result.productVerdict,
        record.result.terminationReason,
      ),
      detail: {
        lifecycle: record.result.lifecycle,
        productVerdict: record.result.productVerdict,
        evaluationFailureClass: record.result.evaluationFailureClass,
        terminationReason: record.result.terminationReason,
        cleanupResult: record.result.cleanupResult,
        operationalDisposition: record.result.operationalDisposition,
      },
    })
  }

  async scanResumableExecutions(input: {
    staleBeforeMs: number
    nowMs: number
  }): Promise<readonly RecoveryExecutionCandidate[]> {
    const rows = await this.client.bridgeFlowRunRuntime.findMany({
      where: {
        lifecycle: { in: ['RUNNING', 'LEASED'] },
        OR: [
          { schedulerDisposition: 'LEASED' },
          {
            schedulerDisposition: 'RECOVERING',
            recoveryLeaseExpiresAt: { lte: new Date(input.nowMs) },
          },
        ],
        updatedAt: { lt: new Date(input.staleBeforeMs) },
      },
      select: {
        runId: true,
        lifecycle: true,
        schedulerDisposition: true,
        updatedAt: true,
      },
    })
    return rows.flatMap((row) =>
      (row.lifecycle === 'RUNNING' || row.lifecycle === 'LEASED') &&
      (row.schedulerDisposition === 'LEASED' || row.schedulerDisposition === 'RECOVERING')
        ? [{
            runId: row.runId,
            lifecycle: row.lifecycle,
            schedulerDisposition: row.schedulerDisposition,
            version: row.updatedAt.toISOString(),
          }]
        : [],
    )
  }

  async claimRecoveryLease(input: {
    runId: string
    expectedVersion: string
    expectedSchedulerDisposition: string
    workerId: string
    leaseToken: string
    leaseExpiresAtMs: number
  }): Promise<{ token: string; epoch: number; owner: string; expiresAtMs: number } | undefined> {
    const now = this.now()
    const claimed = await this.client.bridgeFlowRunRuntime.updateMany({
      where: {
        runId: input.runId,
        lifecycle: { in: ['RUNNING', 'LEASED'] },
        schedulerDisposition: input.expectedSchedulerDisposition,
        updatedAt: new Date(input.expectedVersion),
        OR: [
          { recoveryLeaseToken: null },
          { recoveryLeaseExpiresAt: { lte: now } },
        ],
      },
      data: {
        schedulerDisposition: 'RECOVERING',
        recoveryLeaseToken: input.leaseToken,
        recoveryLeaseOwner: input.workerId,
        recoveryLeaseEpoch: { increment: 1n },
        recoveryLeaseExpiresAt: new Date(input.leaseExpiresAtMs),
        recoveryLeaseRenewedAt: now,
      },
    })
    if (claimed.count !== 1) return undefined
    const lease = await this.client.bridgeFlowRunRuntime.findUnique({
      where: { runId: input.runId },
      select: {
        recoveryLeaseToken: true,
        recoveryLeaseEpoch: true,
        recoveryLeaseOwner: true,
        recoveryLeaseExpiresAt: true,
      },
    })
    if (
      lease?.recoveryLeaseToken !== input.leaseToken ||
      lease.recoveryLeaseOwner !== input.workerId ||
      lease.recoveryLeaseExpiresAt === null
    ) {
      throw new Error('recovery lease claim was not durably owned')
    }
    return {
      token: lease.recoveryLeaseToken,
      epoch: Number(lease.recoveryLeaseEpoch),
      owner: lease.recoveryLeaseOwner,
      expiresAtMs: lease.recoveryLeaseExpiresAt.getTime(),
    }
  }

  async renewRecoveryLease(input: {
    runId: string
    workerId: string
    recoveryFence: RecoveryFence
    leaseExpiresAtMs: number
  }): Promise<boolean> {
    const now = this.now()
    const renewed = await this.client.bridgeFlowRunRuntime.updateMany({
      where: {
        runId: input.runId,
        recoveryLeaseToken: input.recoveryFence.token,
        recoveryLeaseEpoch: BigInt(input.recoveryFence.epoch),
        recoveryLeaseOwner: input.workerId,
        recoveryLeaseExpiresAt: { gt: now },
      },
      data: {
        recoveryLeaseExpiresAt: new Date(input.leaseExpiresAtMs),
        recoveryLeaseRenewedAt: now,
      },
    })
    return renewed.count === 1
  }

  async loadRecoverySnapshot(runId: string): Promise<RecoverySnapshot> {
    const [runtime, occurrences, transitions] = await Promise.all([
      this.client.bridgeFlowRunRuntime.findUnique({
        where: { runId },
        select: {
          recoveryCheckpoint: true,
          recoveryCheckpointRevision: true,
          recoveryLeaseToken: true,
          recoveryLeaseEpoch: true,
          recoveryLeaseOwner: true,
          recoveryLeaseExpiresAt: true,
        },
      }),
      this.client.bridgeFlowStepOccurrence.findMany({
        where: { runId },
        orderBy: [{ occurrenceIndex: 'asc' }, { occurrenceId: 'asc' }],
        select: {
          occurrenceId: true,
          planStepId: true,
          occurrenceIndex: true,
          iterationKey: true,
          lifecycle: true,
          actionResult: true,
          startedAt: true,
        },
      }),
      this.client.bridgeFlowActionTransition.findMany({
        where: { runId },
        orderBy: { createdAt: 'desc' },
        select: {
          occurrenceId: true,
          requestId: true,
          phase: true,
          terminal: true,
        },
      }),
    ])
    if (runtime === null) throw new Error('BridgeFlow recovery run not found')
    const checkpoint = recoveryCheckpoint(runtime.recoveryCheckpoint, runId)
    if (checkpoint.revision !== runtime.recoveryCheckpointRevision) {
      throw new Error('recovery checkpoint revision mismatch; reconciliation required')
    }
    if (
      runtime.recoveryLeaseToken === null ||
      runtime.recoveryLeaseOwner === null ||
      runtime.recoveryLeaseExpiresAt === null ||
      runtime.recoveryLeaseExpiresAt <= this.now()
    ) {
      throw new Error('recovery lease missing or expired')
    }
    const completed = occurrences
      .filter((row) => row.lifecycle === 'COMPLETED')
      .map((row) => row.occurrenceId)
    for (const occurrenceId of completed) {
      if (!checkpoint.completedOccurrenceIds.includes(occurrenceId)) {
        throw new Error('terminal occurrence is ahead of safe checkpoint; reconciliation required')
      }
    }
    const latestNonTerminal = findInFlightTransition(transitions)
    return {
      ...checkpoint,
      runId,
      evidenceScopes: uniqueEvidenceScopes(runId, occurrences),
      recoveryFence: {
        token: runtime.recoveryLeaseToken,
        epoch: Number(runtime.recoveryLeaseEpoch),
      },
      ...(latestNonTerminal === undefined
        ? {}
        : {
            inFlightAction: {
              occurrenceId: latestNonTerminal.occurrenceId,
              requestId: latestNonTerminal.requestId,
              phase: asActionPhase(latestNonTerminal.phase),
            },
          }),
    }
  }

  async markUnknownEffect(input: {
    runId: string
    occurrenceId: string
    requestId: string
    recoveryFence: RecoveryFence
  }): Promise<void> {
    await this.client.$transaction(async (tx) => {
    const client = tx as unknown as PrismaRuntimeClient
    await this.lockFenceRow(client, input.runId)
    await this.assertFence(client, input.runId, input.recoveryFence)
    const occurrence = await tx.bridgeFlowStepOccurrence.updateMany({
      where: {
        runId: input.runId,
        occurrenceId: input.occurrenceId,
        requestId: input.requestId,
        lifecycle: { not: 'COMPLETED' },
      },
      data: {
        lifecycle: 'COMPLETED',
        actionResult: 'UNKNOWN_EFFECT',
        completedAt: this.now(),
      },
    })
    if (occurrence.count !== 1) throw new Error('unknown-effect occurrence fence lost')
    const run = await tx.bridgeFlowRunRuntime.updateMany({
      where: {
        runId: input.runId,
        lifecycle: { in: ['RUNNING', 'LEASED'] },
        ...fenceWhere(input.recoveryFence, this.now()),
      },
      data: {
        lifecycle: 'CLOSED',
        productVerdict: 'INCONCLUSIVE',
        evaluationFailureClass: 'AUTOMATION_FAILURE',
        terminationReason: 'UNKNOWN_ACTION_EFFECT',
        schedulerDisposition: 'WORKER_LOST',
        operationalDisposition: 'NEEDS_ATTENTION',
        recoveryLeaseToken: null,
        recoveryLeaseOwner: null,
        recoveryLeaseExpiresAt: null,
        recoveryLeaseRenewedAt: null,
      },
    })
    if (run.count !== 1) throw new Error('unknown-effect run fence lost')
    })
  }

  async releaseRecoveryLease(input: {
    runId: string
    workerId: string
    recoveryFence: RecoveryFence
    recoveryDisposition: 'COMPLETED' | 'RETRYABLE_FAILURE'
  }): Promise<void> {
    const released = await this.client.bridgeFlowRunRuntime.updateMany({
      where: {
        runId: input.runId,
        recoveryLeaseToken: input.recoveryFence.token,
        recoveryLeaseEpoch: BigInt(input.recoveryFence.epoch),
        recoveryLeaseOwner: input.workerId,
      },
      data: {
        ...(input.recoveryDisposition === 'RETRYABLE_FAILURE'
          ? { schedulerDisposition: 'LEASED' }
          : {}),
        recoveryLeaseToken: null,
        recoveryLeaseOwner: null,
        recoveryLeaseExpiresAt: null,
        recoveryLeaseRenewedAt: null,
      },
    })
    if (released.count !== 1) throw new Error('recovery lease release lost ownership')
  }

  private requireCompleteRecoveryCheckpoint(
    checkpoint: PersistRecoveryCheckpointInput,
  ): CompleteRecoveryCheckpoint {
    if (checkpoint.revision === undefined) throw new Error('recovery checkpoint revision is required')
    if (checkpoint.continuationStack === undefined) {
      throw new Error('recovery checkpoint continuation stack is required')
    }
    if (checkpoint.outcomeState === undefined) {
      throw new Error('recovery checkpoint outcome state is required')
    }
    return {
      ...checkpoint,
      revision: checkpoint.revision,
      continuationStack: checkpoint.continuationStack,
      outcomeState: checkpoint.outcomeState,
    }
  }

  private async persistStepOccurrenceWithin(
    client: PrismaRuntimeClient,
    occurrence: PersistedStepOccurrence,
  ): Promise<void> {
    const terminal = occurrence.outcome.actionResult !== 'RUNNING'
    const data = {
      planStepId: occurrence.planStepId,
      occurrenceIndex: occurrence.occurrenceIndex,
      iterationKey: occurrence.iterationKey,
      requestId: occurrence.requestId,
      lifecycle: terminal ? 'COMPLETED' : 'RUNNING',
      actionResult: occurrence.outcome.actionResult,
      continueGateResult: occurrence.outcome.continueGateResult,
      finalOracleResult: occurrence.outcome.finalOracleResult,
      cleanupResult: occurrence.outcome.cleanupResult,
      startedAt:
        occurrence.startedAtMs === undefined
          ? this.now()
          : new Date(occurrence.startedAtMs),
      ...(terminal ? { completedAt: this.now() } : {}),
    }
    await client.bridgeFlowStepOccurrence.upsert({
      where: {
        runId_occurrenceId: {
          runId: occurrence.runId,
          occurrenceId: occurrence.occurrenceId,
        },
      },
      create: {
        runId: occurrence.runId,
        occurrenceId: occurrence.occurrenceId,
        ...data,
      },
      update: data,
    })
  }

  private publishStepOccurrence(occurrence: PersistedStepOccurrence): void {
    const terminal = occurrence.outcome.actionResult !== 'RUNNING'
    publishRunLiveEvent({
      runId: occurrence.runId,
      kind: 'STEP',
      level: terminal ? runLiveLevelFor(occurrence.outcome.actionResult) : 'INFO',
      title: `${occurrence.planStepId} ${terminal ? 'COMPLETED' : 'RUNNING'}${
        terminal ? ` · ${occurrence.outcome.actionResult}` : ''
      }`,
      dedupeKey: runLiveKeys.step(
        occurrence.occurrenceId,
        terminal ? 'COMPLETED' : 'RUNNING',
        occurrence.outcome.actionResult,
      ),
      detail: {
        occurrenceId: occurrence.occurrenceId,
        planStepId: occurrence.planStepId,
        iterationKey: occurrence.iterationKey,
        actionResult: occurrence.outcome.actionResult,
        continueGateResult: occurrence.outcome.continueGateResult,
        finalOracleResult: occurrence.outcome.finalOracleResult,
      },
    })
  }

  private async persistActionTransitionWithin(
    client: PrismaRuntimeClient,
    record: PersistedActionTransition & { recoveryFence?: RecoveryFence },
  ): Promise<void> {
    const transition = record.transition
    const data = {
      atMs: BigInt(transition.atMs),
      evidenceRef: transition.evidenceRef,
      terminal: transition.terminal,
    }
    await client.bridgeFlowActionTransition.upsert({
      where: {
        runId_occurrenceId_requestId_phase: {
          runId: record.runId,
          occurrenceId: record.occurrenceId,
          requestId: transition.requestId,
          phase: transition.phase,
        },
      },
      create: {
        runId: record.runId,
        occurrenceId: record.occurrenceId,
        requestId: transition.requestId,
        phase: transition.phase,
        ...data,
      },
      update: data,
    })
  }

  private async persistRecoveryCheckpointWithin(
    client: PrismaRuntimeClient,
    checkpoint: CompleteRecoveryCheckpoint,
  ): Promise<void> {
    const current = await client.bridgeFlowRunRuntime.findUnique({
      where: { runId: checkpoint.runId },
      select: {
        recoveryCheckpoint: true,
        recoveryCheckpointRevision: true,
        recoveryLeaseToken: true,
        recoveryLeaseEpoch: true,
        recoveryLeaseExpiresAt: true,
      },
    })
    if (current === null) throw new Error('cannot checkpoint a missing BridgeFlow run')
    this.assertFenceRow(current, checkpoint.recoveryFence)
    if (checkpoint.revision === undefined) {
      throw new Error('recovery checkpoint revision is required')
    }
    if (checkpoint.revision !== current.recoveryCheckpointRevision + 1) {
      throw new Error('recovery checkpoint revision must advance by exactly one')
    }
    const previous = current.recoveryCheckpoint === null
      ? undefined
      : recoveryCheckpoint(current.recoveryCheckpoint, checkpoint.runId)
    if (previous !== undefined) validateCheckpointTransition(previous, checkpoint)
    const updated = await client.bridgeFlowRunRuntime.updateMany({
      where: {
        runId: checkpoint.runId,
        recoveryCheckpointRevision: current.recoveryCheckpointRevision,
        ...fenceWhere(checkpoint.recoveryFence, this.now()),
      },
      data: {
        recoveryCheckpointRevision: checkpoint.revision,
        recoveryCheckpoint: toInputJson(checkpoint),
      },
    })
    if (updated.count !== 1) {
      throw new Error('recovery checkpoint fence or revision lost')
    }
  }

  private async withFence<T>(
    runId: string,
    fence: RecoveryFence | undefined,
    operation: (client: PrismaRuntimeClient) => Promise<T>,
  ): Promise<T> {
    if (fence === undefined) return operation(this.client)
    return this.client.$transaction(async (tx) => {
      const client = tx as unknown as PrismaRuntimeClient
      await this.lockFenceRow(client, runId)
      await this.assertFence(client, runId, fence)
      return operation(client)
    }, {
      maxWait: FENCE_TRANSACTION_MAX_WAIT_MS,
      timeout: FENCE_TRANSACTION_TIMEOUT_MS,
    })
  }

  private async assertFence(
    client: PrismaRuntimeClient,
    runId: string,
    fence: RecoveryFence,
  ): Promise<void> {
    const row = await client.bridgeFlowRunRuntime.findUnique({
      where: { runId },
      select: {
        recoveryLeaseToken: true,
        recoveryLeaseEpoch: true,
        recoveryLeaseExpiresAt: true,
      },
    })
    this.assertFenceRow(row, fence)
  }

  private async lockFenceRow(
    client: PrismaRuntimeClient,
    runId: string,
  ): Promise<void> {
    await client.$queryRaw(
      Prisma.sql`SELECT "run_id" FROM "bridgeflow_run_runtime" WHERE "run_id" = ${runId} FOR UPDATE`,
    )
  }

  private assertFenceRow(
    row: {
      recoveryLeaseToken: string | null
      recoveryLeaseEpoch: bigint
      recoveryLeaseExpiresAt: Date | null
    } | null,
    fence: RecoveryFence | undefined,
  ): void {
    if (fence === undefined) return
    if (
      row === null ||
      row.recoveryLeaseToken !== fence.token ||
      row.recoveryLeaseEpoch !== BigInt(fence.epoch) ||
      row.recoveryLeaseExpiresAt === null ||
      row.recoveryLeaseExpiresAt <= this.now()
    ) {
      throw new Error('recovery fence lost or lease expired')
    }
  }
}

export function createPrismaExecutionPersistence(): PrismaExecutionPersistence {
  return new PrismaExecutionPersistence(prisma)
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function readLastEvidenceRevision(requirements: unknown): number {
  if (typeof requirements !== 'object' || requirements === null || Array.isArray(requirements)) {
    return 0
  }
  const worker = (requirements as Record<string, unknown>).__worker
  if (typeof worker !== 'object' || worker === null || Array.isArray(worker)) return 0
  const revision = (worker as Record<string, unknown>).lastEvidenceRevision
  return typeof revision === 'number' && Number.isInteger(revision) && revision >= 0
    ? revision
    : 0
}

function assertSameOracleRevision(
  existing: {
    idempotencyKey: string
    outcome: string
    productVerdict: string | null
    evaluationFailureClass: string | null
    requirements: unknown
    evidenceRefs: unknown
  },
  expected: {
    idempotencyKey: string
    outcome: string
    productVerdict?: string
    evaluationFailureClass?: string
    requirements: Prisma.InputJsonValue
    evidenceRefs: readonly string[]
  },
): void {
  const same =
    existing.idempotencyKey === expected.idempotencyKey &&
    existing.outcome === expected.outcome &&
    existing.productVerdict === (expected.productVerdict ?? null) &&
    existing.evaluationFailureClass === (expected.evaluationFailureClass ?? null) &&
    stableJson(existing.requirements) === stableJson(expected.requirements) &&
    stableJson(existing.evidenceRefs) === stableJson(expected.evidenceRefs)
  if (!same) throw new Error('oracle revision collision: immutable content differs')
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function waitRow(row: {
  runId: string
  occurrenceId: string
  waitPlanId: string | null
  requestId: string | null
  status: string
  resultKey: string | null
  cancelStatus: string | null
}): PersistedWaitResult {
  if (row.waitPlanId === null || row.requestId === null || !isWaitStatus(row.status)) {
    throw new Error('invalid durable wait terminal row')
  }
  return {
    runId: row.runId,
    occurrenceId: row.occurrenceId,
    waitPlanId: row.waitPlanId,
    requestId: row.requestId,
    status: row.status,
    ...(row.resultKey === null ? {} : { key: row.resultKey }),
    ...(row.cancelStatus === null ? {} : { cancelStatus: row.cancelStatus }),
  }
}

function isWaitStatus(status: string): status is PersistedWaitResult['status'] {
  return [
    'EXPECTED_MATCH',
    'INTERRUPT_MATCH',
    'AMBIGUOUS',
    'TIMEOUT',
    'CANCELLED',
    'WAIT_CONNECTION_LOST',
  ].includes(status)
}

function recoveryCheckpoint(value: unknown, runId: string): RecoverySnapshot {
  const record = asRecord(value)
  if (record === undefined || record.runId !== runId) {
    throw new Error('missing durable BridgeFlow recovery checkpoint')
  }
  const nextStepId =
    typeof record.nextStepId === 'string' || record.nextStepId === null
      ? record.nextStepId
      : undefined
  if (
    nextStepId === undefined ||
    typeof record.runtimeIterationKey !== 'string' ||
    !Number.isInteger(record.revision) ||
    Number(record.revision) < 1
  ) {
    throw new Error('invalid durable BridgeFlow recovery cursor')
  }
  return {
    runId,
    revision: Number(record.revision),
    nextStepId,
    runtimeIterationKey: record.runtimeIterationKey,
    occurrenceCounts: integerRecord(record.occurrenceCounts),
    completedOccurrenceIds: stringArray(record.completedOccurrenceIds),
    completedIterationKeys: stringArray(record.completedIterationKeys),
    startedAtMsByOccurrenceId:
      record.startedAtMsByOccurrenceId === undefined
        ? {}
        : integerRecord(record.startedAtMsByOccurrenceId),
    continuationStack: continuationFrames(record.continuationStack),
    outcomeState: recoveryOutcome(record.outcomeState),
    ...(record.lastCompletedControl === undefined
      ? {}
      : { lastCompletedControl: completedControl(record.lastCompletedControl) }),
    evidenceScopes: [],
  }
}

function validateCheckpointTransition(
  previous: RecoverySnapshot,
  incoming: CompleteRecoveryCheckpoint,
): void {
  assertImmutablePrefix(
    previous.completedOccurrenceIds,
    incoming.completedOccurrenceIds,
    'completed occurrence',
  )
  assertImmutablePrefix(
    previous.completedIterationKeys,
    incoming.completedIterationKeys,
    'completed iteration',
  )
  for (const [stepId, count] of Object.entries(previous.occurrenceCounts)) {
    if ((incoming.occurrenceCounts[stepId] ?? -1) < count) {
      throw new Error(`occurrence counter regressed for ${stepId}`)
    }
  }
  for (const [occurrenceId, startedAtMs] of Object.entries(
    previous.startedAtMsByOccurrenceId ?? {},
  )) {
    if (incoming.startedAtMsByOccurrenceId?.[occurrenceId] !== startedAtMs) {
      throw new Error(`pinned start time changed for ${occurrenceId}`)
    }
  }
  const previousFrames = previous.continuationStack
  const incomingFrames = incoming.continuationStack
  const shared = Math.min(previousFrames.length, incomingFrames.length)
  for (let index = 0; index < shared; index += 1) {
    const left = previousFrames[index]
    const right = incomingFrames[index]
    if (
      left === undefined ||
      right === undefined ||
      left.loopStepId !== right.loopStepId ||
      left.parentIterationKey !== right.parentIterationKey ||
      left.bodyStepId !== right.bodyStepId ||
      left.stopBeforeStepId !== right.stopBeforeStepId ||
      left.returnStepId !== right.returnStepId ||
      left.itemCount !== right.itemCount ||
      right.currentIndex < left.currentIndex ||
      right.currentIndex > left.currentIndex + 1
    ) {
      throw new Error('illegal recovery continuation frame transition')
    }
    const expectedKey = right.parentIterationKey === 'root'
      ? `${right.loopStepId}[${right.currentIndex}]`
      : `${right.parentIterationKey}/${right.loopStepId}[${right.currentIndex}]`
    if (right.currentIterationKey !== expectedKey) {
      throw new Error('recovery continuation iteration key mismatch')
    }
    if (
      right.currentIndex === left.currentIndex + 1 &&
      !incoming.completedIterationKeys.includes(left.currentIterationKey)
    ) {
      throw new Error('continuation cannot advance before completed iteration')
    }
  }
  if (incomingFrames.length > previousFrames.length + 1) {
    throw new Error('recovery continuation stack grew illegally')
  }
  if (incomingFrames.length < previousFrames.length) {
    if (incomingFrames.length !== previousFrames.length - 1) {
      throw new Error('recovery continuation stack shrank illegally')
    }
    const removed = previousFrames.at(-1)
    if (
      removed === undefined ||
      removed.currentIndex !== removed.itemCount - 1 ||
      !incoming.completedIterationKeys.includes(removed.currentIterationKey)
    ) {
      throw new Error('incomplete loop frame cannot be removed')
    }
  }
  if (
    previous.outcomeState.stopped && !incoming.outcomeState.stopped ||
    previous.outcomeState.unknownEffect && !incoming.outcomeState.unknownEffect ||
    previous.outcomeState.automationFailure && !incoming.outcomeState.automationFailure ||
    previous.outcomeState.evidenceInsufficient && !incoming.outcomeState.evidenceInsufficient
  ) {
    throw new Error('recovery outcome flags cannot regress')
  }
  assertImmutablePrefix(
    previous.outcomeState.productVerdicts,
    incoming.outcomeState.productVerdicts,
    'product verdict history',
  )
}

function assertImmutablePrefix(
  previous: readonly string[],
  incoming: readonly string[],
  label: string,
): void {
  if (
    incoming.length < previous.length ||
    previous.some((value, index) => incoming[index] !== value)
  ) {
    throw new Error(`${label} must be an immutable append-only prefix`)
  }
}

function continuationFrames(value: unknown): RecoverySnapshot['continuationStack'] {
  if (!Array.isArray(value)) throw new Error('invalid recovery continuation stack')
  return value.map((candidate) => {
    const frame = asRecord(candidate)
    if (
      frame === undefined ||
      typeof frame.loopStepId !== 'string' ||
      typeof frame.parentIterationKey !== 'string' ||
      typeof frame.bodyStepId !== 'string' ||
      !(typeof frame.stopBeforeStepId === 'string' || frame.stopBeforeStepId === null) ||
      !(typeof frame.returnStepId === 'string' || frame.returnStepId === null) ||
      !Number.isInteger(frame.currentIndex) ||
      !Number.isInteger(frame.itemCount) ||
      Number(frame.currentIndex) < 0 ||
      Number(frame.itemCount) < 1 ||
      Number(frame.currentIndex) >= Number(frame.itemCount) ||
      typeof frame.currentIterationKey !== 'string'
    ) {
      throw new Error('invalid recovery continuation frame')
    }
    const expectedKey = frame.parentIterationKey === 'root'
      ? `${frame.loopStepId}[${Number(frame.currentIndex)}]`
      : `${frame.parentIterationKey}/${frame.loopStepId}[${Number(frame.currentIndex)}]`
    if (frame.currentIterationKey !== expectedKey) {
      throw new Error('invalid recovery continuation iteration key')
    }
    return {
      loopStepId: frame.loopStepId,
      parentIterationKey: frame.parentIterationKey,
      bodyStepId: frame.bodyStepId,
      stopBeforeStepId: frame.stopBeforeStepId,
      returnStepId: frame.returnStepId,
      currentIndex: Number(frame.currentIndex),
      itemCount: Number(frame.itemCount),
      currentIterationKey: frame.currentIterationKey,
    }
  })
}

function recoveryOutcome(value: unknown): RecoverySnapshot['outcomeState'] {
  const outcome = asRecord(value)
  if (
    outcome === undefined ||
    typeof outcome.unknownEffect !== 'boolean' ||
    typeof outcome.automationFailure !== 'boolean' ||
    typeof outcome.evidenceInsufficient !== 'boolean' ||
    !Array.isArray(outcome.productVerdicts) ||
    outcome.productVerdicts.some((verdict) => !isProductVerdict(verdict))
  ) {
    throw new Error('invalid recovery outcome state')
  }
  return {
    stopped: outcome.stopped === true,
    unknownEffect: outcome.unknownEffect,
    automationFailure: outcome.automationFailure,
    evidenceInsufficient: outcome.evidenceInsufficient,
    productVerdicts: outcome.productVerdicts as RecoverySnapshot['outcomeState']['productVerdicts'],
    cleanupResult: isCleanupResult(outcome.cleanupResult)
      ? outcome.cleanupResult
      : 'SUCCEEDED',
    resourceReleaseResult: isResourceReleaseResult(outcome.resourceReleaseResult)
      ? outcome.resourceReleaseResult
      : 'RELEASED',
    schedulerDisposition: isSchedulerDisposition(outcome.schedulerDisposition)
      ? outcome.schedulerDisposition
      : 'RELEASED',
    operationalDisposition: outcome.operationalDisposition === 'NEEDS_ATTENTION'
      ? 'NEEDS_ATTENTION'
      : 'OK',
  }
}

function isProductVerdict(value: unknown): boolean {
  return value === 'PASS_ONLINE' ||
    value === 'PASS_QUEUED_OFFLINE' ||
    value === 'FAIL_PRODUCT' ||
    value === 'INCONCLUSIVE' ||
    value === 'NOT_EVALUATED'
}

function isCleanupResult(value: unknown): value is RecoverySnapshot['outcomeState']['cleanupResult'] {
  return value === 'NOT_STARTED' ||
    value === 'PENDING' ||
    value === 'NOT_REQUIRED' ||
    value === 'SUCCEEDED' ||
    value === 'PARTIAL' ||
    value === 'FAILED'
}

function isResourceReleaseResult(
  value: unknown,
): value is RecoverySnapshot['outcomeState']['resourceReleaseResult'] {
  return value === 'NOT_REQUIRED' ||
    value === 'PENDING' ||
    value === 'RELEASED' ||
    value === 'PARTIAL' ||
    value === 'LEAKED'
}

function isSchedulerDisposition(
  value: unknown,
): value is RecoverySnapshot['outcomeState']['schedulerDisposition'] {
  return value === 'NOT_SCHEDULED' ||
    value === 'SCHEDULED' ||
    value === 'LEASED' ||
    value === 'REQUEUED' ||
    value === 'WORKER_LOST' ||
    value === 'RELEASED'
}

function completedControl(value: unknown): NonNullable<RecoverySnapshot['lastCompletedControl']> {
  const control = asRecord(value)
  if (
    control === undefined ||
    typeof control.occurrenceId !== 'string' ||
    !(typeof control.nextStepId === 'string' || control.nextStepId === null) ||
    typeof control.runtimeIterationKey !== 'string'
  ) {
    throw new Error('invalid completed control checkpoint')
  }
  return {
    occurrenceId: control.occurrenceId,
    nextStepId: control.nextStepId,
    runtimeIterationKey: control.runtimeIterationKey,
  }
}

function fenceWhere(fence: RecoveryFence | undefined, now: Date): Record<string, unknown> {
  return fence === undefined
    ? {}
    : {
        recoveryLeaseToken: fence.token,
        recoveryLeaseEpoch: BigInt(fence.epoch),
        recoveryLeaseExpiresAt: { gt: now },
      }
}

function integerRecord(value: unknown): Readonly<Record<string, number>> {
  const record = asRecord(value)
  if (record === undefined) throw new Error('invalid recovery integer record')
  const result: Record<string, number> = {}
  for (const [key, entry] of Object.entries(record)) {
    if (!Number.isInteger(entry) || Number(entry) < 0) {
      throw new Error('invalid recovery cursor index')
    }
    result[key] = Number(entry)
  }
  return result
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error('invalid recovery string list')
  }
  return value as string[]
}

function uniqueEvidenceScopes(
  runId: string,
  rows: readonly {
    occurrenceId: string
    iterationKey: string
  }[],
): RecoverySnapshot['evidenceScopes'] {
  const scopes = new Map<string, RecoverySnapshot['evidenceScopes'][number]>()
  for (const row of rows) {
    const scope = {
      runId,
      occurrenceId: row.occurrenceId,
      iterationKey: row.iterationKey,
    }
    scopes.set(JSON.stringify([scope.occurrenceId, scope.iterationKey]), scope)
  }
  return [...scopes.values()]
}

function findInFlightTransition(
  rows: readonly {
    occurrenceId: string
    requestId: string
    phase: string
    terminal: string | null
  }[],
): {
  occurrenceId: string
  requestId: string
  phase: string
  terminal: string | null
} | undefined {
  const seen = new Set<string>()
  for (const row of rows) {
    const key = `${row.occurrenceId}\0${row.requestId}`
    if (seen.has(key)) continue
    seen.add(key)
    if (row.terminal === null && row.phase !== 'RECEIVED' && row.phase !== 'TARGET_RESOLVED') {
      return row
    }
  }
  return undefined
}

function asActionPhase(value: string): ActionTransitionPhase {
  if (
    value !== 'RECEIVED' &&
    value !== 'TARGET_RESOLVED' &&
    value !== 'GESTURE_DISPATCHED' &&
    value !== 'GESTURE_COMPLETED' &&
    value !== 'EFFECT_VERIFIED'
  ) {
    throw new Error('invalid durable action phase')
  }
  return value
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}
