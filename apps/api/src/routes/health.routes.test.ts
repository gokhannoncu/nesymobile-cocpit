import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { loadEnv } from '../env.js'
import { buildApp } from '../app.js'

describe('GET /health', () => {
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

  it('returns ok payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('nesy-api')
    expect(body.timestamp).toBeTypeOf('string')
  })
})
