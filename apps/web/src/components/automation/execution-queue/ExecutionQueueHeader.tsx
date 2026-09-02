'use client'

import type { RefObject } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronDown,
  CircleDot,
  Layers,
  ListOrdered,
  Play,
  Search,
  X,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { HeroCallout } from '@/components/product/blocks'
import { StatCard, StatGrid } from '@/components/product/stats'
import { AutomationHistoryStatCardsShimmer } from '@/components/automation/automation-history-page-shimmer'
import { HeroRefreshButton } from '@/components/automation/shared/HeroRefreshButton'
import {
  formatQueueShare,
  type ExecutionQueueFilter,
} from '@/lib/automation/execution-queue-filters'

export function ExecutionQueueHeader({
  totalCount,
  filteredCount,
  statusCounts,
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onClearSearch,
  sortBy,
  onSortChange,
  onRefresh,
  onClearFilters,
  hasFilters,
  isRefreshing,
  searchInputRef,
}: {
  totalCount: number
  filteredCount: number
  statusCounts: {
    queued: number
    running: number
    terminal: number
    blocked: number
    partial: number
  }
  activeFilter: ExecutionQueueFilter
  onFilterChange: (filter: ExecutionQueueFilter) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  sortBy: 'updated-desc' | 'updated-asc'
  onSortChange: (value: 'updated-desc' | 'updated-asc') => void
  onRefresh: () => void
  onClearFilters: () => void
  hasFilters: boolean
  isRefreshing: boolean
  searchInputRef?: RefObject<HTMLInputElement | null>
}) {
  const statCards: Array<{
    label: string
    value: number
    hint: string
    icon: LucideIcon
    tone: 'teal' | 'amber' | 'blue' | 'gray'
    filter: ExecutionQueueFilter
  }> = [
    {
      label: 'All executions',
      value: totalCount,
      hint:
        totalCount === 0
          ? 'Launch a BridgeFlow run from Run Planner'
          : [
              statusCounts.running > 0 ? `${statusCounts.running} live` : null,
              statusCounts.blocked > 0 ? `${statusCounts.blocked} blocked` : null,
            ]
              .filter(Boolean)
              .join(' · ') || `${totalCount} in pipeline`,
      icon: Layers,
      tone: 'teal',
      filter: 'all',
    },
    {
      label: 'Queued',
      value: statusCounts.queued,
      hint:
        statusCounts.queued === 0
          ? 'Nothing waiting to start'
          : formatQueueShare(statusCounts.queued, totalCount),
      icon: ListOrdered,
      tone: 'amber',
      filter: 'queued',
    },
    {
      label: 'Running',
      value: statusCounts.running,
      hint:
        statusCounts.running === 0
          ? 'No device execution in flight'
          : 'Active BridgeFlow runs',
      icon: Play,
      tone: 'blue',
      filter: 'running',
    },
    {
      label: 'Terminal',
      value: statusCounts.terminal,
      hint:
        statusCounts.terminal === 0
          ? 'None finished or blocked yet'
          : `${statusCounts.partial} partial read model${statusCounts.partial === 1 ? '' : 's'}`,
      icon: CircleDot,
      tone: 'gray',
      filter: 'terminal',
    },
  ]

  return (
    <div className="space-y-4">
      <HeroCallout
        icon={ListOrdered}
        eyebrow="Automation / Operations"
        title="Execution Queue"
        lead="Operational view of BridgeFlow executions — queued, running, and terminal runs stay lifecycle-accurate. Blocked runs remain blocked instead of becoming fake product failures."
        tone="nesy"
        compact
        layout="stack"
        chips={['BridgeFlow engine', 'Live pipeline', 'Blocked-run fidelity']}
        actions={
          <HeroRefreshButton
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            label="Refresh execution queue"
          />
        }
      >
        {isRefreshing ? (
          <AutomationHistoryStatCardsShimmer />
        ) : (
        <StatGrid cols={4}>
          {statCards.map((card) => (
            <StatCard
              key={card.filter}
              icon={card.icon}
              label={card.label}
              value={card.value}
              hint={card.hint}
              tone={card.tone}
              active={
                card.filter === 'all'
                  ? activeFilter === 'all' && !searchQuery
                  : activeFilter === card.filter
              }
              onClick={() => {
                if (card.filter === 'all') {
                  if (hasFilters) onClearFilters()
                  return
                }
                onFilterChange(activeFilter === card.filter ? 'all' : card.filter)
              }}
            />
          ))}
        </StatGrid>
        )}
      </HeroCallout>

      <div className="rounded-[8px] border border-border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search run ID, workflow, device, or block reason…"
              className="h-10 w-full rounded-[8px] border border-border/70 bg-background py-2 pl-9 pr-16 text-sm outline-none transition placeholder:text-muted-foreground/75 hover:border-border focus:border-nesy/40 focus:ring-4 focus:ring-nesy-soft/30"
              type="search"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={onClearSearch}
                  aria-label="Clear search"
                  className="inline-flex size-6 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="hidden rounded-lg border border-border/80 bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                  /
                </kbd>
              )}
            </div>
          </div>

          <div className="relative w-full shrink-0 lg:w-48">
            <label htmlFor="execution-queue-sort" className="sr-only">
              Sort executions
            </label>
            <select
              id="execution-queue-sort"
              value={sortBy}
              onChange={(event) =>
                onSortChange(event.target.value as 'updated-desc' | 'updated-asc')
              }
              className="h-10 w-full appearance-none rounded-[8px] border border-border/70 bg-background px-3.5 pr-9 text-sm font-medium text-foreground outline-none transition hover:border-border focus:border-nesy/40 focus:ring-4 focus:ring-nesy-soft/30"
            >
              <option value="updated-desc">Newest first</option>
              <option value="updated-asc">Oldest first</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
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

        {hasFilters || isRefreshing ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-xs text-muted-foreground">Active view</span>
            <Badge variant="secondary" appearance="outline" size="sm" className="rounded-lg">
              {isRefreshing
                ? 'Refreshing…'
                : `${filteredCount} of ${totalCount} executions`}
            </Badge>
            {activeFilter !== 'all' ? (
              <Badge variant="secondary" size="sm" className="rounded-lg">
                Stage: {activeFilter}
              </Badge>
            ) : null}
            {searchQuery ? (
              <Badge variant="secondary" size="sm" className="rounded-lg font-mono">
                “{searchQuery}”
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
