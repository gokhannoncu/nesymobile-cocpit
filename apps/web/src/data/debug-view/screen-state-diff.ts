import type { LiveScreenField } from './live-types'

export type ScreenStateChangeKind = 'added' | 'changed' | 'removed'

export interface ScreenStateChange {
  field: string
  kind: ScreenStateChangeKind
  valueKind: LiveScreenField['kind']
  before: unknown
  after: unknown
}

function fingerprint(value: unknown): string {
  if (value === undefined) return '__undefined__'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Diffs only fragment-owned fields. Activity-scoped SharedViewModel values are
 * intentionally excluded so the timeline stays specific to the active screen.
 */
export function diffCurrentScreenFields(
  previousFields: LiveScreenField[],
  nextFields: LiveScreenField[],
): ScreenStateChange[] {
  const previous = new Map(
    previousFields.filter((field) => field.group === 'screen').map((field) => [field.name, field]),
  )
  const next = new Map(
    nextFields.filter((field) => field.group === 'screen').map((field) => [field.name, field]),
  )
  const changes: ScreenStateChange[] = []

  for (const [name, field] of next) {
    const before = previous.get(name)
    if (!before) {
      changes.push({ field: name, kind: 'added', valueKind: field.kind, before: undefined, after: field.value })
    } else if (before.kind !== field.kind || fingerprint(before.value) !== fingerprint(field.value)) {
      changes.push({
        field: name,
        kind: 'changed',
        valueKind: field.kind,
        before: before.value,
        after: field.value,
      })
    }
  }

  for (const [name, field] of previous) {
    if (!next.has(name)) {
      changes.push({
        field: name,
        kind: 'removed',
        valueKind: field.kind,
        before: field.value,
        after: undefined,
      })
    }
  }

  return changes
}
