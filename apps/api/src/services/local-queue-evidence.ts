/**
 * G90.10 BD.6 — LOCAL durable-queue evidence helpers.
 *
 * The oracle maps PASS_QUEUED_OFFLINE only when a SATISFIED requirement
 * carries plane=LOCAL, subtype=queue, value=true. Live SDK observations
 * otherwise publish subtype=queryRef (`nesy.pendingOperation`), which would
 * never flip the verdict. The queue fact keys are the authority here, not
 * the query name.
 */

export const LOCAL_QUEUE_ITEM_WAITING_FACT = 'LOCAL.OFFLINE_QUEUE_ITEM_WAITING'
export const LOCAL_QUEUE_DRAINED_FACT = 'LOCAL.OFFLINE_QUEUE_DRAINED'

export function evidenceSubtypeForFact(factKey: string, queryRef: string): string {
  if (factKey === LOCAL_QUEUE_ITEM_WAITING_FACT || factKey === LOCAL_QUEUE_DRAINED_FACT) {
    return 'queue'
  }
  return queryRef
}

/**
 * `nesy.pendingOperation` emits `pending_count` as the string `"0"` when
 * empty. A boolean column binding cannot read that. Non-zero is waiting.
 */
export function localQueueItemWaitingFromPendingCount(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false
  const text = String(raw).trim()
  if (text === '' || text === '0') return false
  const numeric = Number(text)
  if (Number.isFinite(numeric)) return numeric !== 0
  return true
}

export function isLocalQueueItemWaitingObservation(observation: {
  factKey: string
  value: unknown
}): boolean {
  return observation.factKey === LOCAL_QUEUE_ITEM_WAITING_FACT && observation.value === true
}
