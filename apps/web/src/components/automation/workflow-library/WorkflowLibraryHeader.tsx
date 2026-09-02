'use client'

import type { RefObject } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Archive, Pencil, Play, Search, Workflow, X } from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { AutomationListStatCardsShimmer } from '@/components/automation/automation-list-page-shimmer'
import { HeroRefreshButton } from '@/components/automation/shared/HeroRefreshButton'
import { HeroCallout } from '@/components/product/blocks'
import { StatCard, StatGrid } from '@/components/product/stats'
import type { WorkflowLibraryStatusFilter } from '@/lib/automation/workflow-library-filters'

export function WorkflowLibraryHeader({
  totalCount,
  filteredCount,
  visibleCount,
  statusCounts,
  statusFilter,
  onStatusChange,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onRefresh,
  onClearFilters,
  hasFilters,
  isRefreshing = false,
  isSearchPending,
  onCreateClick,
  createShortcutLabel,
  searchInputRef,
}: {
  totalCount: number
  filteredCount: number
  visibleCount: number
  statusCounts: { active: number; draft: number; archived: number }
  statusFilter: WorkflowLibraryStatusFilter
  onStatusChange: (filter: WorkflowLibraryStatusFilter) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  onRefresh: () => void
  onClearFilters: () => void
  hasFilters: boolean
  isRefreshing?: boolean
  isSearchPending: boolean
  onCreateClick: () => void
  createShortcutLabel: string
  searchInputRef?: RefObject<HTMLInputElement | null>
}) {
  const statCards: Array<{
    label: string
    value: number
    hint: string
    icon: LucideIcon
    tone: 'nesy' | 'green' | 'amber' | 'gray'
    filter: WorkflowLibraryStatusFilter
  }> = [
    {
      label: 'Total workflows',
      value: totalCount,
      hint:
        totalCount === 0
          ? 'Create a workflow to get started'
          : [
              statusCounts.active > 0 ? `${statusCounts.active} live` : null,
              statusCounts.draft > 0 ? `${statusCounts.draft} draft` : null,
            ]
              .filter(Boolean)
              .join(' · ') || `${totalCount} in library`,
      icon: Workflow,
      tone: 'nesy',
      filter: 'all',
    },
    {
      label: 'Active',
      value: statusCounts.active,
      hint:
        statusCounts.active === 0
          ? 'No published or active workflows yet'
          : 'Published and active workflows',
      icon: Play,
      tone: 'green',
      filter: 'active',
    },
    {
      label: 'Draft',
      value: statusCounts.draft,
      hint: statusCounts.draft === 0 ? 'None in this status' : `${statusCounts.draft} editable`,
      icon: Pencil,
      tone: 'amber',
      filter: 'draft',
    },
    {
      label: 'Archived',
      value: statusCounts.archived,
      hint: statusCounts.archived === 0 ? 'None in this status' : `${statusCounts.archived} retired`,
      icon: Archive,
      tone: 'gray',
      filter: 'archived',
    },
  ]

  return (
    <div className="space-y-4">
      <HeroCallout
        icon={Workflow}
        eyebrow="Automation / Library"
        title="Workflow Library"
        lead="Browse, filter, and open automation workflows — create new flows or jump back into drafts and published runs."
        tone="nesy"
        compact
        layout="stack"
        chips={['Authoring', 'Published runs', 'Draft workspace']}
        actions={
          <HeroRefreshButton
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            label="Refresh workflow library"
          />
        }
      >
        {isRefreshing ? (
          <AutomationListStatCardsShimmer />
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
                  ? statusFilter === 'all' && !searchQuery
                  : statusFilter === card.filter
              }
              onClick={() => {
                if (card.filter === 'all') {
                  if (hasFilters) onClearFilters()
                  return
                }
                onStatusChange(statusFilter === card.filter ? 'all' : card.filter)
              }}
            />
          ))}
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
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search workflow name, slug, or description…"
              className="h-10 w-full rounded-lg border border-border/70 bg-background py-2 pl-9 pr-16 text-sm outline-none transition placeholder:text-muted-foreground/75 hover:border-border focus:border-nesy/40 focus:ring-4 focus:ring-nesy-soft/30"
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

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {hasFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={onCreateClick}
              className="h-10 gap-1.5 bg-nesy px-4 text-sm text-white hover:bg-nesy-hover"
            >
              New Workflow
              <kbd className="hidden rounded-lg border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white/90 lg:inline">
                {createShortcutLabel}
              </kbd>
            </Button>
          </div>
        </div>

        {hasFilters || isSearchPending || isRefreshing ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-xs text-muted-foreground">Active view</span>
            <Badge variant="secondary" appearance="outline" size="sm">
              {isRefreshing
                ? 'Refreshing…'
                : isSearchPending
                  ? 'Updating…'
                  : `${filteredCount} of ${visibleCount} workflows`}
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
