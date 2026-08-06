import type { FastifyInstance } from 'fastify'
import { prisma } from '@nesy/db'

import { createDeviceCommandAdmission } from '../services/device-command-admission.js'
import { DeviceReadinessService } from '../services/device-readiness.service.js'
import { DomainPackAdminService } from '../services/domain-pack-admin.service.js'
import { DurableInteractionSubscription } from '../services/durable-interaction-subscription.js'
import { TestCampaignService } from '../services/test-campaign.service.js'
import { TestProfileCatalogService } from '../services/test-profile-catalog.service.js'
import { createHashPinnedCompileStub } from '../services/workflow-compile.service.js'
import { WorkflowRunService } from '../services/workflow-run.service.js'
import {
  PrismaDomainPackAdminStore,
  PrismaDurableInteractionStore,
  PrismaTestCampaignStore,
  PrismaTestProfileCatalogStore,
  PrismaWorkflowRunStartStore,
} from '../services/phase6-prisma-stores.js'

const compileService = createHashPinnedCompileStub()
const runService = new WorkflowRunService(undefined, new PrismaWorkflowRunStartStore(prisma))
// Database-backed: these catalogs carry release-gate evidence, so they must
// survive an API restart. The in-memory stores remain the default in unit tests.
const domainPackAdmin = new DomainPackAdminService(new PrismaDomainPackAdminStore(prisma))
const testProfiles = new TestProfileCatalogService(new PrismaTestProfileCatalogStore(prisma))
const testCampaigns = new TestCampaignService(new PrismaTestCampaignStore(prisma))
const admission = createDeviceCommandAdmission()
const deviceReadiness = new DeviceReadinessService(admission, {
  adb: () => 'UP',
  bridge: () => 'UP',
  receiptBus: () => 'UP',
  orderedBus: () => 'DEGRADED',
})
const interactions = new DurableInteractionSubscription(new PrismaDurableInteractionStore(prisma))

export async function verdictPhase6ContractRoutes(app: FastifyInstance) {
  app.post<{ Body: Record<string, unknown> }>('/runtime/compile', async (request, reply) => {
    const body = request.body
    const result = compileService.compileWorkflow({
      workflowRef: String(body.workflowRef ?? ''),
      workflowIr: body.workflowIr ?? {},
      domainPackKey: String(body.domainPackKey ?? ''),
      domainPackVersion: String(body.domainPackVersion ?? ''),
      domainPackDigest: String(body.domainPackDigest ?? ''),
    })
    return reply.code(result.ok ? 200 : 422).send(result)
  })

  app.post<{ Body: Record<string, unknown> }>('/runtime/runs', async (request, reply) => {
    try {
      const body = request.body
      const result = await runService.start({
        workflowRef: String(body.workflowRef ?? ''),
        deviceId: String(body.deviceId ?? ''),
        compiledPlanRef: String(body.compiledPlanRef ?? ''),
        compiledPlanHash: String(body.compiledPlanHash ?? ''),
        domainPackKey: String(body.domainPackKey ?? ''),
        domainPackVersion: String(body.domainPackVersion ?? ''),
        domainPackDigest: String(body.domainPackDigest ?? ''),
        releaseGate: body.releaseGate === true,
        profileKey: body.profileKey === undefined ? undefined : String(body.profileKey),
        profileVersion: body.profileVersion === undefined ? undefined : String(body.profileVersion),
      })
      return reply.code(202).send(result)
    } catch (error) {
      return reply.code(400).send({
        status: 'bad_request',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get('/runtime/domain-packs', async () => domainPackAdmin.list())

  app.get<{ Params: { packKey: string; version: string } }>(
    '/runtime/domain-packs/:packKey/:version',
    async (request, reply) => {
      const result = await domainPackAdmin.get(request.params.packKey, request.params.version)
      if (!result) {
        return reply.code(404).send({ status: 'not_found', detail: 'domain pack version not found' })
      }
      return result
    },
  )

  app.put<{ Body: Record<string, unknown> }>('/runtime/domain-packs/draft', async (request, reply) => {
    try {
      const body = request.body
      return await domainPackAdmin.saveDraft({
        packKey: String(body.packKey ?? ''),
        version: String(body.version ?? ''),
        bundleDigest: String(body.bundleDigest ?? ''),
        bundle: body.bundle ?? {},
        expectedRevision:
          body.expectedRevision === undefined ? undefined : Number(body.expectedRevision),
      })
    } catch (error) {
      return reply.code(409).send({
        status: 'conflict',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.post<{ Body: Record<string, unknown> }>('/runtime/domain-packs/publish', async (request, reply) => {
    try {
      const body = request.body
      return await domainPackAdmin.publish({
        packKey: String(body.packKey ?? ''),
        version: String(body.version ?? ''),
        publishedBy: String(body.publishedBy ?? 'system'),
        expectedRevision: Number(body.expectedRevision ?? -1),
      })
    } catch (error) {
      return reply.code(409).send({
        status: 'conflict',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get<{ Params: { profileKey: string; version: string } }>(
    '/runtime/test-profiles/:profileKey/:version',
    async (request, reply) => {
      const result = await testProfiles.get(
        request.params.profileKey,
        Number.parseInt(request.params.version, 10),
      )
      if (!result) {
        return reply.code(404).send({ status: 'not_found', detail: 'test profile not found' })
      }
      return result
    },
  )

  app.put<{ Body: Record<string, unknown> }>('/runtime/test-profiles', async (request, reply) => {
    try {
      const body = request.body
      return await testProfiles.save({
        profileKey: String(body.profileKey ?? ''),
        version: Number(body.version ?? 1),
        kind: (body.kind as 'CORE' | 'PREVIEW' | 'SOAK' | 'FAULT') ?? 'CORE',
        releaseGate: body.releaseGate === true,
        packKey: String(body.packKey ?? ''),
        packVersion: String(body.packVersion ?? ''),
        definition: {
          includedWorkflowRefs: Array.isArray(body.includedWorkflowRefs)
            ? body.includedWorkflowRefs.map(String)
            : [],
          launchProfileRef:
            body.launchProfileRef === undefined ? undefined : String(body.launchProfileRef),
          datasetRef: body.datasetRef === undefined ? undefined : String(body.datasetRef),
        },
        owner: String(body.owner ?? 'system'),
      })
    } catch (error) {
      return reply.code(422).send({
        status: 'invalid',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.post<{ Body: Record<string, unknown> }>('/runtime/test-profiles/validate', async (request) => {
    const body = request.body
    return {
      apiVersion: 'verdict-runtime.v1',
      ...testProfiles.validate({
        profileKey: String(body.profileKey ?? ''),
        version: Number(body.version ?? 1),
        kind: (body.kind as 'CORE' | 'PREVIEW' | 'SOAK' | 'FAULT') ?? 'CORE',
        releaseGate: body.releaseGate === true,
        packKey: String(body.packKey ?? ''),
        packVersion: String(body.packVersion ?? ''),
        definition: {
          includedWorkflowRefs: Array.isArray(body.includedWorkflowRefs)
            ? body.includedWorkflowRefs.map(String)
            : [],
          datasetRef: body.datasetRef === undefined ? undefined : String(body.datasetRef),
        },
        owner: String(body.owner ?? 'system'),
      }),
    }
  })

  app.get('/runtime/test-campaigns', async () => testCampaigns.list())

  app.post<{ Body: Record<string, unknown> }>('/runtime/test-campaigns', async (request) => {
    const body = request.body
    const cells = Array.isArray(body.cells) ? body.cells : []
    const campaign = await testCampaigns.start({
      campaignKey: String(body.campaignKey ?? ''),
      campaignVersion: Number(body.campaignVersion ?? 1),
      cells: cells.map((cell) => {
        const row = cell as Record<string, unknown>
        return {
          cellKey: String(row.cellKey ?? ''),
          profileKey: String(row.profileKey ?? ''),
          profileVersion: Number(row.profileVersion ?? 1),
          deviceCell: row.deviceCell === undefined ? undefined : String(row.deviceCell),
          datasetRef: row.datasetRef === undefined ? undefined : String(row.datasetRef),
        }
      }),
    })
    return { apiVersion: 'verdict-runtime.v1', campaign }
  })

  app.get<{
    Params: { runId: string }
    Querystring: { afterRevision?: string }
  }>('/runtime/runs/:runId/interactions', async (request) =>
    interactions.read({
      runId: request.params.runId,
      afterRevision: Number.parseInt(request.query.afterRevision ?? '0', 10) || 0,
    }),
  )

  app.post<{
    Params: { runId: string }
    Body: Record<string, unknown>
  }>('/runtime/runs/:runId/interactions', async (request) => {
    const body = request.body
    return interactions.append({
      eventId: String(body.eventId ?? `evt_${Date.now()}`),
      runId: request.params.runId,
      origin: (body.origin as 'BRIDGE_INJECTED' | 'MANUAL' | 'UNKNOWN') ?? 'UNKNOWN',
      confidence: Number(body.confidence ?? 0),
      occurredAtMs: Number(body.occurredAtMs ?? Date.now()),
      summary: String(body.summary ?? ''),
    })
  })
}

export const __phase6ContractSingletons = {
  compileService,
  runService,
  domainPackAdmin,
  testProfiles,
  testCampaigns,
  admission,
  deviceReadiness,
  interactions,
}
