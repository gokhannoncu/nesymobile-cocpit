'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'

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
    <div className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs" aria-hidden>
      <ShimmerBlock className="absolute inset-y-0 left-0 w-1 rounded-none" />
      <div className="flex flex-1 flex-col p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <ShimmerBlock className="size-10 shrink-0 rounded-lg" />
          <ShimmerBlock className="size-4 rounded" />
        </div>
        <ShimmerBlock className="mt-3 h-5 w-4/5" />
        <ShimmerBlock className="mt-2 h-4 w-full" />
        <ShimmerBlock className="mt-2 h-4 w-11/12" />
        <div className="mt-3 flex gap-1.5">
          <ShimmerBlock className="h-5 w-20 rounded-lg" />
          <ShimmerBlock className="h-5 w-16 rounded-lg" />
        </div>
        <ShimmerBlock className="mt-3 h-9 w-full rounded-lg" />
        <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
          <ShimmerBlock className="h-3 w-48" />
          <div className="flex items-center justify-between gap-2">
            <ShimmerBlock className="h-3 w-32" />
            <ShimmerBlock className="h-5 w-14 rounded-lg" />
          </div>
        </div>
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
        <div className="border-b border-border/70 bg-muted/15 px-4 py-3">
          <ShimmerBlock className="h-4 w-36" />
        </div>
      )}
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <FeatureCardShimmer />
      </div>
    </article>
  )
}

function ComponentTableRowShimmer({ striped }: { striped?: boolean }) {
  return (
    <tr className={striped ? 'bg-muted/50' : 'bg-card'} aria-hidden>
      <td className="px-4 py-3 align-middle"><ShimmerBlock className="h-5 w-20 rounded-lg" /></td>
      <td className="px-4 py-3 align-middle">
        <ShimmerBlock className="h-4 w-40" />
        <ShimmerBlock className="mt-1.5 h-3 w-56" />
      </td>
      <td className="hidden px-4 py-3 align-middle md:table-cell">
        <ShimmerBlock className="h-7 w-48 rounded-lg" />
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex justify-end">
          <ShimmerBlock className="h-4 w-14" />
        </div>
      </td>
    </tr>
  )
}

function ComponentPackGroupShimmer({ compactHeader = true }: { compactHeader?: boolean }) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs" aria-hidden>
      {!compactHeader ? (
        <header className="border-b border-border/80 bg-gradient-to-br from-nesy-soft/25 via-background to-muted/15 px-4 py-4">
          <div className="flex gap-3">
            <ShimmerBlock className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-5 w-36" />
              <ShimmerBlock className="h-4 w-52" />
              <div className="flex gap-2 pt-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <ShimmerBlock key={index} className="h-7 w-24 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </header>
      ) : (
        <div className="border-b border-border/70 bg-muted/15 px-4 py-3">
          <ShimmerBlock className="h-4 w-32" />
          <ShimmerBlock className="mt-1.5 h-3 w-56" />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/25">
              {['Kind', 'Display name', 'Key', 'Open'].map((col) => (
                <th key={col} className="px-4 py-3 text-left">
                  <ShimmerBlock className="h-3 w-14" />
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
