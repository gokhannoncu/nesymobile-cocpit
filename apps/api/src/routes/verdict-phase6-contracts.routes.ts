import type { FastifyInstance } from 'fastify'
import type { LaunchProfile, TargetResolutionPolicy } from '@nesy/domain-pack-contracts'
import { prisma } from '@nesy/db'
import { createAdbFacade } from '../services/bridge-adb-facade.js'
import { getDeviceBridgeState } from '../services/test-event-bridge.js'
import { TestEventWsServer } from '../services/test-event-ws-server.js'

import { createDeviceCommandAdmission } from '../services/device-command-admission.js'
import { DeviceReadinessService } from '../services/device-readiness.service.js'
import { DomainPackAdminService } from '../services/domain-pack-admin.service.js'
import { DomainPackReadModelsService } from '../services/domain-pack-read-models.service.js'
import { DurableInteractionSubscription } from '../services/durable-interaction-subscription.js'
import { EvidenceSourceQueryService } from '../services/evidence-source-query.service.js'
import { BridgeFlowEvidenceSources } from '../services/bridgeflow-evidence-source-registry.js'
import { TestCampaignService } from '../services/test-campaign.service.js'
import { TestProfileCatalogService } from '../services/test-profile-catalog.service.js'
import { BridgeFlowExecutionQueue } from '../services/bridgeflow-execution-queue.js'
import { createBridgeFlowCompileService } from '../services/bridgeflow-compile-adapter.js'
import { WorkflowRunService } from '../services/workflow-run.service.js'
import {
  PrismaCompiledPlanStore,
  PrismaDeviceMutationLeaseStore,
  PrismaDomainPackAdminStore,
  PrismaDurableInteractionStore,
  PrismaTestCampaignStore,
  PrismaTestProfileCatalogStore,
  PrismaWorkflowRunStartStore,
} from '../services/phase6-prisma-stores.js'

const compiledPlanStore = new PrismaCompiledPlanStore(prisma)
const compileService = createBridgeFlowCompileService(compiledPlanStore)
const runService = new WorkflowRunService(
  new BridgeFlowExecutionQueue({
    prisma,
    planStore: compiledPlanStore,
    logger: (message, detail) => console.warn(message, detail),
  }),
  new PrismaWorkflowRunStartStore(prisma),
)
// Database-backed: these catalogs carry release-gate evidence, so they must
// survive an API restart. The in-memory stores remain the default in unit tests.
const domainPackAdminStore = new PrismaDomainPackAdminStore(prisma)
const domainPackAdmin = new DomainPackAdminService(domainPackAdminStore)
const domainPackReads = new DomainPackReadModelsService(domainPackAdminStore)
const evidenceSources = new EvidenceSourceQueryService(BridgeFlowEvidenceSources)
const testProfiles = new TestProfileCatalogService(new PrismaTestProfileCatalogStore(prisma))
const testCampaigns = new TestCampaignService(new PrismaTestCampaignStore(prisma))
const admission = createDeviceCommandAdmission(new PrismaDeviceMutationLeaseStore(prisma))
const adbFacade = createAdbFacade()

/**
 * Real ADB probe. The previous `() => 'UP'` constant reported a healthy ADB lane
 * for device ids that were not attached at all, which is fabricated health data
 * on a surface whose whole purpose is to say whether a device can be driven.
 *
 * Only devices `adb` reports in `device` state count: `unauthorized`/`offline`
 * devices are listed but accept no commands.
 */
async function probeAdbLane(deviceId: string): Promise<'UP' | 'DOWN'> {
  const attached = await adbFacade.listDevices()
  return attached.some((line) => line.startsWith(deviceId)) ? 'UP' : 'DOWN'
}

async function probeLocalDb(_deviceId: string): Promise<'UP' | 'DOWN'> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return 'UP'
  } catch {
    return 'DOWN'
  }
}

async function probeActiveRun(deviceId: string): Promise<'UP' | 'DOWN' | 'DEGRADED'> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM workflow_runs
    WHERE "deviceId" = ${deviceId}
      AND status IN ('running', 'queued', 'pending', 'QUEUED', 'RUNNING')
  `
  const n = Number(rows[0]?.n ?? 0)
  if (n === 0) return 'UP'
  if (n === 1) return 'DEGRADED'
  return 'DOWN'
}

async function probeBridge(deviceId: string): Promise<'UP' | 'DOWN' | 'DEGRADED'> {
  const adb = await probeAdbLane(deviceId)
  if (adb === 'DOWN') return 'DOWN'
  // Attached device is necessary but not sufficient for Bridge B2; surface DEGRADED
  // until a live capabilities handshake succeeds (CAPABILITY-NEGOTIATION).
  return 'DEGRADED'
}

async function probeReceiptBus(_deviceId: string): Promise<'UP' | 'DOWN' | 'DEGRADED'> {
  try {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM bridgeflow_evidence_fact
      WHERE delivery_lane ILIKE '%receipt%'
        AND observed_at > NOW() - INTERVAL '24 hours'
    `
    return Number(rows[0]?.n ?? 0) > 0 ? 'UP' : 'DEGRADED'
  } catch {
    return 'DOWN'
  }
}

async function probeOrderedBus(_deviceId: string): Promise<'UP' | 'DOWN' | 'DEGRADED'> {
  try {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM bridgeflow_evidence_fact
      WHERE delivery_lane ILIKE '%ordered%'
        AND observed_at > NOW() - INTERVAL '24 hours'
    `
    return Number(rows[0]?.n ?? 0) > 0 ? 'UP' : 'DEGRADED'
  } catch {
    return 'DOWN'
  }
}

async function probeSdkControl(
  deviceId: string,
  context?: { appId?: string },
): Promise<'UP' | 'DOWN' | 'UNKNOWN'> {
  const adb = await probeAdbLane(deviceId)
  if (adb === 'DOWN') return 'DOWN'
  const appId = context?.appId?.trim() || process.env.NESY_MOBILE_APP_ID?.trim() || 'com.nesy.courier'
  const state = await getDeviceBridgeState(
    deviceId,
    appId,
  )
  return state === null ? 'DOWN' : 'UP'
}

async function probeSdkEventAuth(deviceId: string): Promise<'UP' | 'DOWN' | 'UNKNOWN'> {
  const adb = await probeAdbLane(deviceId)
  if (adb === 'DOWN') return 'DOWN'
  if (!TestEventWsServer.isRunning()) return 'DOWN'
  return TestEventWsServer.isIngestReady() ? 'UP' : 'UNKNOWN'
}

async function probeDurableIngest(deviceId: string): Promise<'UP' | 'DOWN' | 'DEGRADED'> {
  try {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM verdict_run_interaction
      WHERE run_id IN (
        SELECT id FROM workflow_runs WHERE "deviceId" = ${deviceId}
      )
    `
    return Number(rows[0]?.n ?? 0) > 0 ? 'UP' : 'DEGRADED'
  } catch {
    return 'DOWN'
  }
}

async function probeBackendCredentials(_deviceId: string): Promise<'UP' | 'UNKNOWN'> {
  // Backend credential vault is outside this readiness surface; remain honest.
  return 'UNKNOWN'
}

const deviceReadiness = new DeviceReadinessService(admission, {
  adb: probeAdbLane,
  localDb: probeLocalDb,
  activeRun: probeActiveRun,
  bridge: probeBridge,
  receiptBus: probeReceiptBus,
  orderedBus: probeOrderedBus,
  sdkControl: probeSdkControl,
  sdkEventAuth: probeSdkEventAuth,
  durableIngest: probeDurableIngest,
  backendCredentials: probeBackendCredentials,
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

  app.get<{
    Params: { packKey: string; version: string }
    Querystring: { deviceId?: string }
  }>('/runtime/domain-packs/:packKey/:version/semantic-actions', async (request, reply) => {
    try {
      const result = await domainPackReads.listSemanticActions(
        request.params.packKey,
        request.params.version,
        { deviceId: request.query.deviceId },
      )
      if (!result) {
        return reply.code(404).send({ status: 'not_found', detail: 'domain pack version not found' })
      }
      return result
    } catch (error) {
      return reply.code(500).send({
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get<{
    Params: { packKey: string; version: string }
  }>('/runtime/domain-packs/:packKey/:version/target-resolution', async (request, reply) => {
    try {
      const result = await domainPackReads.listTargetResolution(
        request.params.packKey,
        request.params.version,
      )
      if (!result) {
        return reply.code(404).send({ status: 'not_found', detail: 'domain pack version not found' })
      }
      return result
    } catch (error) {
      return reply.code(500).send({
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get<{
    Params: { packKey: string; version: string }
  }>('/runtime/domain-packs/:packKey/:version/screen-surfaces', async (request, reply) => {
    try {
      const result = await domainPackReads.listScreenSurfaces(
        request.params.packKey,
        request.params.version,
      )
      if (!result) {
        return reply.code(404).send({ status: 'not_found', detail: 'domain pack version not found' })
      }
      return result
    } catch (error) {
      return reply.code(500).send({
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get<{
    Params: { packKey: string; version: string }
  }>('/runtime/domain-packs/:packKey/:version/entity-bindings', async (request, reply) => {
    try {
      const result = await domainPackReads.listEntityBindings(
        request.params.packKey,
        request.params.version,
      )
      if (!result) {
        return reply.code(404).send({ status: 'not_found', detail: 'domain pack version not found' })
      }
      return result
    } catch (error) {
      return reply.code(500).send({
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get<{
    Params: { packKey: string; version: string }
    Querystring: { releaseBuild?: string }
  }>('/runtime/domain-packs/:packKey/:version/launch-profiles', async (request, reply) => {
    try {
      const result = await domainPackReads.listLaunchProfiles(
        request.params.packKey,
        request.params.version,
        { releaseBuild: request.query.releaseBuild === 'true' },
      )
      if (!result) {
        return reply.code(404).send({ status: 'not_found', detail: 'domain pack version not found' })
      }
      return result
    } catch (error) {
      return reply.code(500).send({
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.post<{ Body: Record<string, unknown> }>(
    '/runtime/target-resolution/validate',
    async (request, reply) => {
      try {
        const body = request.body
        const policy = body.policy as TargetResolutionPolicy | undefined
        if (policy === undefined || typeof policy !== 'object') {
          return reply.code(400).send({
            status: 'bad_request',
            detail: 'body.policy (TargetResolutionPolicy) is required',
          })
        }
        const result = domainPackReads.validateTargetResolution(policy)
        return reply.code(result.ok ? 200 : 422).send(result)
      } catch (error) {
        return reply.code(400).send({
          status: 'bad_request',
          detail: error instanceof Error ? error.message : String(error),
        })
      }
    },
  )

  app.post<{ Body: Record<string, unknown> }>(
    '/runtime/launch-profiles/validate',
    async (request, reply) => {
      try {
        const body = request.body
        const profile = body.profile as LaunchProfile | undefined
        if (profile === undefined || typeof profile !== 'object') {
          return reply.code(400).send({
            status: 'bad_request',
            detail: 'body.profile (LaunchProfile) is required',
          })
        }
        const result = domainPackReads.validateLaunchProfile(profile, {
          releaseBuild: body.releaseBuild === true,
        })
        return reply.code(result.ok ? 200 : 422).send(result)
      } catch (error) {
        return reply.code(400).send({
          status: 'bad_request',
          detail: error instanceof Error ? error.message : String(error),
        })
      }
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

    for (const cell of cells) {
      const row = cell as Record<string, unknown>
      const workflowRef = typeof row.workflowRef === 'string' ? row.workflowRef : ''
      const deviceId = typeof row.deviceId === 'string'
        ? row.deviceId
        : typeof row.deviceCell === 'string'
          ? row.deviceCell
          : ''
      const domainPackKey = typeof row.domainPackKey === 'string' ? row.domainPackKey : ''
      const domainPackVersion = typeof row.domainPackVersion === 'string' ? row.domainPackVersion : ''
      const domainPackDigest = typeof row.domainPackDigest === 'string' ? row.domainPackDigest : ''
      if (!workflowRef || !deviceId || !domainPackKey || !domainPackVersion || !domainPackDigest || row.workflowIr === undefined) {
        continue
      }
      const compile = compileService.compileWorkflow({
        workflowRef,
        workflowIr: row.workflowIr,
        domainPackKey,
        domainPackVersion,
        domainPackDigest,
      })
      if (!compile.ok) continue
      const started = await runService.startFromCompile(compile, {
        workflowRef,
        deviceId,
        domainPackKey,
        domainPackVersion,
        domainPackDigest,
        releaseGate: row.releaseGate === true,
        profileKey: typeof row.profileKey === 'string' ? row.profileKey : undefined,
        profileVersion: row.profileVersion === undefined ? undefined : String(row.profileVersion),
      })
      await testCampaigns.attachCellEvidence({
        campaignId: campaign.campaignId,
        cellKey: String(row.cellKey ?? ''),
        runId: started.runId,
      })
    }

    return { apiVersion: 'verdict-runtime.v1', campaign: await testCampaigns.get(campaign.campaignId) }
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
  domainPackReads,
  evidenceSources,
  testProfiles,
  testCampaigns,
  admission,
  deviceReadiness,
  interactions,
}
