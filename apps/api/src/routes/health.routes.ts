import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { healthResponseSchema } from '../schemas/health.schema.js'

export async function healthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/', async () => ({
    service: 'nesy-api' as const,
    status: 'ok' as const,
    health: '/health',
  }))

  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      service: 'nesy-api' as const,
      timestamp: new Date().toISOString(),
    }),
  )
}
