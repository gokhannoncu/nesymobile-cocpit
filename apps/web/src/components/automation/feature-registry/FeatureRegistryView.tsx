'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, ShieldCheck, Sparkles } from 'lucide-react'
import { FeatureRegistryHeader } from '@/components/automation/feature-registry/FeatureRegistryHeader'
import { cn } from '@nesy/metronic/lib/utils'
import { type Tone, toneCard, toneIcon, toneIconBox, toneText } from '@/components/product/tones'

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
  const tone = packTone(row.packKey)

  return (
    <Link
      href={`/automation/features/${encodeURIComponent(row.key)}`}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-lg border shadow-xs transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nesy/40 dark:hover:shadow-black/30',
        toneCard[tone],
      )}
    >
      <div
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          tone === 'nesy' ? 'bg-nesy' : tone === 'purple' ? 'bg-purple-500' : 'bg-teal-500',
        )}
      />

      <div className="flex flex-1 flex-col p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-black/5',
              toneIconBox[tone],
            )}
          >
            <Sparkles className={cn('size-4.5', toneIcon[tone])} strokeWidth={2.2} />
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
            aria-hidden
          />
        </div>

        <div className="mt-3 min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug tracking-[-0.01em] text-foreground">
            {row.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground/80">
            {row.description ??
              'Executable feature contract from the published domain pack — open for invariants, workflows, and capability bindings.'}
          </p>

          {row.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {row.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    'rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    toneIconBox[tone],
                    toneText[tone],
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <code
            className="mt-3 block truncate rounded-lg border border-border/60 bg-background/90 px-2.5 py-1.5 font-mono text-[11px] font-medium text-foreground"
            title={row.key}
          >
            {row.key}
          </code>
        </div>

        <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <ShieldCheck className="size-3 shrink-0" aria-hidden />
              {row.invariantCount} invariant{row.invariantCount === 1 ? '' : 's'}
              {row.gatingInvariantCount > 0 ? (
                <span className="text-foreground/70">
                  · {row.gatingInvariantCount} gating
                </span>
              ) : null}
            </span>
            <span className="tabular-nums">
              {row.screenCount} screen{row.screenCount === 1 ? '' : 's'}
            </span>
            <span className="tabular-nums">
              {row.workflowCount} workflow{row.workflowCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate text-muted-foreground">
              {row.owner ? (
                <>
                  Owner <span className="font-semibold text-foreground/80">{row.owner}</span>
                </>
              ) : (
                <span className="font-medium">{row.packKey}</span>
              )}
            </span>
            <span className="shrink-0 rounded-lg bg-background/80 px-2 py-0.5 font-mono font-semibold tabular-nums text-foreground">
              v{row.version}
            </span>
          </div>
        </div>
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
          <Sparkles className="mb-4 size-12 text-muted-foreground" />
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
                  <div className="border-b border-border/70 bg-muted/15 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">Feature contracts</p>
                  </div>
                )}

                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
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
