'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Sparkles } from 'lucide-react'
import { FeatureRegistryHeader } from '@/components/automation/feature-registry/FeatureRegistryHeader'
import { cn } from '@nesy/metronic/lib/utils'
import { type Tone, toneIcon, toneIconBox } from '@/components/product/tones'

export type FeatureRegistryRow = {
  packKey: string
  version: string
  key: string
  title: string
  description: string | null
  tags: string[]
  owner: string | null
  invariantCount: number
  gatingInvariantCount: number
  screenCount: number
  workflowCount: number
}

function packTone(packKey: string): Tone {
  if (packKey.startsWith('nesy')) return 'nesy'
  if (packKey.startsWith('match')) return 'purple'
  return 'teal'
}

function FeatureCard({ row }: { row: FeatureRegistryRow }) {
  const visibleTags = row.tags.slice(0, 2)
  const hiddenTagCount = row.tags.length - visibleTags.length

  return (
    <Link
      href={`/automation/features/${encodeURIComponent(row.key)}`}
      className="group flex flex-col rounded-lg border border-border bg-card p-3 transition-colors hover:border-nesy-muted/80 hover:bg-muted/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nesy/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-nesy-ink">
            {row.title}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" title={row.key}>
            {row.key}
          </p>
        </div>
        <ChevronRight
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </div>

      {row.description ? (
        <p className="mt-1.5 line-clamp-1 text-xs leading-snug text-muted-foreground">
          {row.description}
        </p>
      ) : null}

      {row.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-border/80 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {hiddenTagCount > 0 ? (
            <span className="text-[9px] font-medium text-muted-foreground">+{hiddenTagCount}</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
        <span className="min-w-0 truncate tabular-nums">
          {row.invariantCount} inv
          {row.gatingInvariantCount > 0 ? ` · ${row.gatingInvariantCount} gate` : ''}
          {' · '}
          {row.screenCount} scr · {row.workflowCount} wf
        </span>
        <span className="shrink-0 font-mono text-[10px] font-medium tabular-nums text-foreground/70">
          v{row.version}
        </span>
      </div>
    </Link>
  )
}

export function FeatureRegistryView({ features }: { features: FeatureRegistryRow[] }) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activePack, setActivePack] = useState<string | null>(null)

  const packGroups = useMemo(() => {
    const groups = new Map<string, FeatureRegistryRow[]>()
    for (const row of features) {
      const current = groups.get(row.packKey) ?? []
      current.push(row)
      groups.set(row.packKey, current)
    }
    return [...groups.entries()]
      .map(([packKey, rows]) => ({
        packKey,
        version: rows[0]!.version,
        rows: rows.sort((left, right) => left.title.localeCompare(right.title)),
      }))
      .sort((left, right) => left.packKey.localeCompare(right.packKey))
  }, [features])

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return packGroups
      .filter((group) => !activePack || group.packKey === activePack)
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => {
          if (!query) return true
          return (
            row.title.toLowerCase().includes(query) ||
            row.key.toLowerCase().includes(query) ||
            row.packKey.toLowerCase().includes(query) ||
            row.version.toLowerCase().includes(query) ||
            row.description?.toLowerCase().includes(query) ||
            row.tags.some((tag) => tag.toLowerCase().includes(query)) ||
            row.owner?.toLowerCase().includes(query)
          )
        }),
      }))
      .filter((group) => group.rows.length > 0)
  }, [activePack, packGroups, searchQuery])

  const visibleCount = filteredGroups.reduce((total, group) => total + group.rows.length, 0)
  const totalCount = features.length
  const packCount = packGroups.length
  const hasFilters = Boolean(searchQuery || activePack)
  const totalInvariants = useMemo(
    () => features.reduce((total, row) => total + row.invariantCount, 0),
    [features],
  )
  const totalGatingInvariants = useMemo(
    () => features.reduce((total, row) => total + row.gatingInvariantCount, 0),
    [features],
  )
  const totalWorkflowRefs = useMemo(
    () => features.reduce((total, row) => total + row.workflowCount, 0),
    [features],
  )
  const uniqueTagCount = useMemo(
    () => new Set(features.flatMap((row) => row.tags)).size,
    [features],
  )
  const compactGroupHeader = packGroups.length === 1 && !hasFilters

  const clearFilters = () => {
    setSearchQuery('')
    setActivePack(null)
  }

  return (
    <div className="space-y-5">
      <FeatureRegistryHeader
        totalCount={totalCount}
        visibleCount={visibleCount}
        packCount={packCount}
        packGroups={packGroups.map((group) => ({
          packKey: group.packKey,
          version: group.version,
          featureCount: group.rows.length,
        }))}
        solePackRows={packGroups.length === 1 ? packGroups[0]!.rows : null}
        totalInvariants={totalInvariants}
        totalGatingInvariants={totalGatingInvariants}
        totalWorkflowRefs={totalWorkflowRefs}
        uniqueTagCount={uniqueTagCount}
        activePack={activePack}
        onPackChange={setActivePack}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={() => router.refresh()}
        onClearFilters={clearFilters}
        hasFilters={hasFilters}
      />

      {visibleCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <h3 className="text-lg font-semibold text-foreground">No features found</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? 'Try another search term or clear the active filters.'
              : 'No feature contracts are available in the latest published domain packs.'}
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
          {filteredGroups.map((group) => {
            const tone = packTone(group.packKey)

            return (
              <article
                key={group.packKey}
                className="overflow-hidden rounded-lg border border-border bg-card shadow-xs"
              >
                {!compactGroupHeader ? (
                  <header className="flex flex-col gap-3 border-b border-border/80 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          toneIconBox[tone],
                        )}
                      >
                        <Sparkles className={cn('size-4', toneIcon[tone])} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-foreground">
                          {group.packKey}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Latest published · v{group.version} · {group.rows.length} feature
                          {group.rows.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/automation/domain-packs/${encodeURIComponent(group.packKey)}?version=${encodeURIComponent(group.version)}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-nesy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-nesy-hover"
                    >
                      Open pack
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </header>
                ) : (
                  <div className="border-b border-border bg-muted/10 px-3 py-2">
                    <p className="text-xs font-semibold text-foreground">Feature contracts</p>
                  </div>
                )}

                <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.rows.map((row) => (
                    <FeatureCard key={`${row.packKey}:${row.key}`} row={row} />
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
