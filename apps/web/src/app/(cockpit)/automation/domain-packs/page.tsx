'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, Package, RefreshCw, Search } from 'lucide-react'
import { fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import type { DomainPackCatalogApi, DomainPackSummary } from '@/lib/verdict-runtime/types'
import {
  formatPackPublishedAt,
  groupDomainPackCatalog,
  truncateDigest,
} from '@/lib/verdict-runtime/domain-pack-catalog'
import { DomainPackStateBadge } from '@/components/automation/domain-pack/DomainPackStateBadge'
import { ProductPage } from '@/components/product'
import { Button } from '@nesy/metronic/components/ui/button'
import { cn } from '@nesy/metronic/lib/utils'

function packDetailHref(pack: Pick<DomainPackSummary, 'packKey' | 'version'>): string {
  return `/automation/domain-packs/${encodeURIComponent(pack.packKey)}?version=${encodeURIComponent(pack.version)}`
}

function DomainPackGroupCard({
  packKey,
  versions,
  latestPublished,
}: {
  packKey: string
  versions: DomainPackSummary[]
  latestPublished?: DomainPackSummary
}) {
  const [expanded, setExpanded] = useState(versions.length <= 6)
  const visibleVersions = expanded ? versions : versions.slice(0, 3)
  const hiddenCount = versions.length - visibleVersions.length

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex flex-col gap-3 border-b border-border/80 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-nesy-soft text-nesy-ink">
              <Package className="size-4" strokeWidth={2.2} />
            </div>
            <h2 className="truncate text-lg font-semibold tracking-[-0.02em] text-foreground">
              {packKey}
            </h2>
            {latestPublished ? (
              <DomainPackStateBadge state={latestPublished.publicationState} />
            ) : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {versions.length} version{versions.length === 1 ? '' : 's'}
            {latestPublished ? (
              <>
                {' '}
                · Latest published{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  v{latestPublished.version}
                </span>
              </>
            ) : null}
          </p>
        </div>

        {latestPublished ? (
          <Button size="sm" className="shrink-0 bg-nesy text-white hover:bg-nesy-hover" asChild>
            <Link href={packDetailHref(latestPublished)}>
              Open latest
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="shrink-0" asChild>
            <Link href={packDetailHref(versions[0]!)}>
              Open pack
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Revision</th>
              <th className="hidden px-4 py-3 md:table-cell">Published</th>
              <th className="hidden px-4 py-3 lg:table-cell">Digest</th>
              <th className="px-4 py-3 text-right">Open</th>
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
                    'border-b border-border/50 transition-colors last:border-b-0',
                    isLatest ? 'bg-nesy-soft/10' : 'hover:bg-muted/30',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums text-foreground">
                        v{version.version}
                      </span>
                      {isLatest ? (
                        <span className="rounded-full bg-nesy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nesy-ink">
                          Latest
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <DomainPackStateBadge state={version.publicationState} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {version.revision}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {publishedLabel ?? '—'}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <code
                      className="rounded bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground"
                      title={version.bundleDigest}
                    >
                      {truncateDigest(version.bundleDigest)}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={packDetailHref(version)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
                    >
                      View
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 ? (
        <div className="border-t border-border/70 px-4 py-3">
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

  const groups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const items =
      data?.items.filter((item) => {
        if (!query) return true
        return (
          item.packKey.toLowerCase().includes(query) ||
          item.version.toLowerCase().includes(query) ||
          item.bundleDigest.toLowerCase().includes(query)
        )
      }) ?? []

    return groupDomainPackCatalog(items)
  }, [data, searchQuery])

  const totalVersions = data?.items.length ?? 0

  return (
    <ProductPage path="/automation/domain-packs">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {loading
              ? 'Loading catalog…'
              : `${groups.length} pack${groups.length === 1 ? '' : 's'} · ${totalVersions} version${totalVersions === 1 ? '' : 's'} total`}
          </p>
        </div>

        <div className="relative w-full lg:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search pack, version, or digest…"
            className="h-10 w-full cursor-text rounded-md border border-transparent bg-muted/35 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/75 hover:bg-muted/50 focus:border-nesy/40 focus:bg-card focus:ring-4 focus:ring-nesy-soft/30"
            type="search"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-xl border border-border bg-muted/30"
              aria-hidden
            />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="mb-4 size-10 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Failed to load domain packs</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{error.message}</p>
          <Button onClick={() => void loadData()} variant="outline" className="mt-4 gap-2">
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Package className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">No domain packs found</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {searchQuery
              ? 'Try another search term or clear the filter.'
              : 'No domain packs are currently available in the runtime.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {groups.map((group) => (
            <DomainPackGroupCard
              key={group.packKey}
              packKey={group.packKey}
              versions={group.versions}
              latestPublished={group.latestPublished}
            />
          ))}
        </div>
      )}
    </ProductPage>
  )
}
