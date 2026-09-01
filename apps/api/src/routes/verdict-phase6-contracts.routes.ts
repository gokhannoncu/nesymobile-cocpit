import type { FastifyInstance } from 'fastify'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { BridgeClient } from '@nesy/bridge-client'
import { BRIDGE_DEVICE_PORT } from '@nesy/bridge-contract'
import type {
  DomainPackBundle,
  LaunchProfile,
  TargetResolutionPolicy,
} from '@nesy/domain-pack-contracts'
import { prisma } from '@nesy/db'
import { resolveAdbPath } from '@nesy/platform-paths'
import { createAdbFacade, resolveDeviceGatePolicy } from '../services/bridge-adb-facade.js'
import { isProductionBuild } from '../services/bridge-device-gate.js'
import { getDeviceBridgeState } from '../services/test-event-bridge.js'
import { TestEventWsServer } from '../services/test-event-ws-server.js'
import {
  isNesyDashboardCountry,
  isNesyEnvironment,
  isDashboardConfigured,
  resolveBaseUrl,
  type NesyDashboardCountry,
  type NesyEnvironment,
} from '../nesy-env.js'
import {
  isNesyMobileCountry,
  isNesyMobileEnvironment,
  resolveNesyMobileApplicationId,
} from '../nesy-mobile-env.js'
import { createDeviceCommandAdmission } from '../services/device-command-admission.js'
import {
  DeviceReadinessService,
  type DeviceLaneHealth,
} from '../services/device-readiness.service.js'
import { DomainPackAdminService } from '../services/domain-pack-admin.service.js'
import {
  listDomainPacks,
  registerPublishedPack,
  resolveDomainPack,
} from '../services/domain-pack-registry.js'
import { DomainPackReadModelsService } from '../services/domain-pack-read-models.service.js'
import { DurableInteractionSubscription } from '../services/durable-interaction-subscription.js'
import { publishRunLiveEvent, runLiveKeys } from '../services/run-live-hub.js'
import { EvidenceSourceQueryService } from '../services/evidence-source-query.service.js'
import { BridgeFlowEvidenceSources } from '../services/bridgeflow-evidence-source-registry.js'
import { TestCampaignService } from '../services/test-campaign.service.js'
import { TestProfileCatalogService } from '../services/test-profile-catalog.service.js'
import { BridgeFlowExecutionQueue } from '../services/bridgeflow-execution-queue.js'
import { createBridgeFlowCompileService } from '../services/bridgeflow-compile-adapter.js'
import { ensureNesyLoginStartupPermissions } from '../services/android-startup-permissions.js'
import { parseInjectedFaultBody, WorkflowRunService } from '../services/workflow-run.service.js'
import {
  PrismaCompiledPlanStore,
  PrismaDeviceMutationLeaseStore,
  PrismaDomainPackAdminStore,
  PrismaDurableInteractionStore,
  PrismaTestCampaignStore,
  PrismaTestProfileCatalogStore,
  PrismaWorkflowRunStartStore,
} from '../services/phase6-prisma-stores.js'

const execFileAsync = promisify(execFile)
const BRIDGE_PROTOCOL_READINESS_TTL_MS = 30_000
const bridgeProtocolReadinessCache = new Map<string, { expiresAt: number; lane: DeviceLaneHealth }>()

const compiledPlanStore = new PrismaCompiledPlanStore(prisma)
const compileService = createBridgeFlowCompileService(compiledPlanStore)
const runService = new WorkflowRunService(
  new BridgeFlowExecutionQueue({
    prisma,
    planStore: compiledPlanStore,
    logger: (message, detail) => console.warn(message, detail),
    prepareStartupPermissions: ensureNesyLoginStartupPermissions,
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

async function probeBridge(deviceId: string): Promise<DeviceLaneHealth> {
  const adb = await probeAdbLane(deviceId)
  if (adb === 'DOWN') return { lane: 'BRIDGE', status: 'DOWN', detail: 'ADB device is not reachable' }
  // Readiness must prove the same Bridge protocol path a workflow uses. A
  // bound listener alone can still leave runs blocked at BRIDGE_PING.
  const adbPath = resolveAdbPath()
  if (adbPath === null) return { lane: 'BRIDGE', status: 'DOWN', detail: 'adb executable was not found' }
  const portHex = BRIDGE_DEVICE_PORT.toString(16).toUpperCase().padStart(4, '0')
  try {
    const enabled = await adbFacade.getEnabledAccessibilityServices(deviceId)
    const bridgeEnabled =
      enabled.includes('com.verdict.bridge/.BridgeAccessibilityService') ||
      enabled.includes('com.verdict.bridge/com.verdict.bridge.BridgeAccessibilityService')
    if (!bridgeEnabled) {
      return {
        lane: 'BRIDGE',
        status: 'DOWN',
        detail: 'BridgeAccessibilityService is not enabled',
        remediation: 'enable Verdict Bridge accessibility service on the device',
      }
    }

    const { stdout } = await execFileAsync(
      adbPath,
      [
        '-s',
        deviceId,
        'shell',
        // LISTEN state is 0A. Match IPv4 or IPv6-mapped loopback rows for :9876.
        `toybox grep -E ':${portHex} .* 0A ' /proc/net/tcp /proc/net/tcp6 2>/dev/null`,
      ],
      { timeout: 5_000, maxBuffer: 64 * 1024 },
    )
    if (!String(stdout).includes(`:${portHex}`)) {
      return {
        lane: 'BRIDGE',
        status: 'DOWN',
        detail: `Bridge TCP listener is not bound on device port ${BRIDGE_DEVICE_PORT}`,
        remediation: 'restart or reinstall Verdict Bridge, then re-enable the accessibility service',
      }
    }

    const cached = bridgeProtocolReadinessCache.get(deviceId)
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.lane,
        detail: `${cached.lane.detail ?? 'Bridge protocol readiness passed'} (cached)`,
      }
    }

    const result = await probeBridgeProtocol(deviceId, adbPath)
    if (result.status === 'UP') {
      bridgeProtocolReadinessCache.set(deviceId, {
        expiresAt: Date.now() + BRIDGE_PROTOCOL_READINESS_TTL_MS,
        lane: result,
      })
    }
    return result
  } catch (error) {
    return {
      lane: 'BRIDGE',
      status: 'DOWN',
      detail: error instanceof Error ? error.message : String(error),
      remediation: 'verify the Bridge APK is installed and its accessibility service is active',
    }
  }
}

async function probeBridgeProtocol(deviceId: string, adbPath: string): Promise<DeviceLaneHealth> {
  const { stdout } = await execFileAsync(
    adbPath,
    ['-s', deviceId, 'forward', 'tcp:0', `tcp:${BRIDGE_DEVICE_PORT}`],
    { timeout: 5_000, maxBuffer: 64 * 1024 },
  )
  const hostPort = Number.parseInt(String(stdout).trim(), 10)
  if (!Number.isFinite(hostPort) || hostPort <= 0) {
    return {
      lane: 'BRIDGE',
      status: 'DOWN',
      detail: `adb did not allocate a host port for device port ${BRIDGE_DEVICE_PORT}`,
      remediation: 'clear stale adb forwards and retry',
    }
  }

  const client = new BridgeClient({
    host: '127.0.0.1',
    port: hostPort,
    scope: {
      runId: `readiness-${Date.now()}`,
      sessionId: 'readiness',
      runEpoch: Date.now(),
    },
    connectTimeoutMs: 2_000,
    defaultTimeoutMs: 4_000,
    maxConnections: 1,
  })
  try {
    const capabilities = await client.connect()
    return {
      lane: 'BRIDGE',
      status: 'UP',
      detail: `Bridge protocol=${capabilities.protocolVersion} via host tcp:${hostPort}`,
    }
  } catch (error) {
    return {
      lane: 'BRIDGE',
      status: 'DOWN',
      detail: error instanceof Error ? error.message : String(error),
      remediation: 'restart the Verdict Bridge accessibility service or reinstall the Bridge APK',
    }
  } finally {
    client.dispose('readiness probe complete')
    await execFileAsync(adbPath, ['-s', deviceId, 'forward', '--remove', `tcp:${hostPort}`], {
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    }).catch(() => undefined)
  }
}

async function probeActModePolicy(deviceId: string): Promise<DeviceLaneHealth> {
  const policy = resolveDeviceGatePolicy()
  if (policy.labAllowlist.length === 0 || !policy.labAllowlist.includes(deviceId)) {
    return {
      lane: 'ACT_MODE_POLICY',
      status: 'BLOCKED',
      detail:
        policy.labAllowlist.length === 0
          ? 'the lab allowlist is EMPTY; an empty allowlist denies every device on purpose'
          : `${deviceId} is not on the lab allowlist`,
      remediation: `add ${deviceId} to VERDICT_BRIDGE_LAB_DEVICES only if it is a dedicated test device`,
    }
  }

  if (!policy.denyProductionBuilds) return { lane: 'ACT_MODE_POLICY', status: 'UP' }

  const buildType = (await adbFacade.getProp(deviceId, 'ro.build.type')).trim()
  if (isProductionBuild(buildType)) {
    return {
      lane: 'ACT_MODE_POLICY',
      status: 'BLOCKED',
      detail: `ro.build.type=${buildType || '<empty>'} is not a lab build; Act Mode is refused on production devices`,
      remediation:
        'use a userdebug/eng lab device; injecting gestures into a production build is denied by policy',
    }
  }

  return { lane: 'ACT_MODE_POLICY', status: 'UP' }
}

async function probeReceiptBus(_deviceId: string): Promise<'UP' | 'DOWN' | 'DEGRADED'> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM bridgeflow_evidence_fact LIMIT 1`
    return 'UP'
  } catch {
    return 'DOWN'
  }
}

async function probeOrderedBus(_deviceId: string): Promise<'UP' | 'DOWN' | 'DEGRADED'> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM bridgeflow_evidence_fact LIMIT 1`
    return 'UP'
  } catch {
    return 'DOWN'
  }
}

function resolveRuntimeApplicationId(context?: { appId?: string }): string | null {
  const explicit = context?.appId?.trim() || process.env.NESY_MOBILE_APP_ID?.trim()
  if (explicit) return explicit
  const country = process.env.NESY_REMOTE_ACTION_COUNTRY?.trim() ?? 'RS'
  const environment = process.env.NESY_REMOTE_ACTION_ENV?.trim() ?? 'stage'
  if (isNesyMobileCountry(country) && isNesyMobileEnvironment(environment)) {
    return resolveNesyMobileApplicationId(country, environment)
  }
  for (const pack of listDomainPacks()) {
    const packageIdentity = pack.bundle.registries.applications[0]?.packageIdentity?.trim()
    if (packageIdentity) return packageIdentity
  }
  return null
}

function resolveRunApplicationId(body: Record<string, unknown>): string | undefined {
  const explicit = typeof body.appId === 'string' ? body.appId.trim() : ''
  if (explicit) return explicit
  const country = typeof body.country === 'string' ? body.country.trim() : ''
  const environment = typeof body.environment === 'string' ? body.environment.trim() : ''
  if (isNesyMobileCountry(country) && isNesyMobileEnvironment(environment)) {
    return resolveNesyMobileApplicationId(country, environment)
  }
  return undefined
}

async function probeSdkControl(
  deviceId: string,
  context?: { appId?: string },
): Promise<DeviceLaneHealth> {
  const adb = await probeAdbLane(deviceId)
  if (adb === 'DOWN') return { lane: 'SDK_CONTROL', status: 'DOWN', detail: 'ADB device is not reachable' }
  const appId = resolveRuntimeApplicationId(context)
  if (!appId) {
    return {
      lane: 'SDK_CONTROL',
      status: 'UNKNOWN',
      detail: 'No application package identity is available for SDK control',
      remediation: 'pass appId from the workflow application panel or set NESY_MOBILE_APP_ID',
    }
  }
  const state = await getDeviceBridgeState(
    deviceId,
    appId,
  )
  return state === null
    ? {
        lane: 'SDK_CONTROL',
        status: 'DOWN',
        detail: `GET_STATE failed for ${appId}`,
        remediation: 'confirm the selected workflow application package is installed and exposes VerdictControlReceiver',
      }
    : {
        lane: 'SDK_CONTROL',
        status: 'UP',
        detail: `${appId} session=${state.sessionId || '<none>'}`,
      }
}

async function probeSdkEventAuth(deviceId: string): Promise<'UP' | 'DOWN' | 'UNKNOWN'> {
  const adb = await probeAdbLane(deviceId)
  if (adb === 'DOWN') return 'DOWN'
  TestEventWsServer.ensureStarted()
  if (!TestEventWsServer.isRunning()) return 'DOWN'
  const deadline = Date.now() + 1_000
  while (!TestEventWsServer.isIngestReady() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return TestEventWsServer.isIngestReady() ? 'UP' : 'UNKNOWN'
}

async function probeDurableIngest(deviceId: string): Promise<'UP' | 'DOWN' | 'DEGRADED'> {
  try {
    void deviceId
    await prisma.$queryRaw`SELECT 1 FROM verdict_inbox LIMIT 1`
    await prisma.$queryRaw`SELECT 1 FROM verdict_stream LIMIT 1`
    return 'UP'
  } catch {
    return 'DOWN'
  }
}

async function probeBackendCredentials(_deviceId: string): Promise<'UP' | 'DOWN' | 'UNKNOWN'> {
  void _deviceId
  const configuredCountry = process.env.NESY_REMOTE_ACTION_COUNTRY?.trim() ?? 'RS'
  const configuredEnv = process.env.NESY_REMOTE_ACTION_ENV?.trim() ?? 'stage'
  const country: NesyDashboardCountry = isNesyDashboardCountry(configuredCountry)
    ? configuredCountry
    : 'RS'
  const environment: NesyEnvironment = isNesyEnvironment(configuredEnv) ? configuredEnv : 'stage'
  const explicitToken = process.env.NESY_BACKOFFICE_TOKEN?.trim() ?? ''
  const explicitBase =
    process.env.NESY_BACKOFFICE_BASE_URL?.trim() || resolveBaseUrl(country, environment)
  if (explicitToken && explicitBase) return 'UP'
  if (isDashboardConfigured(country, environment)) return 'UP'
  if (explicitBase || explicitToken) return 'UNKNOWN'
  return 'DOWN'
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
  actModePolicy: probeActModePolicy,
  backendCredentials: probeBackendCredentials,
})
const interactions = new DurableInteractionSubscription(new PrismaDurableInteractionStore(prisma))

function isCanonicalPackDigest(digest: string): boolean {
  return /^sha256:[a-f0-9]{64}$/i.test(digest.trim())
}

function isHydratableDomainPackBundle(bundle: unknown): bundle is DomainPackBundle {
  if (bundle === null || typeof bundle !== 'object' || Array.isArray(bundle)) return false
  const registries = (bundle as { registries?: unknown }).registries
  if (registries === null || typeof registries !== 'object' || Array.isArray(registries)) return false
  const semanticActions = (registries as { semanticActions?: unknown }).semanticActions
  const macros = (registries as { macros?: unknown }).macros
  return Array.isArray(semanticActions) && semanticActions.length > 0 && Array.isArray(macros)
}

async function ensureCompilePackHydrated(input: {
  packKey: string
  packVersion: string
  packDigest: string
}): Promise<void> {
  const existing = resolveDomainPack({
    packKey: input.packKey,
    packVersion: input.packVersion,
    packDigest: input.packDigest || undefined,
  })
  if (existing.ok) return

  const record = await domainPackAdminStore.get(input.packKey, input.packVersion)
  if (!record || record.publicationState !== 'PUBLISHED') return
  if (input.packDigest && record.bundleDigest !== input.packDigest) return
  if (!isHydratableDomainPackBundle(record.bundle)) return

  registerPublishedPack({
    packKey: record.packKey,
    version: record.version,
    digest: record.bundleDigest,
    bundle: record.bundle,
  })
}

function annotateDomainPackCatalog(items: Array<{
  packKey: string
  version: string
  bundleDigest: string
  publicationState: string
  revision: number
  publishedAt?: string
}>) {
  const compileDigests = new Map(
    listDomainPacks().map((pack) => [`${pack.packKey}@${pack.packVersion}`, pack.packDigest]),
  )

  const annotated = items.map((item) => {
    const slot = `${item.packKey}@${item.version}`
    const registryDigest = compileDigests.get(slot)
    const compileReady =
      (registryDigest !== undefined && registryDigest === item.bundleDigest) ||
      (item.publicationState === 'PUBLISHED' &&
        isCanonicalPackDigest(item.bundleDigest) &&
        (item.packKey === 'nesy.courier' || item.packKey === 'match.reaction'))
    return { ...item, compileReady }
  })

  return annotated.sort((left, right) => {
    const readyDelta = Number(right.compileReady) - Number(left.compileReady)
    if (readyDelta !== 0) return readyDelta
    if (left.packKey !== right.packKey) return left.packKey.localeCompare(right.packKey)
    return right.version.localeCompare(left.version, undefined, { numeric: true })
  })
}

export async function verdictPhase6ContractRoutes(app: FastifyInstance) {
  app.post<{ Body: Record<string, unknown> }>('/runtime/compile', async (request, reply) => {
    const body = request.body
    const domainPackKey = String(body.domainPackKey ?? '')
    const domainPackVersion = String(body.domainPackVersion ?? '')
    const domainPackDigest = String(body.domainPackDigest ?? '')
    await ensureCompilePackHydrated({
      packKey: domainPackKey,
      packVersion: domainPackVersion,
      packDigest: domainPackDigest,
    })
    const result = compileService.compileWorkflow({
      workflowRef: String(body.workflowRef ?? ''),
      workflowIr: body.workflowIr ?? {},
      domainPackKey,
      domainPackVersion,
      domainPackDigest,
    })
    return reply.code(result.ok ? 200 : 422).send(result)
  })

  app.post<{ Body: Record<string, unknown> }>('/runtime/runs', async (request, reply) => {
    try {
      const body = request.body
      const appId = resolveRunApplicationId(body)
      const inputs =
        body.inputs !== null && typeof body.inputs === 'object' && !Array.isArray(body.inputs)
          ? (body.inputs as Record<string, unknown>)
          : undefined
      const result = await runService.start({
        workflowRef: String(body.workflowRef ?? ''),
        deviceId: String(body.deviceId ?? ''),
        ...(appId === undefined ? {} : { appId }),
        compiledPlanRef: String(body.compiledPlanRef ?? ''),
        compiledPlanHash: String(body.compiledPlanHash ?? ''),
        domainPackKey: String(body.domainPackKey ?? ''),
        domainPackVersion: String(body.domainPackVersion ?? ''),
        domainPackDigest: String(body.domainPackDigest ?? ''),
        releaseGate: body.releaseGate === true,
        profileKey: body.profileKey === undefined ? undefined : String(body.profileKey),
        profileVersion: body.profileVersion === undefined ? undefined : String(body.profileVersion),
        ...(inputs === undefined ? {} : { inputs }),
        ...parseInjectedFaultBody(body),
      })
      return reply.code(202).send(result)
    } catch (error) {
      return reply.code(400).send({
        status: 'bad_request',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get('/runtime/domain-packs', async () => {
    const catalog = await domainPackAdmin.list()
    return {
      ...catalog,
      items: annotateDomainPackCatalog(catalog.items),
    }
  })

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
      await ensureCompilePackHydrated({
        packKey: domainPackKey,
        packVersion: domainPackVersion,
        packDigest: domainPackDigest,
      })
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
    const interaction = {
      eventId: String(body.eventId ?? `evt_${Date.now()}`),
      runId: request.params.runId,
      origin: (body.origin as 'BRIDGE_INJECTED' | 'MANUAL' | 'UNKNOWN') ?? 'UNKNOWN',
      confidence: Number(body.confidence ?? 0),
      occurredAtMs: Number(body.occurredAtMs ?? Date.now()),
      summary: String(body.summary ?? ''),
    }
    const appended = await interactions.append(interaction)
    publishRunLiveEvent({
      runId: interaction.runId,
      kind: 'INTERACTION',
      level: 'INFO',
      title: `${interaction.origin} · ${interaction.summary || interaction.eventId}`,
      atMs: interaction.occurredAtMs,
      dedupeKey: runLiveKeys.interaction(interaction.eventId),
      detail: {
        eventId: interaction.eventId,
        origin: interaction.origin,
        confidence: interaction.confidence,
        summary: interaction.summary,
      },
    })
    return appended
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
