'use client'

import React, { useEffect, useState } from 'react'
import {
  Link2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import {
  fetchVerdictDomainPacks,
  fetchVerdictEntityBindings,
} from '@/lib/verdict-runtime/client'
import type {
  DomainPackSummary,
  EntityBindingCatalogApi,
  EntityBindingCatalogItemApi,
  EntityCatalogItemApi,
} from '@/lib/verdict-runtime/types'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; blockedReason?: string; pack?: DomainPackSummary }
  | { status: 'ready'; pack: DomainPackSummary; catalog: EntityBindingCatalogApi }

function EntityBindingEditorShimmer() {
  return (
    <div className="space-y-3 p-3" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <ShimmerBlock className="h-4 w-28" />
        <ShimmerBlock className="h-7 w-16 rounded-md" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <ShimmerBlock className="h-5 w-24 rounded-md" />
        <ShimmerBlock className="h-5 w-16 rounded-md" />
        <ShimmerBlock className="h-5 w-16 rounded-md" />
      </div>
      <ShimmerBlock className="h-9 w-full rounded-lg" />
      <div className="space-y-2 rounded-lg border border-slate-200/70 p-2.5">
        <ShimmerBlock className="h-3 w-24" />
        <ShimmerBlock className="h-3.5 w-full" />
        <ShimmerBlock className="h-3 w-28" />
        <ShimmerBlock className="h-3.5 w-[88%]" />
      </div>
      <div className="space-y-2">
        <ShimmerBlock className="h-16 w-full rounded-lg" />
        <ShimmerBlock className="h-16 w-full rounded-lg" />
      </div>
    </div>
  )
}

function EntityField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-[11px] leading-snug text-slate-800">{value}</dd>
    </div>
  )
}

function BindingEvidenceCard({ binding }: { binding: EntityBindingCatalogItemApi }) {
  return (
    <article className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-snug text-slate-800">{binding.targetDisplayName}</p>
          <p className="mt-0.5 break-all font-mono text-[10px] leading-snug text-slate-500">
            {binding.targetRef}
          </p>
        </div>
        {binding.entityKnown ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            <CheckCircle2 className="size-3" aria-hidden />
            Known
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
            <AlertTriangle className="size-3" aria-hidden />
            Unknown
          </span>
        )}
      </div>

      {binding.projectedPaths.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {binding.projectedPaths.map((path) => (
            <span
              key={path}
              className="rounded border border-slate-200/90 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700"
            >
              {path}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-slate-500">No projected paths</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
        <span className="font-mono">{binding.entityTypeRef}</span>
        {binding.redactProjection ? (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">Redacted</span>
        ) : null}
      </div>
    </article>
  )
}

export function EntityBindingEditor() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  const [selectedEntityType, setSelectedEntityType] = useState<string | null>(null)

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
            blockedReason: 'no published Domain Pack to load entity bindings from',
          })
          return
        }

        const catalog = await fetchVerdictEntityBindings(pack.packKey, pack.version)
        if (cancelled) return

        if (catalog.entities.length === 0 && catalog.bindings.length === 0) {
          setState({
            status: 'empty',
            pack,
            blockedReason:
              catalog.blockedReason ?? 'pack has no EntityDefinition or EntityBindingDefinition',
          })
          return
        }

        setSelectedEntityType((prev) => prev ?? catalog.entities[0]?.entityType ?? null)
        setState({ status: 'ready', pack, catalog })
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'entity binding catalog unavailable',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const selectedEntity: EntityCatalogItemApi | undefined =
    state.status === 'ready'
      ? state.catalog.entities.find((e) => e.entityType === selectedEntityType) ??
        state.catalog.entities[0]
      : undefined

  const bindingsForEntity: EntityBindingCatalogItemApi[] =
    state.status === 'ready' && selectedEntity
      ? state.catalog.bindings.filter((b) => b.entityTypeRef === selectedEntity.entityType)
      : state.status === 'ready'
        ? state.catalog.bindings
        : []

  const unknownBindingCount =
    state.status === 'ready'
      ? state.catalog.bindings.filter((b) => !b.entityKnown).length
      : 0

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link2 className="size-4 shrink-0 text-violet-600" aria-hidden />
          <h3 className="truncate text-sm font-semibold text-slate-900">Entity Bindings</h3>
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

      {state.status === 'loading' ? (
        <EntityBindingEditorShimmer />
      ) : null}

      {state.status === 'error' ? (
        <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Entity bindings unavailable</p>
            <p className="mt-0.5 leading-snug text-rose-800">{state.message}</p>
          </div>
        </div>
      ) : null}

      {state.status === 'empty' ? (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">No entity bindings</p>
            <p className="mt-0.5 leading-snug">{state.blockedReason ?? 'published pack has no entity registry entries'}</p>
            {state.pack ? (
              <p className="mt-1 break-all font-mono text-[10px] text-amber-900/90">
                {state.pack.packKey}@{state.pack.version}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-600">
              {state.pack.packKey}@{state.pack.version}
            </span>
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
              {state.catalog.entities.length} entities
            </span>
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
              {state.catalog.bindings.length} bindings
            </span>
            {state.catalog.partial ? (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Partial
              </span>
            ) : null}
          </div>

          {state.catalog.blockedReason ? (
            <div className="flex gap-2 rounded-lg border border-amber-200/90 bg-amber-50/80 p-2.5 text-xs text-amber-950">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              <span className="leading-snug">{state.catalog.blockedReason}</span>
            </div>
          ) : null}

          {unknownBindingCount > 0 ? (
            <div className="flex gap-2 rounded-lg border border-rose-200/90 bg-rose-50/80 p-2.5 text-xs text-rose-900">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span className="leading-snug">
                {unknownBindingCount} binding(s) reference an entity type missing from the registry.
              </span>
            </div>
          ) : null}

          <div>
            <label htmlFor="entity-binding-select" className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Entity
            </label>
            {state.catalog.entities.length === 0 ? (
              <p className="text-xs text-slate-500">No entity definitions in this pack.</p>
            ) : (
              <select
                id="entity-binding-select"
                className="w-full rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 outline-none transition-[border-color,box-shadow] focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
                value={selectedEntity?.entityType ?? ''}
                onChange={(e) => setSelectedEntityType(e.target.value)}
              >
                {state.catalog.entities.map((entity) => (
                  <option key={entity.entityType} value={entity.entityType}>
                    {entity.displayName} ({entity.entityType})
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedEntity ? (
            <dl className="space-y-2.5 rounded-lg border border-slate-200/90 bg-slate-50/60 p-2.5">
              <EntityField label="Business key path" value={selectedEntity.businessKeyPath} />
              <EntityField label="Application" value={selectedEntity.applicationRef} />
              <EntityField
                label="Identity paths"
                value={
                  selectedEntity.identityPaths.length > 0
                    ? selectedEntity.identityPaths.join(', ')
                    : '—'
                }
              />
              <EntityField
                label="Source queries"
                value={
                  selectedEntity.sourceQueryRefs.length > 0
                    ? selectedEntity.sourceQueryRefs.join(', ')
                    : '—'
                }
              />
            </dl>
          ) : null}

          <div>
            <p className="mb-2 text-[11px] font-semibold text-slate-600">
              Binding evidence
              {selectedEntity ? (
                <span className="font-normal text-slate-500"> · {selectedEntity.displayName}</span>
              ) : null}
            </p>
            <div className="space-y-2">
              {bindingsForEntity.map((binding) => (
                <BindingEvidenceCard key={`${binding.targetRef}:${binding.entityTypeRef}`} binding={binding} />
              ))}
              {bindingsForEntity.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-500">
                  No bindings for this entity.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
