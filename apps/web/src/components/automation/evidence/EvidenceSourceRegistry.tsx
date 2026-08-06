'use client'

import React, { useEffect, useState } from 'react'
import {
  Database,
  Activity,
  LayoutTemplate,
  Wifi,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
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
            // Run-scoped enrichments are optional; catalog failure is what
            // surfaces as "registry unavailable".
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
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-gray-700" />
          <h3 className="font-semibold text-sm">Evidence Source Registry</h3>
        </div>
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

      {state.status === 'loading' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-6 justify-center">
          <Loader2 size={14} className="animate-spin" />
          Loading evidence sources…
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Registry unavailable</p>
            <p className="mt-0.5 opacity-90">{state.message}</p>
          </div>
        </div>
      )}

      {state.status === 'empty' && (
        <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">No evidence source registered</p>
            <p className="mt-0.5 opacity-90">
              {state.blockedReason ??
                'The runtime resolver has no definitions yet. An empty table is not shown as success.'}
            </p>
          </div>
        </div>
      )}

      {state.status === 'ready' && (
        <div className="space-y-2">
          {state.catalog.partial ? (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
              Partial catalog
              {state.catalog.blockedReason ? ` — ${state.catalog.blockedReason}` : ''}
            </p>
          ) : null}

          {state.runScoped && state.runScoped.conflicts.length > 0 ? (
            <div className="text-[10px] text-red-800 bg-red-50 border border-red-200 rounded p-2 space-y-1">
              <p className="font-semibold">Run conflicts ({state.runScoped.runId})</p>
              {state.runScoped.conflicts.map((conflict) => (
                <p key={`${conflict.factKey}:${conflict.reason}`}>
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
      )}
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
    <div
      className={`p-2 border rounded transition-colors ${
        conflict ? 'border-red-300 bg-red-50/40' : 'hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {planeIcon(source.plane, source.subtype)}
          <span className="font-medium text-sm truncate font-mono">{source.sourceEvent}</span>
        </div>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
            source.authority === 'PRIMARY'
              ? 'bg-blue-100 text-blue-700'
              : source.authority === 'CONFIRMATORY'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {source.authority}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-500 mt-2">
        <div>
          factKey: <span className="font-mono text-gray-700">{source.factKey}</span>
        </div>
        <div>
          plane: <span className="font-mono text-gray-700">{source.plane}</span>
        </div>
        <div>
          subtype: <span className="font-mono text-gray-700">{source.subtype}</span>
        </div>
        <div>
          valueField: <span className="font-mono text-gray-700">{source.valueField}</span>
        </div>
        <div className="col-span-2">
          lanes:{' '}
          <span className="font-mono text-gray-700">
            {source.deliveryLanes.length > 0 ? source.deliveryLanes.join(', ') : '—'}
          </span>
        </div>
        <div>
          freshnessMaxAgeMs:{' '}
          <span className="font-mono text-gray-700">{source.freshnessMaxAgeMs}</span>
        </div>
        {source.confidence !== undefined ? (
          <div>
            confidence: <span className="font-mono text-gray-700">{source.confidence}</span>
          </div>
        ) : null}
      </div>

      {conflict ? (
        <p className="mt-2 text-[10px] text-red-700">
          Conflict: {conflict.reason}
        </p>
      ) : null}
    </div>
  )
}

function planeIcon(plane: string, subtype: string) {
  if (plane === 'UI' || subtype.includes('SCREEN')) {
    return <LayoutTemplate size={14} className="text-blue-500 shrink-0" />
  }
  if (plane === 'REMOTE' || subtype.includes('NETWORK')) {
    return <Wifi size={14} className="text-purple-500 shrink-0" />
  }
  return <Activity size={14} className="text-green-500 shrink-0" />
}
