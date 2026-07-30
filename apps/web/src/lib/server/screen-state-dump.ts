import type { LiveScreenField } from '../../data/debug-view/live-types'

export interface ScreenStateDumpCommands {
  provider: string
  legacy: string
}

export type ScreenStateShellRunner = (
  serial: string,
  command: string,
  timeoutMs?: number,
) => Promise<string | null>

function jsonKind(value: unknown): LiveScreenField['kind'] {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'string'
}

function fieldValueCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length
  if (typeof value === 'object' && value != null) return Object.keys(value).length
  return null
}

/**
 * Parses the `NESY_SCREEN_STATE:{json}` line emitted by both the Verdict SDK
 * provider and the legacy MainActivity debug dump hook. Returns
 * `instrumented: false` when the marker is absent or malformed.
 */
export function parseScreenStateDump(dump: string | null): {
  instrumented: boolean
  fields: LiveScreenField[]
} {
  if (!dump) return { instrumented: false, fields: [] }
  const marker = dump.indexOf('NESY_SCREEN_STATE:')
  if (marker < 0) return { instrumented: false, fields: [] }

  const jsonStart = marker + 'NESY_SCREEN_STATE:'.length
  const line = dump.slice(jsonStart).split('\n')[0]?.trim() ?? ''
  let parsed: { shared?: Record<string, unknown>; screen?: Record<string, unknown> }
  try {
    parsed = JSON.parse(line) as typeof parsed
  } catch {
    return { instrumented: false, fields: [] }
  }

  const fields: LiveScreenField[] = []
  const collect = (obj: Record<string, unknown> | undefined, group: LiveScreenField['group']) => {
    if (!obj) return
    for (const [name, value] of Object.entries(obj)) {
      fields.push({ name, value, kind: jsonKind(value), count: fieldValueCount(value), group })
    }
  }
  collect(parsed.screen, 'screen')
  collect(parsed.shared, 'shared')
  return { instrumented: true, fields }
}

/** Provider-first Screen State lookup with a legacy activity fallback. */
export async function readScreenStateDumpWithFallback(
  serial: string,
  commands: ScreenStateDumpCommands,
  runShell: ScreenStateShellRunner,
): Promise<{ instrumented: boolean; fields: LiveScreenField[] }> {
  const providerDump = await runShell(serial, commands.provider, 8_000)
  const providerState = parseScreenStateDump(providerDump)
  if (providerState.instrumented) return providerState

  const legacyDump = await runShell(serial, commands.legacy, 8_000)
  return parseScreenStateDump(legacyDump)
}
