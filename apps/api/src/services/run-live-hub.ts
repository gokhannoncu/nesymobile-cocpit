/**
 * ===========================================================================
 *  RUN LIVE HUB — the one place a run's progress becomes observable while it
 *  is still happening.
 *
 *  ## Why this exists
 *
 *  Everything a run produces is durable and nothing was live. Steps, action
 *  transitions, oracle revisions and device events all land in PostgreSQL, so
 *  the run detail page could only ever show what had already finished: open it
 *  mid-run and it renders a snapshot that never moves. The information was
 *  there the whole time — it just had no path out of the process until someone
 *  reloaded.
 *
 *  ## Why a hub and not "the socket layer publishes directly"
 *
 *  The producers are spread across the persistence port, the execution queue
 *  and the logcat/WS event sniffer, and none of them may depend on whether a
 *  browser happens to be connected. They publish here unconditionally; the
 *  socket layer is one subscriber among possibly none. A producer that had to
 *  reach `io` would either import the HTTP server into the executor or go
 *  silent in tests, and both are worse than a bounded in-memory fan-out.
 *
 *  ## Why events are numbered and buffered
 *
 *  A browser that connects at second 30 of a run, or reconnects after a Wi-Fi
 *  blip, must not be shown a stream that starts wherever it happened to
 *  attach. `seq` is monotonic per process and the ring buffer holds the recent
 *  tail, so a subscriber replays from its last seen `seq` and sees a gap only
 *  when the run really did outrun the buffer. Bounded on purpose: a live view
 *  is not the audit trail, PostgreSQL is.
 * ===========================================================================
 */

/** Kinds are a closed vocabulary so the UI can style/filter without parsing titles. */
export type RunLiveEventKind =
  | 'RUN_STATUS'
  | 'STEP'
  | 'ACTION'
  | 'WAIT'
  | 'ORACLE'
  | 'EVIDENCE'
  | 'DEVICE'
  | 'INTERACTION'
  | 'RUN_RESULT'

export type RunLiveEventLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'

export interface RunLiveEvent {
  /** Monotonic per API process. Subscribers resume from the last one they saw. */
  seq: number
  runId: string
  atMs: number
  kind: RunLiveEventKind
  level: RunLiveEventLevel
  /** One readable line. The UI never has to reconstruct meaning from `detail`. */
  title: string
  detail: Record<string, unknown>
}

export interface RunLivePublishInput {
  runId: string
  kind: RunLiveEventKind
  title: string
  level?: RunLiveEventLevel
  detail?: Record<string, unknown>
  atMs?: number
  /**
   * The durable identity of what is being announced.
   *
   * Two paths reach this hub for the same row — the producer that wrote it and
   * the read-model watcher that later sees it — and neither can be removed: the
   * producer is what makes the feed instant, the watcher is what makes it
   * complete. A shared key is what keeps "both saw it" from becoming "the
   * operator sees it twice". Build them with [runLiveKeys].
   */
  dedupeKey?: string
}

/**
 * Durable identities, in one place.
 *
 * Producers and the watcher MUST derive a row's key the same way or dedupe
 * silently stops working — which shows up as a doubled feed, not as an error.
 */
export const runLiveKeys = {
  runStatus: (status: string): string => `runstatus:${status}`,
  runtime: (lifecycle: string, productVerdict: string, terminationReason: string): string =>
    `runtime:${lifecycle}:${productVerdict}:${terminationReason}`,
  step: (occurrenceId: string, lifecycle: string, actionResult: string): string =>
    `step:${occurrenceId}:${lifecycle}:${actionResult}`,
  action: (occurrenceId: string, requestId: string, phase: string): string =>
    `action:${occurrenceId}:${requestId}:${phase}`,
  wait: (occurrenceId: string, waitPlanId: string, status: string): string =>
    `wait:${occurrenceId}:${waitPlanId}:${status}`,
  oracle: (occurrenceId: string, evaluatorKind: string, revision: string): string =>
    `oracle:${occurrenceId}:${evaluatorKind}:${revision}`,
  remoteAction: (operationRef: string, attempt: string, status: string): string =>
    `remote:${operationRef}:${attempt}:${status}`,
  evidence: (occurrenceId: string, factKey: string, revision: string): string =>
    `evidence:${occurrenceId}:${factKey}:${revision}`,
  device: (event: string, atMs: string, screen: string): string =>
    `device:${event}:${atMs}:${screen}`,
  interaction: (eventId: string): string => `interaction:${eventId}`,
} as const

/** Recent tail per run. A live view is not the audit trail. */
const MAX_EVENTS_PER_RUN = 500
/** Runs tracked at once; oldest touched is dropped first. */
const MAX_TRACKED_RUNS = 64
/**
 * Dedupe keys held per run. Generous, because forgetting a key means an event
 * the watcher already showed is shown again, and a long FOR_EACH run writes a
 * lot of rows.
 */
const MAX_KEYS_PER_RUN = 20_000
/** A run nobody has touched for this long cannot still be live. */
const RUN_BUFFER_TTL_MS = 60 * 60 * 1000

interface RunBuffer {
  events: RunLiveEvent[]
  lastTouchedMs: number
  announcedKeys: Set<string>
}

type RunLiveListener = (event: RunLiveEvent) => void

export class RunLiveHub {
  private seq = 0
  private readonly buffers = new Map<string, RunBuffer>()
  private readonly listeners = new Set<RunLiveListener>()
  /** Live browsers per run — what lets a DB watcher run only while watched. */
  private readonly subscribers = new Map<string, number>()

  /** @returns the published event, or null when it was refused or a duplicate. */
  publish(input: RunLivePublishInput): RunLiveEvent | null {
    const runId = input.runId.trim()
    // A run event that names no run cannot be routed to a room, and inventing
    // one would attach a device's noise to whichever run asked next.
    if (runId === '') return null
    if (input.dedupeKey !== undefined && !this.claimKey(runId, input.dedupeKey)) return null

    this.seq += 1
    const event: RunLiveEvent = {
      seq: this.seq,
      runId,
      atMs: input.atMs ?? Date.now(),
      kind: input.kind,
      level: input.level ?? 'INFO',
      title: input.title,
      detail: jsonSafeRecord(input.detail ?? {}),
    }

    const buffer = this.bufferFor(runId)
    buffer.events.push(event)
    if (buffer.events.length > MAX_EVENTS_PER_RUN) {
      buffer.events.splice(0, buffer.events.length - MAX_EVENTS_PER_RUN)
    }
    buffer.lastTouchedMs = Date.now()
    this.prune()

    for (const listener of [...this.listeners]) {
      try {
        listener(event)
      } catch {
        // A broken subscriber must never take a run down with it.
      }
    }
    return event
  }

  /**
   * Take ownership of a durable identity.
   *
   * @returns true the first time this run announces the key. The watcher also
   * calls it directly on its seeding pass, so a run opened after the fact does
   * not replay its whole history as if it were happening now.
   */
  claimKey(runId: string, key: string): boolean {
    const buffer = this.bufferFor(runId.trim())
    if (buffer.announcedKeys.has(key)) return false
    buffer.announcedKeys.add(key)
    if (buffer.announcedKeys.size > MAX_KEYS_PER_RUN) {
      // Sets iterate in insertion order, so this drops the oldest identities —
      // the ones least likely to still be re-observed by a poll.
      const overflow = buffer.announcedKeys.size - MAX_KEYS_PER_RUN
      let dropped = 0
      for (const stale of buffer.announcedKeys) {
        buffer.announcedKeys.delete(stale)
        dropped += 1
        if (dropped >= overflow) break
      }
    }
    return true
  }

  /** Everything after `afterSeq` that is still buffered. */
  replay(runId: string, afterSeq = 0): readonly RunLiveEvent[] {
    const buffer = this.buffers.get(runId.trim())
    if (buffer === undefined) return []
    buffer.lastTouchedMs = Date.now()
    return buffer.events.filter((event) => event.seq > afterSeq)
  }

  latestSeq(runId: string): number {
    const buffer = this.buffers.get(runId.trim())
    return buffer?.events.at(-1)?.seq ?? 0
  }

  onEvent(listener: RunLiveListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** @returns the new subscriber count for this run. */
  addSubscriber(runId: string): number {
    const key = runId.trim()
    const next = (this.subscribers.get(key) ?? 0) + 1
    this.subscribers.set(key, next)
    return next
  }

  /** @returns the remaining subscriber count for this run. */
  removeSubscriber(runId: string): number {
    const key = runId.trim()
    const next = (this.subscribers.get(key) ?? 0) - 1
    if (next <= 0) {
      this.subscribers.delete(key)
      return 0
    }
    this.subscribers.set(key, next)
    return next
  }

  subscriberCount(runId: string): number {
    return this.subscribers.get(runId.trim()) ?? 0
  }

  /** Diagnostics: what the process is currently holding. */
  snapshot(): Readonly<Record<string, { events: number; latestSeq: number; subscribers: number }>> {
    return Object.fromEntries(
      Array.from(this.buffers, ([runId, buffer]) => [
        runId,
        {
          events: buffer.events.length,
          latestSeq: buffer.events.at(-1)?.seq ?? 0,
          subscribers: this.subscriberCount(runId),
        },
      ]),
    )
  }

  private bufferFor(runId: string): RunBuffer {
    const existing = this.buffers.get(runId)
    if (existing !== undefined) return existing
    const created: RunBuffer = {
      events: [],
      lastTouchedMs: Date.now(),
      announcedKeys: new Set<string>(),
    }
    this.buffers.set(runId, created)
    return created
  }

  private prune(): void {
    const now = Date.now()
    for (const [runId, buffer] of this.buffers) {
      if (this.subscriberCount(runId) > 0) continue
      if (now - buffer.lastTouchedMs > RUN_BUFFER_TTL_MS) this.buffers.delete(runId)
    }
    if (this.buffers.size <= MAX_TRACKED_RUNS) return
    const evictable = Array.from(this.buffers)
      .filter(([runId]) => this.subscriberCount(runId) === 0)
      .sort((left, right) => left[1].lastTouchedMs - right[1].lastTouchedMs)
    for (const [runId] of evictable.slice(0, this.buffers.size - MAX_TRACKED_RUNS)) {
      this.buffers.delete(runId)
    }
  }
}

let singleton: RunLiveHub | null = null

/**
 * Process-wide, because the producers (persistence, execution queue, device
 * event sniffer) and the consumer (socket.io) are constructed independently and
 * never see each other.
 */
export function getRunLiveHub(): RunLiveHub {
  singleton ??= new RunLiveHub()
  return singleton
}

/**
 * Publish without ever failing the caller.
 *
 * Every producer is on a durable write path, so a live-view fan-out is the last
 * thing allowed to throw there: losing an event from a diagnostic stream is a
 * cosmetic defect, losing the run is not.
 */
export function publishRunLiveEvent(input: RunLivePublishInput): void {
  try {
    getRunLiveHub().publish(input)
  } catch {
    // Intentionally silent — see above.
  }
}

/**
 * Severity from a durable outcome word.
 *
 * Shared by every producer so one vocabulary is coloured one way: a
 * `REQUIRED_TIMEOUT` that reads as an error in the oracle lane and as
 * information in the wait lane would make the feed unreadable exactly when it
 * matters.
 */
export function runLiveLevelFor(value: string | null | undefined): RunLiveEventLevel {
  const upper = (value ?? '').toUpperCase()
  if (upper === '') return 'INFO'
  if (
    upper.includes('FAIL') ||
    upper.includes('TIMEOUT') ||
    upper.includes('TIMED_OUT') ||
    upper.includes('ERROR') ||
    upper.includes('BLOCKED') ||
    upper.includes('ABORT') ||
    upper.includes('LOST') ||
    upper.includes('UNKNOWN_EFFECT')
  ) {
    return 'ERROR'
  }
  if (
    upper.includes('INCONCLUSIVE') ||
    upper.includes('NEEDS_ATTENTION') ||
    upper.includes('UNKNOWN') ||
    upper.includes('AMBIGUOUS') ||
    upper.includes('CANCELLED')
  ) {
    return 'WARN'
  }
  if (
    upper.includes('PASS') ||
    upper.includes('SUCCEEDED') ||
    upper.includes('COMPLETED') ||
    upper.includes('MATCH') ||
    upper.includes('VERIFIED')
  ) {
    return 'SUCCESS'
  }
  return 'INFO'
}

/** `bigint` is not JSON, and `Date` must travel as an instant, not an object. */
function jsonSafeRecord(detail: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(detail).map(([key, value]) => [key, jsonSafe(value)]))
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(jsonSafe)
  if (typeof value === 'object' && value !== null) {
    return jsonSafeRecord(value as Record<string, unknown>)
  }
  return value
}
