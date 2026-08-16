/**
 * Cached Nesy dashboard admin token (Auth/LoginDashboard) used by server-side
 * automation steps: backend event verification, tour approval, end-of-day
 * approval, and the back-office adapter.
 *
 * One process-wide cache keyed by country/environment. `/nesy/auth/login` and
 * `getDashboardAdminToken` must share this map — a 200 from LoginDashboard that
 * never lands here is not a verify credential.
 */

import { createHash } from 'node:crypto'

import {
  isNesyDashboardCountry,
  isNesyEnvironment,
  resolveBaseUrl,
  type NesyCountry,
  type NesyDashboardCountry,
  type NesyEnvironment,
} from '../nesy-env.js'

export const TOKEN_TTL_MS = 30 * 60 * 1000
export const ADMIN_AUTH_NOT_READY = 'ADMIN_AUTH_NOT_READY'

export type BackofficeCredentialSource =
  | 'dashboard-admin-cache'
  | 'NESY_BACKOFFICE_TOKEN'
  | 'login-dashboard'
  | 'empty'

export interface DashboardAdminCachePeek {
  pid: number
  country: string
  environment: string
  present: boolean
  tokenFingerprint: string | null
  ageMs: number | null
  expiresAt: string | null
  ttlMs: number
  loginDashboardCalls: number
  credentialSource: Exclude<BackofficeCredentialSource, 'login-dashboard'>
}

export interface DashboardAdminLoginResult {
  httpStatus: number
  result: unknown
  token: string | null
  resultCode: number | null
  fromCache: boolean
}

interface CacheEntry {
  token: string
  at: number
  result: unknown
}

const cache = new Map<string, CacheEntry>()
let loginDashboardCalls = 0

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function cacheKey(country: NesyCountry, environment: NesyEnvironment): string {
  return `${country}/${environment}`
}

function resultCodeOf(result: unknown): number | null {
  const record = asRecord(result)
  const raw = record.resultCode ?? record.ResultCode
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw)
  return null
}

export function fingerprintAdminToken(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex').slice(0, 16)}`
}

export function extractDashboardAdminToken(result: unknown): string | null {
  const root = asRecord(result)
  const payload = asRecord(root.payload ?? root.Payload)
  const token = payload.token ?? payload.Token
  return typeof token === 'string' && token.trim() !== '' ? token.trim() : null
}

export function getLoginDashboardCallCount(): number {
  return loginDashboardCalls
}

export function resetDashboardAdminTokenStateForTests(): void {
  cache.clear()
  loginDashboardCalls = 0
}

export function rememberDashboardAdminToken(
  country: NesyCountry,
  environment: NesyEnvironment,
  token: string,
  result: unknown = null,
): DashboardAdminCachePeek {
  const trimmed = token.trim()
  if (!trimmed) return peekDashboardAdminCache(country, environment)
  const previous = cache.get(cacheKey(country, environment))
  cache.set(cacheKey(country, environment), {
    token: trimmed,
    at: Date.now(),
    result: result ?? previous?.result ?? { resultCode: 200, payload: { token: trimmed } },
  })
  return peekDashboardAdminCache(country, environment)
}

function liveEntry(country: NesyCountry, environment: NesyEnvironment): CacheEntry | null {
  const entry = cache.get(cacheKey(country, environment))
  if (!entry) return null
  if (Date.now() - entry.at >= TOKEN_TTL_MS) return null
  return entry
}

export function getCachedDashboardAdminToken(
  country: NesyCountry,
  environment: NesyEnvironment,
): string | null {
  return liveEntry(country, environment)?.token ?? null
}

export function peekDashboardAdminCache(
  country: NesyCountry,
  environment: NesyEnvironment,
): DashboardAdminCachePeek {
  const entry = liveEntry(country, environment)
  const envToken = process.env.NESY_BACKOFFICE_TOKEN?.trim() ?? ''
  const credentialSource: Exclude<BackofficeCredentialSource, 'login-dashboard'> = entry
    ? 'dashboard-admin-cache'
    : envToken
      ? 'NESY_BACKOFFICE_TOKEN'
      : 'empty'
  return {
    pid: process.pid,
    country,
    environment,
    present: entry !== null,
    tokenFingerprint: entry ? fingerprintAdminToken(entry.token) : null,
    ageMs: entry ? Date.now() - entry.at : null,
    expiresAt: entry ? new Date(entry.at + TOKEN_TTL_MS).toISOString() : null,
    ttlMs: TOKEN_TTL_MS,
    loginDashboardCalls,
    credentialSource,
  }
}

export function resolveRemoteActionCountryEnv(): {
  country: NesyDashboardCountry
  environment: NesyEnvironment
} {
  const configuredCountry = process.env.NESY_REMOTE_ACTION_COUNTRY?.trim() ?? 'RS'
  const configuredEnv = process.env.NESY_REMOTE_ACTION_ENV?.trim() ?? 'stage'
  return {
    country: isNesyDashboardCountry(configuredCountry) ? configuredCountry : 'RS',
    environment: isNesyEnvironment(configuredEnv) ? configuredEnv : 'stage',
  }
}

export async function loginDashboardAndCache(
  country: NesyCountry,
  environment: NesyEnvironment,
): Promise<DashboardAdminLoginResult> {
  const cached = liveEntry(country, environment)
  if (cached) {
    return {
      httpStatus: 200,
      result: cached.result ?? { resultCode: 200, payload: { token: cached.token } },
      token: cached.token,
      resultCode: 200,
      fromCache: true,
    }
  }

  const baseUrl = resolveBaseUrl(country, environment)
  const username = process.env[`NESY_${country}_${environment.toUpperCase()}_USERNAME`]?.trim()
  const password = process.env[`NESY_${country}_${environment.toUpperCase()}_PASSWORD`]?.trim()
  if (!baseUrl || !username || !password) {
    return { httpStatus: 0, result: null, token: null, resultCode: null, fromCache: false }
  }

  loginDashboardCalls += 1
  try {
    const res = await fetch(`${baseUrl}/Auth/LoginDashboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Username: username, Password: password, CaptchaToken: null }),
      signal: AbortSignal.timeout(25_000),
    })
    const result = await res.json()
    const resultCode = resultCodeOf(result)
    const token = extractDashboardAdminToken(result)
    if (res.ok && resultCode === 200 && token) {
      rememberDashboardAdminToken(country, environment, token, result)
    }
    return {
      httpStatus: res.status,
      result,
      token: res.ok && resultCode === 200 ? token : null,
      resultCode,
      fromCache: false,
    }
  } catch (err) {
    console.warn('[NesyAdminToken] LoginDashboard failed:', err instanceof Error ? err.message : err)
    return { httpStatus: 0, result: null, token: null, resultCode: null, fromCache: false }
  }
}

export async function getDashboardAdminToken(
  country: NesyCountry,
  environment: NesyEnvironment,
): Promise<string | null> {
  return (await loginDashboardAndCache(country, environment)).token
}

export async function resolveBackofficeAdminCredentials(
  country?: NesyCountry,
  environment?: NesyEnvironment,
): Promise<{
  baseUrl: string
  token: string
  source: BackofficeCredentialSource
  country: NesyCountry
  environment: NesyEnvironment
}> {
  const resolved = resolveRemoteActionCountryEnv()
  const nextCountry = country ?? resolved.country
  const nextEnvironment = environment ?? resolved.environment
  const baseUrl = process.env.NESY_BACKOFFICE_BASE_URL?.trim() || resolveBaseUrl(nextCountry, nextEnvironment)
  const cached = getCachedDashboardAdminToken(nextCountry, nextEnvironment)
  if (cached) {
    return {
      baseUrl,
      token: cached,
      source: 'dashboard-admin-cache',
      country: nextCountry,
      environment: nextEnvironment,
    }
  }
  const envToken = process.env.NESY_BACKOFFICE_TOKEN?.trim() ?? ''
  if (envToken) {
    return {
      baseUrl,
      token: envToken,
      source: 'NESY_BACKOFFICE_TOKEN',
      country: nextCountry,
      environment: nextEnvironment,
    }
  }
  const token = await getDashboardAdminToken(nextCountry, nextEnvironment)
  return {
    baseUrl,
    token: token ?? '',
    source: token ? 'login-dashboard' : 'empty',
    country: nextCountry,
    environment: nextEnvironment,
  }
}
