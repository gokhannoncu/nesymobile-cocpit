import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildApp } from '../app.js'
import { loadEnv } from '../env.js'
import {
  getLoginDashboardCallCount,
  rememberDashboardAdminToken,
  resetDashboardAdminTokenStateForTests,
} from '../services/nesy-admin-token.js'

function jwtWithExp(expSec: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ exp: expSec })).toString('base64url')
  return `${header}.${payload}.sig`
}

describe('Nesy admin credential routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app']

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    vi.stubEnv('NESY_RS_STAGE_BASE_URL', 'https://stage.example.test')
    vi.stubEnv('NESY_RS_PROD_BASE_URL', 'https://prod.example.test')
    vi.stubEnv('NESY_RS_STAGE_USERNAME', 'test-user')
    vi.stubEnv('NESY_RS_STAGE_PASSWORD', 'test-password')
    vi.stubEnv('NESY_REMOTE_ACTION_ENV', 'stage')
    vi.stubEnv('NESY_REMOTE_ACTION_COUNTRY', 'RS')
    const built = await buildApp(loadEnv())
    app = built.app
    await app.ready()
  })

  beforeEach(() => {
    resetDashboardAdminTokenStateForTests()
    rememberDashboardAdminToken('RS', 'stage', 'admin-bearer-secret', {
      resultCode: 200,
      payload: { token: 'admin-bearer-secret' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    resetDashboardAdminTokenStateForTests()
    await app.close()
    vi.unstubAllEnvs()
  })

  it('returns cache health without serializing the cached bearer token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/nesy/auth/cached-token?country=RS&environment=stage',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      present: true,
      credentialSource: 'dashboard-admin-cache',
    })
    expect(response.body).not.toContain('admin-bearer-secret')
    expect(response.json()).not.toHaveProperty('token')
  })

  it('scrubs the upstream token from the login response even on a cache hit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/nesy/auth/login',
      payload: { country: 'RS', environment: 'stage' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).not.toContain('admin-bearer-secret')
    expect(response.json().result).toMatchObject({
      resultCode: 200,
      tokenPresent: true,
      fromCache: true,
    })
    expect(response.json().result.payload).toEqual({})
  })

  it('performs qualification shipment reads server-side without returning the bearer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const path = String(url)
        return new Response(
          JSON.stringify({
            resultCode: 200,
            payload: path.includes('GetShipmentDeliveryProof') ? [] : [{ waybillNumber: 'w1' }],
          }),
          { status: 200 },
        )
      }),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/nesy/auth/admin-shipment-read',
      payload: { country: 'RS', environment: 'stage', shipmentId: 'w1' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).not.toContain('admin-bearer-secret')
    expect(response.json()).toMatchObject({
      cache: { present: true },
      proof: { http: 200 },
      details: { http: 200 },
    })
  })

  it('imports an operator JWT into the process cache without LoginDashboard', async () => {
    resetDashboardAdminTokenStateForTests()
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600)
    const response = await app.inject({
      method: 'POST',
      url: '/api/nesy/auth/import-cached-token',
      payload: { country: 'RS', environment: 'stage', token },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      present: true,
      imported: true,
      loginDashboardCallsUnchanged: true,
      expirySource: 'jwt',
      lastResultCode: 200,
      credentialSource: 'dashboard-admin-cache',
    })
    expect(response.body).not.toContain(token)
    expect(response.json()).not.toHaveProperty('token')
    expect(getLoginDashboardCallCount()).toBe(0)

    const cached = await app.inject({
      method: 'GET',
      url: '/api/nesy/auth/cached-token?country=RS&environment=stage',
    })
    expect(cached.statusCode).toBe(200)
    expect(cached.body).not.toContain(token)
  })

  it('refuses an expired operator JWT without calling LoginDashboard', async () => {
    resetDashboardAdminTokenStateForTests()
    const token = jwtWithExp(Math.floor(Date.now() / 1000) - 120)
    const response = await app.inject({
      method: 'POST',
      url: '/api/nesy/auth/import-cached-token',
      payload: { country: 'RS', environment: 'stage', token },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().code).toBe('TOKEN_EXPIRED')
    expect(getLoginDashboardCallCount()).toBe(0)
  })

  it('refuses fixture create when the cache is empty without logging in', async () => {
    resetDashboardAdminTokenStateForTests()
    const response = await app.inject({
      method: 'POST',
      url: '/api/nesy/auth/admin-fixture-create',
      payload: { country: 'RS', environment: 'stage' },
    })
    expect(response.statusCode).toBe(409)
    expect(response.json().code).toBe('ADMIN_AUTH_NOT_READY')
    expect(response.body).not.toContain('admin-bearer-secret')
  })

  it('refuses fixture create against prod', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/nesy/auth/admin-fixture-create',
      payload: { country: 'RS', environment: 'prod' },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().code).toBe('TARGET_NOT_STAGE')
    expect(response.body).not.toContain('admin-bearer-secret')
  })
})
