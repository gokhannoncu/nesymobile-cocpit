import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  isDashboardConfigured,
  NESY_DASHBOARD_COUNTRIES,
  NESY_DASHBOARD_COUNTRY_ENVIRONMENTS,
  resolveBaseUrl,
  resolveDashboardBaseUrl,
  type NesyEnvironment,
} from '../nesy-env.js'
import {
  getNesyMobileEnvironmentsForCountry,
  NESY_MOBILE_COUNTRIES,
  NESY_MOBILE_ENVIRONMENTS,
  resolveNesyMobileApplicationId,
  resolveNesyMobileBaseUrl,
  type NesyMobileEnvironment,
} from '../nesy-mobile-env.js'
import { nesyEnvironmentsResponseSchema } from '../schemas/nesy.schema.js'

export async function nesyEnvRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/environments',
    {
      schema: {
        response: {
          200: nesyEnvironmentsResponseSchema,
        },
      },
    },
    async () => {
      const dashboard: Record<
        string,
        Record<
          string,
          {
            apiUrl: string
            dashboardUrl: string
            configured: boolean
            loginEndpoint: string
          }
        >
      > = {}

      for (const country of NESY_DASHBOARD_COUNTRIES) {
        dashboard[country] = {}
        for (const environment of NESY_DASHBOARD_COUNTRY_ENVIRONMENTS[country]) {
          const apiUrl = resolveBaseUrl(country, environment)
          const dashboardUrl = resolveDashboardBaseUrl(country, environment)
          dashboard[country][environment] = {
            apiUrl,
            dashboardUrl,
            configured: isDashboardConfigured(country, environment),
            loginEndpoint: apiUrl ? `${apiUrl}/Auth/LoginDashboard` : '',
          }
        }
      }

      const mobile: Record<
        string,
        Record<
          string,
          {
            apiUrl: string
            applicationId: string
            selectable: boolean
          }
        >
      > = {}

      for (const country of NESY_MOBILE_COUNTRIES) {
        mobile[country] = {}
        const selectable = new Set(getNesyMobileEnvironmentsForCountry(country))
        for (const environment of NESY_MOBILE_ENVIRONMENTS) {
          mobile[country][environment] = {
            apiUrl: resolveNesyMobileBaseUrl(country, environment),
            applicationId: resolveNesyMobileApplicationId(country, environment),
            selectable: selectable.has(environment as NesyMobileEnvironment),
          }
        }
      }

      return { dashboard, mobile }
    },
  )
}
