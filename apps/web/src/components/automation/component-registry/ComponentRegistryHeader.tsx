'use client'

import Link from 'next/link'
import {
  ChevronRight,
  Crosshair,
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
import type { ComponentKind } from '@/components/automation/component-registry/ComponentRegistryView'
import { cn } from '@nesy/metronic/lib/utils'

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

function packSurfacesHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}/surfaces?version=${encodeURIComponent(version)}`
}

function FilterChip({
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
        'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition',
        active
          ? 'border-nesy/35 bg-nesy-soft text-nesy-ink shadow-xs'
          : 'border-border bg-background text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
      )}
    >
      <span className="max-w-[11rem] truncate">{label}</span>
      <span
        className={cn(
          'rounded-[8px] px-1.5 py-px text-[10px] tabular-nums',
          active ? 'bg-nesy/15 text-nesy-ink' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function ComponentPackCommandStrip({
  packKey,
  version,
  componentCount,
}: {
  packKey: string
  version: string
  componentCount: number
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
          <Package className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{packKey}</p>
          <p className="text-xs text-muted-foreground">
            v{version} · {componentCount} component{componentCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-[8px]" asChild>
          <Link href={packSurfacesHref(packKey, version)}>
            <LayoutGrid className="size-3.5" />
            Surfaces
          </Link>
        </Button>
        <Button size="sm" className="h-8 rounded-[8px] bg-nesy text-white hover:bg-nesy-hover" asChild>
          <Link href={packDetailHref(packKey, version)}>
            Open pack
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

export function ComponentRegistryHeader({
  totalCount,
  visibleCount,
  packCount,
  kindCounts,
  packGroups,
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
  const showFamilyRow = !solePack && packGroups.length > 1

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

      <div className="rounded-[8px] border border-border/80 bg-card/95 p-3 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search name, key, kind, or pack…"
              className="h-9 w-full rounded-[8px] border border-border/70 bg-background py-2 pl-9 pr-9 text-sm outline-none transition placeholder:text-muted-foreground/75 hover:border-border focus:border-nesy/40 focus:ring-4 focus:ring-nesy-soft/30"
              type="search"
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            {hasFilters ? (
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-[8px]"
              onClick={onRefresh}
              aria-label="Refresh component registry"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {solePack ? (
          <div className="mt-3 border-t border-border pt-3">
            <ComponentPackCommandStrip
              packKey={solePack.packKey}
              version={solePack.version}
              componentCount={solePack.componentCount}
            />
          </div>
        ) : null}

        {showFamilyRow ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Family
            </span>
            <FilterChip
              active={activePack === null}
              label="All families"
              count={totalCount}
              onClick={() => onPackChange(null)}
            />
            {packGroups.map((group) => (
              <FilterChip
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
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Active view</span>
            <Badge variant="secondary" appearance="outline" size="sm" className="rounded-[8px]">
              {visibleCount} of {totalCount} components
            </Badge>
            {activeKind ? (
              <Badge variant="secondary" size="sm" className="rounded-[8px]">
                Kind: {activeKind.toLowerCase()}
              </Badge>
            ) : null}
            {activePack ? (
              <Badge variant="secondary" size="sm" className="rounded-[8px]">
                {activePack}
              </Badge>
            ) : null}
            {searchQuery ? (
              <Badge variant="secondary" size="sm" className="rounded-[8px] font-mono">
                “{searchQuery}”
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
