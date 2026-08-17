import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  isDashboardConfigured,
  isNesyDashboardCountry,
  isNesyEnvironment,
  NESY_DASHBOARD_COUNTRY_ENVIRONMENTS,
  nesyPortalHeaders,
  resolveBaseUrl,
  type NesyEnvironment,
} from '../nesy-env.js'
import { nesyCountrySchema, nesyEnvironmentSchema, nesyLoginBodySchema, nesyLoginResponseSchema } from '../schemas/nesy.schema.js'
import {
  ADMIN_AUTH_NOT_READY,
  fingerprintAdminToken,
  getCachedDashboardAdminToken,
  getLoginDashboardCallCount,
  loginDashboardAndCache,
  peekDashboardAdminCache,
  resolveBackofficeAdminCredentials,
} from '../services/nesy-admin-token.js'

const cachePeekSchema = z.object({
  pid: z.number(),
  country: z.string(),
  environment: z.string(),
  present: z.boolean(),
  tokenFingerprint: z.string().nullable(),
  ageMs: z.number().nullable(),
  expiresAt: z.string().nullable(),
  ttlMs: z.number(),
  loginDashboardCalls: z.number(),
  credentialSource: z.enum(['dashboard-admin-cache', 'NESY_BACKOFFICE_TOKEN', 'empty']),
})

const countryEnvQuerySchema = z.object({
  country: nesyCountrySchema.default('RS'),
  environment: nesyEnvironmentSchema.default('stage'),
})

const notReadySchema = z.object({
  code: z.literal(ADMIN_AUTH_NOT_READY),
  message: z.string(),
  cache: cachePeekSchema,
})

const adminShipmentReadBodySchema = z.object({
  country: nesyCountrySchema.default('RS'),
  environment: nesyEnvironmentSchema.default('stage'),
  shipmentId: z.string().trim().min(1),
})

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function resultCodeOf(result: unknown): number | null {
  const record = asRecord(result)
  const raw = record.resultCode ?? record.ResultCode
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw)
  return null
}

function withoutTokenFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutTokenFields)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key.toLowerCase() !== 'token')
      .map(([key, entry]) => [key, withoutTokenFields(entry)]),
  )
}

function isLoopbackAddress(address: string): boolean {
  const normalized = address.toLowerCase()
  return normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1'
}

async function readAdminJson(input: {
  baseUrl: string
  token: string
  path: string
  body: unknown
}): Promise<{ http: number; ms: number; result: unknown }> {
  const startedAt = Date.now()
  const response = await fetch(`${input.baseUrl.replace(/\/$/, '')}/${input.path}`, {
    method: 'POST',
    headers: nesyPortalHeaders(input.token),
    body: JSON.stringify(input.body),
    signal: AbortSignal.timeout(25_000),
  })
  const text = await response.text()
  try {
    return { http: response.status, ms: Date.now() - startedAt, result: text === '' ? null : JSON.parse(text) }
  } catch {
    return { http: response.status, ms: Date.now() - startedAt, result: { raw: text.slice(0, 2_000) } }
  }
}

export async function nesyAuthRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.post(
    '/login',
    {
      schema: {
        body: nesyLoginBodySchema,
        response: {
          200: nesyLoginResponseSchema,
          400: z.object({ message: z.string() }),
          502: z.object({ message: z.string(), country: z.string(), environment: z.string(), result: z.unknown() }),
          500: z.object({ message: z.string(), error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { country, environment } = request.body

      if (!isNesyDashboardCountry(country)) {
        return reply.status(400).send({
          message: 'country is required and must be one of HR, SI, RS, BA, ME, AZ (SK not configured yet).',
        })
      }

      if (!isNesyEnvironment(environment)) {
        return reply.status(400).send({ message: 'environment is required and must be one of stage or prod.' })
      }

      const allowed = [...NESY_DASHBOARD_COUNTRY_ENVIRONMENTS[country]] as NesyEnvironment[]
      if (!allowed.includes(environment)) {
        return reply.status(400).send({
          message: `${country} country does not support ${environment} environment.`,
        })
      }

      if (!isDashboardConfigured(country, environment)) {
        return reply.status(400).send({
          message: `${country}/${environment} credentials are not configured in API environment.`,
        })
      }

      try {
        const login = await loginDashboardAndCache(country, environment)
        if (!login.token || login.resultCode !== 200) {
          return reply.status(502).send({
            message: 'Nesy login request failed.',
            country,
            environment,
            result: withoutTokenFields(login.result),
          })
        }

        return {
          message: 'Nesy login successful.',
          country,
          environment,
          result: {
            ...asRecord(withoutTokenFields(login.result)),
            tokenPresent: true,
            tokenFingerprint: fingerprintAdminToken(login.token),
            fromCache: login.fromCache,
          },
        }
      } catch (error) {
        return reply.status(500).send({
          message: 'Unexpected error during Nesy login.',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  )

  typed.get(
    '/admin-cache',
    {
      schema: {
        querystring: countryEnvQuerySchema,
        response: {
          200: cachePeekSchema,
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { country, environment } = request.query
      if (!isNesyDashboardCountry(country) || !isNesyEnvironment(environment)) {
        return reply.status(400).send({ message: 'country and environment are required.' })
      }
      return peekDashboardAdminCache(country, environment)
    },
  )

  typed.get(
    '/cached-token',
    {
      schema: {
        querystring: countryEnvQuerySchema,
        response: {
          200: cachePeekSchema,
          400: z.object({ message: z.string() }),
          409: notReadySchema,
        },
      },
    },
    async (request, reply) => {
      const { country, environment } = request.query
      if (!isNesyDashboardCountry(country) || !isNesyEnvironment(environment)) {
        return reply.status(400).send({ message: 'country and environment are required.' })
      }
      const cache = peekDashboardAdminCache(country, environment)
      if (!getCachedDashboardAdminToken(country, environment)) {
        return reply.status(409).send({
          code: ADMIN_AUTH_NOT_READY,
          message: 'Dashboard admin token cache is empty. Warm /nesy/auth/login once on this PID first.',
          cache,
        })
      }
      return cache
    },
  )

  /**
   * Local qualification helper. The API process performs the two allowlisted
   * reads with its cached credential; the bearer itself never crosses HTTP.
   */
  typed.post(
    '/admin-shipment-read',
    {
      schema: {
        body: adminShipmentReadBodySchema,
        response: {
          200: z.object({
            cache: cachePeekSchema,
            proof: z.object({ http: z.number(), ms: z.number(), result: z.unknown() }),
            details: z.object({ http: z.number(), ms: z.number(), result: z.unknown() }),
          }),
          403: z.object({ message: z.string() }),
          409: notReadySchema,
          502: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!isLoopbackAddress(request.ip)) {
        return reply.status(403).send({ message: 'admin shipment reads are available only from loopback.' })
      }
      const { country, environment, shipmentId } = request.body
      const cache = peekDashboardAdminCache(country, environment)
      const token = getCachedDashboardAdminToken(country, environment)
      if (!token) {
        return reply.status(409).send({
          code: ADMIN_AUTH_NOT_READY,
          message: 'Dashboard admin token cache is empty. Warm /nesy/auth/login once on this PID first.',
          cache,
        })
      }
      const baseUrl = process.env.NESY_BACKOFFICE_BASE_URL?.trim() || resolveBaseUrl(country, environment)
      if (!baseUrl) {
        return reply.status(502).send({ message: `Back-office URL is not configured for ${country}/${environment}.` })
      }
      try {
        const [proof, details] = await Promise.all([
          readAdminJson({
            baseUrl,
            token,
            path: 'Tracking/GetShipmentDeliveryProof',
            body: { ShipmentIdList: [shipmentId] },
          }),
          readAdminJson({
            baseUrl,
            token,
            path: 'Shipment/SearchShipment',
            body: { ShipmentIds: [shipmentId] },
          }),
        ])
        return { cache, proof, details }
      } catch (error) {
        return reply.status(502).send({
          message: error instanceof Error ? error.message : 'Admin shipment read failed.',
        })
      }
    },
  )

  typed.post(
    '/admin-preflight',
    {
      schema: {
        body: nesyLoginBodySchema,
        response: {
          200: z.object({
            ready: z.literal(true),
            pid: z.number(),
            cache: cachePeekSchema,
            adapterReadback: z.object({
              present: z.boolean(),
              source: z.enum(['dashboard-admin-cache', 'NESY_BACKOFFICE_TOKEN', 'login-dashboard', 'empty']),
              tokenFingerprint: z.string().nullable(),
              matchesCache: z.boolean(),
              loginDashboardCallsBefore: z.number(),
              loginDashboardCallsAfter: z.number(),
            }),
            harmlessRead: z.object({
              path: z.string(),
              http: z.number(),
              resultCode: z.number().nullable(),
              accepted: z.boolean(),
            }),
          }),
          400: z.object({ message: z.string() }),
          409: notReadySchema,
          502: z.object({
            ready: z.literal(false),
            code: z.string(),
            message: z.string(),
            cache: cachePeekSchema,
            adapterReadback: z.unknown(),
            harmlessRead: z.unknown(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { country, environment } = request.body
      if (!isNesyDashboardCountry(country) || !isNesyEnvironment(environment)) {
        return reply.status(400).send({ message: 'country and environment are required.' })
      }

      const cache = peekDashboardAdminCache(country, environment)
      const cachedToken = getCachedDashboardAdminToken(country, environment)
      if (!cachedToken || !cache.present) {
        return reply.status(409).send({
          code: ADMIN_AUTH_NOT_READY,
          message: 'Verify adapter cannot read a dashboard admin token because this PID cache is empty.',
          cache,
        })
      }

      const loginDashboardCallsBefore = getLoginDashboardCallCount()
      const credentials = await resolveBackofficeAdminCredentials(country, environment)
      const loginDashboardCallsAfter = getLoginDashboardCallCount()
      const adapterFingerprint = credentials.token ? fingerprintAdminToken(credentials.token) : null
      const adapterReadback = {
        present: credentials.token.trim() !== '',
        source: credentials.source,
        tokenFingerprint: adapterFingerprint,
        matchesCache: adapterFingerprint === cache.tokenFingerprint,
        loginDashboardCallsBefore,
        loginDashboardCallsAfter,
      }

      const baseUrl = credentials.baseUrl || resolveBaseUrl(country, environment)
      let harmlessRead: { path: string; http: number; resultCode: number | null; accepted: boolean } = {
        path: 'User/GetMyInfo',
        http: 0,
        resultCode: null,
        accepted: false,
      }
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/User/GetMyInfo`, {
          method: 'POST',
          headers: nesyPortalHeaders(cachedToken),
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(25_000),
        })
        const result = await res.json()
        const outerPayload = asRecord(asRecord(result).payload ?? asRecord(result).Payload)
        const nestedEnvelope =
          'resultCode' in outerPayload ||
          'ResultCode' in outerPayload ||
          'payload' in outerPayload ||
          'Payload' in outerPayload
        const resultCode = resultCodeOf(nestedEnvelope ? outerPayload : result) ?? resultCodeOf(result)
        // GetMyInfo nests a second envelope. HTTP 200 + resultCode 200 is the
        // authenticated read. Do not require a flattened userId.
        harmlessRead = {
          path: 'User/GetMyInfo',
          http: res.status,
          resultCode,
          accepted: res.ok && resultCode === 200,
        }
      } catch (error) {
        return reply.status(502).send({
          ready: false,
          code: 'HARMLESS_READ_FAILED',
          message: error instanceof Error ? error.message : 'User/GetMyInfo failed',
          cache,
          adapterReadback,
          harmlessRead,
        })
      }

      const ready =
        adapterReadback.present &&
        adapterReadback.source === 'dashboard-admin-cache' &&
        adapterReadback.matchesCache &&
        adapterReadback.loginDashboardCallsAfter === adapterReadback.loginDashboardCallsBefore &&
        harmlessRead.accepted

      if (!ready) {
        return reply.status(502).send({
          ready: false,
          code: adapterReadback.loginDashboardCallsAfter !== adapterReadback.loginDashboardCallsBefore
            ? 'SECOND_LOGIN_DASHBOARD'
            : 'ADMIN_AUTH_HANDOFF_FAILED',
          message: 'Cached admin token did not hand off to the verify adapter without another LoginDashboard.',
          cache: peekDashboardAdminCache(country, environment),
          adapterReadback,
          harmlessRead,
        })
      }

      return {
        ready: true as const,
        pid: process.pid,
        cache: peekDashboardAdminCache(country, environment),
        adapterReadback,
        harmlessRead,
      }
    },
  )
}
