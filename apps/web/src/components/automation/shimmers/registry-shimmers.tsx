'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import { cn } from '@nesy/metronic/lib/utils'

function FeatureRegistryHeroShimmer() {
  return (
    <div
      className="overflow-hidden rounded-lg border bg-gradient-to-br from-nesy-soft/80 via-background to-background p-4 lg:p-5"
      aria-hidden
    >
      <ShimmerBlock className="h-3 w-32" />
      <ShimmerBlock className="mt-2 h-7 w-52" />
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

function FeatureRegistryCommandShimmer() {
  return (
    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-xs" aria-hidden>
      <div className="flex gap-2">
        <ShimmerBlock className="h-10 flex-1 rounded-lg" />
        <ShimmerBlock className="size-10 shrink-0 rounded-lg" />
      </div>
      <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <ShimmerBlock className="size-10 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <ShimmerBlock className="h-4 w-28" />
            <ShimmerBlock className="h-3 w-36" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2 lg:justify-center">
          {Array.from({ length: 3 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-8 w-28 rounded-full" />
          ))}
        </div>
        <div className="flex gap-2">
          <ShimmerBlock className="h-8 w-28 rounded-lg" />
          <ShimmerBlock className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function FeatureCardShimmer() {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-3" aria-hidden>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <ShimmerBlock className="h-4 w-3/5" />
          <ShimmerBlock className="h-3 w-full" />
        </div>
        <ShimmerBlock className="size-3.5 shrink-0 rounded" />
      </div>
      <ShimmerBlock className="mt-1.5 h-3 w-full" />
      <div className="mt-2 flex gap-1">
        <ShimmerBlock className="h-4 w-16 rounded" />
        <ShimmerBlock className="h-4 w-14 rounded" />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
        <ShimmerBlock className="h-3 w-32" />
        <ShimmerBlock className="h-3 w-10" />
      </div>
    </div>
  )
}

function FeaturePackGroupShimmer({ compactHeader = true }: { compactHeader?: boolean }) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs" aria-hidden>
      {!compactHeader ? (
        <header className="flex flex-col gap-3 border-b border-border/80 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ShimmerBlock className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-5 w-36" />
              <ShimmerBlock className="h-4 w-52" />
            </div>
          </div>
          <ShimmerBlock className="h-8 w-28 shrink-0 rounded-lg" />
        </header>
      ) : (
        <div className="border-b border-border bg-muted/10 px-3 py-2">
          <ShimmerBlock className="h-3 w-28" />
        </div>
      )}
      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
        <FeatureCardShimmer />
      </div>
    </article>
  )
}

function ComponentTableRowShimmer({ striped }: { striped?: boolean }) {
  const cellGrid = 'border-b border-r border-border last:border-r-0'
  const tdClass = `px-2.5 py-2 align-middle ${cellGrid}`

  return (
    <tr className={striped ? 'bg-muted/50' : 'bg-card'} aria-hidden>
      <td className={tdClass}>
        <ShimmerBlock className="h-4 w-16 rounded-md" />
      </td>
      <td className={tdClass}>
        <ShimmerBlock className="h-3.5 w-40" />
        <ShimmerBlock className="mt-1 h-2.5 w-56" />
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <ShimmerBlock className="h-4 w-48 rounded-md" />
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <ShimmerBlock className="h-3.5 w-12" />
        </div>
      </td>
    </tr>
  )
}

function ComponentPackGroupShimmer({ compactHeader = true }: { compactHeader?: boolean }) {
  const cellGrid = 'border-b border-r border-border last:border-r-0'
  const thClass = `px-2.5 py-2 ${cellGrid}`

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs ring-1 ring-border/40" aria-hidden>
      <div className="flex flex-col gap-2 border-b border-border bg-muted/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <ShimmerBlock className="h-4 w-32" />
          <ShimmerBlock className="h-3 w-56" />
        </div>
        <div className="flex gap-2">
          <ShimmerBlock className="h-7 w-20 rounded-md" />
          <ShimmerBlock className="h-3 w-20" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40">
              {['Kind', 'Display name', 'Key', 'Open'].map((col) => (
                <th key={col} className={`text-left ${thClass}`}>
                  <ShimmerBlock className="h-2.5 w-14" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ComponentTableRowShimmer />
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function FeatureRegistryPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading feature registry">
      <div className="space-y-4">
        <FeatureRegistryHeroShimmer />
        <FeatureRegistryCommandShimmer />
      </div>
      <FeaturePackGroupShimmer />
    </div>
  )
}

export function ComponentRegistryPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading component registry">
      <div className="space-y-4">
        <FeatureRegistryHeroShimmer />
        <FeatureRegistryCommandShimmer />
      </div>
      <ComponentPackGroupShimmer />
    </div>
  )
}
