import Fastify, { type FastifyInstance } from 'fastify'
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
import { verdictEventsRoutes } from './routes/verdict-events.routes.js'
import { verdictPhase6ContractRoutes } from './routes/verdict-phase6-contracts.routes.js'
import { verdictRuntimeRoutes } from './routes/verdict-runtime.routes.js'
import shipmentsRouter from './legacy/shipments.router.js'
import customersRouter from './legacy/customers.router.js'
import pickupsRouter from './legacy/pickups.router.js'
import happyPathRouter from './legacy/happy-path.router.js'
import { createSocketServer, type AppSocketServer } from './plugins/socket.js'
import { BridgeFlowEvidenceSources } from './services/bridgeflow-evidence-source-registry.js'
import { registerNesyDeviceEventSources } from './services/bridgeflow-device-event-sources.js'

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

  // Before any route can ingest a device frame: an unregistered `sourceEvent` is
  // refused by the durable resolver, and the registry is empty until this runs.
  registerNesyDeviceEventSources(BridgeFlowEvidenceSources)

  await app.register(healthRoutes)
  await app.register(nesyAuthRoutes, { prefix: '/api/nesy/auth' })
  await app.register(nesyEnvRoutes, { prefix: '/api/nesy' })
  // Durable event runtime read model (Faz 2 / D.2). Read-only, and lazy: the
  // Prisma-backed runtime is not constructed until a route is actually called,
  // so registering it costs nothing when nobody asks about durable health.
  await app.register(verdictEventsRoutes, { prefix: '/api/verdict' })
  await app.register(verdictRuntimeRoutes, { prefix: '/api/verdict' })
  await app.register(verdictPhase6ContractRoutes, { prefix: '/api/verdict' })

  // The @fastify/express bridge breaks light-my-request payload capture,
  // so skip the Express data-center API in tests (mirrors the socket.io skip below).
  if (env.NODE_ENV !== 'test') {
    await registerDataCenterApi(app)
  }

  const io = env.NODE_ENV === 'test' ? null : createSocketServer(app.server, env)

  if (io) {
    const { startAdbBridge } = await import('./plugins/adb-bridge.js')
    startAdbBridge(io)
  }

  return { app, io }
}

async function registerDataCenterApi(app: FastifyInstance) {
  await app.register(fastifyExpress)

  const dataCenterApi = express()
  dataCenterApi.use('/api/media', express.static(process.cwd()))
  dataCenterApi.use((req, res, next) => {
    const path = (req.path ?? req.url ?? '').split('?')[0] ?? ''
    if (
      path.startsWith('/api/shipments') ||
      path.startsWith('/api/customers') ||
      path.startsWith('/api/pickups') ||
      path.startsWith('/api/happy-path') ||
      path.startsWith('/api/nesy/dashboard') ||
      path.startsWith('/api/courier-wallets') ||
      path.startsWith('/api/mobile-devices') ||
      path.startsWith('/api/nesy/mobile-auth') ||
      path.startsWith('/api/mongo-query') ||
      path.startsWith('/api/graylog-query') ||
      path.startsWith('/api/data-locator') ||
      path.startsWith('/api/field-courier-login') ||
      path.startsWith('/api/incidents') ||
      path.startsWith('/api/workflows')
    ) {
      return express.json()(req, res, next)
    }
    next()
  })
  dataCenterApi.use('/api/shipments', shipmentsRouter)
  dataCenterApi.use('/api/customers', customersRouter)
  dataCenterApi.use('/api/pickups', pickupsRouter)
  dataCenterApi.use('/api/happy-path/pools', happyPathRouter)
  const { default: nesyDashboardRouter } = await import('./legacy/nesy-dashboard.router.js')
  const { default: courierWalletsRouter } = await import('./legacy/courier-wallets.router.js')
  const { default: mobileDevicesRouter } = await import('./legacy/mobile-devices.router.js')
  const { default: nesyMobileAuthRouter } = await import('./legacy/nesy-mobile-auth.router.js')
  const { default: mongoQueryRouter } = await import('./legacy/mongo-query.router.js')
  const { default: graylogQueryRouter } = await import('./legacy/graylog-query.router.js')
  const { default: dataLocatorRouter } = await import('./legacy/data-locator.router.js')
  const { default: fieldCourierLoginRouter } = await import('./legacy/field-courier-login.router.js')
  const { default: engineeringIncidentsRouter } = await import('./legacy/engineering-incidents.router.js')
  const { default: workflowsRouter } = await import('./legacy/workflows.router.js')
  dataCenterApi.use('/api/nesy/dashboard', nesyDashboardRouter)
  dataCenterApi.use('/api/courier-wallets', courierWalletsRouter)
  dataCenterApi.use('/api/mobile-devices', mobileDevicesRouter)
  dataCenterApi.use('/api/nesy/mobile-auth', nesyMobileAuthRouter)
  dataCenterApi.use('/api/mongo-query', mongoQueryRouter)
  dataCenterApi.use('/api/graylog-query', graylogQueryRouter)
  dataCenterApi.use('/api/data-locator', dataLocatorRouter)
  dataCenterApi.use('/api/field-courier-login', fieldCourierLoginRouter)
  dataCenterApi.use('/api/incidents', engineeringIncidentsRouter)
  dataCenterApi.use('/api/workflows', workflowsRouter)
  app.use(dataCenterApi)
}
