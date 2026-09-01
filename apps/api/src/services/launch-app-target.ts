export interface LaunchAppTarget {
  country: string | null
  environment: string | null
}

const COMBINED_TARGET = /^(HR|SI|RS|BA|ME)[_-](STAGE|PROD|TEST)$/i

export function extractLaunchAppTarget(nodes: unknown): LaunchAppTarget {
  if (!Array.isArray(nodes)) return { country: null, environment: null }
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const record = node as Record<string, unknown>
    const type = String(record.type ?? '')
    if (type !== 'LAUNCH_APP' && type !== 'launch-app') continue
    return normalizeLaunchAppTarget(configOf(record))
  }
  return { country: null, environment: null }
}

export function defaultRuntimeLaunchTarget(): LaunchAppTarget {
  const country = process.env.NESY_REMOTE_ACTION_COUNTRY?.trim() || 'RS'
  const environment = process.env.NESY_REMOTE_ACTION_ENV?.trim() || 'stage'
  return {
    country: country.toUpperCase(),
    environment: normalizeEnvironmentLabel(environment),
  }
}

export function resolveRunTarget(
  explicit: LaunchAppTarget,
  fallback: LaunchAppTarget = { country: null, environment: null },
): LaunchAppTarget {
  return {
    country: firstText(explicit.country, fallback.country),
    environment: firstText(explicit.environment, fallback.environment),
  }
}

export function formatLaunchAppTargetLabel(target: LaunchAppTarget): string | null {
  const country = target.country?.trim().toUpperCase() ?? ''
  const environment = normalizeEnvironmentLabel(target.environment)
  if (country && environment) return `${country}-${environment}`
  if (country) return country
  if (environment) return environment
  return null
}

function configOf(node: Record<string, unknown>): Record<string, unknown> {
  const data = isRecord(node.data) ? node.data : {}
  if (isRecord(node.config)) return node.config
  if (isRecord(data.config)) return data.config
  return data
}

function normalizeLaunchAppTarget(config: Record<string, unknown>): LaunchAppTarget {
  const countryRaw = textOf(config.country)
  const environmentRaw = textOf(config.environment)
  const combined = COMBINED_TARGET.exec(countryRaw ?? '') ?? COMBINED_TARGET.exec(environmentRaw ?? '')
  if (combined) {
    return {
      country: combined[1]!.toUpperCase(),
      environment: normalizeEnvironmentLabel(combined[2]),
    }
  }
  return {
    country: countryRaw ? countryRaw.toUpperCase() : null,
    environment: normalizeEnvironmentLabel(environmentRaw),
  }
}

function normalizeEnvironmentLabel(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase() ?? ''
  if (raw === '' || raw === 'null') return null
  if (raw === 'test' || raw === 'staging') return 'STAGE'
  return raw.toUpperCase()
}

function firstText(...values: Array<unknown>): string | null {
  for (const value of values) {
    const text = textOf(value)
    if (text) return text
  }
  return null
}

function textOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
