/** Evidence journey stage order — mirrors @nesy/execution-contract EVIDENCE_JOURNEY_STAGES. */
export const EVIDENCE_JOURNEY_STAGES = [
  'EMIT',
  'WAL',
  'TRANSPORT',
  'INBOX',
  'RECEIPT',
  'ORDERED',
  'NORMALIZATION',
  'CORRELATION',
  'EVALUATION',
] as const

export type EvidenceJourneyStage = (typeof EVIDENCE_JOURNEY_STAGES)[number]

export type EvidenceJourneyState =
  | 'PENDING'
  | 'OBSERVED'
  | 'NOT_OBSERVED'
  | 'UNKNOWN'
  | 'BLOCKED'

export interface EvidenceJourneyItem {
  occurrenceId?: string
  iterationKey?: string
  factKey?: string
  revision?: number
  plane?: string
  journeyStage?: string
  journeyState?: string
  rawEventRef?: string | null
  value?: unknown
  reducerTrace?: unknown
  observedAt?: string | number | Date
  authority?: string
  correlationStatus?: string
}

export function normalizeJourneyStage(raw: unknown): EvidenceJourneyStage | null {
  if (typeof raw !== 'string') return null
  const upper = raw.trim().toUpperCase()
  return (EVIDENCE_JOURNEY_STAGES as readonly string[]).includes(upper)
    ? (upper as EvidenceJourneyStage)
    : null
}

export function normalizeJourneyState(raw: unknown): EvidenceJourneyState {
  if (typeof raw !== 'string') return 'UNKNOWN'
  const upper = raw.trim().toUpperCase()
  if (
    upper === 'PENDING' ||
    upper === 'OBSERVED' ||
    upper === 'NOT_OBSERVED' ||
    upper === 'UNKNOWN' ||
    upper === 'BLOCKED'
  ) {
    return upper
  }
  // Never invent COMPLETED/FAILED — map legacy aliases honestly.
  if (upper === 'COMPLETED') return 'OBSERVED'
  if (upper === 'FAILED') return 'BLOCKED'
  if (upper === 'NOT_CAPTURED') return 'NOT_OBSERVED'
  return 'UNKNOWN'
}

export function reducerTraceSteps(trace: unknown): string[] {
  if (Array.isArray(trace)) {
    return trace.filter((entry): entry is string => typeof entry === 'string')
  }
  if (trace && typeof trace === 'object' && Array.isArray((trace as { steps?: unknown }).steps)) {
    return (trace as { steps: unknown[] }).steps.filter(
      (entry): entry is string => typeof entry === 'string',
    )
  }
  return []
}

/** Pick the latest observation per stage (by revision, then observedAt). */
export function latestItemPerStage(
  items: readonly EvidenceJourneyItem[],
): Map<EvidenceJourneyStage, EvidenceJourneyItem> {
  const out = new Map<EvidenceJourneyStage, EvidenceJourneyItem>()
  for (const item of items) {
    const stage = normalizeJourneyStage(item.journeyStage)
    if (!stage) continue
    const prev = out.get(stage)
    if (!prev) {
      out.set(stage, item)
      continue
    }
    const prevRev = typeof prev.revision === 'number' ? prev.revision : 0
    const nextRev = typeof item.revision === 'number' ? item.revision : 0
    if (nextRev >= prevRev) out.set(stage, item)
  }
  return out
}
