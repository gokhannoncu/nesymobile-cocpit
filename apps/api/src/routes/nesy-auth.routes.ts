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
import { resolveCachedStageAdminCredentials, TARGET_NOT_STAGE } from '../services/admin-credential-provider.js'
import { createUnloadableInvoiceShipment } from '../services/admin-fixture-create.js'
import {
  ADMIN_AUTH_NOT_READY,
  JWT_EXP_SKEW_MS,
  fingerprintAdminToken,
  getCachedDashboardAdminToken,
  getLoginDashboardCallCount,
  loginDashboardAndCache,
  peekDashboardAdminCache,
  readJwtExpiryMs,
  rememberDashboardAdminToken,
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
  expirySource: z.enum(['jwt', 'fallback-ttl']).nullable(),
  cacheExpired: z.boolean(),
  jwtExpired: z.boolean(),
  loginDashboardCalls: z.number(),
  lastResultCode: z.number().nullable(),
  lastResultMessage: z.string().nullable(),
  nextLoginRequiresCaptcha: z.boolean().nullable(),
  accountIsBlocked: z.boolean().nullable(),
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

function listenPort(app: FastifyInstance): number {
  const address = app.server.address()
  if (address && typeof address === 'object' && typeof address.port === 'number') return address.port
  return Number(process.env.PORT ?? 4001)
}

function createLocalBffInvoker(
  port: number,
  token: string,
  country: string,
  environment: string,
) {
  return async (method: 'GET' | 'POST', path: string, body: Record<string, unknown> = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(method === 'GET'
        ? {}
        : { body: JSON.stringify({ token, country, environment, ...body }) }),
    })
    const text = await response.text()
    let json: Record<string, unknown> = {}
    try {
      json = text === '' ? {} : (JSON.parse(text) as Record<string, unknown>)
    } catch {
      json = { raw: text.slice(0, 400) }
    }
    return { status: response.status, body: json }
  }
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
        const login = await loginDashboardAndCache(country, environment, { trigger: 'explicit' })
        if (!login.token || login.resultCode !== 200) {
          return reply.status(502).send({
            message: 'Nesy login request failed.',
            country,
            environment,
            result: withoutTokenFields(login.result),
          })
        }

        // Data Center + operator scripts store this JWT in the browser session.
        // Admin peek / fixture / qualification routes still never serialize it.
        const rawResult = asRecord(login.result)
        const rawPayload = asRecord(rawResult.payload ?? rawResult.Payload)
        return {
          message: 'Nesy login successful.',
          country,
          environment,
          result: {
            ...rawResult,
            payload: {
              ...rawPayload,
              token: login.token,
              user: rawPayload.user ?? rawPayload.User,
            },
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
   * Loopback-only operator seed. Stores a dashboard JWT already obtained
   * outside LoginDashboard (browser login). Does not call LoginDashboard
   * and does not increment the login counter. Lifetime follows JWT `exp`.
   */
  typed.post(
    '/import-cached-token',
    {
      schema: {
        body: z.object({
          country: nesyCountrySchema.default('RS'),
          environment: nesyEnvironmentSchema.default('stage'),
          token: z.string().min(1),
        }),
        response: {
          200: cachePeekSchema.extend({
            imported: z.literal(true),
            loginDashboardCallsUnchanged: z.literal(true),
          }),
          400: z.object({ message: z.string(), code: z.string().optional() }),
          403: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!isLoopbackAddress(request.ip)) {
        return reply.status(403).send({ message: 'token import is available only from loopback.' })
      }
      const { country, environment } = request.body
      const token = request.body.token.trim()
      if (!isNesyDashboardCountry(country) || !isNesyEnvironment(environment)) {
        return reply.status(400).send({ message: 'country and environment are required.' })
      }
      const expMs = readJwtExpiryMs(token)
      if (expMs == null) {
        return reply.status(400).send({
          code: 'TOKEN_EXP_UNREADABLE',
          message: 'operator token must be a JWT with an exp claim.',
        })
      }
      if (expMs <= Date.now() + JWT_EXP_SKEW_MS) {
        return reply.status(400).send({
          code: 'TOKEN_EXPIRED',
          message: 'operator token JWT exp is already elapsed.',
        })
      }
      const callsBefore = getLoginDashboardCallCount()
      rememberDashboardAdminToken(country, environment, token, {
        resultCode: 200,
        resultMessage: 'operator-imported',
        payload: { nextLoginRequiresCaptcha: false, accountIsBlocked: false },
      })
      if (getLoginDashboardCallCount() !== callsBefore) {
        return reply.status(400).send({
          code: 'LOGIN_DASHBOARD_TOUCHED',
          message: 'token import must not call LoginDashboard.',
        })
      }
      return {
        ...peekDashboardAdminCache(country, environment),
        imported: true as const,
        loginDashboardCallsUnchanged: true as const,
      }
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

  /**
   * Loopback fixture create. Uses the process cache only; the bearer never
   * appears in this response. Stage target only — same fail-closed origin
   * rule as fault injection.
   */
  typed.post(
    '/admin-fixture-create',
    {
      schema: {
        body: z.object({
          country: nesyCountrySchema.default('RS'),
          environment: nesyEnvironmentSchema.default('stage'),
          customerId: z.string().trim().min(1).default('10330'),
        }),
        response: {
          200: z.object({
            cache: cachePeekSchema,
            shipment: z.object({
              dbId: z.string(),
              shipmentId: z.string(),
              scanValue: z.string(),
              fullBarcode: z.string(),
              unloadStatus: z.unknown(),
            }),
          }),
          400: z.object({ code: z.string(), message: z.string(), cache: cachePeekSchema }),
          403: z.object({ message: z.string() }),
          409: notReadySchema,
          502: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!isLoopbackAddress(request.ip)) {
        return reply.status(403).send({ message: 'admin fixture create is available only from loopback.' })
      }
      const { country, environment, customerId } = request.body
      const credentials = resolveCachedStageAdminCredentials(country, environment)
      if (!credentials.ok && credentials.code === ADMIN_AUTH_NOT_READY) {
        return reply.status(409).send({
          code: ADMIN_AUTH_NOT_READY,
          message: credentials.message,
          cache: credentials.cache,
        })
      }
      if (!credentials.ok) {
        return reply.status(400).send({
          code: TARGET_NOT_STAGE,
          message: credentials.message,
          cache: credentials.cache,
        })
      }
      try {
        const shipment = await createUnloadableInvoiceShipment({
          customerId,
          invokeBff: createLocalBffInvoker(listenPort(app), credentials.token, country, environment),
        })
        return {
          cache: peekDashboardAdminCache(country, environment),
          shipment,
        }
      } catch (error) {
        return reply.status(502).send({
          message: error instanceof Error ? error.message : 'Admin fixture create failed.',
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
