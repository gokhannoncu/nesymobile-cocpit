import type { ActionTransitionPhase } from '@nesy/execution-contract'
import type {
  OperationalDisposition,
  ProductVerdict,
  ResourceReleaseResult,
  SchedulerDisposition,
  WorkflowCleanupResult,
} from '@nesy/workflow-contract'
import { randomUUID } from 'node:crypto'

import type { EvidenceScope } from './bridgeflow-evidence-runtime.js'

export interface RecoveryExecutionCandidate {
  runId: string
  lifecycle: 'RUNNING' | 'LEASED'
  schedulerDisposition: string
  /** Optimistic concurrency token read by the scan. */
  version: string
}

export interface RecoveryInFlightAction {
  occurrenceId: string
  requestId: string
  phase: ActionTransitionPhase
}

export interface RecoverySnapshot {
  runId: string
  revision: number
  nextStepId: string | null
  runtimeIterationKey: string
  occurrenceCounts: Readonly<Record<string, number>>
  completedOccurrenceIds: readonly string[]
  completedIterationKeys: readonly string[]
  startedAtMsByOccurrenceId?: Readonly<Record<string, number>>
  continuationStack: readonly {
    loopStepId: string
    parentIterationKey: string
    bodyStepId: string
    stopBeforeStepId: string | null
    returnStepId: string | null
    currentIndex: number
    itemCount: number
    currentIterationKey: string
  }[]
  outcomeState: {
    stopped: boolean
    unknownEffect: boolean
    automationFailure: boolean
    evidenceInsufficient: boolean
    productVerdicts: readonly ProductVerdict[]
    cleanupResult: WorkflowCleanupResult
    resourceReleaseResult: ResourceReleaseResult
    schedulerDisposition: SchedulerDisposition
    operationalDisposition: OperationalDisposition
  }
  recoveryFence?: RecoveryFence
  lastCompletedControl?: {
    occurrenceId: string
    nextStepId: string | null
    runtimeIterationKey: string
  }
  evidenceScopes: readonly EvidenceScope[]
  inFlightAction?: RecoveryInFlightAction
}

export interface RecoveryFence {
  token: string
  epoch: number
}

export interface RecoveryLease extends RecoveryFence {
  owner: string
  expiresAtMs: number
}

export interface RecoveryPersistencePort {
  scanResumableExecutions(input: {
    staleBeforeMs: number
    nowMs: number
  }): Promise<readonly RecoveryExecutionCandidate[]>
  claimRecoveryLease(input: {
    runId: string
    expectedVersion: string
    expectedSchedulerDisposition: string
    workerId: string
    leaseToken: string
    leaseExpiresAtMs: number
  }): Promise<RecoveryLease | undefined>
  renewRecoveryLease(input: {
    runId: string
    workerId: string
    recoveryFence: RecoveryFence
    leaseExpiresAtMs: number
  }): Promise<boolean>
  loadRecoverySnapshot(runId: string): Promise<RecoverySnapshot>
  markUnknownEffect(input: {
    runId: string
    occurrenceId: string
    requestId: string
    recoveryFence: RecoveryFence
  }): Promise<void>
  releaseRecoveryLease(input: {
    runId: string
    workerId: string
    recoveryFence: RecoveryFence
    recoveryDisposition: 'COMPLETED' | 'RETRYABLE_FAILURE'
  }): Promise<void>
}

export interface RecoveryEvidenceHydrationPort {
  /** Must hydrate both occurrence-scoped and run-level durable blocks. */
  hydrate(scope: EvidenceScope): Promise<void>
}

export interface RecoveryExecutorPort {
  resume(snapshot: RecoverySnapshot, context?: { signal: AbortSignal }): Promise<{
    status: 'RESUMED' | 'BLOCKED' | 'PASS' | 'FAILED'
  }>
}

export type RecoveryWorkerResult = {
  runId: string
  status:
    | 'RESUMED'
    | 'BLOCKED'
    | 'FAILED'
    | 'SKIPPED_CLAIM'
    | 'RECONCILIATION_REQUIRED'
}

export class BridgeFlowRecoveryWorker {
  constructor(
    private readonly options: {
      workerId: string
      persistence: RecoveryPersistencePort
      evidence: RecoveryEvidenceHydrationPort
      executor: RecoveryExecutorPort
      now?: () => number
      leaseMs: number
      tokenFactory?: () => string
    },
  ) {
    if (!options.workerId.trim()) throw new Error('recovery workerId is required')
    if (!Number.isFinite(options.leaseMs) || options.leaseMs <= 0) {
      throw new Error('recovery leaseMs must be positive')
    }
  }

  async runOnce(): Promise<readonly RecoveryWorkerResult[]> {
    const now = this.options.now ?? Date.now
    const candidates = await this.options.persistence.scanResumableExecutions({
      staleBeforeMs: now() - this.options.leaseMs,
      nowMs: now(),
    })
    return Promise.all(candidates.map((candidate) => this.recover(candidate)))
  }

  private async recover(
    candidate: RecoveryExecutionCandidate,
  ): Promise<RecoveryWorkerResult> {
    const now = this.options.now ?? Date.now
    const claimed = await this.options.persistence.claimRecoveryLease({
      runId: candidate.runId,
      expectedVersion: candidate.version,
      expectedSchedulerDisposition: candidate.schedulerDisposition,
      workerId: this.options.workerId,
      leaseToken: (this.options.tokenFactory ?? randomUUID)(),
      leaseExpiresAtMs: now() + this.options.leaseMs,
    })
    if (!claimed) return { runId: candidate.runId, status: 'SKIPPED_CLAIM' }

    let release = true
    let recoveryDisposition: 'COMPLETED' | 'RETRYABLE_FAILURE' =
      'RETRYABLE_FAILURE'
    const controller = new AbortController()
    let renewalFailed = false
    let renewalInFlight: Promise<void> | undefined
    const renew = async (): Promise<void> => {
      if (renewalInFlight !== undefined) return renewalInFlight
      if (renewalFailed) throw new Error('recovery lease already lost')
      const renewal = (async () => {
        const renewed = await this.options.persistence.renewRecoveryLease({
          runId: candidate.runId,
          workerId: this.options.workerId,
          recoveryFence: claimed,
          leaseExpiresAtMs: now() + this.options.leaseMs,
        })
        if (!renewed) {
          renewalFailed = true
          controller.abort('recovery lease lost')
          throw new Error('recovery lease renewal failed')
        }
      })()
      renewalInFlight = renewal
      void renewal.then(
        () => {
          if (renewalInFlight === renewal) renewalInFlight = undefined
        },
        () => {
          if (renewalInFlight === renewal) renewalInFlight = undefined
        },
      )
      return renewal
    }
    const renewalTimer = setInterval(() => {
      void renew().catch(() => undefined)
    }, Math.max(1, Math.floor(this.options.leaseMs / 3)))
    try {
      await renew()
      const snapshot = await this.options.persistence.loadRecoverySnapshot(candidate.runId)
      if (snapshot.runId !== candidate.runId) {
        throw new Error('recovery snapshot runId mismatch')
      }
      if (
        snapshot.recoveryFence?.token !== claimed.token ||
        snapshot.recoveryFence?.epoch !== claimed.epoch
      ) {
        throw new Error('recovery snapshot fence mismatch')
      }
      if (snapshot.inFlightAction !== undefined) {
        release = false
        await this.options.persistence.markUnknownEffect({
          runId: candidate.runId,
          occurrenceId: snapshot.inFlightAction.occurrenceId,
          requestId: snapshot.inFlightAction.requestId,
          recoveryFence: claimed,
        })
        return {
          runId: candidate.runId,
          status: 'RECONCILIATION_REQUIRED',
        }
      }

      const scopes = uniqueScopes(snapshot.evidenceScopes)
      if (scopes.length === 0) {
        throw new Error('recovery requires an evidence scope to hydrate run blocks')
      }
      for (const scope of scopes) {
        await renew()
        await this.options.evidence.hydrate(scope)
      }
      await renew()
      const result = await this.options.executor.resume(snapshot, {
        signal: controller.signal,
      })
      await renew()
      if (renewalFailed) throw new Error('recovery lease lost during resume')
      recoveryDisposition = 'COMPLETED'
      return {
        runId: candidate.runId,
        status:
          result.status === 'PASS'
            ? 'RESUMED'
            : result.status,
      }
    } catch {
      return { runId: candidate.runId, status: 'FAILED' }
    } finally {
      clearInterval(renewalTimer)
      await renewalInFlight?.catch(() => undefined)
      if (release) {
        await this.options.persistence.releaseRecoveryLease({
          runId: candidate.runId,
          workerId: this.options.workerId,
          recoveryFence: claimed,
          recoveryDisposition,
        })
      }
    }
  }
}

function uniqueScopes(scopes: readonly EvidenceScope[]): readonly EvidenceScope[] {
  const byKey = new Map<string, EvidenceScope>()
  for (const scope of scopes) {
    byKey.set(
      JSON.stringify([scope.runId, scope.occurrenceId, scope.iterationKey]),
      scope,
    )
  }
  return [...byKey.values()]
}
