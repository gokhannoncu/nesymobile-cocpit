'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  Crosshair,
  LayoutGrid,
  Monitor,
  Package,
} from 'lucide-react'
import { ComponentRegistryHeader } from '@/components/automation/component-registry/ComponentRegistryHeader'
import { cn } from '@nesy/metronic/lib/utils'
import { type Tone, toneIcon, toneIconBox, toneText } from '@/components/product/tones'

export type ComponentKind = 'SCREEN' | 'SURFACE' | 'TARGET'

export type ComponentRegistryRow = {
  packKey: string
  version: string
  key: string
  title: string
  kind: ComponentKind
}

const KIND_META: Record<
  ComponentKind,
  { label: string; tone: Tone; icon: typeof Monitor; description: string }
> = {
  SCREEN: {
    label: 'Screen',
    tone: 'blue',
    icon: Monitor,
    description: 'Full-screen views in the mobile app flow',
  },
  SURFACE: {
    label: 'Surface',
    tone: 'purple',
    icon: LayoutGrid,
    description: 'Composable UI surfaces within a screen',
  },
  TARGET: {
    label: 'Target',
    tone: 'orange',
    icon: Crosshair,
    description: 'Automation targets for interaction and verification',
  },
}

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2.5 py-2', cellGrid)
const tdClass = cn('px-2.5 py-2 align-middle', cellGrid)

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

function componentHref(row: ComponentRegistryRow): string {
  if (row.kind === 'SCREEN' || row.kind === 'SURFACE') {
    return `/automation/domain-packs/${encodeURIComponent(row.packKey)}/surfaces?version=${encodeURIComponent(row.version)}`
  }
  return packDetailHref(row.packKey, row.version)
}

function KindBadge({ kind }: { kind: ComponentKind }) {
  const meta = KIND_META[kind]
  const Icon = meta.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        toneIconBox[meta.tone],
        toneText[meta.tone],
      )}
    >
      <Icon className={cn('size-2.5', toneIcon[meta.tone])} strokeWidth={2.4} />
      {kind}
    </span>
  )
}

function ComponentKeyChip({ value }: { value: string }) {
  return (
    <code
      className="inline-block max-w-full rounded-[4px] border border-nesy-muted/70 bg-nesy-soft/80 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-nesy-ink"
      title={value}
    >
      {value}
    </code>
  )
}

function ComponentRow({ row, index }: { row: ComponentRegistryRow; index: number }) {
  const router = useRouter()
  const href = componentHref(row)

  return (
    <tr
      onClick={() => router.push(href)}
      className={cn(
        'cursor-pointer transition-colors',
        index % 2 === 1 ? 'bg-muted/50 hover:bg-muted/65' : 'bg-card hover:bg-muted/35',
      )}
    >
      <td className={tdClass}>
        <KindBadge kind={row.kind} />
      </td>
      <td className={tdClass}>
        <div className="text-xs font-semibold leading-tight text-foreground">{row.title}</div>
        <div className="mt-0.5 md:hidden">
          <ComponentKeyChip value={row.key} />
        </div>
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <ComponentKeyChip value={row.key} />
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <Link
            href={href}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex w-12 cursor-pointer items-center justify-end gap-0.5 rounded-md py-0.5 text-[11px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
          >
            Open
            <ChevronRight className="size-3 shrink-0" />
          </Link>
        </div>
      </td>
    </tr>
  )
}

function countByKind(rows: readonly ComponentRegistryRow[]): Record<ComponentKind, number> {
  const counts: Record<ComponentKind, number> = { SCREEN: 0, SURFACE: 0, TARGET: 0 }
  for (const row of rows) counts[row.kind] += 1
  return counts
}

function formatKindSummary(counts: Record<ComponentKind, number>): string {
  return `${counts.SCREEN} screen${counts.SCREEN === 1 ? '' : 's'} · ${counts.SURFACE} surface${counts.SURFACE === 1 ? '' : 's'} · ${counts.TARGET} target${counts.TARGET === 1 ? '' : 's'}`
}

function PackGroupHeader({
  packKey,
  version,
  rowCount,
  kindCounts,
  showPackTitle,
  showPackActions,
}: {
  packKey: string
  version: string
  rowCount: number
  kindCounts: Record<ComponentKind, number>
  showPackTitle: boolean
  showPackActions: boolean
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-muted/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {showPackTitle ? packKey : 'Component list'}
        </p>
        <p className="text-xs text-muted-foreground">
          {showPackTitle ? (
            <>
              v{version} · {rowCount} item{rowCount === 1 ? '' : 's'} · {formatKindSummary(kindCounts)}
            </>
          ) : (
            <>
              {rowCount} item{rowCount === 1 ? '' : 's'} · {formatKindSummary(kindCounts)}
            </>
          )}
        </p>
      </div>
      {showPackActions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={packSurfacesHref(packKey, version)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition hover:bg-muted/40"
          >
            <LayoutGrid className="size-3" />
            Surfaces
          </Link>
          <Link
            href={packDetailHref(packKey, version)}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-nesy-ink transition hover:underline"
          >
            Open pack
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function packSurfacesHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}/surfaces?version=${encodeURIComponent(version)}`
}

function ComponentPackGroupCard({
  packKey,
  version,
  rows,
  showPackTitle,
  showPackActions,
}: {
  packKey: string
  version: string
  rows: ComponentRegistryRow[]
  showPackTitle: boolean
  showPackActions: boolean
}) {
  const [expanded, setExpanded] = useState(rows.length <= 10)
  const visibleRows = expanded ? rows : rows.slice(0, 10)
  const hiddenCount = rows.length - visibleRows.length
  const kindCounts = countByKind(rows)

  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <PackGroupHeader
        packKey={packKey}
        version={version}
        rowCount={rows.length}
        kindCounts={kindCounts}
        showPackTitle={showPackTitle}
        showPackActions={showPackActions}
      />

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className={cn('w-24', thClass)}>Kind</th>
              <th className={cn('min-w-[200px]', thClass)}>Display name</th>
              <th className={cn('hidden md:table-cell', thClass)}>Key</th>
              <th className={cn('w-16 text-right', thClass)}>Open</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <ComponentRow key={`${row.kind}:${row.packKey}:${row.key}`} row={row} index={index} />
            ))}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 ? (
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="cursor-pointer text-sm font-semibold text-nesy-ink underline-offset-2 hover:underline"
          >
            {expanded
              ? 'Show fewer components'
              : `Show ${hiddenCount} more component${hiddenCount === 1 ? '' : 's'}`}
          </button>
        </div>
      ) : null}
    </article>
  )
}

export function ComponentRegistryView({ components }: { components: ComponentRegistryRow[] }) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeKind, setActiveKind] = useState<ComponentKind | null>(null)
  const [activePack, setActivePack] = useState<string | null>(null)

  const kindCounts = useMemo(() => countByKind(components), [components])

  const packGroups = useMemo(() => {
    const groups = new Map<string, ComponentRegistryRow[]>()
    for (const row of components) {
      const current = groups.get(row.packKey) ?? []
      current.push(row)
      groups.set(row.packKey, current)
    }
    return [...groups.entries()]
      .map(([packKey, rows]) => ({
        packKey,
        version: rows[0]!.version,
        rows: rows.sort((left, right) => {
          const kindOrder = left.kind.localeCompare(right.kind)
          if (kindOrder !== 0) return kindOrder
          return left.title.localeCompare(right.title)
        }),
      }))
      .sort((left, right) => left.packKey.localeCompare(right.packKey))
  }, [components])

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return packGroups
      .filter((group) => !activePack || group.packKey === activePack)
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => {
          if (activeKind && row.kind !== activeKind) return false
          if (!query) return true
          return (
            row.title.toLowerCase().includes(query) ||
            row.key.toLowerCase().includes(query) ||
            row.kind.toLowerCase().includes(query) ||
            row.packKey.toLowerCase().includes(query) ||
            row.version.toLowerCase().includes(query)
          )
        }),
      }))
      .filter((group) => group.rows.length > 0)
  }, [activeKind, activePack, packGroups, searchQuery])

  const visibleCount = filteredGroups.reduce((total, group) => total + group.rows.length, 0)
  const totalCount = components.length
  const packCount = packGroups.length
  const hasFilters = Boolean(searchQuery || activeKind || activePack)
  const showPackTitleInGroups = packGroups.length > 1 || hasFilters
  const showPackActionsInGroups = showPackTitleInGroups

  const clearFilters = () => {
    setSearchQuery('')
    setActiveKind(null)
    setActivePack(null)
  }

  return (
    <div className="space-y-5">
      <ComponentRegistryHeader
        totalCount={totalCount}
        visibleCount={visibleCount}
        packCount={packCount}
        kindCounts={kindCounts}
        packGroups={packGroups.map((group) => ({
          packKey: group.packKey,
          version: group.version,
          componentCount: group.rows.length,
        }))}
        activeKind={activeKind}
        onKindChange={setActiveKind}
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
          <h3 className="text-lg font-semibold text-foreground">No components found</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? 'Try another search term or clear the active filters.'
              : 'No screens, surfaces, or targets are available in the latest published domain packs.'}
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
            <ComponentPackGroupCard
              key={group.packKey}
              packKey={group.packKey}
              version={group.version}
              rows={group.rows}
              showPackTitle={showPackTitleInGroups}
              showPackActions={showPackActionsInGroups}
            />
          ))}
        </div>
      )}
    </div>
  )
}
