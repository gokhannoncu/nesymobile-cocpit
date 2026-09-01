'use client'

import React, { useEffect, useState } from 'react'
import {
  Target,
  ArrowRight,
  Zap,
  AlertTriangle,
  RefreshCw,
  Ban,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
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

function TargetResolutionPanelShimmer() {
  return (
    <div className="space-y-3 p-3" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <ShimmerBlock className="h-4 w-36" />
        <ShimmerBlock className="h-7 w-16 rounded-md" />
      </div>
      <ShimmerBlock className="h-5 w-28 rounded-md" />
      <ShimmerBlock className="h-9 w-full rounded-lg" />
      <div className="space-y-2 rounded-lg border border-slate-200/70 p-2.5">
        <ShimmerBlock className="h-3 w-16" />
        <ShimmerBlock className="h-3.5 w-full" />
        <ShimmerBlock className="h-3 w-14" />
        <ShimmerBlock className="h-3.5 w-[92%]" />
      </div>
      <ShimmerBlock className="h-14 w-full rounded-lg" />
      <ShimmerBlock className="h-14 w-full rounded-lg" />
    </div>
  )
}

function entityOptionLabel(entityKey: string): string {
  const leaf = entityKey.split('.').pop() ?? entityKey
  return leaf.replace(/-/g, ' ')
}

function EntityTargetMapping({ entityKey, targetKey }: { entityKey: string; targetKey: string }) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/60 p-2.5">
      <div className="grid gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-500">Entity</p>
          <p className="mt-0.5 break-all font-mono text-[11px] leading-snug text-slate-800">{entityKey}</p>
        </div>
        <div className="flex items-center gap-2 text-slate-400" aria-hidden>
          <span className="h-px flex-1 bg-slate-200/90" />
          <ArrowRight className="size-3.5 shrink-0" />
          <span className="h-px flex-1 bg-slate-200/90" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-500">Target</p>
          <p className="mt-0.5 break-all font-mono text-[11px] leading-snug text-slate-800">{targetKey}</p>
        </div>
      </div>
    </div>
  )
}

function PolicyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-800">{value}</dd>
    </div>
  )
}

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
        const { selectPinnedPublishedPack } = await import('@/lib/verdict-runtime/select-published-pack')
        const pack = selectPinnedPublishedPack(packs.items)
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
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Target className="size-4 shrink-0 text-indigo-600" aria-hidden />
          <h3 className="truncate text-sm font-semibold text-slate-900">Target Resolution</h3>
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

      {state.status === 'loading' ? <TargetResolutionPanelShimmer /> : null}

      {state.status === 'error' ? (
        <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Target resolution unavailable</p>
            <p className="mt-0.5 leading-snug text-rose-800">{state.message}</p>
          </div>
        </div>
      ) : null}

      {state.status === 'empty' ? (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">No provider chain</p>
            <p className="mt-0.5 leading-snug">{state.blockedReason}</p>
            {state.pack ? (
              <p className="mt-1 break-all font-mono text-[10px] text-amber-900/90">
                {state.pack.packKey}@{state.pack.version}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {state.status === 'ready' && selected ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-600">
              {state.pack.packKey}@{state.pack.version}
            </span>
            {state.catalog.partial ? (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Partial
              </span>
            ) : null}
          </div>

          {state.catalog.entities.length > 1 ? (
            <div>
              <label htmlFor="target-resolution-select" className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                Resolution chain
              </label>
              <select
                id="target-resolution-select"
                className="w-full rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 outline-none transition-[border-color,box-shadow] focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
                value={selected.targetKey}
                onChange={(e) => setSelectedTargetKey(e.target.value)}
              >
                {state.catalog.entities.map((entity) => (
                  <option key={entity.targetKey} value={entity.targetKey}>
                    {entityOptionLabel(entity.entityKey)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <EntityTargetMapping entityKey={selected.entityKey} targetKey={selected.targetKey} />

          <div>
            <p className="mb-2 text-[11px] font-semibold text-slate-600">Strategy chain</p>
            <div className="space-y-2">
              {selected.strategies.length === 0 ? (
                <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900">
                  Empty strategy chain
                </p>
              ) : (
                selected.strategies.map((strategy) => (
                  <article
                    key={`${strategy.order}:${strategy.kind}`}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-200/90 bg-white p-2.5"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">
                      {strategy.order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-xs font-semibold text-slate-800">{strategy.kind}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Identity: {strategy.establishesIdentity ? 'yes' : 'no'}
                      </p>
                      <span className="mt-1.5 inline-block rounded border border-slate-200/90 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                        {strategy.ambiguityPolicy}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-slate-200/80 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <Zap className="size-3.5 text-amber-500" aria-hidden />
              Policies
            </p>
            <dl className="grid gap-2.5 sm:grid-cols-2">
              <PolicyField label="Ambiguity" value={selected.ambiguityPolicy} />
              <PolicyField label="Not found" value={selected.notFoundPolicy} />
              <PolicyField label="Deadline (ms)" value={String(selected.deadlineMs)} />
              <PolicyField label="Reverify before action" value={selected.reverifyBeforeAction ? 'true' : 'false'} />
            </dl>
          </div>

          {selected.violations.length > 0 ? (
            <div className="space-y-1 rounded-lg border border-rose-200/90 bg-rose-50/80 p-2.5 text-[10px] text-rose-900">
              <p className="font-semibold">Policy violations</p>
              {selected.violations.map((v) => (
                <p key={`${v.code}:${v.message}`} className="leading-snug">
                  <span className="font-mono">{v.code}</span>: {v.message}
                </p>
              ))}
            </div>
          ) : null}

          {ambiguityBlocksAction ? (
            <div className="flex gap-2 rounded-lg border border-amber-200/90 bg-amber-50/80 p-2.5 text-[10px] text-amber-950">
              <Ban className="mt-0.5 size-3.5 shrink-0" />
              <div className="leading-snug">
                <p className="font-semibold">Resolve / act disabled</p>
                <p className="mt-0.5">
                  Ambiguity policy is unsafe or the chain has identity violations — dependent actions stay disabled.
                </p>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={ambiguityBlocksAction}
            className="w-full rounded-lg border border-indigo-200/90 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 transition-colors enabled:hover:border-indigo-300 enabled:hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              ambiguityBlocksAction
                ? 'Disabled while ambiguity / identity policy is unsafe'
                : 'Preview only — executor wiring is separate'
            }
          >
            Use resolved target
          </button>
        </div>
      ) : null}
    </div>
  )
}
