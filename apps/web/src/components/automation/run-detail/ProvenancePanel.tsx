'use client'

import { GitBranch } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { cn } from '@nesy/metronic/lib/utils'
import type { RunDetailResult } from '@/lib/verdict-runtime/types'
import {
  assertProvenanceConsistency,
  buildProvenanceDeepLinks,
} from '@/lib/verdict-runtime/provenance-deep-links'
import { CopyableHash } from './CopyableHash'

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
    <section className="min-w-0 overflow-hidden rounded-lg border border-indigo-200/70 bg-gradient-to-br from-indigo-50/50 via-card to-card shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/20">
      <div className="flex items-start justify-between gap-2 border-b border-indigo-100/80 px-3 py-2.5 dark:border-indigo-900/30">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <GitBranch className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-foreground">Provenance</h3>
              <p className="truncate font-mono text-[11px] text-indigo-900/80 dark:text-indigo-200/80">
                {workflowSlug}
              </p>
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-[10px] font-semibold',
            check.ok
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-amber-300 bg-amber-50 text-amber-800',
          )}
        >
          {check.ok ? 'Consistent' : 'Incomplete'}
        </Badge>
      </div>

      <dl className="space-y-2 px-3 py-2.5 text-[11px]">
        <ProvenanceRow label="Domain pack">
          {domainPackKey && domainPackVersion ? (
            <span className="font-medium text-foreground">{domainPackKey}@{domainPackVersion}</span>
          ) : (
            <span className="text-muted-foreground">Not captured</span>
          )}
        </ProvenanceRow>
        <ProvenanceRow label="Plan hash">
          {compiledPlanHash ? (
            <CopyableHash value={compiledPlanHash} />
          ) : (
            <span className="text-muted-foreground">Not captured</span>
          )}
        </ProvenanceRow>
        <ProvenanceRow label="Pack digest">
          {domainPackDigest ? (
            <CopyableHash value={domainPackDigest} />
          ) : (
            <span className="text-muted-foreground">Not captured</span>
          )}
        </ProvenanceRow>
        <ProvenanceRow label="Source map">
          <span className="font-semibold tabular-nums text-foreground">{sourceMapCount}</span>
          <span className="text-muted-foreground"> entries</span>
        </ProvenanceRow>
      </dl>

      {!check.ok ? (
        <p className="border-t border-indigo-100/80 px-3 py-2 text-[10px] text-amber-800 dark:border-indigo-900/30">
          {check.reason}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5 border-t border-indigo-100/80 px-3 py-2 dark:border-indigo-900/30">
        <NavChip href={links.editorPath} label="Editor" />
        <NavChip href={links.runDetailPath} label="This run" />
        <NavChip href={links.historyPath} label="History" />
      </div>
    </section>
  )
}

function ProvenanceRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function NavChip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:border-indigo-300 hover:text-indigo-800"
    >
      {label}
    </Link>
  )
}
