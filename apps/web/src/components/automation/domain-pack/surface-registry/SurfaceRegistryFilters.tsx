'use client'

import { Search } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type {
  ApplicationRegistryItemApi,
  ScreenRegistryItemApi,
} from '@/lib/verdict-runtime/types'
import {
  uniqueSurfaceKinds,
  uniqueSurfacePolicies,
} from '@/lib/verdict-runtime/surface-registry'
import type { SurfaceRegistryItemApi } from '@/lib/verdict-runtime/types'

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-[8px] border px-2.5 py-1.5 text-[11px] font-semibold transition',
        active
          ? 'border-nesy/30 bg-nesy-soft text-nesy-ink'
          : 'border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function SurfaceRegistryFilters({
  applications,
  screens,
  surfaces,
  selectedAppKey,
  selectedScreenKey,
  selectedKind,
  selectedPolicy,
  query,
  onAppChange,
  onScreenChange,
  onKindChange,
  onPolicyChange,
  onQueryChange,
}: {
  applications: ApplicationRegistryItemApi[]
  screens: ScreenRegistryItemApi[]
  surfaces: SurfaceRegistryItemApi[]
  selectedAppKey: string | null
  selectedScreenKey: string | null
  selectedKind: string | null
  selectedPolicy: string | null
  query: string
  onAppChange: (appKey: string | null) => void
  onScreenChange: (screenKey: string | null) => void
  onKindChange: (kind: string | null) => void
  onPolicyChange: (policy: string | null) => void
  onQueryChange: (query: string) => void
}) {
  const kinds = uniqueSurfaceKinds(surfaces)
  const policies = uniqueSurfacePolicies(surfaces)

  return (
    <div className="space-y-3 rounded-[8px] border border-border bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Registry filters</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Narrow by application, screen, kind, or policy.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search surfaces…"
            className="h-9 w-full rounded-[8px] border border-border bg-background ps-8 pe-3 text-xs outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Application
        </p>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={selectedAppKey === null} onClick={() => onAppChange(null)}>
            All apps
          </FilterChip>
          {applications.map((app) => (
            <FilterChip
              key={app.applicationKey}
              active={selectedAppKey === app.applicationKey}
              onClick={() => onAppChange(app.applicationKey)}
            >
              {app.displayName}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Screen
        </p>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={selectedScreenKey === null} onClick={() => onScreenChange(null)}>
            All screens
          </FilterChip>
          {screens.map((screen) => (
            <FilterChip
              key={screen.screenKey}
              active={selectedScreenKey === screen.screenKey}
              onClick={() => onScreenChange(screen.screenKey)}
            >
              {screen.displayName}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Kind
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={selectedKind === null} onClick={() => onKindChange(null)}>
              All kinds
            </FilterChip>
            {kinds.map((kind) => (
              <FilterChip
                key={kind}
                active={selectedKind === kind}
                onClick={() => onKindChange(kind)}
              >
                {kind.replace(/_/g, ' ')}
              </FilterChip>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Policy
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={selectedPolicy === null} onClick={() => onPolicyChange(null)}>
              All policies
            </FilterChip>
            {policies.map((policy) => (
              <FilterChip
                key={policy}
                active={selectedPolicy === policy}
                onClick={() => onPolicyChange(policy)}
              >
                {policy.replace(/_/g, ' ')}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
