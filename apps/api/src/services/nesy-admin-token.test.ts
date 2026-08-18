import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  extractDashboardAdminToken,
  fingerprintAdminToken,
  getCachedDashboardAdminToken,
  getDashboardAdminToken,
  getLoginDashboardCallCount,
  loginDashboardAndCache,
  loginDiagnostics,
  peekDashboardAdminCache,
  readJwtExpiryMs,
  rememberDashboardAdminToken,
  resetDashboardAdminTokenStateForTests,
  resolveBackofficeAdminCredentials,
  TOKEN_TTL_MS,
} from './nesy-admin-token.js'

function jwtWithExp(expSec: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ exp: expSec })).toString('base64url')
  return `${header}.${payload}.sig`
}

const LOGIN_JSON = {
  resultCode: 200,
  payload: { token: 'dashboard-token-abc', user: { username: 'admin' } },
}

describe('dashboard admin token cache handoff', () => {
  const envKeys = [
    'NESY_RS_STAGE_BASE_URL',
    'NESY_RS_STAGE_USERNAME',
    'NESY_RS_STAGE_PASSWORD',
    'NESY_BACKOFFICE_TOKEN',
    'NESY_BACKOFFICE_BASE_URL',
  ] as const
  const previous = new Map<string, string | undefined>()

  beforeEach(() => {
    resetDashboardAdminTokenStateForTests()
    for (const key of envKeys) previous.set(key, process.env[key])
    process.env.NESY_RS_STAGE_BASE_URL = 'https://nesy.example.test'
    process.env.NESY_RS_STAGE_USERNAME = 'admin'
    process.env.NESY_RS_STAGE_PASSWORD = 'secret'
    delete process.env.NESY_BACKOFFICE_TOKEN
    delete process.env.NESY_BACKOFFICE_BASE_URL
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetDashboardAdminTokenStateForTests()
    for (const key of envKeys) {
      const value = previous.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('extracts a token from a LoginDashboard envelope', () => {
    expect(extractDashboardAdminToken(LOGIN_JSON)).toBe('dashboard-token-abc')
    expect(extractDashboardAdminToken({ ResultCode: 200, Payload: { Token: 'X' } })).toBe('X')
    expect(extractDashboardAdminToken({ resultCode: 400, payload: {} })).toBeNull()
  })

  it('writes the same PID cache that getDashboardAdminToken and the adapter read', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(LOGIN_JSON), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchImpl)

    const login = await loginDashboardAndCache('RS', 'stage')
    expect(login.fromCache).toBe(false)
    expect(login.resultCode).toBe(200)
    expect(login.token).toBe('dashboard-token-abc')
    expect(getLoginDashboardCallCount()).toBe(1)

    const peek = peekDashboardAdminCache('RS', 'stage')
    expect(peek.present).toBe(true)
    expect(peek.tokenFingerprint).toBe(fingerprintAdminToken('dashboard-token-abc'))
    expect(peek.loginDashboardCalls).toBe(1)
    expect(peek.credentialSource).toBe('dashboard-admin-cache')
    expect(getCachedDashboardAdminToken('RS', 'stage')).toBe('dashboard-token-abc')

    const second = await getDashboardAdminToken('RS', 'stage')
    expect(second).toBe('dashboard-token-abc')
    expect(getLoginDashboardCallCount()).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const adapter = await resolveBackofficeAdminCredentials('RS', 'stage')
    expect(adapter.source).toBe('dashboard-admin-cache')
    expect(adapter.token).toBe('dashboard-token-abc')
    expect(getLoginDashboardCallCount()).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not cache a captcha / non-200 LoginDashboard envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ resultCode: 400, resultMessage: 'captcha', payload: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const login = await loginDashboardAndCache('RS', 'stage')
    expect(login.token).toBeNull()
    expect(login.resultCode).toBe(400)
    const peek = peekDashboardAdminCache('RS', 'stage')
    expect(peek.present).toBe(false)
    expect(peek.lastResultCode).toBe(400)
    expect(peek.lastResultMessage).toBe('captcha')
    expect(getLoginDashboardCallCount()).toBe(1)
    expect(await getDashboardAdminToken('RS', 'stage')).toBeNull()
    expect(getLoginDashboardCallCount()).toBe(1)
  })

  it('keeps a JWT until exp, not the 30-minute fallback', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-17T12:00:00.000Z'))
    const expSec = Math.floor(Date.parse('2026-08-18T03:00:00.000Z') / 1000)
    rememberDashboardAdminToken('RS', 'stage', jwtWithExp(expSec), { resultCode: 200, payload: {} })
    expect(readJwtExpiryMs(jwtWithExp(expSec))).toBe(Date.parse('2026-08-18T03:00:00.000Z'))
    vi.setSystemTime(new Date('2026-08-17T12:45:00.000Z'))
    const peek = peekDashboardAdminCache('RS', 'stage')
    expect(peek.present).toBe(true)
    expect(peek.expirySource).toBe('jwt')
    expect(peek.jwtExpired).toBe(false)
    expect(peek.expiresAt).toBe('2026-08-18T03:00:00.000Z')
    expect(Date.now() - Date.parse('2026-08-17T12:00:00.000Z')).toBeGreaterThan(TOKEN_TTL_MS)
    vi.useRealTimers()
  })

  it('marks jwtExpired after exp and refreshes once via getDashboardAdminToken', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-17T12:00:00.000Z'))
    const expSec = Math.floor(Date.parse('2026-08-17T12:10:00.000Z') / 1000)
    rememberDashboardAdminToken('RS', 'stage', jwtWithExp(expSec), { resultCode: 200, payload: {} })
    vi.setSystemTime(new Date('2026-08-17T12:10:30.000Z'))
    const peek = peekDashboardAdminCache('RS', 'stage')
    expect(peek.present).toBe(false)
    expect(peek.jwtExpired).toBe(true)
    expect(peek.cacheExpired).toBe(true)
    expect(peek.lastResultCode).toBe(200)

    const next = jwtWithExp(Math.floor(Date.parse('2026-08-18T03:00:00.000Z') / 1000))
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ resultCode: 200, payload: { token: next } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchImpl)
    const token = await getDashboardAdminToken('RS', 'stage')
    expect(token).toBe(next)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(getLoginDashboardCallCount()).toBe(1)
    vi.useRealTimers()
  })

  it('reads captcha flags from a LoginDashboard envelope without keeping a token', () => {
    expect(
      loginDiagnostics({
        resultCode: 400,
        resultMessage: 'CAPTCHA_REQUIRED',
        payload: { nextLoginRequiresCaptcha: true, accountIsBlocked: false },
      }),
    ).toEqual({
      resultCode: 400,
      resultMessage: 'CAPTCHA_REQUIRED',
      nextLoginRequiresCaptcha: true,
      accountIsBlocked: false,
    })
  })

  it('prefers the warmed cache over NESY_BACKOFFICE_TOKEN so verify reads the same provider', async () => {
    rememberDashboardAdminToken('RS', 'stage', 'cached-from-login')
    process.env.NESY_BACKOFFICE_TOKEN = 'env-token-should-lose'
    const adapter = await resolveBackofficeAdminCredentials('RS', 'stage')
    expect(adapter.source).toBe('dashboard-admin-cache')
    expect(adapter.token).toBe('cached-from-login')
    expect(getLoginDashboardCallCount()).toBe(0)
  })
})
