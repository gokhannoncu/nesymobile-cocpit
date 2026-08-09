/**
 * Phase 7.19 / residual — select sensitive diagnostic captures past retention SLA.
 * Wiring to a cron/job is separate; this is the pure selection contract.
 */

/** Default sensitive-capture retention window (24h). */
export const DEFAULT_SENSITIVE_CAPTURE_RETENTION_MS = 24 * 60 * 60_000

export interface PurgeCandidate {
  captureId: string
  sensitive: boolean
  createdAt: Date | string | number
}

export function selectSensitiveCapturesForPurge(
  audits: readonly PurgeCandidate[],
  olderThanMs: number = DEFAULT_SENSITIVE_CAPTURE_RETENTION_MS,
  nowMs: number = Date.now(),
): readonly string[] {
  if (!Number.isFinite(olderThanMs) || olderThanMs < 0) {
    throw new Error('olderThanMs must be a non-negative finite number')
  }
  return audits
    .filter((audit) => {
      if (!audit.sensitive) return false
      const created = new Date(audit.createdAt).getTime()
      if (!Number.isFinite(created)) return false
      return nowMs - created >= olderThanMs
    })
    .map((audit) => audit.captureId)
}
