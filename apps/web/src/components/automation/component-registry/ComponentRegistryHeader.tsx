'use client'

import Link from 'next/link'
import {
  ChevronRight,
  Crosshair,
  Layers,
  LayoutGrid,
  Monitor,
  Package,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { HeroCallout } from '@/components/product/blocks'
import { StatCard, StatGrid } from '@/components/product/stats'
import type {
  ComponentKind,
  ComponentRegistryRow,
} from '@/components/automation/component-registry/ComponentRegistryView'
import { cn } from '@nesy/metronic/lib/utils'

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

function packSurfacesHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}/surfaces?version=${encodeURIComponent(version)}`
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-xs font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

function ComponentPackCommandStrip({
  packKey,
  version,
  rows,
}: {
  packKey: string
  version: string
  rows: ComponentRegistryRow[]
}) {
  const screenCount = rows.filter((row) => row.kind === 'SCREEN').length
  const surfaceCount = rows.filter((row) => row.kind === 'SURFACE').length
  const targetCount = rows.filter((row) => row.kind === 'TARGET').length

  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
            <Layers className="size-4" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{packKey}</p>
            <p className="text-xs text-muted-foreground">UI registry · latest published</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-center">
          <StatPill label="Total" value={`${rows.length} components`} />
          <StatPill label="Version" value={`v${version}`} />
          <StatPill label="Screens" value={String(screenCount)} />
          <StatPill label="Surfaces" value={String(surfaceCount)} />
          <StatPill label="Targets" value={String(targetCount)} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="sm" className="bg-nesy text-white hover:bg-nesy-hover" asChild>
            <Link href={packDetailHref(packKey, version)}>
              Open pack
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link href={packSurfacesHref(packKey, version)}>
              <LayoutGrid className="size-3.5" />
              Surfaces
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function PackScopeChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        active
          ? 'border-nesy/35 bg-nesy-soft text-nesy-ink shadow-xs'
          : 'border-border bg-background text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
      )}
    >
      <span className="max-w-[10rem] truncate">{label}</span>
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
          active ? 'bg-nesy/15 text-nesy-ink' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

export function ComponentRegistryHeader({
  totalCount,
  visibleCount,
  packCount,
  kindCounts,
  packGroups,
  solePackRows,
  activeKind,
  onKindChange,
  activePack,
  onPackChange,
  searchQuery,
  onSearchChange,
  onRefresh,
  onClearFilters,
  hasFilters,
}: {
  totalCount: number
  visibleCount: number
  packCount: number
  kindCounts: Record<ComponentKind, number>
  packGroups: { packKey: string; version: string; componentCount: number }[]
  solePackRows: ComponentRegistryRow[] | null
  activeKind: ComponentKind | null
  onKindChange: (kind: ComponentKind | null) => void
  activePack: string | null
  onPackChange: (packKey: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onClearFilters: () => void
  hasFilters: boolean
}) {
  const solePack = packGroups.length === 1 ? packGroups[0] : null

  return (
    <div className="space-y-4">
      <HeroCallout
        icon={Package}
        eyebrow="Automation / Registry"
        title="Component Registry"
        lead="Screens, surfaces, and automation targets from the latest published domain pack per family — browse UI building blocks before wiring a workflow."
        tone="nesy"
        compact
        layout="stack"
        chips={['Screens', 'Surfaces', 'Targets', 'Latest published']}
      >
        <StatGrid cols={4}>
          <StatCard
            icon={Package}
            label="All components"
            value={hasFilters ? visibleCount : totalCount}
            hint={
              hasFilters
                ? `${visibleCount} of ${totalCount} match filters`
                : `${packCount} ${packCount === 1 ? 'family' : 'families'}`
            }
            tone="nesy"
            active={activeKind === null && !activePack && !searchQuery}
            onClick={onClearFilters}
          />
          <StatCard
            icon={Monitor}
            label="Screens"
            value={kindCounts.SCREEN}
            hint="Full-screen app views"
            tone="blue"
            active={activeKind === 'SCREEN'}
            onClick={() => onKindChange(activeKind === 'SCREEN' ? null : 'SCREEN')}
          />
          <StatCard
            icon={LayoutGrid}
            label="Surfaces"
            value={kindCounts.SURFACE}
            hint="Composable UI regions"
            tone="purple"
            active={activeKind === 'SURFACE'}
            onClick={() => onKindChange(activeKind === 'SURFACE' ? null : 'SURFACE')}
          />
          <StatCard
            icon={Crosshair}
            label="Targets"
            value={kindCounts.TARGET}
            hint="Automation interaction points"
            tone="orange"
            active={activeKind === 'TARGET'}
            onClick={() => onKindChange(activeKind === 'TARGET' ? null : 'TARGET')}
          />
        </StatGrid>
      </HeroCallout>

      <div className="rounded-lg border border-border/80 bg-card/95 p-3 shadow-xs backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search name, key, kind, or pack…"
              className="h-10 w-full rounded-lg border border-border/70 bg-background py-2 pl-9 pr-9 text-sm outline-none transition placeholder:text-muted-foreground/75 hover:border-border focus:border-nesy/40 focus:ring-4 focus:ring-nesy-soft/30"
              type="search"
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 shrink-0"
              onClick={onRefresh}
              aria-label="Refresh component registry"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {solePack && solePackRows ? (
          <ComponentPackCommandStrip
            packKey={solePack.packKey}
            version={solePack.version}
            rows={solePackRows}
          />
        ) : packGroups.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Family
            </span>
            <PackScopeChip
              active={activePack === null}
              label="All families"
              count={totalCount}
              onClick={() => onPackChange(null)}
            />
            {packGroups.map((group) => (
              <PackScopeChip
                key={group.packKey}
                active={activePack === group.packKey}
                label={group.packKey}
                count={group.componentCount}
                onClick={() =>
                  onPackChange(activePack === group.packKey ? null : group.packKey)
                }
              />
            ))}
          </div>
        ) : null}

        {hasFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-xs text-muted-foreground">Active view</span>
            <Badge variant="secondary" appearance="outline" size="sm">
              {visibleCount} of {totalCount} components
            </Badge>
            {activeKind ? (
              <Badge variant="secondary" size="sm">
                Kind: {activeKind.toLowerCase()}
              </Badge>
            ) : null}
            {activePack ? (
              <Badge variant="secondary" size="sm">
                {activePack}
              </Badge>
            ) : null}
            {searchQuery ? (
              <Badge variant="secondary" size="sm" className="font-mono">
                “{searchQuery}”
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
