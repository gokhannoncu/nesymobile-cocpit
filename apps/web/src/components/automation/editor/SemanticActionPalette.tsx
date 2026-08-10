'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Zap,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Ban,
  CheckCircle2,
} from 'lucide-react'
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

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Semantic Actions</h3>
          <button
            type="button"
            onClick={() => setReloadToken((n) => n + 1)}
            className="flex items-center gap-1 text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded font-medium"
            disabled={state.status === 'loading'}
          >
            <RefreshCw size={12} className={state.status === 'loading' ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2 text-gray-400" />
          <input
            type="text"
            placeholder="Search actions…"
            className="w-full pl-8 pr-2 py-1.5 text-xs border rounded bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={state.status !== 'ready'}
          />
        </div>
        {state.status === 'ready' && (
          <div className="mt-2 text-[10px] text-gray-500 font-mono">
            {state.pack.packKey}@{state.pack.version}
            {state.catalog.partial ? ' · partial' : ''}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-4">
        {state.status === 'loading' && (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-8 justify-center">
            <Loader2 size={14} className="animate-spin" />
            Loading semantic actions…
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-3">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Semantic actions unavailable</div>
              <div className="mt-0.5 text-red-700">{state.message}</div>
            </div>
          </div>
        )}

        {state.status === 'empty' && (
          <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Palette empty</div>
              <div className="mt-0.5">
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
          <div className="text-xs text-gray-500 text-center py-6">
            No actions match “{search}”.
          </div>
        )}

        {state.status === 'ready' &&
          [...groups.entries()].map(([appRef, actions]) => (
            <div key={appRef}>
              <h4 className="text-xs font-medium text-gray-500 mb-2 px-1 uppercase tracking-wider font-mono">
                {appRef}
              </h4>
              <div className="space-y-2">
                {actions.map((action) => {
                  const blocked = !action.capabilityStatus.satisfied
                  return (
                    <div
                      key={action.actionKey}
                      className={`flex flex-col p-2 border rounded transition-all ${
                        blocked
                          ? 'bg-gray-50 border-gray-200 opacity-75'
                          : 'bg-white border-gray-200 cursor-grab hover:border-blue-400 hover:shadow-sm'
                      }`}
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
                          className={blocked ? 'text-gray-400' : 'text-blue-600'}
                        />
                        <span className="text-sm font-medium">{action.displayName}</span>
                        {blocked ? (
                          <Ban size={12} className="ml-auto text-amber-600 shrink-0" />
                        ) : (
                          <CheckCircle2 size={12} className="ml-auto text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 leading-tight">
                        {action.businessMeaning}
                      </span>
                      <span className="text-[9px] mt-1 text-gray-400 font-mono bg-gray-50 px-1 py-0.5 rounded w-fit">
                        {action.actionKey}
                      </span>
                      {blocked && (
                        <span className="text-[9px] mt-1 text-amber-800 bg-amber-50 px-1 py-0.5 rounded">
                          {action.capabilityStatus.reason ??
                            `missing: ${action.capabilityStatus.missing.join(', ') || 'capabilities'}`}
                        </span>
                      )}
                      {action.targetRefs.length > 0 && (
                        <span className="text-[9px] mt-1 text-gray-400 font-mono">
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
