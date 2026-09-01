'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ChevronRight,
  GitBranch,
  LayoutGrid,
  Network,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  TestTube2,
  X,
} from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { componentCount, type CoverageGraphCounts } from '@/lib/verdict-runtime/coverage-graph'
import { cn } from '@nesy/metronic/lib/utils'

export type CoverageHealthFilter = 'all' | 'complete' | 'gaps'

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

function packSurfacesHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}/surfaces?version=${encodeURIComponent(version)}`
}

function MetaCell({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="min-w-0 rounded-[8px] border border-border/60 bg-background/70 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden />
        {label}
      </div>
      <p className="mt-0.5 text-sm font-bold tabular-nums leading-snug text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[9px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
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
        'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[10px] font-semibold transition',
        active
          ? 'border-nesy/35 bg-nesy-soft text-nesy-ink'
          : 'border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground',
      )}
    >
      <span className="max-w-[10rem] truncate">{label}</span>
      <span
        className={cn(
          'rounded-[4px] px-1 py-px text-[9px] tabular-nums',
          active ? 'bg-nesy/15 text-nesy-ink' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function ChainStep({
  label,
  value,
  hint,
  isLast,
}: {
  label: string
  value: number
  hint?: string
  isLast?: boolean
}) {
  return (
    <>
      <div className="flex min-w-[4.75rem] shrink-0 flex-col items-center rounded-[8px] border border-nesy/20 bg-background/80 px-2 py-1.5 text-center">
        <span className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 text-base font-bold tabular-nums text-nesy-ink">{value}</span>
        {hint ? <span className="mt-0.5 text-[8px] leading-tight text-muted-foreground">{hint}</span> : null}
      </div>
      {!isLast ? (
        <ChevronRight className="size-3 shrink-0 text-muted-foreground/45" aria-hidden />
      ) : null}
    </>
  )
}

function CoverageChainStepper({
  familyCount,
  totals,
}: {
  familyCount: number
  totals: CoverageGraphCounts
}) {
  const components = componentCount(totals)

  return (
    <div className="rounded-[8px] border border-border/60 bg-muted/10 px-2.5 py-2">
      <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        <GitBranch className="size-3" aria-hidden />
        Product coverage chain
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ChainStep label="Families" value={familyCount} hint="published" />
        <ChainStep label="Features" value={totals.features} />
        <ChainStep label="Components" value={components} hint={`${totals.screens} scr · ${totals.targets} tgt`} />
        <ChainStep label="Evidence" value={totals.evidence} />
        <ChainStep
          label="Tests"
          value={totals.tests}
          hint={totals.releaseGateTests > 0 ? `${totals.releaseGateTests} gate` : undefined}
          isLast
        />
      </div>
    </div>
  )
}

export function CoverageGraphHeader({
  familyCount,
  visibleCount,
  completeCount,
  gapCount,
  totals,
  packGroups,
  activeHealthFilter,
  onHealthFilterChange,
  activePack,
  onPackChange,
  searchQuery,
  onSearchChange,
  onRefresh,
  onClearFilters,
  hasFilters,
}: {
  familyCount: number
  visibleCount: number
  completeCount: number
  gapCount: number
  totals: CoverageGraphCounts
  packGroups: { packKey: string; version: string }[]
  activeHealthFilter: CoverageHealthFilter
  onHealthFilterChange: (filter: CoverageHealthFilter) => void
  activePack: string | null
  onPackChange: (packKey: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onClearFilters: () => void
  hasFilters: boolean
}) {
  const solePack = packGroups.length === 1 ? packGroups[0] : null
  const components = componentCount(totals)

  return (
    <div className="space-y-4">
      <article className="overflow-hidden rounded-[8px] border border-border bg-card">
        <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
                  <Network className="size-4" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold leading-tight text-foreground lg:text-xl">
                    Coverage graph
                  </h1>
                  <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                    Product → Feature → Component → Evidence → Test Profile chain across the latest
                    published domain pack per family.
                  </p>
                </div>
              </div>
            </div>

            {solePack ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 rounded-[8px]" asChild>
                  <Link href={packSurfacesHref(solePack.packKey, solePack.version)}>
                    <LayoutGrid className="size-4" />
                    Surfaces
                  </Link>
                </Button>
                <Button size="sm" className="h-9 rounded-[8px] bg-nesy text-white hover:bg-nesy-hover" asChild>
                  <Link href={packDetailHref(solePack.packKey, solePack.version)}>
                    Open pack
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <MetaCell icon={Package} label="Families" value={familyCount} hint="published packs" />
            <MetaCell icon={Network} label="Features" value={totals.features} />
            <MetaCell icon={LayoutGrid} label="Components" value={components} hint={`${totals.screens} screens`} />
            <MetaCell icon={ShieldCheck} label="Evidence" value={totals.evidence} />
            <MetaCell
              icon={TestTube2}
              label="Test profiles"
              value={totals.tests}
              hint={totals.releaseGateTests > 0 ? `${totals.releaseGateTests} release gate` : undefined}
            />
          </div>

          <div className="mt-3">
            <CoverageChainStepper familyCount={familyCount} totals={totals} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={activeHealthFilter === 'all' && !activePack && !searchQuery}
              label="All families"
              count={hasFilters ? visibleCount : familyCount}
              onClick={onClearFilters}
            />
            <FilterChip
              active={activeHealthFilter === 'complete'}
              label="Complete chain"
              count={completeCount}
              onClick={() =>
                onHealthFilterChange(activeHealthFilter === 'complete' ? 'all' : 'complete')
              }
            />
            <FilterChip
              active={activeHealthFilter === 'gaps'}
              label="Has gaps"
              count={gapCount}
              onClick={() => onHealthFilterChange(activeHealthFilter === 'gaps' ? 'all' : 'gaps')}
            />
            {hasFilters ? (
              <span className="text-[10px] text-muted-foreground">
                · {visibleCount} of {familyCount} shown
              </span>
            ) : null}
          </div>
        </div>
      </article>

      <div className="rounded-[8px] border border-border bg-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search pack key, version, or display name…"
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

          <div className="flex shrink-0 items-center gap-2">
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
              aria-label="Refresh coverage graph"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {packGroups.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Family
            </span>
            <FilterChip
              active={activePack === null}
              label="All"
              count={familyCount}
              onClick={() => onPackChange(null)}
            />
            {packGroups.map((group) => (
              <FilterChip
                key={group.packKey}
                active={activePack === group.packKey}
                label={group.packKey}
                count={1}
                onClick={() => onPackChange(activePack === group.packKey ? null : group.packKey)}
              />
            ))}
          </div>
        ) : null}

        {hasFilters && activeHealthFilter === 'gaps' ? (
          <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>Showing families with missing features, components, evidence, or test profiles.</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
