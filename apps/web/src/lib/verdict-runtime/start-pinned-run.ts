import {
  compileVerdictWorkflow,
  fetchVerdictDeviceReadiness,
  fetchVerdictDomainPacks,
  startVerdictWorkflowRun,
} from './client'
import { selectPinnedPublishedPack } from './select-published-pack'
import type { WorkflowRunStartApi } from './types'
import {
  isNesyMobileCountry,
  isNesyMobileEnvironment,
  resolveNesyMobileApplicationId,
} from '@/services/nesy-mobile-env'

/**
 * Compile against the newest executable published Domain Pack, then start a
 * BridgeFlow run. Used by Field Login / Load Tour / editor Run Test cutovers.
 */
export async function startPinnedVerdictRun(input: {
  workflowRef: string
  deviceId: string
  workflowIr?: Record<string, unknown>
  /** Explicit Android package selected by the workflow/application panel. */
  appId?: string
  /** Used to derive appId when the panel selected country/environment instead of a raw package. */
  country?: string
  environment?: string
  /** Launch / test profile pin (e.g. nesy.launch.cold-real-login). */
  profileKey?: string
  /** Business inputs addressed by `run.input.<path>` (e.g. pin, sessionCorrelationId). */
  inputs?: Readonly<Record<string, unknown>>
}): Promise<WorkflowRunStartApi> {
  const packs = await fetchVerdictDomainPacks()
  const pack = selectPinnedPublishedPack(packs.items)
  if (!pack) {
    throw new Error('No published Domain Pack to pin a run to')
  }

  const appId = resolveRunAppId(input)

  await assertActModeReady(input.deviceId, appId)

  const compiled = await compileVerdictWorkflow({
    workflowRef: input.workflowRef,
    workflowIr: input.workflowIr ?? { nodes: [], connections: [] },
    domainPackKey: pack.packKey,
    domainPackVersion: pack.version,
    domainPackDigest: pack.bundleDigest,
  })

  if (!compiled.ok) {
    const first = compiled.issues[0]
    const detail =
      first && typeof first === 'object' && 'message' in first
        ? String((first as { message: unknown }).message)
        : 'compile rejected'
    throw new Error(
      `Compile failed before run start (${pack.packKey}@${pack.version}): ${detail}`,
    )
  }

  return startVerdictWorkflowRun({
    workflowRef: input.workflowRef,
    deviceId: input.deviceId,
    compiledPlanRef: compiled.compiledPlanRef,
    compiledPlanHash: compiled.compiledPlanHash,
    domainPackKey: pack.packKey,
    domainPackVersion: pack.version,
    domainPackDigest: pack.bundleDigest,
    ...(appId ? { appId } : {}),
    ...(input.country ? { country: input.country } : {}),
    ...(input.environment ? { environment: input.environment } : {}),
    ...(input.profileKey ? { profileKey: input.profileKey } : {}),
    ...(input.inputs ? { inputs: input.inputs } : {}),
  })
}

function resolveRunAppId(input: { appId?: string; country?: string; environment?: string }): string | undefined {
  const explicit = input.appId?.trim()
  if (explicit) return explicit
  const country = input.country?.trim() ?? ''
  const environment = input.environment?.trim() ?? ''
  if (isNesyMobileCountry(country) && isNesyMobileEnvironment(environment)) {
    return resolveNesyMobileApplicationId(country, environment)
  }
  return undefined
}

async function assertActModeReady(deviceId: string, appId?: string): Promise<void> {
  const readiness = await fetchVerdictDeviceReadiness(deviceId, appId)
  const blocker = readiness.lanes.find((lane) => {
    const name = String(lane.lane ?? '').toUpperCase()
    const status = String(lane.status ?? '').toUpperCase()
    return name === 'ACT_MODE_POLICY' && status === 'BLOCKED'
  })
  if (!blocker) return

  const detail = typeof blocker.detail === 'string' ? blocker.detail : 'Act Mode is blocked for this device'
  const remediation = typeof blocker.remediation === 'string' ? blocker.remediation : ''
  throw new Error([`Act Mode blocked before run start: ${detail}`, remediation].filter(Boolean).join(' — '))
}
