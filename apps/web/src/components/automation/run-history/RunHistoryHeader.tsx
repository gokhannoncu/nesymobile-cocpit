'use client'

import type { RefObject } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  ChevronDown,
  CircleX,
  ClipboardCheck,
  History,
  Package,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { HeroCallout } from '@/components/product/blocks'
import { StatCard, StatGrid } from '@/components/product/stats'
import type { Tone } from '@/components/product/tones'
import {
  formatRunShare,
  type RunHistoryStatusFilter,
} from '@/lib/automation/run-history-filters'

type StatCardFilter = 'all' | 'success' | 'failed' | 'active'

export function RunHistoryHeader({
  totalCount,
  filteredCount,
  statusCounts,
  passRate,
  statusFilter,
  onStatusChange,
  searchQuery,
  onSearchChange,
  onClearSearch,
  sortBy,
  onSortChange,
  onRefresh,
  onClearFilters,
  hasFilters,
  searchInputRef,
}: {
  totalCount: number
  filteredCount: number
  statusCounts: { success: number; active: number; failed: number }
  passRate: number | null
  statusFilter: RunHistoryStatusFilter
  onStatusChange: (filter: RunHistoryStatusFilter) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  sortBy: 'created-desc' | 'created-asc'
  onSortChange: (value: 'created-desc' | 'created-asc') => void
  onRefresh: () => void
  onClearFilters: () => void
  hasFilters: boolean
  searchInputRef?: RefObject<HTMLInputElement | null>
}) {
  const statCards: Array<{
    label: string
    value: number
    hint: string
    icon: LucideIcon
    tone: Tone
    filter: StatCardFilter
  }> = [
    {
      label: 'Total runs',
      value: totalCount,
      hint: totalCount
        ? `${passRate ?? 0}% pass rate · tap to show all`
        : 'Run a workflow to populate history',
      icon: Package,
      tone: 'nesy',
      filter: 'all',
    },
    {
      label: 'Successful',
      value: statusCounts.success,
      hint: formatRunShare(statusCounts.success, totalCount),
      icon: BadgeCheck,
      tone: 'teal',
      filter: 'success',
    },
    {
      label: 'In progress',
      value: statusCounts.active,
      hint: formatRunShare(statusCounts.active, totalCount),
      icon: ClipboardCheck,
      tone: 'orange',
      filter: 'active',
    },
    {
      label: 'Failed',
      value: statusCounts.failed,
      hint: formatRunShare(statusCounts.failed, totalCount),
      icon: CircleX,
      tone: 'red',
      filter: 'failed',
    },
  ]

  const isActiveFilterSelected = (filter: StatCardFilter) => {
    if (filter === 'active') {
      return (
        statusFilter === 'active' ||
        statusFilter === 'running' ||
        statusFilter === 'pending'
      )
    }
    return statusFilter === filter
  }

  const handleStatClick = (filter: StatCardFilter) => {
    if (filter === 'active') {
      const activeSelected = isActiveFilterSelected('active')
      onStatusChange(activeSelected ? 'all' : 'active')
      return
    }
    onStatusChange(statusFilter === filter ? 'all' : filter)
  }

  return (
    <div className="space-y-4">
      <HeroCallout
        icon={History}
        eyebrow="Automation / Operations"
        title="Run History"
        lead="Every workflow execution in one place — filter by outcome, search by workflow or device, and open run detail for replay and evidence."
        tone="nesy"
        compact
        layout="stack"
        chips={['Execution log', 'Pass rate', 'Bulk cleanup']}
      >
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
                  ? statusFilter === 'all' && !searchQuery
                  : isActiveFilterSelected(card.filter)
              }
              onClick={() => {
                if (card.filter === 'all') {
                  if (hasFilters) onClearFilters()
                  return
                }
                handleStatClick(card.filter)
              }}
            />
          ))}
        </StatGrid>
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
              placeholder="Search runs, workflows, or devices…"
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
            <label htmlFor="run-history-sort" className="sr-only">
              Sort runs
            </label>
            <select
              id="run-history-sort"
              value={sortBy}
              onChange={(event) =>
                onSortChange(event.target.value as 'created-desc' | 'created-asc')
              }
              className="h-10 w-full appearance-none rounded-[8px] border border-border/70 bg-background px-3.5 pr-9 text-sm font-medium text-foreground outline-none transition hover:border-border focus:border-nesy/40 focus:ring-4 focus:ring-nesy-soft/30"
            >
              <option value="created-desc">Newest first</option>
              <option value="created-asc">Oldest first</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {hasFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 shrink-0 rounded-[8px]"
              onClick={onRefresh}
              aria-label="Refresh run history"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {hasFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-xs text-muted-foreground">Active view</span>
            <Badge variant="secondary" appearance="outline" size="sm">
              {filteredCount} of {totalCount} runs
            </Badge>
            {statusFilter !== 'all' ? (
              <Badge variant="secondary" size="sm">
                Status: {statusFilter}
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
