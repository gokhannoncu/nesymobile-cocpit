'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Network } from 'lucide-react'
import {
  CoverageGraphHeader,
  type CoverageHealthFilter,
} from '@/components/automation/coverage-graph/CoverageGraphHeader'
import {
  componentCount,
  coverageChainComplete,
  coverageChainStatusTone,
  coverageGapLayers,
  coverageLayerLabel,
  coverageScore,
  sumCoverageTotals,
  type CoverageGraphCounts,
} from '@/lib/verdict-runtime/coverage-graph'
import { cn } from '@nesy/metronic/lib/utils'

export type CoverageGraphRow = CoverageGraphCounts & {
  packKey: string
  version: string
  displayName: string | null
}

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2 py-1.5', cellGrid)
const tdClass = cn('px-2 py-1.5 align-middle', cellGrid)

const chainBadgeBase =
  'inline-flex rounded-[4px] border px-1.5 py-px text-[8px] font-bold uppercase tracking-wide leading-none'

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

function CountCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        'tabular-nums text-[11px] font-semibold',
        value > 0 ? 'text-foreground' : 'text-muted-foreground/60',
      )}
    >
      {value}
    </span>
  )
}

function CoverageMiniBar({ row }: { row: CoverageGraphRow }) {
  const segments = [
    row.features > 0,
    componentCount(row) > 0,
    row.evidence > 0,
    row.tests > 0,
  ]

  return (
    <div className="flex gap-0.5" aria-hidden>
      {segments.map((filled, index) => (
        <span
          key={index}
          className={cn('h-1 flex-1 rounded-[3px]', filled ? 'bg-nesy/75' : 'bg-muted')}
        />
      ))}
    </div>
  )
}

function chainStatusBadgeClass(tone: ReturnType<typeof coverageChainStatusTone>): string {
  switch (tone) {
    case 'complete':
      return cn(chainBadgeBase, 'border-nesy/30 bg-nesy-soft text-nesy-ink')
    case 'critical':
      return cn(chainBadgeBase, 'border-border bg-muted/40 text-muted-foreground')
    default:
      return cn(
        chainBadgeBase,
        'border-nesy-muted/70 bg-nesy-muted/25 text-nesy-ink dark:border-nesy/25 dark:bg-nesy-soft/10',
      )
  }
}

function ChainStatusBadge({ row }: { row: CoverageGraphRow }) {
  const complete = coverageChainComplete(row)
  const gaps = coverageGapLayers(row)
  const tone = coverageChainStatusTone(complete, gaps.length)

  return (
    <div className="space-y-1">
      <span className={chainStatusBadgeClass(tone)}>
        {complete ? 'Complete' : `${gaps.length} gap${gaps.length === 1 ? '' : 's'}`}
      </span>
      {!complete ? (
        <p className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">
          Missing {gaps.map((layer) => coverageLayerLabel(layer)).join(', ')}
        </p>
      ) : (
        <p className="text-[9px] text-muted-foreground">
          {coverageScore(row)}% · {row.releaseGateTests > 0 ? `${row.releaseGateTests} gate` : 'all layers'}
        </p>
      )}
      <CoverageMiniBar row={row} />
    </div>
  )
}

function CoverageGraphTableRow({ row, index }: { row: CoverageGraphRow; index: number }) {
  const router = useRouter()
  const href = packDetailHref(row.packKey, row.version)

  return (
    <tr
      onClick={() => router.push(href)}
      className={cn(
        'cursor-pointer transition-colors',
        index % 2 === 1 ? 'bg-muted/50 hover:bg-muted/65' : 'bg-card hover:bg-muted/35',
      )}
    >
      <td className={tdClass}>
        <div className="text-[11px] font-semibold leading-tight text-foreground">{row.packKey}</div>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          v{row.version}
          {row.displayName && row.displayName !== row.packKey ? ` · ${row.displayName}` : ''}
        </p>
      </td>
      <td className={cn('hidden sm:table-cell', tdClass)}>
        <CountCell value={row.features} />
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <CountCell value={row.screens} />
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <CountCell value={row.surfaces} />
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <CountCell value={row.targets} />
      </td>
      <td className={cn('hidden lg:table-cell', tdClass)}>
        <CountCell value={row.evidence} />
      </td>
      <td className={cn('hidden lg:table-cell', tdClass)}>
        <div className="flex items-baseline gap-1">
          <CountCell value={row.tests} />
          {row.releaseGateTests > 0 ? (
            <span className="rounded-[4px] border border-nesy/25 bg-nesy-soft px-1 py-px text-[8px] font-bold uppercase tracking-wide text-nesy-ink">
              {row.releaseGateTests} gate
            </span>
          ) : null}
        </div>
      </td>
      <td className={cn('sm:hidden', tdClass)}>
        <p className="text-[9px] tabular-nums text-muted-foreground">
          {row.features} feat · {componentCount(row)} cmp · {row.evidence} ev · {row.tests} test
        </p>
      </td>
      <td className={tdClass}>
        <ChainStatusBadge row={row} />
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <Link
            href={href}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex w-12 cursor-pointer items-center justify-end gap-0.5 rounded-[8px] py-0.5 text-[10px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
          >
            Open
            <ChevronRight className="size-3 shrink-0" />
          </Link>
        </div>
      </td>
    </tr>
  )
}

function matchesHealthFilter(row: CoverageGraphRow, filter: CoverageHealthFilter): boolean {
  if (filter === 'complete') return coverageChainComplete(row)
  if (filter === 'gaps') return !coverageChainComplete(row)
  return true
}

export function CoverageGraphView({ rows }: { rows: CoverageGraphRow[] }) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeHealthFilter, setActiveHealthFilter] = useState<CoverageHealthFilter>('all')
  const [activePack, setActivePack] = useState<string | null>(null)

  const completeCount = useMemo(
    () => rows.filter((row) => coverageChainComplete(row)).length,
    [rows],
  )
  const gapCount = rows.length - completeCount
  const totals = useMemo(() => sumCoverageTotals(rows), [rows])

  const packGroups = useMemo(
    () =>
      rows
        .map((row) => ({ packKey: row.packKey, version: row.version }))
        .sort((left, right) => left.packKey.localeCompare(right.packKey)),
    [rows],
  )

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return rows
      .filter((row) => {
        if (activePack && row.packKey !== activePack) return false
        if (!matchesHealthFilter(row, activeHealthFilter)) return false
        if (!query) return true
        return (
          row.packKey.toLowerCase().includes(query) ||
          row.version.toLowerCase().includes(query) ||
          row.displayName?.toLowerCase().includes(query)
        )
      })
      .sort((left, right) => {
        const gapOrder = coverageGapLayers(left).length - coverageGapLayers(right).length
        if (gapOrder !== 0) return gapOrder
        return left.packKey.localeCompare(right.packKey)
      })
  }, [activeHealthFilter, activePack, rows, searchQuery])

  const hasFilters = Boolean(searchQuery || activeHealthFilter !== 'all' || activePack)
  const familyCount = rows.length
  const visibleCount = filteredRows.length

  const clearFilters = () => {
    setSearchQuery('')
    setActiveHealthFilter('all')
    setActivePack(null)
  }

  return (
    <div className="space-y-5">
      <CoverageGraphHeader
        familyCount={familyCount}
        visibleCount={visibleCount}
        completeCount={completeCount}
        gapCount={gapCount}
        totals={totals}
        packGroups={packGroups}
        activeHealthFilter={activeHealthFilter}
        onHealthFilterChange={setActiveHealthFilter}
        activePack={activePack}
        onPackChange={setActivePack}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={() => router.refresh()}
        onClearFilters={clearFilters}
        hasFilters={hasFilters}
      />

      {visibleCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[8px] border border-dashed border-border bg-card px-6 py-16 text-center">
          <Network className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">No coverage rows found</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? 'Try another search term or clear the active filters.'
              : 'No published domain packs are available to graph.'}
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
        <article className="overflow-hidden rounded-[8px] border border-border bg-card">
          <div className="flex flex-col gap-1 border-b border-border bg-muted/10 px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground">Family coverage matrix</p>
              <p className="text-[11px] text-muted-foreground">
                {visibleCount} famil{visibleCount === 1 ? 'y' : 'ies'} · {completeCount} complete ·{' '}
                {gapCount} with gaps
              </p>
            </div>
            <p className="text-[9px] text-muted-foreground">Sorted by gap severity, then pack key</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-muted/40 text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className={cn('min-w-[160px]', thClass)}>Family</th>
                  <th className={cn('hidden w-16 sm:table-cell', thClass)}>Features</th>
                  <th className={cn('hidden w-16 md:table-cell', thClass)}>Screens</th>
                  <th className={cn('hidden w-16 md:table-cell', thClass)}>Surfaces</th>
                  <th className={cn('hidden w-16 md:table-cell', thClass)}>Targets</th>
                  <th className={cn('hidden w-16 lg:table-cell', thClass)}>Evidence</th>
                  <th className={cn('hidden w-20 lg:table-cell', thClass)}>Tests</th>
                  <th className={cn('sm:hidden', thClass)}>Counts</th>
                  <th className={cn('min-w-[120px]', thClass)}>Chain</th>
                  <th className={cn('w-16 text-right', thClass)}>Open</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <CoverageGraphTableRow key={`${row.packKey}@${row.version}`} row={row} index={index} />
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </div>
  )
}
