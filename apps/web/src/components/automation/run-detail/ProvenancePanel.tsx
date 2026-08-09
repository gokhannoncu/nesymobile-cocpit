'use client'

import type { RunDetailResult } from '@/lib/verdict-runtime/types'
import {
  assertProvenanceConsistency,
  buildProvenanceDeepLinks,
} from '@/lib/verdict-runtime/provenance-deep-links'

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * Phase 7 residual — surface plan/pack provenance on Run Detail (CHECKPOINT 10/86).
 */
export function ProvenancePanel({ run }: { run: RunDetailResult }) {
  const runtime = (run.runtime ?? {}) as Record<string, unknown>
  const workflowId = asString(run.run?.workflowId) ?? asString(runtime.workflowId) ?? 'unknown'
  const workflowSlug =
    asString(run.run?.workflowSlug) ?? asString(runtime.workflowSlug) ?? workflowId
  const compiledPlanHash =
    asString(runtime.compiledPlanHash) ??
    asString((run as { compiledPlanHash?: unknown }).compiledPlanHash)
  const domainPackKey = asString(runtime.domainPackKey)
  const domainPackVersion = asString(runtime.domainPackVersion)
  const domainPackDigest = asString(runtime.domainPackDigest)
  const sourceMap = runtime.sourceMap
  const sourceMapCount =
    sourceMap && typeof sourceMap === 'object' ? Object.keys(sourceMap as object).length : 0

  const check = assertProvenanceConsistency({
    workflowId,
    workflowSlug,
    runId: run.correlation.runId,
    compiledPlanHash,
    domainPackKey,
    domainPackVersion,
    domainPackDigest,
  })
  const links = buildProvenanceDeepLinks({
    workflowSlug,
    runId: run.correlation.runId,
  })

  return (
    <div className="border rounded-md p-4 bg-accent/30 space-y-3">
      <div>
        <h3 className="font-medium">Provenance</h3>
        <p className="text-sm text-muted-foreground">
          Workflow / plan / domain-pack pin chain for this run.
        </p>
      </div>
      <dl className="grid gap-1 text-[11px] font-mono text-muted-foreground">
        <div>
          <dt className="inline">workflow </dt>
          <dd className="inline text-foreground">{workflowSlug}</dd>
        </div>
        <div>
          <dt className="inline">compiledPlanHash </dt>
          <dd className="inline text-foreground break-all">
            {compiledPlanHash ?? 'NOT_CAPTURED'}
          </dd>
        </div>
        <div>
          <dt className="inline">domainPack </dt>
          <dd className="inline text-foreground">
            {domainPackKey && domainPackVersion
              ? `${domainPackKey}@${domainPackVersion}`
              : 'NOT_CAPTURED'}
          </dd>
        </div>
        <div>
          <dt className="inline">domainPackDigest </dt>
          <dd className="inline text-foreground break-all">
            {domainPackDigest ?? 'NOT_CAPTURED'}
          </dd>
        </div>
        <div>
          <dt className="inline">sourceMap entries </dt>
          <dd className="inline text-foreground">{sourceMapCount}</dd>
        </div>
      </dl>
      {!check.ok ? (
        <p className="text-[11px] text-amber-700">Incomplete provenance: {check.reason}</p>
      ) : (
        <p className="text-[11px] text-emerald-700">Provenance pins consistent</p>
      )}
      <p className="text-[10px] text-muted-foreground font-mono">
        {links.listPath} → {links.editorPath} → {links.runDetailPath} → {links.historyPath}
      </p>
    </div>
  )
}
