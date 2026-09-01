'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import { cn } from '@nesy/metronic/lib/utils'

function CapabilityRegistryHeroShimmer() {
  return (
    <div
      className="overflow-hidden rounded-lg border bg-gradient-to-br from-nesy-soft/80 via-background to-background p-4 lg:p-5"
      aria-hidden
    >
      <ShimmerBlock className="h-3 w-36" />
      <ShimmerBlock className="mt-2 h-7 w-56" />
      <ShimmerBlock className="mt-2 h-4 w-full max-w-2xl" />
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <ShimmerBlock key={index} className="h-6 w-28 rounded-full" />
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border/70 bg-background/80 p-4">
            <ShimmerBlock className="h-3 w-20" />
            <ShimmerBlock className="mt-3 h-8 w-12" />
            <ShimmerBlock className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}

function CapabilityRegistryCommandShimmer() {
  return (
    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-xs" aria-hidden>
      <div className="flex gap-2">
        <ShimmerBlock className="h-10 flex-1 rounded-lg" />
        <ShimmerBlock className="size-10 shrink-0 rounded-lg" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <ShimmerBlock key={index} className="h-7 w-24 rounded-md" />
        ))}
      </div>
    </div>
  )
}

function CapabilityTableRowShimmer() {
  const cellGrid = 'border-b border-r border-border last:border-r-0'
  const tdClass = `px-2.5 py-2 align-middle ${cellGrid}`

  return (
    <tr className="bg-card" aria-hidden>
      <td className={tdClass}>
        <ShimmerBlock className="h-5 w-20 rounded-[4px]" />
      </td>
      <td className={tdClass}>
        <ShimmerBlock className="h-5 w-24 rounded-[4px]" />
      </td>
      <td className={tdClass}>
        <ShimmerBlock className="h-3.5 w-40" />
        <ShimmerBlock className="mt-1 h-2.5 w-full max-w-sm" />
      </td>
      <td className={cn('hidden lg:table-cell', tdClass)}>
        <ShimmerBlock className="h-4 w-48 rounded-md" />
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <ShimmerBlock className="h-4 w-16 rounded-md" />
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <ShimmerBlock className="h-3.5 w-12" />
        </div>
      </td>
    </tr>
  )
}

function CapabilityPackGroupShimmer() {
  const cellGrid = 'border-b border-r border-border last:border-r-0'
  const thClass = `px-2.5 py-2 ${cellGrid}`

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs ring-1 ring-border/40" aria-hidden>
      <div className="flex flex-col gap-2 border-b border-border bg-muted/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <ShimmerBlock className="h-4 w-36" />
          <ShimmerBlock className="h-3 w-56" />
        </div>
        <ShimmerBlock className="h-3 w-20" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40">
              {['Layer', 'Provider', 'Capability', 'Key', 'Traits', 'Open'].map((col) => (
                <th
                  key={col}
                  className={cn(
                    'text-left',
                    thClass,
                    col === 'Key' && 'hidden lg:table-cell',
                    col === 'Traits' && 'hidden md:table-cell',
                  )}
                >
                  <ShimmerBlock className="h-2.5 w-14" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CapabilityTableRowShimmer />
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function CapabilitiesPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading capability contracts">
      <div className="space-y-4">
        <CapabilityRegistryHeroShimmer />
        <CapabilityRegistryCommandShimmer />
      </div>
      <CapabilityPackGroupShimmer />
    </div>
  )
}

export function CoverageGraphPageShimmer() {
  const cellGrid = 'border-b border-r border-border last:border-r-0'
  const thClass = `px-2 py-1.5 ${cellGrid}`
  const tdClass = `px-2 py-1.5 align-middle ${cellGrid}`

  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading coverage graph">
      <article className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />
          <div className="flex items-start gap-3">
            <ShimmerBlock className="size-10 shrink-0 rounded-[8px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-7 w-48 max-w-full" />
              <ShimmerBlock className="h-4 w-full max-w-lg" />
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-14 rounded-[8px]" />
            ))}
          </div>
          <ShimmerBlock className="mt-3 h-16 w-full rounded-[8px]" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-7 w-28 rounded-[8px]" />
            ))}
          </div>
        </div>
      </article>

      <ShimmerBlock className="h-14 w-full rounded-[8px]" />

      <article className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="border-b border-border bg-muted/10 px-2.5 py-1.5">
          <ShimmerBlock className="h-4 w-44" />
          <ShimmerBlock className="mt-1 h-3 w-56" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted/40">
                {['Family', 'Features', 'Screens', 'Evidence', 'Tests', 'Chain', 'Open'].map((col) => (
                  <th key={col} className={thClass}>
                    <ShimmerBlock className="h-2.5 w-14" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, index) => (
                <tr key={index} className="bg-card">
                  <td className={tdClass}>
                    <ShimmerBlock className="h-3.5 w-32" />
                    <ShimmerBlock className="mt-1 h-2.5 w-20" />
                  </td>
                  <td className={tdClass}>
                    <ShimmerBlock className="h-3.5 w-8" />
                  </td>
                  <td className={tdClass}>
                    <ShimmerBlock className="h-3.5 w-8" />
                  </td>
                  <td className={tdClass}>
                    <ShimmerBlock className="h-3.5 w-8" />
                  </td>
                  <td className={tdClass}>
                    <ShimmerBlock className="h-3.5 w-8" />
                  </td>
                  <td className={tdClass}>
                    <ShimmerBlock className="h-4 w-16 rounded-[4px]" />
                    <ShimmerBlock className="mt-1 h-1 w-full rounded-[3px]" />
                  </td>
                  <td className={tdClass}>
                    <div className="flex justify-end">
                      <ShimmerBlock className="h-3.5 w-12" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
