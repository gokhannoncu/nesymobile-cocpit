/**
 * EVENTUAL eligibility time for a remote proof observation.
 *
 * `requestedAtMs` is scheduling / provenance only. Using it as
 * `observedAtMs` makes this false-PASS possible:
 *
 *   t=119.8s  poll starts
 *   t=120.0s  EVENTUAL deadline
 *   t=121.0s  backend actually becomes Delivered
 *   t=121.2s  response returns Delivered
 *   observedAtMs = 119.8s  → admitted as in-window
 *
 * Truth is the payload's source event when that timestamp is trusted.
 * Otherwise the HTTP completion time — when *we* learned the answer.
 */

export function parseProofEventDate(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw < 1_000_000_000_000 ? raw * 1_000 : raw
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Date.parse(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

export function isTrustedSourceEventAtMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function eventualObservedAtMs(input: {
  sourceEventAtMs?: unknown
  completedAtMs: number
}): number {
  return isTrustedSourceEventAtMs(input.sourceEventAtMs)
    ? input.sourceEventAtMs
    : input.completedAtMs
}
