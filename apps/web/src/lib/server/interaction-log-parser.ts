import type { InteractionEvent, InteractionKind } from '@/data/debug-view/types'

const INTERACTION_KINDS = new Set<InteractionKind>([
  'app',
  'screen',
  'click',
  'input',
  'scan',
  'network',
  'system',
  'error',
])

function nullableString(value: unknown): value is string | null {
  return value == null || typeof value === 'string'
}

/** Parses and validates one `InteractionEvent` logcat line. */
export function parseInteractionLogLine(line: string): InteractionEvent | null {
  if (line.length > 32_768 || !line.includes('InteractionEvent')) return null
  const jsonStart = line.indexOf('{')
  if (jsonStart < 0) return null

  let value: unknown
  try {
    value = JSON.parse(line.slice(jsonStart))
  } catch {
    return null
  }
  if (typeof value !== 'object' || value == null) return null

  const event = value as Record<string, unknown>
  if (
    typeof event.id !== 'string' ||
    event.id.length === 0 ||
    typeof event.timestamp !== 'string' ||
    !Number.isFinite(Date.parse(event.timestamp)) ||
    typeof event.offsetMs !== 'number' ||
    !Number.isFinite(event.offsetMs) ||
    event.offsetMs < 0 ||
    typeof event.kind !== 'string' ||
    !INTERACTION_KINDS.has(event.kind as InteractionKind) ||
    typeof event.screen !== 'string' ||
    typeof event.label !== 'string' ||
    !nullableString(event.detail) ||
    !nullableString(event.analyticsEvent)
  ) {
    return null
  }

  return {
    id: event.id,
    timestamp: event.timestamp,
    offsetMs: event.offsetMs,
    kind: event.kind as InteractionKind,
    screen: event.screen.slice(0, 200),
    label: event.label.slice(0, 500),
    detail: event.detail?.slice(0, 2_000) ?? null,
    analyticsEvent: event.analyticsEvent?.slice(0, 200) ?? null,
  }
}
