'use client'

import React, { useEffect, useState } from 'react'
import {
  Database,
  Activity,
  LayoutTemplate,
  Wifi,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import {
  fetchVerdictEvidenceSources,
  fetchVerdictRunEvidenceSources,
} from '@/lib/verdict-runtime/client'
import type {
  EvidenceSourceApi,
  EvidenceSourceCatalogApi,
  RunEvidenceSourceCatalogApi,
} from '@/lib/verdict-runtime/types'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; blockedReason?: string }
  | {
      status: 'ready'
      catalog: EvidenceSourceCatalogApi
      runScoped?: RunEvidenceSourceCatalogApi
    }

function formatSubtypeLabel(subtype: string): string {
  return subtype
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatFreshness(ms: number): string {
  if (ms >= 60_000) {
    const seconds = Math.round(ms / 1000)
    return seconds % 60 === 0 ? `${seconds / 60}m` : `${(ms / 1000).toFixed(0)}s`
  }
  return `${ms}ms`
}

function EvidenceSourceRegistryShimmer() {
  return (
    <div className="space-y-2 p-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-slate-200/70 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <ShimmerBlock className="size-4 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <ShimmerBlock className="h-3.5 w-[72%]" />
                <ShimmerBlock className="h-2.5 w-full" />
              </div>
            </div>
            <ShimmerBlock className="h-5 w-14 rounded-md" />
          </div>
          <ShimmerBlock className="h-2.5 w-[88%]" />
          <ShimmerBlock className="h-2.5 w-[64%]" />
          <div className="flex gap-1">
            <ShimmerBlock className="h-5 w-24 rounded-md" />
            <ShimmerBlock className="h-5 w-28 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

function AuthorityBadge({ authority }: { authority: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        authority === 'PRIMARY'
          ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/80'
          : authority === 'CONFIRMATORY'
            ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/80'
            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80',
      )}
    >
      {authority}
    </span>
  )
}

function EvidenceMetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-[11px] leading-snug text-slate-800">{value}</dd>
    </div>
  )
}

function EvidenceSourceRow({
  source,
  conflict,
}: {
  source: EvidenceSourceApi
  conflict?: { reason: string; authorities: readonly string[] }
}) {
  return (
    <article
      className={cn(
        'rounded-lg border p-2.5 transition-colors',
        conflict
          ? 'border-rose-200/90 bg-rose-50/40'
          : 'border-slate-200/90 bg-white hover:border-slate-300',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {planeIcon(source.plane, source.subtype)}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold leading-snug text-slate-800">
              {formatSubtypeLabel(source.subtype)}
            </h4>
            <p className="mt-0.5 break-all font-mono text-[10px] leading-snug text-slate-500">
              {source.factKey}
            </p>
          </div>
        </div>
        <AuthorityBadge authority={source.authority} />
      </header>

      <dl className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5">
        <EvidenceMetaField label="Source event" value={source.sourceEvent} />
        <div className="grid grid-cols-2 gap-2">
          <EvidenceMetaField label="Plane" value={source.plane} />
          <EvidenceMetaField label="Freshness" value={formatFreshness(source.freshnessMaxAgeMs)} />
        </div>
        <EvidenceMetaField label="Value field" value={source.valueField} />
        {source.confidence !== undefined ? (
          <EvidenceMetaField label="Confidence" value={String(source.confidence)} />
        ) : null}
      </dl>

      {source.deliveryLanes.length > 0 ? (
        <div className="mt-2.5">
          <p className="mb-1 text-[10px] font-semibold text-slate-500">Lanes</p>
          <div className="flex flex-wrap gap-1">
            {source.deliveryLanes.map((lane) => (
              <span
                key={lane}
                className="rounded border border-slate-200/90 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700"
              >
                {lane}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {conflict ? (
        <p className="mt-2 rounded-md border border-rose-200/90 bg-rose-50/80 px-2 py-1.5 text-[10px] leading-snug text-rose-800">
          Conflict: {conflict.reason}
        </p>
      ) : null}
    </article>
  )
}

function planeIcon(plane: string, subtype: string) {
  if (plane === 'UI' || subtype.includes('SCREEN')) {
    return <LayoutTemplate className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
  }
  if (plane === 'REMOTE' || subtype.includes('NETWORK')) {
    return <Wifi className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden />
  }
  return <Activity className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
}

export function EvidenceSourceRegistry({ runId }: { runId?: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    ;(async () => {
      try {
        const catalog = await fetchVerdictEvidenceSources()
        if (cancelled) return

        let runScoped: RunEvidenceSourceCatalogApi | undefined
        if (runId !== undefined && runId.trim() !== '') {
          try {
            runScoped = await fetchVerdictRunEvidenceSources(runId)
          } catch {
            runScoped = undefined
          }
        }

        if (catalog.items.length === 0) {
          setState({
            status: 'empty',
            blockedReason:
              catalog.blockedReason ?? 'no evidence source registered',
          })
          return
        }

        setState({ status: 'ready', catalog, runScoped })
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'registry unavailable',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [runId, reloadToken])

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Database className="size-4 shrink-0 text-slate-700" aria-hidden />
          <h3 className="truncate text-sm font-semibold text-slate-900">Evidence Sources</h3>
        </div>
        <button
          type="button"
          onClick={() => setReloadToken((n) => n + 1)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
          disabled={state.status === 'loading'}
        >
          <RefreshCw className={cn('size-3', state.status === 'loading' && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {state.status === 'loading' ? <EvidenceSourceRegistryShimmer /> : null}

      {state.status === 'error' ? (
        <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Registry unavailable</p>
            <p className="mt-0.5 leading-snug text-rose-800">{state.message}</p>
          </div>
        </div>
      ) : null}

      {state.status === 'empty' ? (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">No evidence source registered</p>
            <p className="mt-0.5 leading-snug">
              {state.blockedReason ??
                'The runtime resolver has no definitions yet. An empty table is not shown as success.'}
            </p>
          </div>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <div className="space-y-2">
          {state.catalog.partial ? (
            <p className="rounded-md border border-amber-200/90 bg-amber-50/80 px-2 py-1 text-[10px] font-medium text-amber-900">
              Partial catalog
              {state.catalog.blockedReason ? ` — ${state.catalog.blockedReason}` : ''}
            </p>
          ) : null}

          {state.runScoped && state.runScoped.conflicts.length > 0 ? (
            <div className="space-y-1 rounded-lg border border-rose-200/90 bg-rose-50/80 p-2.5 text-[10px] text-rose-900">
              <p className="font-semibold">Run conflicts ({state.runScoped.runId})</p>
              {state.runScoped.conflicts.map((conflict) => (
                <p key={`${conflict.factKey}:${conflict.reason}`} className="leading-snug">
                  <span className="font-mono">{conflict.factKey}</span>: {conflict.reason}
                  {conflict.authorities.length > 0
                    ? ` [${conflict.authorities.join(', ')}]`
                    : ''}
                </p>
              ))}
            </div>
          ) : null}

          {state.catalog.items.map((src) => (
            <EvidenceSourceRow
              key={`${src.sourceEvent}:${src.factKey}`}
              source={src}
              conflict={state.runScoped?.conflicts.find((c) => c.factKey === src.factKey)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
