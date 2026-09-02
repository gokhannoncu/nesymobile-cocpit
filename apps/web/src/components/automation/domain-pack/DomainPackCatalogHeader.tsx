'use client'

import {
  Archive,
  FileCheck2,
  FilePenLine,
  Layers,
  Package,
  Search,
  X,
} from 'lucide-react'
import { DomainPackFamilyStrip } from '@/components/automation/domain-pack/DomainPackFamilyStrip'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { AutomationHistoryStatCardsShimmer } from '@/components/automation/automation-history-page-shimmer'
import { HeroRefreshButton } from '@/components/automation/shared/HeroRefreshButton'
import { HeroCallout } from '@/components/product/blocks'
import { StatCard, StatGrid } from '@/components/product/stats'
import type { DomainPackState } from '@/lib/verdict-runtime/types'
import type { DomainPackGroup } from '@/lib/verdict-runtime/domain-pack-catalog'
import { cn } from '@nesy/metronic/lib/utils'

export function DomainPackCatalogHeader({
  totalPacks,
  totalVersions,
  visibleVersions,
  statusCounts,
  activeStatus,
  onStatusChange,
  allPackGroups,
  activePack,
  onPackChange,
  searchQuery,
  onSearchChange,
  onRefresh,
  onClearFilters,
  hasFilters,
  isRefreshing = false,
}: {
  totalPacks: number
  totalVersions: number
  visibleVersions: number
  statusCounts: Record<DomainPackState, number>
  activeStatus: DomainPackState | null
  onStatusChange: (status: DomainPackState | null) => void
  allPackGroups: DomainPackGroup[]
  activePack: string | null
  onPackChange: (packKey: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onClearFilters: () => void
  hasFilters: boolean
  isRefreshing?: boolean
}) {
  const solePack = allPackGroups.length === 1 ? allPackGroups[0] : null

  return (
    <div className="space-y-4">
      <HeroCallout
        icon={Package}
        eyebrow="Automation / Registry"
        title="Domain Pack Catalog"
        lead="Published bundle manifests for every product family — browse version history, digests, and publication state before pinning a pack to a run."
        tone="nesy"
        compact
        layout="stack"
        chips={['Runtime catalog', 'Immutable publishes', 'Version lineage']}
        actions={
          <HeroRefreshButton
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            label="Refresh domain pack catalog"
          />
        }
      >
        {isRefreshing ? (
          <AutomationHistoryStatCardsShimmer />
        ) : (
        <StatGrid cols={4}>
          <StatCard
            icon={Layers}
            label="All versions"
            value={totalVersions}
            hint={
              hasFilters
                ? `${visibleVersions} match filters`
                : `${totalPacks} ${totalPacks === 1 ? 'family' : 'families'} in catalog`
            }
            tone="nesy"
            active={activeStatus === null && !activePack && !searchQuery}
            onClick={() => {
              onStatusChange(null)
              onPackChange(null)
              onSearchChange('')
            }}
          />
          <StatCard
            icon={FileCheck2}
            label="Published"
            value={statusCounts.PUBLISHED}
            hint={
              totalVersions > 0
                ? `${Math.round((statusCounts.PUBLISHED / totalVersions) * 100)}% of catalog`
                : 'Pin-ready snapshots'
            }
            tone="green"
            active={activeStatus === 'PUBLISHED'}
            onClick={() =>
              onStatusChange(activeStatus === 'PUBLISHED' ? null : 'PUBLISHED')
            }
          />
          <StatCard
            icon={FilePenLine}
            label="Draft"
            value={statusCounts.DRAFT}
            hint={statusCounts.DRAFT ? 'Editable workspace copies' : 'No drafts in runtime'}
            tone="amber"
            active={activeStatus === 'DRAFT'}
            onClick={() => onStatusChange(activeStatus === 'DRAFT' ? null : 'DRAFT')}
          />
          <StatCard
            icon={Archive}
            label="Archived"
            value={statusCounts.ARCHIVED}
            hint={statusCounts.ARCHIVED ? 'Retired from pin selection' : 'None archived'}
            tone="gray"
            active={activeStatus === 'ARCHIVED'}
            onClick={() =>
              onStatusChange(activeStatus === 'ARCHIVED' ? null : 'ARCHIVED')
            }
          />
        </StatGrid>
        )}
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
              placeholder="Search pack, version, or digest…"
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
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex h-10 cursor-pointer items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {solePack ? (
          <DomainPackFamilyStrip
            packKey={solePack.packKey}
            versions={solePack.versions}
            latestPublished={solePack.latestPublished}
            variant="command"
          />
        ) : allPackGroups.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Family
            </span>
            <PackScopeChip
              active={activePack === null}
              label="All families"
              count={totalVersions}
              onClick={() => onPackChange(null)}
            />
            {allPackGroups.map((group) => (
              <PackScopeChip
                key={group.packKey}
                active={activePack === group.packKey}
                label={group.packKey}
                count={group.versions.length}
                onClick={() =>
                  onPackChange(activePack === group.packKey ? null : group.packKey)
                }
              />
            ))}
          </div>
        ) : null}

        {hasFilters || isRefreshing ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-xs text-muted-foreground">Active view</span>
            <Badge variant="secondary" appearance="outline" size="sm">
              {isRefreshing ? 'Refreshing…' : `${visibleVersions} of ${totalVersions} versions`}
            </Badge>
            {activeStatus ? (
              <Badge variant="secondary" size="sm">
                Status: {activeStatus.toLowerCase()}
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
