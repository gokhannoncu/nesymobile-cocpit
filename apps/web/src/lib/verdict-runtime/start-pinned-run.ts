import {
  compileVerdictWorkflow,
  fetchVerdictDomainPacks,
  startVerdictWorkflowRun,
} from './client'
import type { WorkflowRunStartApi } from './types'

/**
 * Compile against the newest published Domain Pack, then start a BridgeFlow run.
 * Used by Field Login / Load Tour cutovers (CHECKPOINT 37/38).
 */
export async function startPinnedVerdictRun(input: {
  workflowRef: string
  deviceId: string
  workflowIr?: { nodes: unknown[]; connections?: unknown[]; edges?: unknown[] }
}): Promise<WorkflowRunStartApi> {
  const packs = await fetchVerdictDomainPacks()
  const pack = packs.items.find((item) => item.publicationState === 'PUBLISHED')
  if (!pack) {
    throw new Error('No published Domain Pack to pin a run to')
  }

  const ir = input.workflowIr ?? { nodes: [], connections: [] }
  const compiled = await compileVerdictWorkflow({
    workflowRef: input.workflowRef,
    workflowIr: {
      nodes: ir.nodes,
      connections: ir.connections ?? ir.edges ?? [],
    },
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
    throw new Error(`Compile failed before run start: ${detail}`)
  }

  return startVerdictWorkflowRun({
    workflowRef: input.workflowRef,
    deviceId: input.deviceId,
    compiledPlanRef: compiled.compiledPlanRef,
    compiledPlanHash: compiled.compiledPlanHash,
    domainPackKey: pack.packKey,
    domainPackVersion: pack.version,
    domainPackDigest: pack.bundleDigest,
  })
}
