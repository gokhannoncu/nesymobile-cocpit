import type { FastifyInstance, FastifyReply } from 'fastify'

import {
  getDeviceReadiness,
  getEvidenceJourney,
  getLegacyRunSummary,
  getRunDetail,
  getTestCampaignResult,
  getTestProfileCatalog,
  getWorkflowCatalog,
  queryRunHistory,
} from '../services/verdict-runtime-read-model.js'

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

  app.get<{ Params: { runId: string } }>('/runtime/runs/:runId/legacy-summary', async (request, reply) => {
    const result = await withRuntimeRead(reply, () => getLegacyRunSummary(request.params.runId))
    if (result === undefined) return
    if (result === null) {
      return reply.code(404).send({ status: 'not_found', detail: `run ${request.params.runId} was not found` })
    }
    return result
  })

  app.get<{ Params: { runId: string } }>('/runtime/runs/:runId/evidence-journey', async (request, reply) => {
    const result = await withRuntimeRead(reply, () => getEvidenceJourney(request.params.runId))
    if (!result) return
    return result
  })

  app.get<{ Params: { deviceId: string } }>('/runtime/devices/:deviceId/readiness', async (request, reply) => {
    const result = await withRuntimeRead(reply, () => getDeviceReadiness(request.params.deviceId))
    if (!result) return
    return result
  })

  app.get<{ Querystring: { limit?: string } }>('/runtime/catalog/workflows', async (request, reply) => {
    const result = await withRuntimeRead(reply, () => getWorkflowCatalog(parsePositiveInt(request.query.limit, 50)))
    if (!result) return
    return result
  })

  app.get('/runtime/test-profiles', async () => getTestProfileCatalog())

  app.get<{ Params: { campaignId: string } }>('/runtime/test-campaigns/:campaignId', async (request) =>
    getTestCampaignResult(request.params.campaignId),
  )
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
