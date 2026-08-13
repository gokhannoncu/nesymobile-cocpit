import type { FastifyInstance, FastifyReply } from 'fastify'

import {
  getEvidenceJourney,
  getRunDetail,
  getWorkflowCatalog,
  queryRunHistory,
} from '../services/verdict-runtime-read-model.js'
import { getRunTelemetry } from '../services/run-telemetry-read-model.js'
import { __phase6ContractSingletons } from './verdict-phase6-contracts.routes.js'

async function withRuntimeRead<T>(reply: FastifyReply, read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read()
  } catch (err) {
    await reply.code(503).send({
      status: 'unavailable',
      detail: err instanceof Error ? err.message : String(err),
    })
    return undefined
  }
}

export async function verdictRuntimeRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { limit?: string; offset?: string; engineType?: string } }>(
    '/runtime/runs',
    async (request, reply) => {
      const result = await withRuntimeRead(reply, () =>
        queryRunHistory({
          limit: parsePositiveInt(request.query.limit, 50),
          offset: parsePositiveInt(request.query.offset, 0),
          engineType: request.query.engineType,
        }),
      )
      if (!result) return
      return result
    },
  )

  app.get<{ Params: { runId: string } }>('/runtime/runs/:runId', async (request, reply) => {
    const result = await withRuntimeRead(reply, () => getRunDetail(request.params.runId))
    if (result === undefined) return
    if (result === null) {
      return reply.code(404).send({ status: 'not_found', detail: `run ${request.params.runId} was not found` })
    }
    return result
  })

  app.get<{ Params: { runId: string } }>(
    '/runtime/runs/:runId/telemetry',
    async (request, reply) => {
      const result = await withRuntimeRead(reply, () =>
        getRunTelemetry(request.params.runId),
      )
      if (result === undefined) return
      if (result === null) {
        return reply.code(404).send({
          status: 'not_found',
          detail: `run ${request.params.runId} was not found`,
        })
      }
      return result
    },
  )

  app.get<{ Params: { runId: string } }>('/runtime/runs/:runId/evidence-journey', async (request, reply) => {
    const result = await withRuntimeRead(reply, () => getEvidenceJourney(request.params.runId))
    if (!result) return
    return result
  })

  app.get('/runtime/evidence-sources', async () => __phase6ContractSingletons.evidenceSources.list())

  app.get<{ Params: { runId: string } }>(
    '/runtime/runs/:runId/evidence-sources',
    async (request, reply) => {
      try {
        return await __phase6ContractSingletons.evidenceSources.listForRun(request.params.runId)
      } catch (error) {
        return reply.code(503).send({
          status: 'unavailable',
          detail: error instanceof Error ? error.message : String(error),
        })
      }
    },
  )

  app.get<{ Params: { runId: string } }>(
    '/runtime/runs/:runId/target-resolutions',
    async (request) =>
      __phase6ContractSingletons.domainPackReads.listRunTargetResolutions(request.params.runId),
  )

  app.get<{
    Params: { deviceId: string }
    Querystring: { appId?: string }
  }>('/runtime/devices/:deviceId/readiness', async (request) =>
    __phase6ContractSingletons.deviceReadiness.get(request.params.deviceId, {
      appId: request.query.appId,
    }),
  )

  app.get<{ Querystring: { limit?: string } }>('/runtime/catalog/workflows', async (request, reply) => {
    const result = await withRuntimeRead(reply, () => getWorkflowCatalog(parsePositiveInt(request.query.limit, 50)))
    if (!result) return
    return result
  })

  app.get('/runtime/test-profiles', async () => __phase6ContractSingletons.testProfiles.list())

  app.get<{ Params: { campaignId: string } }>('/runtime/test-campaigns/:campaignId', async (request, reply) => {
    const result = __phase6ContractSingletons.testCampaigns.get(request.params.campaignId)
    if (!result) {
      return reply.code(404).send({ status: 'not_found', detail: 'campaign not found' })
    }
    return result
  })
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
