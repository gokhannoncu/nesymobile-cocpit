'use client'

import Link from 'next/link'
import {
  ChevronRight,
  Cpu,
  Layers,
  Package,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  X,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { HeroCallout } from '@/components/product/blocks'
import { StatCard, StatGrid } from '@/components/product/stats'
import { cn } from '@nesy/metronic/lib/utils'

export type CapabilityLayerFilter = 'all' | 'core' | 'domain'
export type CapabilityTraitFilter = 'all' | 'runtime' | 'automation'

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

function FilterChip({
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
        'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition',
        active
          ? 'border-nesy/35 bg-nesy-soft text-nesy-ink shadow-xs'
          : 'border-border bg-background text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
      )}
    >
      <span className="max-w-[11rem] truncate">{label}</span>
      <span
        className={cn(
          'rounded-[8px] px-1.5 py-px text-[10px] tabular-nums',
          active ? 'bg-nesy/15 text-nesy-ink' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function CapabilityPackCommandStrip({
  packKey,
  version,
  capabilityCount,
}: {
  packKey: string
  version: string
  capabilityCount: number
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-right text-xs font-semibold text-foreground">{packKey}</p>
        <p className="text-right text-[10px] text-muted-foreground">
          v{version} · {capabilityCount} capabilit{capabilityCount === 1 ? 'y' : 'ies'}
        </p>
      </div>
      <Button size="sm" className="h-8 shrink-0 bg-nesy text-white hover:bg-nesy-hover" asChild>
        <Link href={packDetailHref(packKey, version)}>
          Open pack
          <ChevronRight className="size-4" />
        </Link>
      </Button>
    </div>
  )
}

export function CapabilityRegistryHeader({
  totalCount,
  visibleCount,
  packCount,
  coreCount,
  domainCount,
  runtimeCount,
  automationCount,
  providerCounts,
  packGroups,
  activeLayerFilter,
  onLayerFilterChange,
  activeTraitFilter,
  onTraitFilterChange,
  activeProvider,
  onProviderChange,
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
  coreCount: number
  domainCount: number
  runtimeCount: number
  automationCount: number
  providerCounts: Record<string, number>
  packGroups: { packKey: string; version: string; capabilityCount: number }[]
  activeLayerFilter: CapabilityLayerFilter
  onLayerFilterChange: (filter: CapabilityLayerFilter) => void
  activeTraitFilter: CapabilityTraitFilter
  onTraitFilterChange: (filter: CapabilityTraitFilter) => void
  activeProvider: string | null
  onProviderChange: (provider: string | null) => void
  activePack: string | null
  onPackChange: (packKey: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onClearFilters: () => void
  hasFilters: boolean
}) {
  const solePack = packGroups.length === 1 ? packGroups[0] : null
  const providerEntries = Object.entries(providerCounts).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  const showProviderRow = providerEntries.length > 0 || solePack != null
  const showFamilyRow = !solePack && packGroups.length > 1

  return (
    <div className="space-y-4">
      <HeroCallout
        icon={Sparkles}
        eyebrow="Automation / Registry"
        title="Capability Contracts"
        lead="Reusable automation semantics from the latest published domain pack — layer, provider, runtime detection, and allowlisted operations in one catalog."
        tone="nesy"
        compact
        layout="stack"
        chips={['verdict.core', 'domain layer', 'Runtime detection']}
      >
        <StatGrid cols={4}>
          <StatCard
            icon={Layers}
            label="All capabilities"
            value={hasFilters ? visibleCount : totalCount}
            hint={
              hasFilters
                ? `${visibleCount} of ${totalCount} match filters`
                : `${packCount} ${packCount === 1 ? 'family' : 'families'}`
            }
            tone="nesy"
            active={
              activeLayerFilter === 'all' &&
              activeTraitFilter === 'all' &&
              !activeProvider &&
              !activePack &&
              !searchQuery
            }
            onClick={onClearFilters}
          />
          <StatCard
            icon={Shield}
            label="Core layer"
            value={coreCount}
            hint="verdict.core platform seams"
            tone="teal"
            active={activeLayerFilter === 'core'}
            onClick={() =>
              onLayerFilterChange(activeLayerFilter === 'core' ? 'all' : 'core')
            }
          />
          <StatCard
            icon={Package}
            label="Domain layer"
            value={domainCount}
            hint="domain.* pack-specific seams"
            tone="amber"
            active={activeLayerFilter === 'domain'}
            onClick={() =>
              onLayerFilterChange(activeLayerFilter === 'domain' ? 'all' : 'domain')
            }
          />
          <StatCard
            icon={Cpu}
            label="Runtime detected"
            value={runtimeCount}
            hint={
              automationCount > 0
                ? `${automationCount} automation-only`
                : 'Probe-backed capabilities'
            }
            tone="blue"
            active={activeTraitFilter === 'runtime'}
            onClick={() =>
              onTraitFilterChange(activeTraitFilter === 'runtime' ? 'all' : 'runtime')
            }
          />
        </StatGrid>
      </HeroCallout>

      <div className="rounded-lg border border-border/80 bg-card/95 p-3 shadow-xs backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search capability, key, layer, provider…"
              className="h-9 w-full rounded-[8px] border border-border/70 bg-background py-2 pl-9 pr-9 text-sm outline-none transition placeholder:text-muted-foreground/75 hover:border-border focus:border-nesy/40 focus:ring-4 focus:ring-nesy-soft/30"
              type="search"
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            {hasFilters ? (
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-[8px]"
              onClick={onRefresh}
              aria-label="Refresh capability registry"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {showProviderRow ? (
          <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 lg:flex-row lg:items-center lg:justify-between">
            {providerEntries.length > 0 ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Provider
                </span>
                <FilterChip
                  active={activeProvider === null}
                  label="All"
                  count={totalCount}
                  onClick={() => onProviderChange(null)}
                />
                {providerEntries.map(([provider, count]) => (
                  <FilterChip
                    key={provider}
                    active={activeProvider === provider}
                    label={provider.replace(/_/g, ' ')}
                    count={count}
                    onClick={() =>
                      onProviderChange(activeProvider === provider ? null : provider)
                    }
                  />
                ))}
              </div>
            ) : null}
            {solePack ? (
              <CapabilityPackCommandStrip
                packKey={solePack.packKey}
                version={solePack.version}
                capabilityCount={solePack.capabilityCount}
              />
            ) : null}
          </div>
        ) : null}

        {showFamilyRow ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Family
            </span>
            <FilterChip
              active={activePack === null}
              label="All families"
              count={totalCount}
              onClick={() => onPackChange(null)}
            />
            {packGroups.map((group) => (
              <FilterChip
                key={group.packKey}
                active={activePack === group.packKey}
                label={group.packKey}
                count={group.capabilityCount}
                onClick={() =>
                  onPackChange(activePack === group.packKey ? null : group.packKey)
                }
              />
            ))}
          </div>
        ) : null}

        {hasFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Active view</span>
            <Badge variant="secondary" appearance="outline" size="sm" className="rounded-[8px]">
              {visibleCount} of {totalCount} capabilities
            </Badge>
            {activeLayerFilter !== 'all' ? (
              <Badge variant="secondary" size="sm" className="rounded-[8px]">
                Layer: {activeLayerFilter}
              </Badge>
            ) : null}
            {activeTraitFilter !== 'all' ? (
              <Badge variant="secondary" size="sm" className="rounded-[8px]">
                {activeTraitFilter === 'runtime' ? 'Runtime detected' : 'Automation only'}
              </Badge>
            ) : null}
            {activeProvider ? (
              <Badge variant="secondary" size="sm" className="rounded-[8px]">
                {activeProvider.replace(/_/g, ' ')}
              </Badge>
            ) : null}
            {activePack ? (
              <Badge variant="secondary" size="sm" className="rounded-[8px]">
                {activePack}
              </Badge>
            ) : null}
            {searchQuery ? (
              <Badge variant="secondary" size="sm" className="rounded-[8px] font-mono">
                “{searchQuery}”
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
