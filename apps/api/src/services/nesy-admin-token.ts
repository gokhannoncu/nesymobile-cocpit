/**
 * Cached Nesy dashboard admin token (Auth/LoginDashboard) used by server-side
 * automation steps: backend event verification, tour approval, end-of-day
 * approval, and the back-office adapter.
 *
 * One process-wide cache keyed by country/environment. `/nesy/auth/login` and
 * `getDashboardAdminToken` must share this map — a 200 from LoginDashboard that
 * never lands here is not a verify credential.
 *
 * Lifetime follows the JWT `exp` claim (Nesy dashboard tokens expire at the
 * next 03:00 UTC). A 30-minute wall clock is only the fallback when `exp`
 * cannot be read. Admin peek / fixture / qualification responses never
 * serialize the bearer. Data Center `/nesy/auth/login` still returns
 * `payload.token` for the browser session.
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

/** Used only when the token is not a JWT or `exp` is missing. */
export const TOKEN_TTL_MS = 30 * 60 * 1000
export const JWT_EXP_SKEW_MS = 60_000
export const ADMIN_AUTH_NOT_READY = 'ADMIN_AUTH_NOT_READY'

export type BackofficeCredentialSource =
  | 'dashboard-admin-cache'
  | 'NESY_BACKOFFICE_TOKEN'
  | 'login-dashboard'
  | 'empty'

export type AdminTokenExpirySource = 'jwt' | 'fallback-ttl'

export type LoginDashboardTrigger = 'explicit' | 'jwt-expired-refresh'

export interface DashboardAdminCachePeek {
  pid: number
  country: string
  environment: string
  present: boolean
  tokenFingerprint: string | null
  ageMs: number | null
  expiresAt: string | null
  ttlMs: number
  expirySource: AdminTokenExpirySource | null
  cacheExpired: boolean
  jwtExpired: boolean
  loginDashboardCalls: number
  lastResultCode: number | null
  lastResultMessage: string | null
  nextLoginRequiresCaptcha: boolean | null
  accountIsBlocked: boolean | null
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
  expiresAtMs: number
  expirySource: AdminTokenExpirySource
  result: unknown
}

interface LastLoginSignal {
  resultCode: number | null
  resultMessage: string | null
  nextLoginRequiresCaptcha: boolean | null
  accountIsBlocked: boolean | null
}

import {
  deleteStoredAdminToken,
  readStoredAdminToken,
  writeStoredAdminToken,
} from './nesy-admin-token-store.js'

const cache = new Map<string, CacheEntry>()
let loginDashboardCalls = 0
let lastLogin: LastLoginSignal = emptyLastLogin()

function emptyLastLogin(): LastLoginSignal {
  return {
    resultCode: null,
    resultMessage: null,
    nextLoginRequiresCaptcha: null,
    accountIsBlocked: null,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/**
 * A copy of a login response with every `token` field removed, at any depth.
 *
 * Lives here rather than in the route that first needed it, because the durable
 * token store also has to strip before writing its diagnostics blob — and a
 * second implementation of "what counts as a token field" is a second thing to
 * get wrong about a credential.
 */
export function withoutTokenFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutTokenFields)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key.toLowerCase() !== 'token')
      .map(([key, entry]) => [key, withoutTokenFields(entry)]),
  )
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

function safeResultMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) return '[redacted-jwt]'
  return trimmed.slice(0, 300)
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  return null
}

export function loginDiagnostics(result: unknown): LastLoginSignal {
  const record = asRecord(result)
  const payload = asRecord(record.payload ?? record.Payload)
  return {
    resultCode: resultCodeOf(result),
    resultMessage: safeResultMessage(record.resultMessage ?? record.ResultMessage),
    nextLoginRequiresCaptcha: asBoolean(
      payload.nextLoginRequiresCaptcha ?? payload.NextLoginRequiresCaptcha,
    ),
    accountIsBlocked: asBoolean(payload.accountIsBlocked ?? payload.AccountIsBlocked),
  }
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

/** Reads `exp` without verifying the signature. The token never leaves this process. */
export function readJwtExpiryMs(token: string): number | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const padded = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(padded, 'base64').toString('utf8')
    const payload = JSON.parse(json) as { exp?: unknown }
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp) && payload.exp > 0) {
      return Math.floor(payload.exp * 1000)
    }
    return null
  } catch {
    return null
  }
}

export function resolveTokenExpiry(token: string, nowMs = Date.now()): {
  expiresAtMs: number
  expirySource: AdminTokenExpirySource
} {
  const jwtExpMs = readJwtExpiryMs(token)
  if (jwtExpMs != null) return { expiresAtMs: jwtExpMs, expirySource: 'jwt' }
  return { expiresAtMs: nowMs + TOKEN_TTL_MS, expirySource: 'fallback-ttl' }
}

function entryStillLive(entry: CacheEntry, nowMs = Date.now()): boolean {
  const skew = entry.expirySource === 'jwt' ? JWT_EXP_SKEW_MS : 0
  return nowMs < entry.expiresAtMs - skew
}

export function getLoginDashboardCallCount(): number {
  return loginDashboardCalls
}

export function resetDashboardAdminTokenStateForTests(): void {
  cache.clear()
  loginDashboardCalls = 0
  lastLogin = emptyLastLogin()
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
  const nowMs = Date.now()
  const expiry = resolveTokenExpiry(trimmed, nowMs)
  const entry: CacheEntry = {
    token: trimmed,
    at: nowMs,
    expiresAtMs: expiry.expiresAtMs,
    expirySource: expiry.expirySource,
    result: result ?? previous?.result ?? { resultCode: 200, payload: { token: trimmed } },
  }
  cache.set(cacheKey(country, environment), entry)
  // Write-through, not awaited: this function is synchronous by contract and
  // several callers are on the request path. The durable copy exists to save a
  // manual login after a restart, so it may lag by a few milliseconds; what it
  // must not do is make an in-memory token unavailable while it is being saved.
  void writeStoredAdminToken(country, environment, {
    token: entry.token,
    expiresAtMs: entry.expiresAtMs,
    expirySource: entry.expirySource,
    // The token is already a column; a second copy inside the diagnostics blob
    // would outlive the deliberate expiry of the first.
    loginResult: withoutTokenFields(entry.result),
    obtainedAtMs: entry.at,
  })
  if (result != null) lastLogin = loginDiagnostics(result)
  else if (lastLogin.resultCode == null) lastLogin = { ...emptyLastLogin(), resultCode: 200 }
  return peekDashboardAdminCache(country, environment)
}

function storedEntry(country: NesyCountry, environment: NesyEnvironment): CacheEntry | null {
  return cache.get(cacheKey(country, environment)) ?? null
}

function liveEntry(country: NesyCountry, environment: NesyEnvironment): CacheEntry | null {
  const entry = storedEntry(country, environment)
  if (!entry || !entryStillLive(entry)) return null
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
  const stored = storedEntry(country, environment)
  const entry = stored && entryStillLive(stored) ? stored : null
  const cacheExpired = stored != null && entry == null
  const jwtExpired = cacheExpired && stored.expirySource === 'jwt'
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
    expiresAt: stored ? new Date(stored.expiresAtMs).toISOString() : null,
    ttlMs: entry ? Math.max(0, entry.expiresAtMs - Date.now()) : TOKEN_TTL_MS,
    expirySource: stored?.expirySource ?? null,
    cacheExpired,
    jwtExpired,
    loginDashboardCalls,
    lastResultCode: lastLogin.resultCode,
    lastResultMessage: lastLogin.resultMessage,
    nextLoginRequiresCaptcha: lastLogin.nextLoginRequiresCaptcha,
    accountIsBlocked: lastLogin.accountIsBlocked,
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
  options: { trigger?: LoginDashboardTrigger } = {},
): Promise<DashboardAdminLoginResult> {
  const trigger = options.trigger ?? 'explicit'
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

  if (trigger === 'jwt-expired-refresh') {
    const peek = peekDashboardAdminCache(country, environment)
    if (peek.lastResultCode !== 200 || peek.nextLoginRequiresCaptcha === true) {
      return {
        httpStatus: 0,
        result: {
          resultCode: peek.lastResultCode,
          resultMessage: peek.lastResultMessage,
          payload: { nextLoginRequiresCaptcha: peek.nextLoginRequiresCaptcha },
        },
        token: null,
        resultCode: peek.lastResultCode,
        fromCache: false,
      }
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
    lastLogin = loginDiagnostics(result)
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
  const cached = getCachedDashboardAdminToken(country, environment)
  if (cached) return cached
  const peek = peekDashboardAdminCache(country, environment)
  if (peek.cacheExpired && peek.lastResultCode === 200 && peek.nextLoginRequiresCaptcha !== true) {
    return (await loginDashboardAndCache(country, environment, { trigger: 'jwt-expired-refresh' })).token
  }
  return null
}

/**
 * Loads the durable token into this process, if memory has none.
 *
 * Called from the async credential path rather than at module load: a token is
 * only needed when a run actually reaches a back-office step, and reading the
 * database on import would make every process that merely links this module pay
 * for it.
 *
 * A hydrated token also restores `lastLogin.resultCode`. Without that,
 * `getDashboardAdminToken` would refuse to refresh once the hydrated token
 * expired — it only re-logs in when a previous login is known to have
 * succeeded, and a row in this table IS that knowledge.
 */
export async function hydrateDashboardAdminCache(
  country: NesyCountry,
  environment: NesyEnvironment,
): Promise<void> {
  if (storedEntry(country, environment) !== null) return
  const stored = await readStoredAdminToken(country, environment)
  if (stored === null) return
  cache.set(cacheKey(country, environment), {
    token: stored.token,
    at: stored.obtainedAtMs,
    expiresAtMs: stored.expiresAtMs,
    expirySource: stored.expirySource,
    result: stored.loginResult ?? { resultCode: 200 },
  })
  if (lastLogin.resultCode == null) lastLogin = { ...emptyLastLogin(), resultCode: 200 }
}

/**
 * Drops a token the back office has rejected, from memory AND from the store.
 *
 * Leaving the durable copy would hydrate the rejected token straight back in on
 * the next restart, which is worse than not persisting at all: the failure would
 * survive the fix. The next credential read finds no cache, and because a
 * previous login is on record, `getDashboardAdminToken` signs in again.
 */
export async function invalidateDashboardAdminToken(
  country: NesyCountry,
  environment: NesyEnvironment,
): Promise<void> {
  cache.delete(cacheKey(country, environment))
  await deleteStoredAdminToken(country, environment)
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
  // Survives an API restart: without this the token was gone on every reload.
  await hydrateDashboardAdminCache(nextCountry, nextEnvironment)
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
