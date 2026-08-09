export type InteractionOrigin = 'BRIDGE_INJECTED' | 'MANUAL' | 'UNKNOWN'

export function asInteractionOrigin(raw: unknown): InteractionOrigin {
  if (raw === 'BRIDGE_INJECTED' || raw === 'MANUAL' || raw === 'UNKNOWN') return raw
  return 'UNKNOWN'
}

/**
 * Human baseline counts MANUAL only — BRIDGE_INJECTED must never inflate it
 * (Phase 7.17 / CHECKPOINT 54–57).
 */
export function countInteractionOrigins(
  rows: readonly { origin: unknown }[],
): {
  bridge: number
  manual: number
  unknown: number
  humanBaseline: number
} {
  let bridge = 0
  let manual = 0
  let unknown = 0
  for (const row of rows) {
    const origin = asInteractionOrigin(row.origin)
    if (origin === 'BRIDGE_INJECTED') bridge += 1
    else if (origin === 'MANUAL') manual += 1
    else unknown += 1
  }
  return { bridge, manual, unknown, humanBaseline: manual }
}
