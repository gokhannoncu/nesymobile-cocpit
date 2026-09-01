'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  Crosshair,
  Layers,
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

function packTone(packKey: string): Tone {
  if (packKey.startsWith('nesy')) return 'nesy'
  if (packKey.startsWith('match')) return 'purple'
  return 'teal'
}

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
        'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        toneIconBox[meta.tone],
        toneText[meta.tone],
      )}
    >
      <Icon className={cn('size-3', toneIcon[meta.tone])} strokeWidth={2.4} />
      {kind}
    </span>
  )
}

function ComponentRow({ row, index }: { row: ComponentRegistryRow; index: number }) {
  const meta = KIND_META[row.kind]

  return (
    <tr
      className={cn(
        'border-b border-border/60 transition-colors last:border-b-0',
        index % 2 === 1 ? 'bg-muted/50 hover:bg-muted/65' : 'bg-card hover:bg-muted/35',
      )}
    >
      <td className="px-4 py-3 align-middle">
        <KindBadge kind={row.kind} />
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="font-semibold text-foreground">{row.title}</div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{meta.description}</p>
      </td>
      <td className="hidden px-4 py-3 align-middle md:table-cell">
        <code
          className="block max-w-xs truncate rounded-lg border border-border/60 bg-background/90 px-2 py-1 font-mono text-[11px] font-medium text-foreground"
          title={row.key}
        >
          {row.key}
        </code>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex justify-end">
          <Link
            href={componentHref(row)}
            className="inline-flex w-14 items-center justify-end gap-0.5 rounded-lg py-1 text-xs font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
          >
            Open
            <ChevronRight className="size-3.5 shrink-0" />
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

function ComponentPackGroupCard({
  packKey,
  version,
  rows,
  compactHeader = false,
}: {
  packKey: string
  version: string
  rows: ComponentRegistryRow[]
  compactHeader?: boolean
}) {
  const [expanded, setExpanded] = useState(rows.length <= 10)
  const visibleRows = expanded ? rows : rows.slice(0, 10)
  const hiddenCount = rows.length - visibleRows.length
  const tone = packTone(packKey)
  const kindCounts = countByKind(rows)

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      {!compactHeader ? (
        <header className="relative border-b border-border/80 bg-gradient-to-br from-nesy-soft/25 via-background to-muted/15 px-4 py-4">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-black/5',
                  toneIconBox[tone],
                )}
              >
                <Layers className={cn('size-4', toneIcon[tone])} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-foreground">
                  {packKey}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Latest published · v{version} · {rows.length} component
                  {rows.length === 1 ? '' : 's'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <KindCountPill label="Screens" value={kindCounts.SCREEN} tone="blue" />
                  <KindCountPill label="Surfaces" value={kindCounts.SURFACE} tone="purple" />
                  <KindCountPill label="Targets" value={kindCounts.TARGET} tone="orange" />
                </div>
              </div>
            </div>
            <Link
              href={packDetailHref(packKey, version)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-nesy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-nesy-hover"
            >
              Open pack
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </header>
      ) : (
        <div className="flex flex-col gap-2 border-b border-border/70 bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Component list</p>
            <p className="text-xs text-muted-foreground">
              {rows.length} item{rows.length === 1 ? '' : 's'} · {kindCounts.SCREEN} screens ·{' '}
              {kindCounts.SURFACE} surfaces · {kindCounts.TARGET} targets
            </p>
          </div>
          <Link
            href={packDetailHref(packKey, version)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-nesy-ink transition hover:underline"
          >
            Open pack
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/25 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Display name</th>
              <th className="hidden px-4 py-3 md:table-cell">Key</th>
              <th className="w-20 px-4 py-3 text-right">Open</th>
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
        <div className="border-t border-border/70 px-4 py-3">
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

function KindCountPill({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: Tone
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold',
        toneIconBox[tone],
        toneText[tone],
      )}
    >
      {label}
      <span className="tabular-nums">{value}</span>
    </span>
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
  const compactGroupHeader = packGroups.length === 1 && !hasFilters

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
        solePackRows={packGroups.length === 1 ? packGroups[0]!.rows : null}
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
              compactHeader={compactGroupHeader}
            />
          ))}
        </div>
      )}
    </div>
  )
}
