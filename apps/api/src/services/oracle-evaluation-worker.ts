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
  /**
   * Give host-held state a chance to become a fact, once per evaluation.
   *
   * Some facts have no device event to carry them: `UI.*_READY` is a claim about
   * the screen the device is on RIGHT NOW, and only the host can attach the
   * BridgeFlow correlation tuple the resolver demands. That producer used to run
   * only from the executor's evidence port, which this worker never calls — so a
   * continue gate on a screen fact read an empty lane for its whole deadline and
   * timed out against a device that was on the right screen. Measured: 30s of
   * retries with `evidence_refs: []` and `lastEvidenceRevision: 0`.
   *
   * Called before every read so a screen that appears mid-gate is still seen.
   * Keep this synchronous: the 250ms loop must not serialize on HTTP.
   */
  refreshFacts?: (scope: EvidenceScope) => void
  /**
   * Drain host-held work that `refreshFacts` only *started*.
   *
   * Final Oracle EVENTUAL used to call `refreshFacts` on the timeout path
   * and immediately evaluate. GetShipmentDeliveryProof is async; the
   * in-flight ask was still empty, so a proof that existed before the
   * deadline (run_4a9a7ff4, eventDate 4s early) still timed out. This
   * hook waits for that ask. It does not move `deadlineMs`.
   */
  flushFacts?: (scope: EvidenceScope) => void | Promise<void>
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

/** Sentinel so `nextWake` can tell "no host-held state" from a real hook. */
const NO_REFRESH = (): void => undefined

/**
 * How often a gate re-reads host-held state. Below the pack's 300ms readiness
 * stability windows, so a screen cannot settle and be missed between polls.
 */
const HOST_STATE_POLL_MS = 250

export class OracleEvaluationWorker {
  private readonly runtime: BridgeFlowEvidenceRuntime
  private readonly persistence: OracleRevisionPersistencePort
  private readonly clock: () => number
  private readonly refreshFacts: (scope: EvidenceScope) => void
  private readonly flushFacts: ((scope: EvidenceScope) => void | Promise<void>) | undefined

  constructor(options: OracleWorkerOptions) {
    this.runtime = options.runtime
    this.persistence = options.persistence
    this.clock = options.clock ?? Date.now
    this.refreshFacts = options.refreshFacts ?? NO_REFRESH
    this.flushFacts = options.flushFacts
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
      this.refreshFacts(work)
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
        wakeAtMs: this.nextWake(
          nextStabilityBoundary(work.policy, facts, nowMs),
          nowMs,
          deadlineAtMs,
        ),
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
      this.refreshFacts(work)
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
        // Reuse Continue Gate nextWake. Deadline is a termination boundary,
        // not the poll interval:
        //   wakeAt = min(next fact refresh, next requirement boundary, deadline)
        // Measured on run_e68ca3ae: EVENTUAL slept 120s, proof existed 12s
        // before timeout, lastEvidenceRevision stayed 22, INCONCLUSIVE.
        wakeAtMs: this.nextWake(
          nextPendingRequirementBoundary(
            work.policy,
            evaluation,
            work.startedAtMs,
            nowMs,
          ),
          nowMs,
          deadlineAtMs,
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

  /**
   * When to wake even though no evidence arrived.
   *
   * `waitForRevision` wakes on a new evidence REVISION, which is right for facts
   * that ride on device events. Host-held state has no event: `refreshFacts` turns
   * "the screen the device is on now" into a fact, and it only runs at the top of
   * this loop. Without a periodic wake the loop slept from the first pass straight
   * to the deadline, so a screen that appeared one second after the gate opened was
   * never published and the gate timed out against it. Measured: two evaluations
   * 30s apart, the second at the deadline, both holding only the login screen fact.
   *
   * The stability / requirement boundary still wins when it is sooner. Deadline
   * is only the last of the three: refresh wake, temporal boundary, deadline.
   */
  private nextWake(
    stabilityBoundaryMs: number | undefined,
    nowMs: number,
    deadlineAtMs: number,
  ): number | undefined {
    if (this.refreshFacts === NO_REFRESH) return stabilityBoundaryMs
    const poll = Math.min(nowMs + HOST_STATE_POLL_MS, deadlineAtMs)
    return stabilityBoundaryMs === undefined ? poll : Math.min(stabilityBoundaryMs, poll)
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
    if (this.flushFacts !== undefined) await this.flushFacts(work)
    else this.refreshFacts(work)
    const afterFlushRevision = Math.max(
      lastEvidenceRevision,
      this.runtime.latestRevision(work, 'ORDERED_REQUIRED'),
    )
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
      afterFlushRevision,
      evaluation,
    )
    if (evaluation.outcome === 'SATISFIED') return { status: 'SATISFIED', evaluation }
    if (evaluation.outcome === 'VIOLATED') return { status: 'VIOLATED', evaluation }
    if (evaluation.outcome === 'NOT_APPLICABLE') {
      return { status: 'NOT_APPLICABLE', evaluation }
    }
    return { status: 'INCONCLUSIVE', evaluation }
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
