export type GraylogCountry = 'HR' | 'SI' | 'RS' | 'SK' | 'ME' | 'BA' | 'AZ' | 'BG'

export const GRAYLOG_COUNTRIES: GraylogCountry[] = [
  'HR',
  'SI',
  'RS',
  'SK',
  'ME',
  'BA',
  'AZ',
  'BG',
]

const DEFAULT_BASE_URLS: Record<GraylogCountry, string> = {
  HR: 'https://nesy-graylog.overseas.hr',
  SI: 'https://nesy-graylog.expressone.si',
  RS: 'https://nesy-graylog.cityexpress.rs',
  SK: 'https://graylog.nesy.sps-sro.sk',
  ME: 'https://nesy-graylog.expressone.me',
  BA: 'https://nesy-graylog.expressone.ba',
  AZ: 'https://nesy-graylog.starex.az',
  BG: 'https://nesy-graylog.expressone.bg',
}

export function isGraylogCountry(value: string): value is GraylogCountry {
  return (GRAYLOG_COUNTRIES as string[]).includes(value)
}

export function resolveGraylogBaseUrl(country: GraylogCountry): string {
  const fromEnv = process.env[`GRAYLOG_${country}_BASE_URL`]?.trim()
  const base = (fromEnv || DEFAULT_BASE_URLS[country]).replace(/\/$/, '')
  return base
}

export function resolveGraylogToken(country: GraylogCountry): string {
  return process.env[`GRAYLOG_${country}_TOKEN`]?.trim() ?? ''
}

export function isGraylogConfigured(country: GraylogCountry): boolean {
  return Boolean(resolveGraylogToken(country) && resolveGraylogBaseUrl(country))
}

export type GraylogClusterInfo = {
  country: GraylogCountry
  baseUrl: string
  configured: boolean
}

export function listGraylogClusters(): GraylogClusterInfo[] {
  return GRAYLOG_COUNTRIES.map((country) => ({
    country,
    baseUrl: resolveGraylogBaseUrl(country),
    configured: isGraylogConfigured(country),
  }))
}
