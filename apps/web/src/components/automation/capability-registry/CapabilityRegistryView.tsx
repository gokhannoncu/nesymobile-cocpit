'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Package } from 'lucide-react'
import {
  CapabilityRegistryHeader,
  type CapabilityLayerFilter,
  type CapabilityTraitFilter,
} from '@/components/automation/capability-registry/CapabilityRegistryHeader'
import {
  isCoreCapabilityLayer,
  isDomainCapabilityLayer,
} from '@/lib/verdict-runtime/domain-pack-detail'
import {
  capabilityLayerBadgeClass,
  capabilityLayerLabel,
  capabilityProviderBadgeClass,
  capabilityProviderLabel,
  capabilityTraitBadgeClass,
} from '@/lib/verdict-runtime/capability-registry'
import { cn } from '@nesy/metronic/lib/utils'

export type CapabilityRegistryRow = {
  packKey: string
  version: string
  key: string
  title: string
  description: string | null
  layer: string
  provider: string
  runtimeDetected: boolean
  automationOnly: boolean
  detectionRef: string | null
}

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2 py-1.5', cellGrid)
const tdClass = cn('px-2 py-1.5 align-middle', cellGrid)

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

function LayerBadge({ layer }: { layer: string }) {
  return (
    <span className={cn(capabilityLayerBadgeClass(layer), 'max-w-[9rem] truncate')} title={layer}>
      {capabilityLayerLabel(layer)}
    </span>
  )
}

function ProviderBadge({ provider }: { provider: string }) {
  return <span className={capabilityProviderBadgeClass(provider)}>{capabilityProviderLabel(provider)}</span>
}

function TraitBadge({ trait, label }: { trait: 'runtime' | 'automation'; label: string }) {
  return <span className={capabilityTraitBadgeClass(trait)}>{label}</span>
}

function CapabilityRow({ row, index }: { row: CapabilityRegistryRow; index: number }) {
  const router = useRouter()
  const href = packDetailHref(row.packKey, row.version)

  return (
    <tr
      onClick={() => router.push(href)}
      className={cn(
        'cursor-pointer transition-colors',
        index % 2 === 1 ? 'bg-muted/50 hover:bg-muted/65' : 'bg-card hover:bg-muted/35',
      )}
    >
      <td className={tdClass}>
        <LayerBadge layer={row.layer} />
      </td>
      <td className={tdClass}>
        <ProviderBadge provider={row.provider} />
      </td>
      <td className={tdClass}>
        <div className="text-[11px] font-semibold leading-tight text-foreground">{row.title}</div>
        {row.description ? (
          <p className="mt-0.5 line-clamp-1 text-[9px] leading-snug text-muted-foreground">
            {row.description}
          </p>
        ) : null}
        <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground md:hidden" title={row.key}>
          {row.key}
        </p>
      </td>
      <td className={cn('hidden lg:table-cell', tdClass)}>
        <code
          className="block max-w-xs truncate rounded-[4px] border border-border/70 bg-muted/30 px-1 py-px font-mono text-[9px] font-medium text-muted-foreground"
          title={row.key}
        >
          {row.key}
        </code>
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <div className="flex flex-wrap gap-1">
          {row.runtimeDetected ? <TraitBadge trait="runtime" label="Runtime" /> : null}
          {row.automationOnly ? <TraitBadge trait="automation" label="Auto-only" /> : null}
          {!row.runtimeDetected && !row.automationOnly ? (
            <span className="text-[9px] text-muted-foreground">—</span>
          ) : null}
        </div>
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <Link
            href={href}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex w-12 cursor-pointer items-center justify-end gap-0.5 rounded-md py-0.5 text-[10px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
          >
            Open
            <ChevronRight className="size-3 shrink-0" />
          </Link>
        </div>
      </td>
    </tr>
  )
}

function formatCapabilitySummary(rows: readonly CapabilityRegistryRow[]): string {
  const core = rows.filter((row) => isCoreCapabilityLayer(row.layer)).length
  const domain = rows.filter((row) => isDomainCapabilityLayer(row.layer)).length
  const runtime = rows.filter((row) => row.runtimeDetected).length
  return `${core} core · ${domain} domain · ${runtime} runtime`
}

function PackGroupHeader({
  packKey,
  version,
  rowCount,
  rows,
  showPackTitle,
}: {
  packKey: string
  version: string
  rowCount: number
  rows: CapabilityRegistryRow[]
  showPackTitle: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-border bg-muted/10 px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-foreground">
          {showPackTitle ? packKey : 'Capability catalog'}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {showPackTitle ? (
            <>
              v{version} · {rowCount} contract{rowCount === 1 ? '' : 's'} · {formatCapabilitySummary(rows)}
            </>
          ) : (
            <>
              {rowCount} contract{rowCount === 1 ? '' : 's'} · {formatCapabilitySummary(rows)}
            </>
          )}
        </p>
      </div>
      <Link
        href={packDetailHref(packKey, version)}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-semibold text-nesy-ink transition hover:underline"
      >
        Open pack
        <ChevronRight className="size-3.5" />
      </Link>
    </div>
  )
}

function CapabilityPackGroupCard({
  packKey,
  version,
  rows,
  showPackTitle,
}: {
  packKey: string
  version: string
  rows: CapabilityRegistryRow[]
  showPackTitle: boolean
}) {
  const [expanded, setExpanded] = useState(rows.length <= 12)
  const visibleRows = expanded ? rows : rows.slice(0, 12)
  const hiddenCount = rows.length - visibleRows.length

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs ring-1 ring-border/40">
      <PackGroupHeader
        packKey={packKey}
        version={version}
        rowCount={rows.length}
        rows={rows}
        showPackTitle={showPackTitle}
      />

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-muted/40 text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className={cn('w-28', thClass)}>Layer</th>
              <th className={cn('w-28', thClass)}>Provider</th>
              <th className={cn('min-w-[220px]', thClass)}>Capability</th>
              <th className={cn('hidden lg:table-cell', thClass)}>Key</th>
              <th className={cn('hidden w-28 md:table-cell', thClass)}>Traits</th>
              <th className={cn('w-16 text-right', thClass)}>Open</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <CapabilityRow key={`${row.packKey}:${row.key}`} row={row} index={index} />
            ))}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 ? (
        <div className="border-t border-border px-2.5 py-1.5">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="cursor-pointer text-[11px] font-semibold text-nesy-ink underline-offset-2 hover:underline"
          >
            {expanded
              ? 'Show fewer capabilities'
              : `Show ${hiddenCount} more capabilit${hiddenCount === 1 ? 'y' : 'ies'}`}
          </button>
        </div>
      ) : null}
    </article>
  )
}

function matchesLayerFilter(row: CapabilityRegistryRow, filter: CapabilityLayerFilter): boolean {
  if (filter === 'core') return isCoreCapabilityLayer(row.layer)
  if (filter === 'domain') return isDomainCapabilityLayer(row.layer)
  return true
}

function matchesTraitFilter(row: CapabilityRegistryRow, filter: CapabilityTraitFilter): boolean {
  if (filter === 'runtime') return row.runtimeDetected
  if (filter === 'automation') return row.automationOnly
  return true
}

export function CapabilityRegistryView({ capabilities }: { capabilities: CapabilityRegistryRow[] }) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeLayerFilter, setActiveLayerFilter] = useState<CapabilityLayerFilter>('all')
  const [activeTraitFilter, setActiveTraitFilter] = useState<CapabilityTraitFilter>('all')
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [activePack, setActivePack] = useState<string | null>(null)

  const coreCount = useMemo(
    () => capabilities.filter((row) => isCoreCapabilityLayer(row.layer)).length,
    [capabilities],
  )
  const domainCount = useMemo(
    () => capabilities.filter((row) => isDomainCapabilityLayer(row.layer)).length,
    [capabilities],
  )
  const runtimeCount = useMemo(
    () => capabilities.filter((row) => row.runtimeDetected).length,
    [capabilities],
  )
  const automationCount = useMemo(
    () => capabilities.filter((row) => row.automationOnly).length,
    [capabilities],
  )

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of capabilities) counts[row.provider] = (counts[row.provider] ?? 0) + 1
    return counts
  }, [capabilities])

  const packGroups = useMemo(() => {
    const groups = new Map<string, CapabilityRegistryRow[]>()
    for (const row of capabilities) {
      const current = groups.get(row.packKey) ?? []
      current.push(row)
      groups.set(row.packKey, current)
    }
    return [...groups.entries()]
      .map(([packKey, rows]) => ({
        packKey,
        version: rows[0]!.version,
        rows: rows.sort((left, right) => {
          const layerOrder = left.layer.localeCompare(right.layer)
          if (layerOrder !== 0) return layerOrder
          return left.title.localeCompare(right.title)
        }),
      }))
      .sort((left, right) => left.packKey.localeCompare(right.packKey))
  }, [capabilities])

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return packGroups
      .filter((group) => !activePack || group.packKey === activePack)
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => {
          if (!matchesLayerFilter(row, activeLayerFilter)) return false
          if (!matchesTraitFilter(row, activeTraitFilter)) return false
          if (activeProvider && row.provider !== activeProvider) return false
          if (!query) return true
          return (
            row.title.toLowerCase().includes(query) ||
            row.key.toLowerCase().includes(query) ||
            row.layer.toLowerCase().includes(query) ||
            row.provider.toLowerCase().includes(query) ||
            row.packKey.toLowerCase().includes(query) ||
            row.version.toLowerCase().includes(query) ||
            row.description?.toLowerCase().includes(query) ||
            row.detectionRef?.toLowerCase().includes(query)
          )
        }),
      }))
      .filter((group) => group.rows.length > 0)
  }, [
    activeLayerFilter,
    activePack,
    activeProvider,
    activeTraitFilter,
    packGroups,
    searchQuery,
  ])

  const visibleCount = filteredGroups.reduce((total, group) => total + group.rows.length, 0)
  const totalCount = capabilities.length
  const packCount = packGroups.length
  const hasFilters = Boolean(
    searchQuery ||
      activeLayerFilter !== 'all' ||
      activeTraitFilter !== 'all' ||
      activeProvider ||
      activePack,
  )
  const showPackTitleInGroups = packGroups.length > 1 || hasFilters

  const clearFilters = () => {
    setSearchQuery('')
    setActiveLayerFilter('all')
    setActiveTraitFilter('all')
    setActiveProvider(null)
    setActivePack(null)
  }

  return (
    <div className="space-y-5">
      <CapabilityRegistryHeader
        totalCount={totalCount}
        visibleCount={visibleCount}
        packCount={packCount}
        coreCount={coreCount}
        domainCount={domainCount}
        runtimeCount={runtimeCount}
        automationCount={automationCount}
        providerCounts={providerCounts}
        packGroups={packGroups.map((group) => ({
          packKey: group.packKey,
          version: group.version,
          capabilityCount: group.rows.length,
        }))}
        activeLayerFilter={activeLayerFilter}
        onLayerFilterChange={setActiveLayerFilter}
        activeTraitFilter={activeTraitFilter}
        onTraitFilterChange={setActiveTraitFilter}
        activeProvider={activeProvider}
        onProviderChange={setActiveProvider}
        activePack={activePack}
        onPackChange={setActivePack}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={() => router.refresh()}
        onClearFilters={clearFilters}
        hasFilters={hasFilters}
      />

      {visibleCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <Package className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">No capabilities found</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? 'Try another search term or clear the active filters.'
              : 'No capability contracts are available in the latest published domain packs.'}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 cursor-pointer text-sm font-semibold text-nesy-ink underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <CapabilityPackGroupCard
              key={group.packKey}
              packKey={group.packKey}
              version={group.version}
              rows={group.rows}
              showPackTitle={showPackTitleInGroups}
            />
          ))}
        </div>
      )}
    </div>
  )
}
