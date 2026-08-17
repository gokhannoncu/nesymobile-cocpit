/**
 * Per-run store of facts this run observed — `SDK_QUERY` steps, back-office
 * reads, and device events.
 *
 * ## Why a store and not a direct publish
 *
 * Evidence is scoped by `(runId, occurrenceId, iterationKey)`, and
 * `currentFacts` only returns facts whose `occurrenceId` equals the ASKING
 * scope's. A step that publishes under its own occurrence is therefore invisible
 * to every later step — including the one carrying the Final Oracle.
 *
 * That is not a bug in the filter. An occurrence is what makes a fact from one
 * FOR_EACH iteration unable to satisfy the next, and dropping it would let a
 * stale observation settle a later requirement.
 *
 * So `SDK_QUERY` follows the same shape `screen-readiness-observer` already uses
 * for `UI.*_READY`: the observation is RECORDED here when it happens, and the
 * evidence port publishes it into the scope of whichever occurrence is asking.
 * The correlation is made at the moment of the question, which is the only moment
 * it can be made correctly.
 *
 * ## Freshness
 *
 * `observedAtMs` is the time of the QUERY, not of the question — republishing
 * with a fresh timestamp would make a stale observation immortal, so that is
 * never done.
 *
 * What CHANGED (2026-08-12): carrying an observation to a later occurrence no
 * longer counts as a new admission. The freshness window used to expire these on
 * republication, which sounds right and was measured to be wrong: a run whose
 * steps span more than the window loses evidence it legitimately holds. Tour
 * approval spent 120s in an optional push wait and arrived at its Final Oracle
 * with all five REQUIRED facts reported missing, every producing step having
 * succeeded.
 *
 * The tension is real and worth stating rather than hiding. Freshness protects
 * against answering today's question with yesterday's observation; occurrence
 * scoping protects against answering one iteration's question with another's.
 * Only the second of those is about a fact moving WITHIN a run, so only the
 * second still applies here. A fact that must be re-read to stay true needs a
 * re-read step in the macro — the workflow rule of putting observations
 * immediately before the assert that consumes them — not an invisible expiry
 * that removes evidence without saying so.
 */

export interface SdkObservation {
  factKey: string
  /** `'UNKNOWN'` when the column was absent or not a boolean; never invented. */
  value: boolean | 'UNKNOWN'
  /**
   * EVENTUAL eligibility time. For delivery proof this is trusted
   * `sourceEventAtMs` when present, otherwise HTTP `completedAtMs`.
   * Never the HTTP request start.
   */
  observedAtMs: number
  /** Named query the observation came from, kept for the fact's `subtype`. */
  queryRef: string
  /** WHICH entity this observation is about, when a derivation needs to check identity. */
  correlationValue?: string
  /** Provenance only — when the host asked. Not EVENTUAL truth. */
  requestedAtMs?: number
  /** When the HTTP response finished. Fallback EVENTUAL time. */
  completedAtMs?: number
  /** Authoritative payload event time (`eventDate` on the proof row). */
  sourceEventAtMs?: number
}

export class SdkObservationStore {
  private readonly byRun = new Map<string, Map<string, SdkObservation>>()
  private readonly closedUntil = new Map<string, number>()

  /** Last observation wins: a re-read of the same fact supersedes the older one. */
  record(runId: string, observation: SdkObservation): boolean {
    this.pruneClosedRuns()
    if ((this.closedUntil.get(runId) ?? 0) > Date.now()) return false
    const bucket = this.byRun.get(runId) ?? new Map<string, SdkObservation>()
    bucket.set(observation.factKey, observation)
    this.byRun.set(runId, bucket)
    return true
  }

  current(runId: string): readonly SdkObservation[] {
    return [...(this.byRun.get(runId)?.values() ?? [])]
  }

  /** Called when a run reaches a terminal state so a long-lived process does not grow. */
  clear(runId: string): void {
    this.byRun.delete(runId)
  }

  /** Opens a fresh run id and removes any defensive late-write tombstone. */
  open(runId: string): void {
    this.closedUntil.delete(runId)
    this.byRun.delete(runId)
  }

  /**
   * Retires a run and rejects writes that race its terminal cleanup.
   *
   * Back-office reads are bounded to 20s. Keeping a one-minute tombstone closes
   * that race without retaining every historical run id forever.
   */
  close(runId: string): void {
    this.byRun.delete(runId)
    this.closedUntil.set(runId, Date.now() + 60_000)
    this.pruneClosedRuns()
  }

  private pruneClosedRuns(): void {
    const now = Date.now()
    for (const [runId, until] of this.closedUntil) {
      if (until <= now) this.closedUntil.delete(runId)
    }
  }
}

let shared: SdkObservationStore | undefined

export function getSdkObservationStore(): SdkObservationStore {
  shared ??= new SdkObservationStore()
  return shared
}
