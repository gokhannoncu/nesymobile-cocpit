/**
 * Per-run store of facts observed by `SDK_QUERY` steps.
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
 * `observedAtMs` is the time of the QUERY, not of the question. A session read
 * two minutes ago must not be re-published as if it were current; the publisher's
 * freshness window is what expires it, and re-publishing with a fresh timestamp
 * would make a stale observation immortal.
 */

export interface SdkObservation {
  factKey: string
  /** `'UNKNOWN'` when the column was absent or not a boolean; never invented. */
  value: boolean | 'UNKNOWN'
  observedAtMs: number
  /** Named query the observation came from, kept for the fact's `subtype`. */
  queryRef: string
}

export class SdkObservationStore {
  private readonly byRun = new Map<string, Map<string, SdkObservation>>()

  /** Last observation wins: a re-read of the same fact supersedes the older one. */
  record(runId: string, observation: SdkObservation): void {
    const bucket = this.byRun.get(runId) ?? new Map<string, SdkObservation>()
    bucket.set(observation.factKey, observation)
    this.byRun.set(runId, bucket)
  }

  current(runId: string): readonly SdkObservation[] {
    return [...(this.byRun.get(runId)?.values() ?? [])]
  }

  /** Called when a run reaches a terminal state so a long-lived process does not grow. */
  clear(runId: string): void {
    this.byRun.delete(runId)
  }
}

let shared: SdkObservationStore | undefined

export function getSdkObservationStore(): SdkObservationStore {
  shared ??= new SdkObservationStore()
  return shared
}
