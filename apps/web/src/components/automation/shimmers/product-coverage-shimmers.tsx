'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import { MetricCardsShimmer, PageTitleShimmer } from './shared-shimmer'

function CapabilityCardShimmer() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs" aria-hidden>
      <ShimmerBlock className="h-3 w-48" />
      <ShimmerBlock className="mt-3 h-5 w-3/4" />
      <ShimmerBlock className="mt-3 h-8 w-full rounded-md" />
    </div>
  )
}

export function CapabilitiesPageShimmer() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading capability contracts">
      <PageTitleShimmer />
      <div className="grid gap-4 md:grid-cols-2">
        <CapabilityCardShimmer />
      </div>
    </div>
  )
}

export function CoverageGraphPageShimmer() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading coverage graph">
      <PageTitleShimmer />
      <MetricCardsShimmer count={4} columns="lg:grid-cols-4" />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs" aria-hidden>
        <div className="grid gap-3 border-b border-border/70 px-5 py-4 last:border-b-0 md:grid-cols-6">
          <ShimmerBlock className="h-4 w-32" />
          {Array.from({ length: 5 }).map((__, col) => (
            <ShimmerBlock key={col} className="h-4 w-20" />
          ))}
        </div>
      </div>
    </div>
  )
}
