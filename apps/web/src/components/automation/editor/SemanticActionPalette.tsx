'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Zap,
  AlertTriangle,
  RefreshCw,
  Ban,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import {
  fetchVerdictDomainPacks,
  fetchVerdictSemanticActions,
} from '@/lib/verdict-runtime/client'
import type {
  DomainPackSummary,
  SemanticActionApi,
  SemanticActionCatalogApi,
} from '@/lib/verdict-runtime/types'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; blockedReason?: string; pack?: DomainPackSummary }
  | { status: 'ready'; pack: DomainPackSummary; catalog: SemanticActionCatalogApi }

function groupByApplication(items: readonly SemanticActionApi[]): Map<string, SemanticActionApi[]> {
  const groups = new Map<string, SemanticActionApi[]>()
  for (const item of items) {
    const key = item.applicationRef || 'unscoped'
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return groups
}

function SemanticActionCardShimmer() {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200/70 bg-white p-2.5">
      <div className="flex items-center gap-2">
        <ShimmerBlock className="size-3.5 shrink-0 rounded" />
        <ShimmerBlock className="h-3.5 w-[58%]" />
        <ShimmerBlock className="ml-auto size-3 shrink-0 rounded-full" />
      </div>
      <ShimmerBlock className="h-2.5 w-full" />
      <ShimmerBlock className="h-2.5 w-[92%]" />
      <ShimmerBlock className="h-4 w-28 rounded-md" />
      <ShimmerBlock className="h-2.5 w-[76%]" />
    </div>
  )
}

function SemanticActionPaletteShimmer() {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-hidden>
      <div className="border-b border-slate-200/90 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <ShimmerBlock className="h-4 w-32" />
          <ShimmerBlock className="h-7 w-[4.5rem] rounded-md" />
        </div>
        <ShimmerBlock className="h-8 w-full rounded-lg" />
        <ShimmerBlock className="mt-2 h-3 w-28" />
      </div>

      <div className="flex-1 space-y-4 overflow-hidden p-2">
        <ShimmerBlock className="h-3 w-40 px-1" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <SemanticActionCardShimmer key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SemanticActionPalette() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    ;(async () => {
      try {
        const packs = await fetchVerdictDomainPacks()
        if (cancelled) return
        const { selectPinnedPublishedPack } = await import('@/lib/verdict-runtime/select-published-pack')
        const pack = selectPinnedPublishedPack(packs.items)
        if (!pack) {
          setState({
            status: 'empty',
            blockedReason: 'no published Domain Pack — semantic action palette is empty',
          })
          return
        }

        const catalog = await fetchVerdictSemanticActions(pack.packKey, pack.version)
        if (cancelled) return

        if (catalog.items.length === 0) {
          setState({
            status: 'empty',
            pack,
            blockedReason:
              catalog.blockedReason ?? 'published pack has no semantic actions',
          })
          return
        }

        setState({ status: 'ready', pack, catalog })
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'semantic action catalog unavailable',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const filtered = useMemo(() => {
    if (state.status !== 'ready') return []
    const q = search.trim().toLowerCase()
    if (!q) return state.catalog.items
    return state.catalog.items.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.actionKey.toLowerCase().includes(q) ||
        a.businessMeaning.toLowerCase().includes(q) ||
        a.applicationRef.toLowerCase().includes(q),
    )
  }, [state, search])

  const groups = useMemo(() => groupByApplication(filtered), [filtered])

  if (state.status === 'loading') {
    return <SemanticActionPaletteShimmer />
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200/90 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Semantic Actions</h3>
          <button
            type="button"
            onClick={() => setReloadToken((n) => n + 1)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search actions…"
            className="w-full rounded-lg border border-slate-200/90 bg-slate-50/80 py-2 pl-8 pr-2.5 text-xs text-slate-800 outline-none transition-[border-color,background-color,box-shadow] placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200/80"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {state.status === 'ready' && (
          <div className="mt-2 font-mono text-[10px] text-slate-500">
            {state.pack.packKey}@{state.pack.version}
            {state.catalog.partial ? ' · partial' : ''}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-2">
        {state.status === 'error' && (
          <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Semantic actions unavailable</div>
              <div className="mt-0.5 leading-snug text-rose-800">{state.message}</div>
            </div>
          </div>
        )}

        {state.status === 'empty' && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Palette empty</div>
              <div className="mt-0.5 leading-snug">
                {state.blockedReason ?? 'no published Domain Pack'}
              </div>
              {state.pack && (
                <div className="mt-1 font-mono text-[10px] text-amber-800">
                  {state.pack.packKey}@{state.pack.version}
                </div>
              )}
            </div>
          </div>
        )}

        {state.status === 'ready' && filtered.length === 0 && (
          <div className="py-6 text-center text-xs text-slate-500">
            No actions match “{search}”.
          </div>
        )}

        {state.status === 'ready' &&
          [...groups.entries()].map(([appRef, actions]) => (
            <div key={appRef}>
              <h4 className="mb-2 px-1 font-mono text-xs font-semibold uppercase tracking-wider text-slate-500">
                {appRef}
              </h4>
              <div className="space-y-2">
                {actions.map((action) => {
                  const blocked = !action.capabilityStatus.satisfied
                  return (
                    <div
                      key={action.actionKey}
                      className={cn(
                        'flex flex-col rounded-lg border p-2.5 transition-all',
                        blocked
                          ? 'border-slate-200/90 bg-slate-50/80 opacity-75'
                          : 'cursor-grab border-slate-200/90 bg-white hover:border-sky-300 hover:shadow-sm',
                      )}
                      draggable={!blocked}
                      title={
                        blocked
                          ? action.capabilityStatus.reason ??
                            'required capabilities not satisfied'
                          : action.businessMeaning
                      }
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Zap
                          size={14}
                          className={blocked ? 'text-slate-400' : 'text-sky-600'}
                        />
                        <span className="text-sm font-medium text-slate-900">{action.displayName}</span>
                        {blocked ? (
                          <Ban size={12} className="ml-auto text-amber-600 shrink-0" />
                        ) : (
                          <CheckCircle2 size={12} className="ml-auto text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] leading-snug text-slate-600">
                        {action.businessMeaning}
                      </span>
                      <span className="mt-1 w-fit rounded-md bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                        {action.actionKey}
                      </span>
                      {blocked && (
                        <span className="text-[9px] mt-1 text-amber-800 bg-amber-50 px-1 py-0.5 rounded">
                          {action.capabilityStatus.reason ??
                            `missing: ${action.capabilityStatus.missing.join(', ') || 'capabilities'}`}
                        </span>
                      )}
                      {action.targetRefs.length > 0 && (
                        <span className="mt-1 break-all font-mono text-[9px] leading-snug text-slate-400">
                          targets: {action.targetRefs.join(', ')}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
