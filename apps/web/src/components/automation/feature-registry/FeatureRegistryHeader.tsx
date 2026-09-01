'use client'

import Link from 'next/link'
import {
  ChevronRight,
  Layers,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Workflow,
  X,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { HeroCallout } from '@/components/product/blocks'
import { StatCard, StatGrid } from '@/components/product/stats'
import type { FeatureRegistryRow } from '@/components/automation/feature-registry/FeatureRegistryView'
import { cn } from '@nesy/metronic/lib/utils'

type FeaturePackGroup = {
  packKey: string
  version: string
  featureCount: number
}

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

function packSurfacesHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}/surfaces?version=${encodeURIComponent(version)}`
}

function StatPill({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          'truncate text-xs font-semibold text-foreground',
          mono && 'font-mono text-[11px]',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function FeaturePackCommandStrip({
  packKey,
  version,
  rows,
}: {
  packKey: string
  version: string
  rows: FeatureRegistryRow[]
}) {
  const invariantCount = rows.reduce((total, row) => total + row.invariantCount, 0)
  const gatingCount = rows.reduce((total, row) => total + row.gatingInvariantCount, 0)
  const tagCount = new Set(rows.flatMap((row) => row.tags)).size

  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
            <Sparkles className="size-4" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{packKey}</p>
            <p className="text-xs text-muted-foreground">Feature contracts · latest published</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-center">
          <StatPill label="Features" value={`${rows.length} contracts`} />
          <StatPill label="Version" value={`v${version}`} mono />
          <StatPill
            label="Invariants"
            value={gatingCount > 0 ? `${invariantCount} · ${gatingCount} gating` : `${invariantCount} total`}
          />
          {tagCount > 0 ? <StatPill label="Tags" value={`${tagCount} unique`} /> : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="sm" className="bg-nesy text-white hover:bg-nesy-hover" asChild>
            <Link href={packDetailHref(packKey, version)}>
              Open pack
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link href={packSurfacesHref(packKey, version)}>
              <Package className="size-3.5" />
              Surfaces
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function PackScopeChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        active
          ? 'border-nesy/35 bg-nesy-soft text-nesy-ink shadow-xs'
          : 'border-border bg-background text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
      )}
    >
      <span className="max-w-[10rem] truncate">{label}</span>
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
          active ? 'bg-nesy/15 text-nesy-ink' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

export function FeatureRegistryHeader({
  totalCount,
  visibleCount,
  packCount,
  packGroups,
  solePackRows,
  totalInvariants,
  totalGatingInvariants,
  totalWorkflowRefs,
  uniqueTagCount,
  activePack,
  onPackChange,
  searchQuery,
  onSearchChange,
  onRefresh,
  onClearFilters,
  hasFilters,
}: {
  totalCount: number
  visibleCount: number
  packCount: number
  packGroups: FeaturePackGroup[]
  solePackRows: FeatureRegistryRow[] | null
  totalInvariants: number
  totalGatingInvariants: number
  totalWorkflowRefs: number
  uniqueTagCount: number
  activePack: string | null
  onPackChange: (packKey: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onClearFilters: () => void
  hasFilters: boolean
}) {
  const solePack = packGroups.length === 1 ? packGroups[0] : null

  return (
    <div className="space-y-4">
      <HeroCallout
        icon={Sparkles}
        eyebrow="Automation / Registry"
        title="Feature Registry"
        lead="Executable feature contracts from the latest published domain pack per family — invariants, workflows, and capability bindings in one catalog."
        tone="nesy"
        compact
        layout="stack"
        chips={['Latest published', 'Executable contracts', 'Release gates']}
      >
        <StatGrid cols={4}>
          <StatCard
            icon={Sparkles}
            label="Features"
            value={hasFilters ? visibleCount : totalCount}
            hint={
              hasFilters
                ? `${visibleCount} of ${totalCount} match filters`
                : `${packCount} ${packCount === 1 ? 'family' : 'families'} in catalog`
            }
            tone="nesy"
            active={!hasFilters}
            onClick={
              hasFilters
                ? onClearFilters
                : () => {
                    onPackChange(null)
                    onSearchChange('')
                  }
            }
          />
          <StatCard
            icon={Layers}
            label="Families"
            value={packCount}
            hint="One pin per pack key"
            tone="blue"
            active={activePack === null && !searchQuery}
            onClick={() => {
              onPackChange(null)
              onSearchChange('')
            }}
          />
          <StatCard
            icon={ShieldCheck}
            label="Invariants"
            value={totalInvariants}
            hint={
              totalGatingInvariants > 0
                ? `${totalGatingInvariants} bind release gates`
                : 'No gating rules'
            }
            tone="green"
          />
          <StatCard
            icon={uniqueTagCount > 0 ? Tags : Workflow}
            label={uniqueTagCount > 0 ? 'Tags' : 'Workflows'}
            value={uniqueTagCount > 0 ? uniqueTagCount : totalWorkflowRefs}
            hint={
              uniqueTagCount > 0
                ? `${totalWorkflowRefs} workflow refs`
                : 'Referenced test paths'
            }
            tone="amber"
          />
        </StatGrid>
      </HeroCallout>

      <div className="rounded-lg border border-border/80 bg-card/95 p-3 shadow-xs backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search feature, key, description, or pack…"
              className="h-10 w-full rounded-lg border border-border/70 bg-background py-2 pl-9 pr-9 text-sm outline-none transition placeholder:text-muted-foreground/75 hover:border-border focus:border-nesy/40 focus:ring-4 focus:ring-nesy-soft/30"
              type="search"
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 shrink-0"
              onClick={onRefresh}
              aria-label="Refresh feature registry"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {solePack && solePackRows ? (
          <FeaturePackCommandStrip
            packKey={solePack.packKey}
            version={solePack.version}
            rows={solePackRows}
          />
        ) : packGroups.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Family
            </span>
            <PackScopeChip
              active={activePack === null}
              label="All families"
              count={totalCount}
              onClick={() => onPackChange(null)}
            />
            {packGroups.map((group) => (
              <PackScopeChip
                key={group.packKey}
                active={activePack === group.packKey}
                label={group.packKey}
                count={group.featureCount}
                onClick={() =>
                  onPackChange(activePack === group.packKey ? null : group.packKey)
                }
              />
            ))}
          </div>
        ) : null}

        {hasFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-xs text-muted-foreground">Active view</span>
            <Badge variant="secondary" appearance="outline" size="sm">
              {visibleCount} of {totalCount} features
            </Badge>
            {activePack ? (
              <Badge variant="secondary" size="sm">
                {activePack}
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
