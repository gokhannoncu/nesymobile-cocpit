'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, Package, RefreshCw } from 'lucide-react'
import { DomainPackFamilyStrip } from '@/components/automation/domain-pack/DomainPackFamilyStrip'
import { fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import type {
  DomainPackCatalogApi,
  DomainPackState,
  DomainPackSummary,
} from '@/lib/verdict-runtime/types'
import {
  formatPackPublishedAt,
  groupDomainPackCatalog,
  truncateDigest,
} from '@/lib/verdict-runtime/domain-pack-catalog'
import { DomainPackCatalogHeader } from '@/components/automation/domain-pack/DomainPackCatalogHeader'
import { DomainPackStateBadge } from '@/components/automation/domain-pack/DomainPackStateBadge'
import { DomainPackCatalogPageShimmer } from '@/components/automation/domain-pack/domain-pack-catalog-shimmer'
import { ProductPage } from '@/components/product'
import { Button } from '@nesy/metronic/components/ui/button'
import { cn } from '@nesy/metronic/lib/utils'

function packDetailHref(pack: Pick<DomainPackSummary, 'packKey' | 'version'>): string {
  return `/automation/domain-packs/${encodeURIComponent(pack.packKey)}?version=${encodeURIComponent(pack.version)}`
}

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2.5 py-1.5', cellGrid)
const tdClass = cn('px-2.5 py-1.5 align-middle', cellGrid)

function DomainPackGroupCard({
  packKey,
  versions,
  latestPublished,
  compactHeader = false,
}: {
  packKey: string
  versions: DomainPackSummary[]
  latestPublished?: DomainPackSummary
  compactHeader?: boolean
}) {
  const [expanded, setExpanded] = useState(versions.length <= 6)
  const visibleVersions = expanded ? versions : versions.slice(0, 3)
  const hiddenCount = versions.length - visibleVersions.length

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <DomainPackFamilyStrip
        packKey={packKey}
        versions={versions}
        latestPublished={latestPublished}
        variant={compactHeader ? 'compact' : 'card'}
      />

      <div className="overflow-x-auto border-t border-border">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className={thClass}>Version</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Revision</th>
              <th className={thClass}>Published</th>
              <th className={cn('hidden lg:table-cell', thClass)}>Digest</th>
              <th className={cn('w-16 text-right', thClass)}>Open</th>
            </tr>
          </thead>
          <tbody>
            {visibleVersions.map((version, index) => {
              const isLatest = index === 0
              const publishedLabel = formatPackPublishedAt(version.publishedAt)

              return (
                <tr
                  key={`${version.packKey}-${version.version}-${version.revision}`}
                  className={cn(
                    'transition-colors',
                    isLatest
                      ? 'bg-nesy-soft/30 hover:bg-nesy-soft/40'
                      : index % 2 === 1
                        ? 'bg-muted/50 hover:bg-muted/65'
                        : 'bg-card hover:bg-muted/35',
                  )}
                >
                  <td className={tdClass}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold tabular-nums text-foreground">
                        v{version.version}
                      </span>
                      {isLatest ? (
                        <span className="rounded-md bg-nesy/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-nesy-ink">
                          Latest
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className={tdClass}>
                    <DomainPackStateBadge state={version.publicationState} />
                  </td>
                  <td className={cn(tdClass, 'tabular-nums text-muted-foreground')}>
                    {version.revision}
                  </td>
                  <td
                    className={cn(tdClass, 'whitespace-nowrap tabular-nums text-foreground')}
                    title={version.publishedAt}
                  >
                    {publishedLabel ?? '—'}
                  </td>
                  <td className={cn('hidden lg:table-cell', tdClass)}>
                    <code
                      className="rounded-md border border-border bg-muted/40 px-1 py-px font-mono text-[10px] text-muted-foreground"
                      title={version.bundleDigest}
                    >
                      {truncateDigest(version.bundleDigest)}
                    </code>
                  </td>
                  <td className={tdClass}>
                    <div className="flex justify-end">
                      <Link
                        href={packDetailHref(version)}
                        className="inline-flex w-12 cursor-pointer items-center justify-end gap-0.5 rounded-md py-0.5 text-[11px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
                      >
                        View
                        <ChevronRight className="size-3 shrink-0" />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
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
            {expanded ? 'Show fewer versions' : `Show ${hiddenCount} older version${hiddenCount === 1 ? '' : 's'}`}
          </button>
        </div>
      ) : null}
    </article>
  )
}

export default function DomainPacksCatalogPage() {
  const [data, setData] = useState<DomainPackCatalogApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activePack, setActivePack] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<DomainPackState | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchVerdictDomainPacks()
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load domain packs'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const allPackGroups = useMemo(
    () => groupDomainPackCatalog(data?.items ?? []),
    [data],
  )

  const statusCounts = useMemo(() => {
    const counts: Record<DomainPackState, number> = { PUBLISHED: 0, DRAFT: 0, ARCHIVED: 0 }
    for (const item of data?.items ?? []) counts[item.publicationState] += 1
    return counts
  }, [data])

  const groups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const items =
      data?.items.filter((item) => {
        if (activePack && item.packKey !== activePack) return false
        if (activeStatus && item.publicationState !== activeStatus) return false
        if (!query) return true
        return (
          item.packKey.toLowerCase().includes(query) ||
          item.version.toLowerCase().includes(query) ||
          item.bundleDigest.toLowerCase().includes(query)
        )
      }) ?? []

    return groupDomainPackCatalog(items)
  }, [activePack, activeStatus, data, searchQuery])

  const totalVersions = data?.items.length ?? 0
  const totalPacks = allPackGroups.length
  const visibleVersions = groups.reduce((total, group) => total + group.versions.length, 0)
  const hasFilters = Boolean(searchQuery || activePack || activeStatus)
  const compactGroupHeader =
    allPackGroups.length === 1 && groups.length === 1 && !hasFilters

  const clearFilters = () => {
    setSearchQuery('')
    setActivePack(null)
    setActiveStatus(null)
  }

  return (
    <ProductPage path="/automation/domain-packs" hideToolbar>
      {loading ? (
        <DomainPackCatalogPageShimmer />
      ) : (
        <div className="space-y-5">
          <DomainPackCatalogHeader
            totalPacks={totalPacks}
            totalVersions={totalVersions}
            visibleVersions={visibleVersions}
            statusCounts={statusCounts}
            activeStatus={activeStatus}
            onStatusChange={setActiveStatus}
            allPackGroups={allPackGroups}
            activePack={activePack}
            onPackChange={setActivePack}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={() => void loadData()}
            onClearFilters={clearFilters}
            hasFilters={hasFilters}
          />

      {error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="mb-4 size-10 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Failed to load domain packs</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{error.message}</p>
          <Button onClick={() => void loadData()} variant="outline" className="mt-4 gap-2">
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <Package className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">No domain packs found</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? 'Try another search term or clear the active filters.'
              : 'No domain packs are currently available in the runtime.'}
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
          {groups.map((group) => (
            <DomainPackGroupCard
              key={group.packKey}
              packKey={group.packKey}
              versions={group.versions}
              latestPublished={group.latestPublished}
              compactHeader={compactGroupHeader}
            />
          ))}
        </div>
      )}
        </div>
      )}
    </ProductPage>
  )
}
