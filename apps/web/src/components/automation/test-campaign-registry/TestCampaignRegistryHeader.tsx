'use client'

import {
  AlertTriangle,
  CalendarRange,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { HeroCallout } from '@/components/product/blocks'
import { StatCard, StatGrid } from '@/components/product/stats'
import { campaignTypeBadgeClass, campaignBadgePrimary } from '@/lib/verdict-runtime/test-campaign-registry'
import { cn } from '@nesy/metronic/lib/utils'

export type CampaignTraitFilter = 'all' | 'running' | 'blocked' | 'gateFail'

function TypeChip({
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
        'inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[4px] border transition',
        active
          ? cn(
              label === 'All' ? campaignBadgePrimary : campaignTypeBadgeClass(label),
              'shadow-xs ring-1 ring-nesy/15',
            )
          : cn(
              'border-border bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              count === 0 && 'opacity-40',
            ),
      )}
    >
      <span>{label}</span>
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

export function TestCampaignRegistryHeader({
  totalCount,
  visibleCount,
  totalCells,
  runningCount,
  blockedCount,
  gateFailCount,
  typeCounts,
  activeTraitFilter,
  onTraitFilterChange,
  activeType,
  onTypeChange,
  searchQuery,
  onSearchChange,
  onRefresh,
  onClearFilters,
  hasFilters,
}: {
  totalCount: number
  visibleCount: number
  totalCells: number
  runningCount: number
  blockedCount: number
  gateFailCount: number
  typeCounts: Record<string, number>
  activeTraitFilter: CampaignTraitFilter
  onTraitFilterChange: (filter: CampaignTraitFilter) => void
  activeType: string | null
  onTypeChange: (type: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onClearFilters: () => void
  hasFilters: boolean
}) {
  const typeEntries = Object.entries(typeCounts).sort(([left], [right]) => left.localeCompare(right))

  return (
    <div className="space-y-4">
      <HeroCallout
        icon={CalendarRange}
        eyebrow="Automation / Verification"
        title="Test Campaigns"
        lead="Execution matrices across devices, datasets, and release-gate profiles — campaign status, cell count, and gate evaluation from the Verdict runtime catalog."
        tone="nesy"
        compact
        layout="stack"
        chips={['PR', 'NIGHTLY', 'RELEASE', 'Release gate', 'Cell matrix']}
      >
        <StatGrid cols={4}>
          <StatCard
            icon={CalendarRange}
            label="All campaigns"
            value={hasFilters ? visibleCount : totalCount}
            hint={
              hasFilters
                ? `${visibleCount} of ${totalCount} match filters`
                : `${totalCells} matrix cells`
            }
            tone="nesy"
            active={activeTraitFilter === 'all' && activeType === null && !searchQuery}
            onClick={onClearFilters}
          />
          <StatCard
            icon={Play}
            label="Running"
            value={runningCount}
            hint="Active execution"
            tone="nesy"
            active={activeTraitFilter === 'running'}
            onClick={() =>
              onTraitFilterChange(activeTraitFilter === 'running' ? 'all' : 'running')
            }
          />
          <StatCard
            icon={AlertTriangle}
            label="Blocked"
            value={blockedCount}
            hint="Campaign-level blockers"
            tone="orange"
            active={activeTraitFilter === 'blocked'}
            onClick={() =>
              onTraitFilterChange(activeTraitFilter === 'blocked' ? 'all' : 'blocked')
            }
          />
          <StatCard
            icon={ShieldAlert}
            label="Gate failed"
            value={gateFailCount}
            hint="Release gate evaluation failed"
            tone="orange"
            active={activeTraitFilter === 'gateFail'}
            onClick={() =>
              onTraitFilterChange(activeTraitFilter === 'gateFail' ? 'all' : 'gateFail')
            }
          />
        </StatGrid>
      </HeroCallout>

      <div className="rounded-[8px] border border-border/80 bg-card/95 p-3 backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search campaign id, type, status, or gate result…"
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
              aria-label="Refresh test campaign catalog"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {typeEntries.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Type
            </span>
            <TypeChip
              active={activeType === null}
              label="All"
              count={totalCount}
              onClick={() => onTypeChange(null)}
            />
            {typeEntries.map(([type, count]) => (
              <TypeChip
                key={type}
                active={activeType === type}
                label={type}
                count={count}
                onClick={() => onTypeChange(activeType === type ? null : type)}
              />
            ))}
          </div>
        ) : null}

        {hasFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Active view</span>
            <Badge variant="secondary" appearance="outline" size="sm">
              {visibleCount} of {totalCount} campaigns
            </Badge>
            {activeTraitFilter !== 'all' ? (
              <Badge variant="secondary" size="sm">
                {activeTraitFilter === 'running'
                  ? 'Running'
                  : activeTraitFilter === 'blocked'
                    ? 'Blocked'
                    : 'Gate failed'}
              </Badge>
            ) : null}
            {activeType ? (
              <Badge variant="secondary" size="sm">
                {activeType}
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
