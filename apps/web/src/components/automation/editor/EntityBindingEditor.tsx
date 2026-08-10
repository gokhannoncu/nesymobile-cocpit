'use client'

import React, { useEffect, useState } from 'react'
import {
  Link2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react'
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
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-purple-600" />
          <h3 className="font-semibold text-sm">Entity Bindings</h3>
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
          Loading entity bindings…
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Entity bindings unavailable</div>
            <div className="mt-0.5 text-red-700">{state.message}</div>
          </div>
        </div>
      )}

      {state.status === 'empty' && (
        <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">No entity bindings</div>
            <div className="mt-0.5">
              {state.blockedReason ?? 'published pack has no entity registry entries'}
            </div>
            {state.pack && (
              <div className="mt-1 font-mono text-[10px] text-amber-800">
                {state.pack.packKey}@{state.pack.version}
              </div>
            )}
          </div>
        </div>
      )}

      {state.status === 'ready' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
            <span className="font-mono">
              {state.pack.packKey}@{state.pack.version}
            </span>
            <span>·</span>
            <span>{state.catalog.entities.length} entities</span>
            <span>·</span>
            <span>{state.catalog.bindings.length} bindings</span>
            {state.catalog.partial && (
              <>
                <span>·</span>
                <span className="text-amber-700 font-medium">partial</span>
              </>
            )}
          </div>

          {state.catalog.blockedReason && (
            <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <span>{state.catalog.blockedReason}</span>
            </div>
          )}

          {unknownBindingCount > 0 && (
            <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                {unknownBindingCount} binding(s) reference an entityTypeRef missing from
                EntityDefinition registry — not valid evidence.
              </span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">
              EntityDefinition
            </label>
            {state.catalog.entities.length === 0 ? (
              <p className="text-xs text-gray-500">No EntityDefinition entries in pack.</p>
            ) : (
              <select
                className="w-full text-xs border rounded p-1.5 bg-gray-50"
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

          {selectedEntity && (
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 border rounded p-2">
              <div>
                <div className="text-[10px] uppercase text-gray-500">businessKeyPath</div>
                <div className="font-mono break-all">{selectedEntity.businessKeyPath}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-500">applicationRef</div>
                <div className="font-mono break-all">{selectedEntity.applicationRef}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] uppercase text-gray-500">identityPaths</div>
                <div className="font-mono break-all">
                  {selectedEntity.identityPaths.length > 0
                    ? selectedEntity.identityPaths.join(', ')
                    : '—'}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] uppercase text-gray-500">sourceQueryRefs</div>
                <div className="font-mono break-all">
                  {selectedEntity.sourceQueryRefs.length > 0
                    ? selectedEntity.sourceQueryRefs.join(', ')
                    : '—'}
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-medium text-gray-500 uppercase mb-1">
              EntityBindingDefinition evidence
              {selectedEntity ? ` for ${selectedEntity.entityType}` : ''}
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">entityTypeRef</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">targetRef</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">projectedPaths</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">redact</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">known</th>
                </tr>
              </thead>
              <tbody>
                {bindingsForEntity.map((binding) => (
                  <tr
                    key={`${binding.targetRef}:${binding.entityTypeRef}`}
                    className="border-b align-top"
                  >
                    <td className="py-2 px-2 font-mono text-[11px]">{binding.entityTypeRef}</td>
                    <td className="py-2 px-2">
                      <div className="font-medium">{binding.targetDisplayName}</div>
                      <div className="font-mono text-[10px] text-gray-500">{binding.targetRef}</div>
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px]">
                      {binding.projectedPaths.length > 0
                        ? binding.projectedPaths.join(', ')
                        : '—'}
                    </td>
                    <td className="py-2 px-2">{binding.redactProjection ? 'yes' : 'no'}</td>
                    <td className="py-2 px-2">
                      {binding.entityKnown ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 size={12} />
                          yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <AlertTriangle size={12} />
                          no
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {bindingsForEntity.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-500">
                      No EntityBindingDefinition for this entity.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
