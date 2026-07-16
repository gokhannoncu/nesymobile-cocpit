import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEnv } from '../env.js'
import { buildApp } from '../app.js'

describe('GET /api/nesy/environments', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app']

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    const env = loadEnv()
    const built = await buildApp(env)
    app = built.app
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns dashboard and mobile environment matrix', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/nesy/environments',
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.dashboard.HR.stage.apiUrl).toBe('')
    expect(body.mobile.HR.stage.apiUrl).toBe('https://nesy-staging-mobile-api.overseas.hr')
    expect(body.mobile.HR.prod.applicationId).toBe('com.arasdigital.nesymobileprod')
  })
})
