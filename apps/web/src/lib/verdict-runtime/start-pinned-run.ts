import {
  compileVerdictWorkflow,
  fetchVerdictDomainPacks,
  startVerdictWorkflowRun,
} from './client'
import { selectPinnedPublishedPack } from './select-published-pack'
import type { WorkflowRunStartApi } from './types'

/**
 * Compile against the newest executable published Domain Pack, then start a
 * BridgeFlow run. Used by Field Login / Load Tour / editor Run Test cutovers.
 */
export async function startPinnedVerdictRun(input: {
  workflowRef: string
  deviceId: string
  workflowIr?: Record<string, unknown>
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
    ...(input.profileKey ? { profileKey: input.profileKey } : {}),
    ...(input.inputs ? { inputs: input.inputs } : {}),
  })
}
