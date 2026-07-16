import Fastify from 'fastify'
import cors from '@fastify/cors'
import express from 'express'
import fastifyExpress from '@fastify/express'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import type { Env } from './env.js'
import { healthRoutes } from './routes/health.routes.js'
import { nesyAuthRoutes } from './routes/nesy-auth.routes.js'
import { nesyEnvRoutes } from './routes/nesy-env.routes.js'
import shipmentsRouter from './legacy/shipments.router.js'
import customersRouter from './legacy/customers.router.js'
import pickupsRouter from './legacy/pickups.router.js'
import happyPathRouter from './legacy/happy-path.router.js'
import { createSocketServer, type AppSocketServer } from './plugins/socket.js'

export type AppContext = {
  env: Env
  io: AppSocketServer | null
}

export async function buildApp(env: Env) {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : env.NODE_ENV === 'development'
          ? { level: 'warn' }
          : true,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  await app.register(healthRoutes)
  await app.register(nesyAuthRoutes, { prefix: '/api/nesy/auth' })
  await app.register(nesyEnvRoutes, { prefix: '/api/nesy' })

  await app.register(fastifyExpress)

  const dataCenterApi = express()
  dataCenterApi.use((req, res, next) => {
    const path = (req.path ?? req.url ?? '').split('?')[0] ?? ''
    if (
      path.startsWith('/api/shipments') ||
      path.startsWith('/api/customers') ||
      path.startsWith('/api/pickups') ||
      path.startsWith('/api/happy-path')
    ) {
      return express.json()(req, res, next)
    }
    next()
  })
  dataCenterApi.use('/api/shipments', shipmentsRouter)
  dataCenterApi.use('/api/customers', customersRouter)
  dataCenterApi.use('/api/pickups', pickupsRouter)
  dataCenterApi.use('/api/happy-path/pools', happyPathRouter)
  app.use(dataCenterApi)

  const io = env.NODE_ENV === 'test' ? null : createSocketServer(app.server, env)

  if (io) {
    const { startAdbBridge } = await import('./plugins/adb-bridge.js')
    startAdbBridge(io)
  }

  return { app, io }
}
