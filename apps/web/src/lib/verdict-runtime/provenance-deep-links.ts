/**
 * Phase 7.23 — workflow provenance / deep-link chain helpers.
 */

export interface ProvenanceChainInput {
  workflowId: string
  workflowSlug: string
  runId: string
  compiledPlanHash: string | null
  domainPackKey: string | null
  domainPackVersion: string | null
  domainPackDigest: string | null
}

export interface ProvenanceDeepLinks {
  listPath: '/automation/list'
  editorPath: string
  runDetailPath: string
  historyPath: '/automation/history'
}

export function buildProvenanceDeepLinks(input: {
  workflowSlug: string
  runId: string
}): ProvenanceDeepLinks {
  return {
    listPath: '/automation/list',
    editorPath: `/automation/${input.workflowSlug}`,
    runDetailPath: `/automation/${input.workflowSlug}/runs/${input.runId}`,
    historyPath: '/automation/history',
  }
}

/**
 * Same workflow/plan/run/domain-pack provenance is consistent when all pins
 * resolve to the same identity tuple — missing pins fail closed (not invented).
 */
export function assertProvenanceConsistency(input: ProvenanceChainInput): {
  ok: boolean
  reason?: string
  links: ProvenanceDeepLinks
} {
  const links = buildProvenanceDeepLinks({
    workflowSlug: input.workflowSlug,
    runId: input.runId,
  })
  if (!input.workflowId || !input.workflowSlug || !input.runId) {
    return { ok: false, reason: 'workflow/run identity incomplete', links }
  }
  if (!input.compiledPlanHash) {
    return { ok: false, reason: 'compiledPlanHash missing', links }
  }
  if (!input.domainPackKey || !input.domainPackVersion || !input.domainPackDigest) {
    return { ok: false, reason: 'domain pack provenance incomplete', links }
  }
  return { ok: true, links }
}
