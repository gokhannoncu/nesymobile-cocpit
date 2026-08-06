'use client'

import React, { useEffect, useState } from 'react'
import {
  Target,
  ArrowRight,
  Zap,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Ban,
} from 'lucide-react'
import {
  fetchVerdictDomainPacks,
  fetchVerdictTargetResolution,
} from '@/lib/verdict-runtime/client'
import type {
  DomainPackSummary,
  TargetResolutionCatalogApi,
  TargetResolutionEntityApi,
} from '@/lib/verdict-runtime/types'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; blockedReason?: string; pack?: DomainPackSummary }
  | { status: 'ready'; pack: DomainPackSummary; catalog: TargetResolutionCatalogApi }

export function TargetResolutionPanel() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    ;(async () => {
      try {
        const packs = await fetchVerdictDomainPacks()
        if (cancelled) return
        const pack = packs.items.find((item) => item.publicationState === 'PUBLISHED')
        if (!pack) {
          setState({
            status: 'empty',
            blockedReason: 'no published Domain Pack to load target resolution from',
          })
          return
        }

        const catalog = await fetchVerdictTargetResolution(pack.packKey, pack.version)
        if (cancelled) return

        if (catalog.entities.length === 0) {
          setState({
            status: 'empty',
            pack,
            blockedReason:
              catalog.blockedReason ?? 'pack has no target resolution provider chains',
          })
          return
        }

        setSelectedTargetKey((prev) => prev ?? catalog.entities[0]?.targetKey ?? null)
        setState({ status: 'ready', pack, catalog })
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'target resolution catalog unavailable',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const selected: TargetResolutionEntityApi | undefined =
    state.status === 'ready'
      ? state.catalog.entities.find((e) => e.targetKey === selectedTargetKey) ??
        state.catalog.entities[0]
      : undefined

  const ambiguityBlocksAction =
    selected !== undefined &&
    (selected.ambiguityPolicy !== 'FAIL' ||
      selected.violations.some((v) => v.code.includes('AMBIGUITY') || v.code.includes('IDENTITY')))

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-indigo-600" />
          <h3 className="font-semibold text-sm">Target Resolution Chain</h3>
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
          Loading target resolution…
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Target resolution unavailable</p>
            <p className="mt-0.5 opacity-90">{state.message}</p>
          </div>
        </div>
      )}

      {state.status === 'empty' && (
        <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">No provider chain</p>
            <p className="mt-0.5 opacity-90">{state.blockedReason}</p>
            {state.pack ? (
              <p className="mt-1 font-mono opacity-75">
                {state.pack.packKey}@{state.pack.version}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {state.status === 'ready' && selected && (
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500 font-mono">
            {state.pack.packKey}@{state.pack.version}
            {state.catalog.partial ? ' · partial' : ''}
          </p>

          {state.catalog.entities.length > 1 ? (
            <select
              className="w-full text-xs border rounded p-1.5 bg-gray-50"
              value={selected.targetKey}
              onChange={(e) => setSelectedTargetKey(e.target.value)}
            >
              {state.catalog.entities.map((entity) => (
                <option key={entity.targetKey} value={entity.targetKey}>
                  {entity.entityKey} → {entity.targetKey}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[11px] font-mono text-gray-700">
              {selected.entityKey} → {selected.targetKey}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {selected.strategies.length === 0 ? (
              <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded p-2">
                Empty strategy chain
              </p>
            ) : (
              selected.strategies.map((strategy, index) => (
                <React.Fragment key={`${strategy.order}:${strategy.kind}`}>
                  {index > 0 ? (
                    <div className="flex justify-center -my-1 text-gray-300">
                      <ArrowRight size={14} className="rotate-90" />
                    </div>
                  ) : null}
                  <div className="flex items-start gap-3 p-2 bg-gray-50 rounded border">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-xs font-bold">
                      {strategy.order}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold font-mono">{strategy.kind}</h4>
                      <p className="text-[10px] text-gray-500">
                        establishesIdentity: {strategy.establishesIdentity ? 'true' : 'false'}
                      </p>
                      <div className="mt-1 text-[10px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded inline-block">
                        ambiguity: {strategy.ambiguityPolicy}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              ))
            )}
          </div>

          <div className="pt-3 border-t space-y-2">
            <h4 className="text-xs font-semibold flex items-center gap-1">
              <Zap size={12} className="text-yellow-500" /> Policies
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600">
              <div>
                ambiguity:{' '}
                <span className="font-mono text-gray-800">{selected.ambiguityPolicy}</span>
              </div>
              <div>
                notFound:{' '}
                <span className="font-mono text-gray-800">{selected.notFoundPolicy}</span>
              </div>
              <div>
                deadlineMs:{' '}
                <span className="font-mono text-gray-800">{selected.deadlineMs}</span>
              </div>
              <div>
                reverify:{' '}
                <span className="font-mono text-gray-800">
                  {selected.reverifyBeforeAction ? 'true' : 'false'}
                </span>
              </div>
            </div>
          </div>

          {selected.violations.length > 0 ? (
            <div className="text-[10px] text-red-800 bg-red-50 border border-red-200 rounded p-2 space-y-1">
              <p className="font-semibold">Policy violations</p>
              {selected.violations.map((v) => (
                <p key={`${v.code}:${v.message}`}>
                  <span className="font-mono">{v.code}</span>: {v.message}
                </p>
              ))}
            </div>
          ) : null}

          {ambiguityBlocksAction ? (
            <div className="flex gap-2 text-[10px] text-amber-900 bg-amber-50 border border-amber-200 rounded p-2">
              <Ban size={12} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Resolve / act disabled</p>
                <p className="mt-0.5">
                  Ambiguity is not fail-closed or the chain has identity/ambiguity
                  violations — actions that depend on this target stay disabled.
                </p>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={ambiguityBlocksAction}
            className="w-full text-xs py-1.5 rounded border font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-50 text-indigo-800 border-indigo-200 enabled:hover:bg-indigo-100"
            title={
              ambiguityBlocksAction
                ? 'Disabled while ambiguity / identity policy is unsafe'
                : 'Preview only — executor wiring is separate'
            }
          >
            Use resolved target
          </button>
        </div>
      )}
    </div>
  )
}
