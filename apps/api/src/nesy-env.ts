export type NesyCountry = 'HR' | 'SI' | 'RS' | 'BA' | 'ME' | 'SK' | 'AZ'
export type NesyEnvironment = 'stage' | 'prod'

/** Dashboard ortamları: ülke x stage+prod; SK henüz dahil değil */
export const NESY_DASHBOARD_COUNTRY_ENVIRONMENTS = {
  HR: ['stage', 'prod'],
  RS: ['stage', 'prod'],
  SI: ['stage', 'prod'],
  BA: ['stage', 'prod'],
  ME: ['stage', 'prod'],
  AZ: ['stage'],
} as const satisfies Record<Exclude<NesyCountry, 'SK'>, NesyEnvironment[]>

export type NesyDashboardCountry = keyof typeof NESY_DASHBOARD_COUNTRY_ENVIRONMENTS

export const NESY_DASHBOARD_COUNTRIES: NesyDashboardCountry[] = [
  'HR',
  'SI',
  'RS',
  'BA',
  'ME',
  'AZ',
]

export function isNesyDashboardCountry(value: string): value is NesyDashboardCountry {
  return Object.hasOwn(NESY_DASHBOARD_COUNTRY_ENVIRONMENTS, value)
}

export function isNesyEnvironment(value: string): value is NesyEnvironment {
  return value === 'stage' || value === 'prod'
}

export function getEnvValue(
  country: NesyCountry,
  environment: NesyEnvironment,
  field: 'BASE_URL' | 'USERNAME' | 'PASSWORD',
) {
  return process.env[`NESY_${country}_${environment.toUpperCase()}_${field}`]?.trim() ?? ''
}

export function resolveBaseUrl(country: NesyCountry, environment: NesyEnvironment) {
  return getEnvValue(country, environment, 'BASE_URL').replace(/\/$/, '')
}

export function resolveDashboardBaseUrl(country: NesyCountry, environment: NesyEnvironment) {
  return (
    process.env[`NESY_${country}_${environment.toUpperCase()}_DASHBOARD_BASE_URL`]?.trim() ?? ''
  ).replace(/\/$/, '')
}

export function isDashboardConfigured(country: NesyCountry, environment: NesyEnvironment) {
  return Boolean(
    resolveBaseUrl(country, environment) &&
      getEnvValue(country, environment, 'USERNAME') &&
      getEnvValue(country, environment, 'PASSWORD'),
  )
}

export function nesyHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

/** Nesy Dashboard (Angular) ile uyumlu ek başlıklar — User/Role/Geocode çağrıları için */
export function nesyPortalHeaders(token: string) {
  return {
    ...nesyHeaders(token),
    'X-Channel': 'Portal',
    'X-Client-Request-Time': new Date().toISOString(),
    'X-Error-Handling': 'inactive',
  }
}

export function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
