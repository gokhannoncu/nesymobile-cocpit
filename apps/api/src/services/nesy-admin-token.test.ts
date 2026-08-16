import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  extractDashboardAdminToken,
  fingerprintAdminToken,
  getCachedDashboardAdminToken,
  getDashboardAdminToken,
  getLoginDashboardCallCount,
  loginDashboardAndCache,
  peekDashboardAdminCache,
  rememberDashboardAdminToken,
  resetDashboardAdminTokenStateForTests,
  resolveBackofficeAdminCredentials,
} from './nesy-admin-token.js'

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
    expect(peekDashboardAdminCache('RS', 'stage').present).toBe(false)
    expect(getLoginDashboardCallCount()).toBe(1)
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
