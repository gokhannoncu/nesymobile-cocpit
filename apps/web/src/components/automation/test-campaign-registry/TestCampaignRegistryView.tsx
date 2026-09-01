'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarRange, ChevronRight } from 'lucide-react'
import {
  TestCampaignRegistryHeader,
  type CampaignTraitFilter,
} from '@/components/automation/test-campaign-registry/TestCampaignRegistryHeader'
import { CampaignTypeBadge } from '@/components/automation/test-campaign/CampaignTypeBadge'
import type { TestCampaignCatalogItemApi } from '@/lib/verdict-runtime/types'
import {
  campaignGateResultBadgeClass,
  campaignStatusBadgeClass,
  campaignStatusRank,
  countCampaignsByType,
  sumCampaignCells,
  testCampaignDetailHref,
} from '@/lib/verdict-runtime/test-campaign-registry'
import { cn } from '@nesy/metronic/lib/utils'

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2 py-1.5', cellGrid)
const tdClass = cn('px-2 py-1.5 align-middle', cellGrid)

function StatusBadge({ status }: { status: string }) {
  return <span className={campaignStatusBadgeClass(status)}>{status}</span>
}

function GateResultBadge({ result }: { result: string }) {
  return (
    <span className={campaignGateResultBadgeClass(result)}>
      {result.replace(/_/g, ' ')}
    </span>
  )
}

function CampaignRow({ item, index }: { item: TestCampaignCatalogItemApi; index: number }) {
  const router = useRouter()
  const href = testCampaignDetailHref(item.campaignId)

  return (
    <tr
      onClick={() => router.push(href)}
      className={cn(
        'cursor-pointer transition-colors',
        index % 2 === 1 ? 'bg-muted/50 hover:bg-muted/65' : 'bg-card hover:bg-muted/35',
      )}
    >
      <td className={tdClass}>
        <CampaignTypeBadge type={item.campaignKey} />
      </td>
      <td className={tdClass}>
        <div className="text-[11px] font-semibold leading-tight text-foreground">{item.campaignId}</div>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">v{item.campaignVersion}</p>
      </td>
      <td className={tdClass}>
        <StatusBadge status={item.status} />
      </td>
      <td className={cn('hidden sm:table-cell', tdClass)}>
        <span className="tabular-nums text-[11px] font-semibold text-foreground">{item.cellCount}</span>
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <GateResultBadge result={item.releaseGateResult} />
      </td>
      <td className={cn('sm:hidden', tdClass)}>
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {item.cellCount} cells · {item.releaseGateResult.replace(/_/g, ' ')}
        </p>
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <Link
            href={href}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex w-12 cursor-pointer items-center justify-end gap-0.5 rounded-md py-0.5 text-[11px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
          >
            Open
            <ChevronRight className="size-3 shrink-0" />
          </Link>
        </div>
      </td>
    </tr>
  )
}

function formatCampaignSummary(items: readonly TestCampaignCatalogItemApi[]): string {
  const running = items.filter((item) => item.status === 'RUNNING').length
  const blocked = items.filter((item) => item.status === 'BLOCKED').length
  const cells = sumCampaignCells(items)
  return `${cells} cells · ${running} running · ${blocked} blocked`
}

function CampaignTypeGroupHeader({
  campaignKey,
  items,
  showTypeTitle,
}: {
  campaignKey: string
  items: TestCampaignCatalogItemApi[]
  showTypeTitle: boolean
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-muted/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {showTypeTitle ? campaignKey : 'Campaign catalog'}
        </p>
        <p className="text-xs text-muted-foreground">
          {items.length} campaign{items.length === 1 ? '' : 's'} · {formatCampaignSummary(items)}
        </p>
      </div>
    </div>
  )
}

function CampaignTypeGroupCard({
  campaignKey,
  items,
  showTypeTitle,
}: {
  campaignKey: string
  items: TestCampaignCatalogItemApi[]
  showTypeTitle: boolean
}) {
  const [expanded, setExpanded] = useState(items.length <= 12)
  const visibleItems = expanded ? items : items.slice(0, 12)
  const hiddenCount = items.length - visibleItems.length

  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <CampaignTypeGroupHeader
        campaignKey={campaignKey}
        items={items}
        showTypeTitle={showTypeTitle}
      />

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className={cn('w-24', thClass)}>Type</th>
              <th className={cn('min-w-[200px]', thClass)}>Campaign</th>
              <th className={cn('w-24', thClass)}>Status</th>
              <th className={cn('hidden w-16 sm:table-cell', thClass)}>Cells</th>
              <th className={cn('hidden w-28 md:table-cell', thClass)}>Gate</th>
              <th className={cn('sm:hidden', thClass)}>Summary</th>
              <th className={cn('w-16 text-right', thClass)}>Open</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item, index) => (
              <CampaignRow key={item.campaignId} item={item} index={index} />
            ))}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 ? (
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="cursor-pointer text-sm font-semibold text-nesy-ink underline-offset-2 hover:underline"
          >
            {expanded
              ? 'Show fewer campaigns'
              : `Show ${hiddenCount} more campaign${hiddenCount === 1 ? '' : 's'}`}
          </button>
        </div>
      ) : null}
    </article>
  )
}

function matchesTraitFilter(
  item: TestCampaignCatalogItemApi,
  filter: CampaignTraitFilter,
): boolean {
  if (filter === 'running') return item.status === 'RUNNING'
  if (filter === 'blocked') return item.status === 'BLOCKED'
  if (filter === 'gateFail') return item.releaseGateResult === 'FAIL'
  return true
}

export function TestCampaignRegistryView({ items }: { items: TestCampaignCatalogItemApi[] }) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTraitFilter, setActiveTraitFilter] = useState<CampaignTraitFilter>('all')
  const [activeType, setActiveType] = useState<string | null>(null)

  const runningCount = useMemo(
    () => items.filter((item) => item.status === 'RUNNING').length,
    [items],
  )
  const blockedCount = useMemo(
    () => items.filter((item) => item.status === 'BLOCKED').length,
    [items],
  )
  const gateFailCount = useMemo(
    () => items.filter((item) => item.releaseGateResult === 'FAIL').length,
    [items],
  )
  const totalCells = useMemo(() => sumCampaignCells(items), [items])
  const typeCounts = useMemo(() => countCampaignsByType(items), [items])

  const typeGroups = useMemo(() => {
    const groups = new Map<string, TestCampaignCatalogItemApi[]>()
    for (const item of items) {
      const current = groups.get(item.campaignKey) ?? []
      current.push(item)
      groups.set(item.campaignKey, current)
    }

    return [...groups.entries()]
      .map(([campaignKey, campaigns]) => ({
        campaignKey,
        campaigns: campaigns.sort((left, right) => {
          const statusOrder = campaignStatusRank(left.status) - campaignStatusRank(right.status)
          if (statusOrder !== 0) return statusOrder
          return left.campaignId.localeCompare(right.campaignId)
        }),
      }))
      .sort((left, right) => left.campaignKey.localeCompare(right.campaignKey))
  }, [items])

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return typeGroups
      .filter((group) => !activeType || group.campaignKey === activeType)
      .map((group) => ({
        ...group,
        campaigns: group.campaigns.filter((item) => {
          if (!matchesTraitFilter(item, activeTraitFilter)) return false
          if (!query) return true
          return (
            item.campaignId.toLowerCase().includes(query) ||
            item.campaignKey.toLowerCase().includes(query) ||
            item.campaignVersion.toLowerCase().includes(query) ||
            item.status.toLowerCase().includes(query) ||
            item.releaseGateResult.toLowerCase().includes(query)
          )
        }),
      }))
      .filter((group) => group.campaigns.length > 0)
  }, [activeTraitFilter, activeType, searchQuery, typeGroups])

  const visibleCount = filteredGroups.reduce((total, group) => total + group.campaigns.length, 0)
  const totalCount = items.length
  const hasFilters = Boolean(searchQuery || activeTraitFilter !== 'all' || activeType)
  const showTypeTitleInGroups = typeGroups.length > 1 || hasFilters

  const clearFilters = () => {
    setSearchQuery('')
    setActiveTraitFilter('all')
    setActiveType(null)
  }

  return (
    <div className="space-y-5">
      <TestCampaignRegistryHeader
        totalCount={totalCount}
        visibleCount={visibleCount}
        totalCells={totalCells}
        runningCount={runningCount}
        blockedCount={blockedCount}
        gateFailCount={gateFailCount}
        typeCounts={typeCounts}
        activeTraitFilter={activeTraitFilter}
        onTraitFilterChange={setActiveTraitFilter}
        activeType={activeType}
        onTypeChange={setActiveType}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={() => router.refresh()}
        onClearFilters={clearFilters}
        hasFilters={hasFilters}
      />

      {visibleCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <CalendarRange className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">No test campaigns found</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? 'Try another search term or clear the active filters.'
              : 'The Verdict runtime returned an empty campaign catalog.'}
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
            <CampaignTypeGroupCard
              key={group.campaignKey}
              campaignKey={group.campaignKey}
              items={group.campaigns}
              showTypeTitle={showTypeTitleInGroups}
            />
          ))}
        </div>
      )}
    </div>
  )
}
