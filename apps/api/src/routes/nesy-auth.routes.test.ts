import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildApp } from '../app.js'
import { loadEnv } from '../env.js'
import {
  rememberDashboardAdminToken,
  resetDashboardAdminTokenStateForTests,
} from '../services/nesy-admin-token.js'

describe('Nesy admin credential routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app']

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    vi.stubEnv('NESY_RS_STAGE_BASE_URL', 'https://stage.example.test')
    vi.stubEnv('NESY_RS_STAGE_USERNAME', 'test-user')
    vi.stubEnv('NESY_RS_STAGE_PASSWORD', 'test-password')
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
})
