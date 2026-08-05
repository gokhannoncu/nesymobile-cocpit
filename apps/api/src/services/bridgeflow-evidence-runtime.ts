import type {
  EvidenceDeliveryLane,
  NormalizedEvidenceFact,
} from '@nesy/oracle-engine'

export interface EvidenceScope {
  runId: string
  occurrenceId: string
  iterationKey: string
}

export interface EvidencePublication {
  runId: string
  fact: NormalizedEvidenceFact
  revision: number
  lane: EvidenceDeliveryLane
  correlationStatus: 'CORRELATED' | 'MISMATCH' | 'PENDING'
  trust: 'RESOLVER_ACCEPTED'
}

export type EvidenceWakeup =
  | { status: 'EVIDENCE'; revision: number; lane: EvidenceDeliveryLane }
  | { status: 'BLOCKED'; revision: number; reason: string; evidenceRef?: string }
  | { status: 'TIMEOUT' }
  | { status: 'TIMER' }
  | { status: 'CANCELLED' }
  | { status: 'CLOSED'; reason: string }

export interface EvidenceRevisionWait {
  scope: EvidenceScope
  afterRevision: number
  deadlineAtMs: number
  wakeAtMs?: number
  lane?: EvidenceDeliveryLane
  signal?: AbortSignal
}

export interface BlockedRevision {
  revision: number
  reason: string
  evidenceRef?: string
}

export class BridgeFlowEvidenceRuntime {
  private readonly publications = new Map<string, Map<string, EvidencePublication>>()
  private readonly blocked = new Map<string, BlockedRevision>()
  private readonly blockedRuns = new Map<string, BlockedRevision>()
  private readonly closed = new Map<string, string>()
  private readonly listeners = new Map<string, Set<() => void>>()
  private readonly now: () => number

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now
  }

  publish(publication: EvidencePublication): void {
    validatePublication(publication)
    if (this.closed.has(scopeKey(scopeOf(publication)))) {
      throw new Error('evidence scope is closed')
    }
    this.store(publication)
    this.notify(scopeKey(scopeOf(publication)))
  }

  hydrate(publications: readonly EvidencePublication[]): void {
    for (const publication of publications) {
      try {
        validatePublication(publication)
        if (this.closed.has(scopeKey(scopeOf(publication)))) continue
        this.store(publication)
      } catch {
        // Durable hydration is a trust boundary. Invalid rows remain audit data
        // but never become evaluator input.
      }
    }
  }

  block(scope: EvidenceScope, blocked: BlockedRevision): void {
    const key = scopeKey(scope)
    const existing = this.blocked.get(key)
    if (existing === undefined || blocked.revision >= existing.revision) {
      this.blocked.set(key, { ...blocked })
      this.notify(key)
    }
  }

  blockRun(runId: string, blocked: BlockedRevision): void {
    const existing = this.blockedRuns.get(runId)
    if (existing === undefined || blocked.revision >= existing.revision) {
      this.blockedRuns.set(runId, { ...blocked })
      for (const key of this.keysForRun(runId)) this.notify(key)
    }
  }

  blockedState(scope: EvidenceScope): BlockedRevision | undefined {
    const blocked = this.blocked.get(scopeKey(scope)) ?? this.blockedRuns.get(scope.runId)
    return blocked === undefined ? undefined : { ...blocked }
  }

  currentFacts(
    scope: EvidenceScope,
    nowMs: number,
    lane?: EvidenceDeliveryLane,
    observedBeforeMs = Number.POSITIVE_INFINITY,
  ): readonly NormalizedEvidenceFact[] {
    const bucket = this.publications.get(scopeKey(scope))
    if (bucket === undefined) return []
    return [...bucket.values()]
      .filter(
        (publication) =>
          publication.trust === 'RESOLVER_ACCEPTED' &&
          publication.correlationStatus === 'CORRELATED' &&
          (lane === undefined || publication.lane === lane),
      )
      .map((publication) => publication.fact)
      .filter(
        (fact) =>
          fact.occurrenceId === scope.occurrenceId &&
          fact.iterationKey === scope.iterationKey &&
          fact.observedAtMs < observedBeforeMs &&
          nowMs >= fact.observedAtMs &&
          nowMs - fact.observedAtMs <= fact.freshnessMaxAgeMs,
      )
      .sort((left, right) => {
        const observed = left.observedAtMs - right.observedAtMs
        return observed !== 0 ? observed : left.factKey.localeCompare(right.factKey)
      })
  }

  latestRevision(scope: EvidenceScope, lane?: EvidenceDeliveryLane): number {
    return Math.max(
      0,
      ...[...(this.publications.get(scopeKey(scope))?.values() ?? [])]
        .filter(
          (publication) =>
            publication.trust === 'RESOLVER_ACCEPTED' &&
            publication.correlationStatus === 'CORRELATED' &&
            (lane === undefined || publication.lane === lane),
        )
        .map((publication) => publication.revision),
    )
  }

  async waitForRevision(request: EvidenceRevisionWait): Promise<EvidenceWakeup> {
    const key = scopeKey(request.scope)
    const ready = (): EvidenceWakeup | undefined => {
      if (request.signal?.aborted) return { status: 'CANCELLED' }
      if (this.now() >= request.deadlineAtMs) return { status: 'TIMEOUT' }
      const blocked = this.blockedState(request.scope)
      if (blocked !== undefined) return { status: 'BLOCKED', ...blocked }
      const closedReason = this.closed.get(key)
      if (closedReason !== undefined) return { status: 'CLOSED', reason: closedReason }
      const publication = [...(this.publications.get(key)?.values() ?? [])]
        .filter(
          (candidate) =>
            candidate.trust === 'RESOLVER_ACCEPTED' &&
            candidate.correlationStatus === 'CORRELATED' &&
            candidate.revision > request.afterRevision &&
            (request.lane === undefined || candidate.lane === request.lane),
        )
        .sort((left, right) => left.revision - right.revision)[0]
      return publication === undefined
        ? undefined
        : { status: 'EVIDENCE', revision: publication.revision, lane: publication.lane }
    }

    const immediate = ready()
    if (immediate !== undefined) return immediate
    const timerAtMs = Math.min(request.deadlineAtMs, request.wakeAtMs ?? request.deadlineAtMs)

    return new Promise<EvidenceWakeup>((resolve) => {
      let settled = false
      const listeners = this.listeners.get(key) ?? new Set<() => void>()
      const settle = (result: EvidenceWakeup) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        listeners.delete(onRevision)
        if (listeners.size === 0) this.listeners.delete(key)
        request.signal?.removeEventListener('abort', onAbort)
        resolve(result)
      }
      const onRevision = () => {
        const result = ready()
        if (result !== undefined) settle(result)
      }
      const onAbort = () => settle({ status: 'CANCELLED' })
      const timer = setTimeout(() => {
        settle(this.now() >= request.deadlineAtMs ? { status: 'TIMEOUT' } : { status: 'TIMER' })
      }, Math.max(0, timerAtMs - this.now()))
      if (typeof timer.unref === 'function') timer.unref()
      listeners.add(onRevision)
      this.listeners.set(key, listeners)
      request.signal?.addEventListener('abort', onAbort, { once: true })
      // Closes abort/deadline/publication races between the first check and
      // listener registration.
      onRevision()
      if (!settled && this.now() >= timerAtMs) {
        settle(this.now() >= request.deadlineAtMs ? { status: 'TIMEOUT' } : { status: 'TIMER' })
      }
    })
  }

  closeScope(scope: EvidenceScope, reason: string): void {
    const key = scopeKey(scope)
    this.closed.set(key, reason)
    this.notify(key)
  }

  evictScope(scope: EvidenceScope): void {
    const key = scopeKey(scope)
    if ((this.listeners.get(key)?.size ?? 0) > 0) {
      throw new Error('cannot evict an evidence scope with active subscriptions')
    }
    this.publications.delete(key)
    this.blocked.delete(key)
    this.closed.delete(key)
    if (!this.keysForRun(scope.runId).some((candidate) => candidate !== key)) {
      this.blockedRuns.delete(scope.runId)
    }
  }

  scopeStats(scope: EvidenceScope): {
    listeners: number
    publications: number
    blocked: boolean
    closed: boolean
  } {
    const key = scopeKey(scope)
    return {
      listeners: this.listeners.get(key)?.size ?? 0,
      publications: this.publications.get(key)?.size ?? 0,
      blocked: this.blockedState(scope) !== undefined,
      closed: this.closed.has(key),
    }
  }

  private store(publication: EvidencePublication): void {
    const key = scopeKey(scopeOf(publication))
    const bucket = this.publications.get(key) ?? new Map<string, EvidencePublication>()
    const fact = { ...publication.fact, deliveryLane: publication.lane }
    const identity = JSON.stringify([
      publication.revision,
      publication.lane,
      fact.factKey,
      fact.rawEventId ?? '',
    ])
    bucket.set(identity, { ...publication, fact })
    this.publications.set(key, bucket)
  }

  private notify(key: string): void {
    for (const listener of [...(this.listeners.get(key) ?? [])]) listener()
  }

  private keysForRun(runId: string): string[] {
    const prefix = JSON.stringify([runId]).slice(0, -1)
    return [...new Set([...this.publications.keys(), ...this.listeners.keys(), ...this.closed.keys()])]
      .filter((key) => key.startsWith(prefix))
  }
}

let processRuntime: BridgeFlowEvidenceRuntime | undefined

export function getBridgeFlowEvidenceRuntime(): BridgeFlowEvidenceRuntime {
  processRuntime ??= new BridgeFlowEvidenceRuntime()
  return processRuntime
}

function validatePublication(publication: EvidencePublication): void {
  if (
    publication.trust !== 'RESOLVER_ACCEPTED' ||
    !Number.isInteger(publication.revision) ||
    publication.revision < 1 ||
    publication.revision > 2_147_483_647 ||
    !Number.isFinite(publication.fact.observedAtMs) ||
    !Number.isSafeInteger(publication.fact.freshnessMaxAgeMs) ||
    publication.fact.freshnessMaxAgeMs <= 0
  ) {
    throw new Error('invalid or untrusted evidence publication')
  }
}

function scopeOf(publication: EvidencePublication): EvidenceScope {
  return {
    runId: publication.runId,
    occurrenceId: publication.fact.occurrenceId,
    iterationKey: publication.fact.iterationKey,
  }
}

function scopeKey(scope: EvidenceScope): string {
  return JSON.stringify([scope.runId, scope.occurrenceId, scope.iterationKey])
}
