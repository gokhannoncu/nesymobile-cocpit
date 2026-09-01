'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ChevronRight,
  FlaskConical,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  TestTube2,
  X,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { HeroCallout } from '@/components/product/blocks'
import { StatCard, StatGrid } from '@/components/product/stats'
import {
  testProfileKindBadgeClass,
  type TestProfileKind,
} from '@/lib/verdict-runtime/test-profile-registry'
import { cn } from '@nesy/metronic/lib/utils'

export type TestProfileTraitFilter = 'all' | 'releaseGate' | 'blocked' | 'notRun'

const PROFILE_KINDS: TestProfileKind[] = ['CORE', 'PREVIEW', 'SOAK', 'FAULT']

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

function KindFilterChip({
  kind,
  count,
  active,
  onClick,
}: {
  kind: TestProfileKind
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${kind} profiles`}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[4px] border transition',
        active
          ? cn(testProfileKindBadgeClass(kind), 'shadow-xs ring-1 ring-nesy/15')
          : cn(
              'border-border bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              count === 0 && 'opacity-40',
            ),
      )}
    >
      <span>{kind}</span>
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

function PackFilterChip({
  packKey,
  count,
  active,
  onClick,
}: {
  packKey: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={packKey}
      className={cn(
        'inline-flex max-w-[12rem] shrink-0 cursor-pointer items-center gap-1 rounded-[4px] border px-2 py-0.5 font-mono text-[10px] font-semibold transition',
        active
          ? 'border-nesy/35 bg-nesy-soft text-nesy-ink shadow-xs ring-1 ring-nesy/15'
          : 'border-border bg-background text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
      )}
    >
      <span className="truncate">{packKey}</span>
      <span
        className={cn(
          'shrink-0 rounded-[4px] px-1 py-px text-[9px] tabular-nums',
          active ? 'bg-nesy/15 text-nesy-ink' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function TestProfilePackCommandStrip({
  packKey,
  packVersion,
  profileCount,
}: {
  packKey: string
  packVersion: string
  profileCount: number
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
            v{packVersion} · {profileCount} profile{profileCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <Button size="sm" className="h-8 shrink-0 rounded-[8px] bg-nesy text-white hover:bg-nesy-hover" asChild>
        <Link href={packDetailHref(packKey, packVersion)}>
          Open pack
          <ChevronRight className="size-4" />
        </Link>
      </Button>
    </div>
  )
}

export function TestProfileRegistryHeader({
  totalCount,
  visibleCount,
  packCount,
  releaseGateCount,
  blockedCount,
  notRunCount,
  kindCounts,
  packGroups,
  activeTraitFilter,
  onTraitFilterChange,
  activeKind,
  onKindChange,
  activePack,
  onPackChange,
  searchQuery,
  onSearchChange,
  onRefresh,
  onClearFilters,
  hasFilters,
  partial,
}: {
  totalCount: number
  visibleCount: number
  packCount: number
  releaseGateCount: number
  blockedCount: number
  notRunCount: number
  kindCounts: Record<TestProfileKind, number>
  packGroups: { packKey: string; packVersion: string; profileCount: number }[]
  activeTraitFilter: TestProfileTraitFilter
  onTraitFilterChange: (filter: TestProfileTraitFilter) => void
  activeKind: TestProfileKind | null
  onKindChange: (kind: TestProfileKind | null) => void
  activePack: string | null
  onPackChange: (packKey: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onClearFilters: () => void
  hasFilters: boolean
  partial: boolean
}) {
  const solePack = packGroups.length === 1 ? packGroups[0] : null
  const showFamilyRow = !solePack && packGroups.length > 1
  const visibleKindOptions = PROFILE_KINDS.filter((kind) => kindCounts[kind] > 0 || activeKind === kind)

  return (
    <div className="space-y-4">
      <HeroCallout
        icon={TestTube2}
        eyebrow="Automation / Verification"
        title="Test Profiles"
        lead="Release-gate and diagnostic verification profiles from the Verdict runtime catalog — kind, last result, owner, and domain pack binding in one matrix."
        tone="nesy"
        compact
        layout="stack"
        chips={['CORE', 'PREVIEW', 'SOAK', 'FAULT', 'Release gate']}
      >
        <StatGrid cols={4}>
          <StatCard
            icon={FlaskConical}
            label="All profiles"
            value={hasFilters ? visibleCount : totalCount}
            hint={
              hasFilters
                ? `${visibleCount} of ${totalCount} match · tap to reset`
                : `${packCount} ${packCount === 1 ? 'family' : 'families'}`
            }
            tone="nesy"
            active={
              activeTraitFilter === 'all' &&
              activeKind === null &&
              !activePack &&
              !searchQuery
            }
            onClick={onClearFilters}
          />
          <StatCard
            icon={ShieldCheck}
            label="Release gate"
            value={releaseGateCount}
            hint="Blocks release when failing"
            tone="nesy"
            active={activeTraitFilter === 'releaseGate'}
            onClick={() =>
              onTraitFilterChange(activeTraitFilter === 'releaseGate' ? 'all' : 'releaseGate')
            }
          />
          <StatCard
            icon={AlertTriangle}
            label="Blocked"
            value={blockedCount}
            hint="Catalog blockers active"
            tone="orange"
            active={activeTraitFilter === 'blocked'}
            onClick={() =>
              onTraitFilterChange(activeTraitFilter === 'blocked' ? 'all' : 'blocked')
            }
          />
          <StatCard
            icon={Package}
            label="Not run"
            value={notRunCount}
            hint="Awaiting first execution"
            tone="gray"
            active={activeTraitFilter === 'notRun'}
            onClick={() => onTraitFilterChange(activeTraitFilter === 'notRun' ? 'all' : 'notRun')}
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
              placeholder="Search profile, owner, pack, or kind…"
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
            {partial ? (
              <Badge variant="secondary" appearance="outline" size="sm" className="rounded-[8px]">
                Partial catalog
              </Badge>
            ) : null}
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
              aria-label="Refresh test profile catalog"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {visibleKindOptions.length > 0 || showFamilyRow ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 lg:flex-row lg:items-center lg:gap-3">
            {visibleKindOptions.length > 0 ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <span className="mr-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Kind
                </span>
                {visibleKindOptions.map((kind) => (
                  <KindFilterChip
                    key={kind}
                    kind={kind}
                    count={kindCounts[kind]}
                    active={activeKind === kind}
                    onClick={() => onKindChange(activeKind === kind ? null : kind)}
                  />
                ))}
              </div>
            ) : null}

            {showFamilyRow ? (
              <>
                {visibleKindOptions.length > 0 ? (
                  <span className="hidden h-5 w-px shrink-0 bg-border lg:block" aria-hidden />
                ) : null}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Pack
                  </span>
                  {packGroups.map((group) => (
                    <PackFilterChip
                      key={group.packKey}
                      packKey={group.packKey}
                      count={group.profileCount}
                      active={activePack === group.packKey}
                      onClick={() =>
                        onPackChange(activePack === group.packKey ? null : group.packKey)
                      }
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {solePack ? (
          <div className="mt-3 border-t border-border pt-3">
            <TestProfilePackCommandStrip
              packKey={solePack.packKey}
              packVersion={solePack.packVersion}
              profileCount={solePack.profileCount}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
