import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  getEnvValue,
  isDashboardConfigured,
  isNesyDashboardCountry,
  isNesyEnvironment,
  NESY_DASHBOARD_COUNTRY_ENVIRONMENTS,
  resolveBaseUrl,
  type NesyDashboardCountry,
  type NesyEnvironment,
} from '../nesy-env.js'
import { nesyLoginBodySchema, nesyLoginResponseSchema } from '../schemas/nesy.schema.js'

export async function nesyAuthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
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
        return reply.status(400).send({ message: 'environment is required and must be stage or prod.' })
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

      const baseUrl = resolveBaseUrl(country, environment)
      const username = getEnvValue(country, environment, 'USERNAME')
      const password = getEnvValue(country, environment, 'PASSWORD')

      try {
        const loginUrl = `${baseUrl}/Auth/LoginDashboard`
        const nesyResponse = await fetch(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Username: username,
            Password: password,
            CaptchaToken: null,
          }),
          signal: AbortSignal.timeout(25_000),
        })

        const result = await nesyResponse.json()

        if (!nesyResponse.ok) {
          return reply.status(502).send({
            message: 'Nesy login request failed.',
            country,
            environment,
            result,
          })
        }

        return {
          message: 'Nesy login successful.',
          country,
          environment,
          result,
        }
      } catch (error) {
        return reply.status(500).send({
          message: 'Unexpected error during Nesy login.',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  )
}
