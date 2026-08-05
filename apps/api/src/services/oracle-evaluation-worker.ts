import {
  evaluateContinueGate,
  evaluateFinalOracle,
  type ContinueGateEvaluation,
  type FinalOracleEvaluation,
  type NormalizedEvidenceFact,
} from '@nesy/oracle-engine'
import type { EvidencePolicy, FinalOraclePolicy } from '@nesy/workflow-contract'

import type {
  BridgeFlowEvidenceRuntime,
  EvidenceScope,
} from './bridgeflow-evidence-runtime.js'

export interface OracleRevisionRecord {
  runId: string
  occurrenceId: string
  evaluatorKind: 'CONTINUE_GATE' | 'FINAL_ORACLE'
  revision: number
  lastEvidenceRevision: number
  evaluation: ContinueGateEvaluation | FinalOracleEvaluation
  evidenceRefs: readonly string[]
  reason?: string
  recoveryFence?: { token: string; epoch: number }
}

export interface OracleEvaluationCheckpoint {
  latestRevision: number
  lastEvidenceRevision: number
}

export interface OracleRevisionPersistencePort {
  loadOracleCheckpoint(input: {
    runId: string
    occurrenceId: string
    evaluatorKind: OracleRevisionRecord['evaluatorKind']
  }): Promise<OracleEvaluationCheckpoint>
  persistOracleRevision(record: OracleRevisionRecord): Promise<void>
}

export interface OracleWorkerOptions {
  runtime: BridgeFlowEvidenceRuntime
  persistence: OracleRevisionPersistencePort
  clock?: () => number
}

export interface ContinueGateWork extends EvidenceScope {
  policy: EvidencePolicy
  startedAtMs: number
  signal?: AbortSignal
  recoveryFence?: { token: string; epoch: number }
}

export interface FinalOracleWork extends EvidenceScope {
  policy: FinalOraclePolicy
  startedAtMs: number
  signal?: AbortSignal
  recoveryFence?: { token: string; epoch: number }
}

export type ContinueGateWorkerResult =
  | { status: 'SATISFIED' | 'TIMED_OUT'; evaluation: ContinueGateEvaluation }
  | { status: 'CANCELLED' }
  | { status: 'CLOSED'; reason: string }
  | { status: 'BLOCKED'; reason: string; evidenceRef?: string }

export type FinalOracleWorkerResult =
  | {
      status: 'SATISFIED' | 'VIOLATED' | 'INCONCLUSIVE' | 'NOT_APPLICABLE'
      evaluation: FinalOracleEvaluation
    }
  | { status: 'CANCELLED' }
  | { status: 'CLOSED'; reason: string }
  | { status: 'BLOCKED'; reason: string; evidenceRef?: string }

export class OracleEvaluationWorker {
  private readonly runtime: BridgeFlowEvidenceRuntime
  private readonly persistence: OracleRevisionPersistencePort
  private readonly clock: () => number

  constructor(options: OracleWorkerOptions) {
    this.runtime = options.runtime
    this.persistence = options.persistence
    this.clock = options.clock ?? Date.now
  }

  async runContinueGate(work: ContinueGateWork): Promise<ContinueGateWorkerResult> {
    const deadlineAtMs = work.startedAtMs + work.policy.deadlineMs
    const preflight = this.preflight(work, deadlineAtMs)
    if (preflight !== undefined) {
      if (preflight.status === 'TIMED_OUT') {
        const checkpoint = await this.persistence.loadOracleCheckpoint({
          runId: work.runId,
          occurrenceId: work.occurrenceId,
          evaluatorKind: 'CONTINUE_GATE',
        })
        return this.persistContinueTimeout(
          work,
          checkpoint.latestRevision + 1,
          checkpoint.lastEvidenceRevision,
        )
      }
      return preflight
    }
    const checkpoint = await this.persistence.loadOracleCheckpoint({
      runId: work.runId,
      occurrenceId: work.occurrenceId,
      evaluatorKind: 'CONTINUE_GATE',
    })
    let evaluationRevision = checkpoint.latestRevision
    let afterEvidenceRevision = checkpoint.lastEvidenceRevision

    for (;;) {
      const before = this.preflight(work, deadlineAtMs)
      if (before !== undefined) {
        if (before.status === 'TIMED_OUT') {
          return this.persistContinueTimeout(work, ++evaluationRevision, afterEvidenceRevision)
        }
        return before
      }
      const nowMs = this.clock()
      const facts = this.runtime.currentFacts(work, nowMs, 'RECEIPT_SAFE', deadlineAtMs)
      const latestEvidenceRevision = this.runtime.latestRevision(work, 'RECEIPT_SAFE')
      afterEvidenceRevision = Math.max(afterEvidenceRevision, latestEvidenceRevision)
      const raced = this.preflight(work, deadlineAtMs)
      if (raced !== undefined) {
        if (raced.status === 'TIMED_OUT') {
          return this.persistContinueTimeout(work, ++evaluationRevision, afterEvidenceRevision)
        }
        return raced
      }

      const evaluation = evaluateContinueGate({
        policy: work.policy,
        facts,
        occurrenceId: work.occurrenceId,
        iterationKey: work.iterationKey,
        nowMs,
        startedAtMs: work.startedAtMs,
      })
      const beforePersist = this.preflight(work, deadlineAtMs)
      if (beforePersist !== undefined) {
        if (beforePersist.status === 'TIMED_OUT') {
          return this.persistContinueTimeout(work, ++evaluationRevision, afterEvidenceRevision)
        }
        return beforePersist
      }
      evaluationRevision += 1
      await this.persist(
        work,
        'CONTINUE_GATE',
        evaluationRevision,
        afterEvidenceRevision,
        evaluation,
        evaluation.reason,
      )

      const afterPersist = this.preflight(work, deadlineAtMs)
      if (afterPersist !== undefined) {
        if (afterPersist.status === 'TIMED_OUT') {
          return this.persistContinueTimeout(
            work,
            ++evaluationRevision,
            afterEvidenceRevision,
          )
        }
        return afterPersist
      }
      if (evaluation.outcome === 'SATISFIED') return { status: 'SATISFIED', evaluation }

      const wakeup = await this.runtime.waitForRevision({
        scope: work,
        afterRevision: afterEvidenceRevision,
        deadlineAtMs,
        wakeAtMs: nextStabilityBoundary(work.policy, facts, nowMs),
        lane: 'RECEIPT_SAFE',
        signal: work.signal,
      })
      if (wakeup.status === 'CANCELLED') return { status: 'CANCELLED' }
      if (wakeup.status === 'BLOCKED') return blockedResult(wakeup)
      if (wakeup.status === 'CLOSED') return wakeup
      if (wakeup.status === 'TIMEOUT') {
        return this.persistContinueTimeout(work, ++evaluationRevision, afterEvidenceRevision)
      }
      if (wakeup.status === 'EVIDENCE') afterEvidenceRevision = wakeup.revision
    }
  }

  async runFinalOracle(work: FinalOracleWork): Promise<FinalOracleWorkerResult> {
    const eventualDeadlines = work.policy.requirements
      .filter((requirement) => requirement.timing === 'EVENTUAL')
      .map((requirement) => requirement.deadlineMs ?? 0)
    const deadlineAtMs =
      eventualDeadlines.length === 0
        ? Number.POSITIVE_INFINITY
        : work.startedAtMs + Math.max(...eventualDeadlines)
    const hasEventualRequirements = eventualDeadlines.length > 0
    const preflight = this.preflight(work, deadlineAtMs)
    if (preflight !== undefined) {
      if (preflight.status === 'TIMED_OUT') {
        const checkpoint = await this.persistence.loadOracleCheckpoint({
          runId: work.runId,
          occurrenceId: work.occurrenceId,
          evaluatorKind: 'FINAL_ORACLE',
        })
        return this.persistFinalTimeout(
          work,
          checkpoint.latestRevision + 1,
          checkpoint.lastEvidenceRevision,
          deadlineAtMs,
        )
      }
      return preflight
    }
    const checkpoint = await this.persistence.loadOracleCheckpoint({
      runId: work.runId,
      occurrenceId: work.occurrenceId,
      evaluatorKind: 'FINAL_ORACLE',
    })
    let evaluationRevision = checkpoint.latestRevision
    let afterEvidenceRevision = checkpoint.lastEvidenceRevision

    for (;;) {
      const before = this.preflight(work, deadlineAtMs)
      if (before !== undefined) {
        if (before.status === 'TIMED_OUT') {
          return this.persistFinalTimeout(
            work,
            ++evaluationRevision,
            afterEvidenceRevision,
            deadlineAtMs,
          )
        }
        return before
      }
      const nowMs = this.clock()
      const facts = this.runtime.currentFacts(work, nowMs, 'ORDERED_REQUIRED', deadlineAtMs)
      afterEvidenceRevision = Math.max(
        afterEvidenceRevision,
        this.runtime.latestRevision(work, 'ORDERED_REQUIRED'),
      )
      const raced = this.preflight(work, deadlineAtMs)
      if (raced !== undefined) {
        if (raced.status === 'TIMED_OUT') {
          return this.persistFinalTimeout(
            work,
            ++evaluationRevision,
            afterEvidenceRevision,
            deadlineAtMs,
          )
        }
        return raced
      }

      const evaluation = evaluateFinalOracle({
        policy: work.policy,
        facts,
        occurrenceId: work.occurrenceId,
        iterationKey: work.iterationKey,
        nowMs,
        startedAtMs: work.startedAtMs,
      })
      const beforePersist = this.preflight(work, deadlineAtMs)
      if (beforePersist !== undefined) {
        if (beforePersist.status === 'TIMED_OUT') {
          return this.persistFinalTimeout(
            work,
            ++evaluationRevision,
            afterEvidenceRevision,
            deadlineAtMs,
          )
        }
        return beforePersist
      }
      evaluationRevision += 1
      await this.persist(
        work,
        'FINAL_ORACLE',
        evaluationRevision,
        afterEvidenceRevision,
        evaluation,
      )

      const afterPersist = this.preflight(work, deadlineAtMs)
      if (afterPersist !== undefined) {
        if (afterPersist.status === 'TIMED_OUT') {
          return this.persistFinalTimeout(
            work,
            ++evaluationRevision,
            afterEvidenceRevision,
            deadlineAtMs,
          )
        }
        return afterPersist
      }
      const hasPending = Object.values(evaluation.requirementsByFact).some(
        (requirement) => requirement.state === 'PENDING',
      )
      if (!hasPending) {
        if (evaluation.outcome === 'SATISFIED') return { status: 'SATISFIED', evaluation }
        if (evaluation.outcome === 'VIOLATED') return { status: 'VIOLATED', evaluation }
        if (evaluation.outcome === 'NOT_APPLICABLE') {
          return { status: 'NOT_APPLICABLE', evaluation }
        }
      }
      if (!hasEventualRequirements) return finalResult(evaluation)

      const wakeup = await this.runtime.waitForRevision({
        scope: work,
        afterRevision: afterEvidenceRevision,
        deadlineAtMs,
        wakeAtMs: nextPendingRequirementBoundary(
          work.policy,
          evaluation,
          work.startedAtMs,
          nowMs,
        ),
        lane: 'ORDERED_REQUIRED',
        signal: work.signal,
      })
      if (wakeup.status === 'CANCELLED') return { status: 'CANCELLED' }
      if (wakeup.status === 'BLOCKED') return blockedResult(wakeup)
      if (wakeup.status === 'CLOSED') return wakeup
      if (wakeup.status === 'TIMEOUT') {
        return this.persistFinalTimeout(
          work,
          ++evaluationRevision,
          afterEvidenceRevision,
          deadlineAtMs,
        )
      }
      if (wakeup.status === 'EVIDENCE') afterEvidenceRevision = wakeup.revision
    }
  }

  private preflight(
    work: EvidenceScope & { signal?: AbortSignal },
    deadlineAtMs: number,
  ):
    | { status: 'CANCELLED' }
    | { status: 'BLOCKED'; reason: string; evidenceRef?: string }
    | { status: 'TIMED_OUT' }
    | undefined {
    if (work.signal?.aborted) return { status: 'CANCELLED' }
    if (this.clock() >= deadlineAtMs) return { status: 'TIMED_OUT' }
    const blocked = this.runtime.blockedState(work)
    return blocked === undefined ? undefined : blockedResult(blocked)
  }

  private async persistContinueTimeout(
    work: ContinueGateWork,
    revision: number,
    lastEvidenceRevision: number,
  ): Promise<ContinueGateWorkerResult> {
    if (work.signal?.aborted) return { status: 'CANCELLED' }
    const blocked = this.runtime.blockedState(work)
    if (blocked !== undefined) return blockedResult(blocked)
    const evaluation = evaluateContinueGate({
      policy: work.policy,
      facts: this.runtime.currentFacts(
        work,
        work.startedAtMs + work.policy.deadlineMs,
        'RECEIPT_SAFE',
        work.startedAtMs + work.policy.deadlineMs,
      ),
      occurrenceId: work.occurrenceId,
      iterationKey: work.iterationKey,
      nowMs: work.startedAtMs + work.policy.deadlineMs,
      startedAtMs: work.startedAtMs,
    })
    await this.persist(
      work,
      'CONTINUE_GATE',
      revision,
      lastEvidenceRevision,
      evaluation,
      evaluation.reason,
    )
    return { status: 'TIMED_OUT', evaluation }
  }

  private async persistFinalTimeout(
    work: FinalOracleWork,
    revision: number,
    lastEvidenceRevision: number,
    deadlineAtMs: number,
  ): Promise<FinalOracleWorkerResult> {
    if (work.signal?.aborted) return { status: 'CANCELLED' }
    const blocked = this.runtime.blockedState(work)
    if (blocked !== undefined) return blockedResult(blocked)
    const evaluation = evaluateFinalOracle({
      policy: work.policy,
      facts: this.runtime.currentFacts(
        work,
        deadlineAtMs,
        'ORDERED_REQUIRED',
        deadlineAtMs,
      ),
      occurrenceId: work.occurrenceId,
      iterationKey: work.iterationKey,
      nowMs: deadlineAtMs,
      startedAtMs: work.startedAtMs,
    })
    await this.persist(
      work,
      'FINAL_ORACLE',
      revision,
      lastEvidenceRevision,
      evaluation,
    )
    const status =
      evaluation.outcome === 'VIOLATED'
        ? 'VIOLATED'
        : evaluation.outcome === 'NOT_APPLICABLE'
          ? 'NOT_APPLICABLE'
          : 'INCONCLUSIVE'
    return { status, evaluation }
  }

  private async persist(
    work: EvidenceScope & { recoveryFence?: { token: string; epoch: number } },
    evaluatorKind: OracleRevisionRecord['evaluatorKind'],
    revision: number,
    lastEvidenceRevision: number,
    evaluation: ContinueGateEvaluation | FinalOracleEvaluation,
    reason?: string,
  ): Promise<void> {
    await this.persistence.persistOracleRevision({
      runId: work.runId,
      occurrenceId: work.occurrenceId,
      evaluatorKind,
      revision,
      lastEvidenceRevision,
      evaluation,
      evidenceRefs: [...evaluation.evidenceRefs],
      ...(reason === undefined ? {} : { reason }),
      ...(work.recoveryFence === undefined
        ? {}
        : { recoveryFence: work.recoveryFence }),
    })
  }
}

function nextStabilityBoundary(
  policy: EvidencePolicy,
  facts: readonly NormalizedEvidenceFact[],
  nowMs: number,
): number | undefined {
  const stableForMs = policy.stableForMs ?? 0
  if (stableForMs <= 0) return undefined
  const relevant = new Set([...(policy.allOf ?? []), ...(policy.anyOf ?? [])])
  const boundaries = facts
    .filter((fact) => relevant.has(fact.factKey) && fact.value === true)
    .map((fact) => fact.observedAtMs + stableForMs)
    .filter((boundary) => boundary > nowMs)
  return boundaries.length === 0 ? undefined : Math.min(...boundaries)
}

function nextPendingRequirementBoundary(
  policy: FinalOraclePolicy,
  evaluation: FinalOracleEvaluation,
  startedAtMs: number,
  nowMs: number,
): number | undefined {
  const boundaries = policy.requirements
    .filter(
      (requirement) =>
        requirement.timing === 'EVENTUAL' &&
        evaluation.requirementsByFact[requirement.factKey]?.state === 'PENDING',
    )
    .map((requirement) => startedAtMs + (requirement.deadlineMs ?? 0))
    .filter((boundary) => boundary > nowMs)
  return boundaries.length === 0 ? undefined : Math.min(...boundaries)
}

function blockedResult(blocked: {
  reason: string
  evidenceRef?: string
}): { status: 'BLOCKED'; reason: string; evidenceRef?: string } {
  return {
    status: 'BLOCKED',
    reason: blocked.reason,
    ...(blocked.evidenceRef === undefined ? {} : { evidenceRef: blocked.evidenceRef }),
  }
}

function finalResult(evaluation: FinalOracleEvaluation): FinalOracleWorkerResult {
  if (evaluation.outcome === 'SATISFIED') return { status: 'SATISFIED', evaluation }
  if (evaluation.outcome === 'VIOLATED') return { status: 'VIOLATED', evaluation }
  if (evaluation.outcome === 'NOT_APPLICABLE') return { status: 'NOT_APPLICABLE', evaluation }
  return { status: 'INCONCLUSIVE', evaluation }
}
