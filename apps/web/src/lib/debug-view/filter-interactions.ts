import type { InteractionEvent, InteractionKind } from '@/data/debug-view/types'

export type InteractionKindFilter = InteractionKind | 'all'

export interface InteractionFilterState {
  kind: InteractionKindFilter
  /** `datetime-local` value or empty string */
  from: string
  /** `datetime-local` value or empty string */
  to: string
  search: string
}

export interface InteractionExportPayload {
  exportedAt: string
  device: { serial: string; name: string }
  filters: {
    kind: InteractionKindFilter
    from: string | null
    to: string | null
    search: string
  }
  count: number
  events: InteractionEvent[]
}

function matchesSearch(event: InteractionEvent, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const fields = [event.label, event.screen, event.detail, event.analyticsEvent]
  return fields.some((field) => field != null && field.toLowerCase().includes(q))
}

function inDateRange(event: InteractionEvent, from: string, to: string): boolean {
  const fromTrim = from.trim()
  const toTrim = to.trim()
  if (!fromTrim && !toTrim) return true

  const ts = Date.parse(event.timestamp)
  if (!Number.isFinite(ts)) return false

  if (fromTrim) {
    const fromMs = Date.parse(fromTrim)
    if (!Number.isFinite(fromMs) || ts < fromMs) return false
  }
  if (toTrim) {
    const toMs = Date.parse(toTrim)
    if (!Number.isFinite(toMs) || ts > toMs) return false
  }
  if (fromTrim && toTrim) {
    const fromMs = Date.parse(fromTrim)
    const toMs = Date.parse(toTrim)
    if (Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs > toMs) return false
  }
  return true
}

/** Events after date + search filters (kind not applied) — for chip counts. */
export function filterInteractionsForCounts(
  events: InteractionEvent[],
  filters: Pick<InteractionFilterState, 'from' | 'to' | 'search'>,
): InteractionEvent[] {
  return events.filter((event) => inDateRange(event, filters.from, filters.to) && matchesSearch(event, filters.search))
}

/** Full filter: date → search → kind. */
export function filterInteractions(
  events: InteractionEvent[],
  filters: InteractionFilterState,
): InteractionEvent[] {
  const base = filterInteractionsForCounts(events, filters)
  if (filters.kind === 'all') return base
  return base.filter((event) => event.kind === filters.kind)
}

export function buildInteractionExport(input: {
  events: InteractionEvent[]
  filters: InteractionFilterState
  device: { serial: string; name: string }
  exportedAt?: string
}): InteractionExportPayload {
  const chronological = [...input.events].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  )
  return {
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    device: input.device,
    filters: {
      kind: input.filters.kind,
      from: input.filters.from.trim() || null,
      to: input.filters.to.trim() || null,
      search: input.filters.search.trim(),
    },
    count: chronological.length,
    events: chronological,
  }
}

/** Safe filename segment from a device serial. */
export function sanitizeSerialForFilename(serial: string): string {
  return serial.replace(/[^\w.-]+/g, '_').slice(0, 64) || 'device'
}

export function interactionExportFilename(serial: string, exportedAt = new Date()): string {
  const iso = exportedAt.toISOString().replace(/[:.]/g, '-')
  return `interactions-${sanitizeSerialForFilename(serial)}-${iso}.json`
}
