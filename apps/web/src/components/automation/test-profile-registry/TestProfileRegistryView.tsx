'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, FlaskConical } from 'lucide-react'
import {
  TestProfileRegistryHeader,
  type TestProfileTraitFilter,
} from '@/components/automation/test-profile-registry/TestProfileRegistryHeader'
import { TestProfileKindBadge } from '@/components/automation/test-profile/TestProfileKindBadge'
import type { TestProfileCatalogItemApi } from '@/lib/verdict-runtime/types'
import {
  countProfilesByKind,
  testProfileDetailHref,
  testProfileIsBlocked,
  testProfileResultTone,
  type TestProfileKind,
} from '@/lib/verdict-runtime/test-profile-registry'
import { cn } from '@nesy/metronic/lib/utils'
import { toneIconBox, toneText } from '@/components/product/tones'

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2.5 py-1.5', cellGrid)
const tdClass = cn('px-2.5 py-1.5 align-middle', cellGrid)

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

const profileTraitBadgeClass =
  'inline-flex rounded-[4px] border border-current/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide leading-none'

function ResultBadge({
  item,
}: {
  item: Pick<TestProfileCatalogItemApi, 'lastResult' | 'blockedReason'>
}) {
  if (testProfileIsBlocked(item)) {
    return (
      <span
        className={cn(profileTraitBadgeClass, toneIconBox.amber, toneText.amber)}
        title={item.blockedReason ?? undefined}
      >
        Blocked
      </span>
    )
  }

  const tone = testProfileResultTone(item.lastResult)

  return (
    <span className={cn(profileTraitBadgeClass, toneIconBox[tone], toneText[tone])}>
      {item.lastResult}
    </span>
  )
}

function GateBadge({ releaseGate }: { releaseGate: boolean }) {
  if (!releaseGate) {
    return <span className="text-[10px] text-muted-foreground">—</span>
  }

  return (
    <span className={cn(profileTraitBadgeClass, toneIconBox.teal, toneText.teal)}>
      Gate
    </span>
  )
}

function TestProfileRow({ item, index }: { item: TestProfileCatalogItemApi; index: number }) {
  const router = useRouter()
  const href = testProfileDetailHref(item.profileKey)

  return (
    <tr
      onClick={() => router.push(href)}
      className={cn(
        'cursor-pointer transition-colors',
        index % 2 === 1 ? 'bg-muted/50 hover:bg-muted/65' : 'bg-card hover:bg-muted/35',
      )}
    >
      <td className={tdClass}>
        <TestProfileKindBadge kind={item.kind} />
      </td>
      <td className={tdClass}>
        <div className="text-xs font-semibold leading-tight text-foreground">{item.profileKey}</div>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">v{item.version}</p>
      </td>
      <td className={tdClass}>
        <ResultBadge item={item} />
        {item.blockedReason ? (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground" title={item.blockedReason}>
            {item.blockedReason}
          </p>
        ) : null}
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <GateBadge releaseGate={item.releaseGate} />
      </td>
      <td className={cn('hidden lg:table-cell', tdClass)}>
        <span className="text-xs text-foreground">{item.owner || '—'}</span>
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <Link
            href={href}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex w-12 cursor-pointer items-center justify-end gap-0.5 rounded-[8px] py-0.5 text-[11px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
          >
            Open
            <ChevronRight className="size-3 shrink-0" />
          </Link>
        </div>
      </td>
    </tr>
  )
}

function formatProfileSummary(items: readonly TestProfileCatalogItemApi[]): string {
  const gates = items.filter((item) => item.releaseGate).length
  const blocked = items.filter((item) => testProfileIsBlocked(item)).length
  const kinds = new Set(items.map((item) => item.kind))
  return `${gates} gate · ${blocked} blocked · ${kinds.size} kind${kinds.size === 1 ? '' : 's'}`
}

function PackGroupHeader({
  packKey,
  packVersion,
  items,
  showPackTitle,
}: {
  packKey: string
  packVersion: string
  items: TestProfileCatalogItemApi[]
  showPackTitle: boolean
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-muted/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {showPackTitle ? packKey : 'Test profile catalog'}
        </p>
        <p className="text-xs text-muted-foreground">
          {showPackTitle ? (
            <>
              v{packVersion} · {items.length} profile{items.length === 1 ? '' : 's'} ·{' '}
              {formatProfileSummary(items)}
            </>
          ) : (
            <>
              {items.length} profile{items.length === 1 ? '' : 's'} · {formatProfileSummary(items)}
            </>
          )}
        </p>
      </div>
      <Link
        href={packDetailHref(packKey, packVersion)}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-semibold text-nesy-ink transition hover:underline"
      >
        Open pack
        <ChevronRight className="size-3.5" />
      </Link>
    </div>
  )
}

function TestProfilePackGroupCard({
  packKey,
  packVersion,
  items,
  showPackTitle,
}: {
  packKey: string
  packVersion: string
  items: TestProfileCatalogItemApi[]
  showPackTitle: boolean
}) {
  const [expanded, setExpanded] = useState(items.length <= 12)
  const visibleItems = expanded ? items : items.slice(0, 12)
  const hiddenCount = items.length - visibleItems.length

  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <PackGroupHeader
        packKey={packKey}
        packVersion={packVersion}
        items={items}
        showPackTitle={showPackTitle}
      />

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className={cn('w-24', thClass)}>Kind</th>
              <th className={cn('min-w-[180px]', thClass)}>Profile</th>
              <th className={cn('w-28', thClass)}>Result</th>
              <th className={cn('hidden w-20 md:table-cell', thClass)}>Gate</th>
              <th className={cn('hidden lg:table-cell', thClass)}>Owner</th>
              <th className={cn('w-16 text-right', thClass)}>Open</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item, index) => (
              <TestProfileRow
                key={`${item.profileKey}@${item.version}`}
                item={item}
                index={index}
              />
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
              ? 'Show fewer profiles'
              : `Show ${hiddenCount} more profile${hiddenCount === 1 ? '' : 's'}`}
          </button>
        </div>
      ) : null}
    </article>
  )
}

function matchesSearch(item: TestProfileCatalogItemApi, query: string): boolean {
  if (!query) return true
  const normalized = query.toLowerCase()
  return (
    item.profileKey.toLowerCase().includes(normalized) ||
    item.owner.toLowerCase().includes(normalized) ||
    item.packKey.toLowerCase().includes(normalized) ||
    item.packVersion.toLowerCase().includes(normalized) ||
    item.kind.toLowerCase().includes(normalized) ||
    item.lastResult.toLowerCase().includes(normalized) ||
    item.blockedReason?.toLowerCase().includes(normalized)
  )
}

function filterProfilesForUi(
  items: readonly TestProfileCatalogItemApi[],
  {
    traitFilter,
    kind,
    pack,
    searchQuery,
  }: {
    traitFilter: TestProfileTraitFilter
    kind: TestProfileKind | null
    pack: string | null
    searchQuery: string
  },
): TestProfileCatalogItemApi[] {
  const query = searchQuery.trim()

  return items.filter((item) => {
    if (!matchesTraitFilter(item, traitFilter)) return false
    if (kind && item.kind !== kind) return false
    if (pack && item.packKey !== pack) return false
    if (!matchesSearch(item, query)) return false
    return true
  })
}

function buildPackGroups(items: readonly TestProfileCatalogItemApi[]) {
  const groups = new Map<string, TestProfileCatalogItemApi[]>()
  for (const item of items) {
    const current = groups.get(item.packKey) ?? []
    current.push(item)
    groups.set(item.packKey, current)
  }

  return [...groups.entries()]
    .map(([packKey, profiles]) => ({
      packKey,
      packVersion: profiles[0]!.packVersion,
      profiles: profiles.sort((left, right) => left.profileKey.localeCompare(right.profileKey)),
    }))
    .sort((left, right) => {
      const countDelta = right.profiles.length - left.profiles.length
      if (countDelta !== 0) return countDelta
      return left.packKey.localeCompare(right.packKey)
    })
}

function matchesTraitFilter(
  item: TestProfileCatalogItemApi,
  filter: TestProfileTraitFilter,
): boolean {
  if (filter === 'releaseGate') return item.releaseGate
  if (filter === 'blocked') return testProfileIsBlocked(item)
  if (filter === 'notRun') return item.lastResult === 'NOT_RUN' && !testProfileIsBlocked(item)
  return true
}

export function TestProfileRegistryView({
  items,
  partial,
}: {
  items: TestProfileCatalogItemApi[]
  partial: boolean
}) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTraitFilter, setActiveTraitFilter] = useState<TestProfileTraitFilter>('all')
  const [activeKind, setActiveKind] = useState<TestProfileKind | null>(null)
  const [activePack, setActivePack] = useState<string | null>(null)

  const traitBaseItems = useMemo(
    () =>
      filterProfilesForUi(items, {
        traitFilter: 'all',
        kind: activeKind,
        pack: activePack,
        searchQuery,
      }),
    [activeKind, activePack, items, searchQuery],
  )

  const releaseGateCount = useMemo(
    () => traitBaseItems.filter((item) => item.releaseGate).length,
    [traitBaseItems],
  )
  const blockedCount = useMemo(
    () => traitBaseItems.filter((item) => testProfileIsBlocked(item)).length,
    [traitBaseItems],
  )
  const notRunCount = useMemo(
    () =>
      traitBaseItems.filter(
        (item) => item.lastResult === 'NOT_RUN' && !testProfileIsBlocked(item),
      ).length,
    [traitBaseItems],
  )

  const kindCountsForFilters = useMemo(
    () =>
      countProfilesByKind(
        filterProfilesForUi(items, {
          traitFilter: activeTraitFilter,
          kind: null,
          pack: activePack,
          searchQuery,
        }),
      ),
    [activePack, activeTraitFilter, items, searchQuery],
  )

  const catalogPackGroups = useMemo(() => buildPackGroups(items), [items])

  const packGroupsForFilters = useMemo(
    () =>
      buildPackGroups(
        filterProfilesForUi(items, {
          traitFilter: activeTraitFilter,
          kind: activeKind,
          pack: null,
          searchQuery,
        }),
      ),
    [activeKind, activeTraitFilter, items, searchQuery],
  )

  const filteredGroups = useMemo(
    () =>
      buildPackGroups(
        filterProfilesForUi(items, {
          traitFilter: activeTraitFilter,
          kind: activeKind,
          pack: activePack,
          searchQuery,
        }),
      ),
    [activeKind, activePack, activeTraitFilter, items, searchQuery],
  )

  const visibleCount = filteredGroups.reduce((total, group) => total + group.profiles.length, 0)
  const totalCount = items.length
  const packCount = catalogPackGroups.length
  const hasFilters = Boolean(
    searchQuery || activeTraitFilter !== 'all' || activeKind || activePack,
  )
  const showPackTitleInGroups = catalogPackGroups.length > 1 || hasFilters

  const clearFilters = () => {
    setSearchQuery('')
    setActiveTraitFilter('all')
    setActiveKind(null)
    setActivePack(null)
  }

  return (
    <div className="space-y-5">
      <TestProfileRegistryHeader
        totalCount={totalCount}
        visibleCount={visibleCount}
        packCount={packCount}
        releaseGateCount={releaseGateCount}
        blockedCount={blockedCount}
        notRunCount={notRunCount}
        kindCounts={kindCountsForFilters}
        packGroups={packGroupsForFilters.map((group) => ({
          packKey: group.packKey,
          packVersion: group.packVersion,
          profileCount: group.profiles.length,
        }))}
        activeTraitFilter={activeTraitFilter}
        onTraitFilterChange={setActiveTraitFilter}
        activeKind={activeKind}
        onKindChange={setActiveKind}
        activePack={activePack}
        onPackChange={setActivePack}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={() => router.refresh()}
        onClearFilters={clearFilters}
        hasFilters={hasFilters}
        partial={partial}
      />

      {visibleCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[8px] border border-dashed border-border bg-card px-6 py-16 text-center">
          <FlaskConical className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">No test profiles found</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? 'Try another search term or clear the active filters.'
              : 'The Verdict runtime returned an empty profile catalog.'}
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
            <TestProfilePackGroupCard
              key={group.packKey}
              packKey={group.packKey}
              packVersion={group.packVersion}
              items={group.profiles}
              showPackTitle={showPackTitleInGroups}
            />
          ))}
        </div>
      )}
    </div>
  )
}
