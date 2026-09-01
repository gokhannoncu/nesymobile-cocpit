'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import { DataTableShimmer, MetricCardsShimmer, PageTitleShimmer } from './shared-shimmer'

export function RunPlannerPageShimmer() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading run planner">
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-orange-50/80 via-background to-background p-5 shadow-xs dark:from-orange-950/20" aria-hidden>
        <ShimmerBlock className="h-3 w-36" />
        <ShimmerBlock className="mt-2 h-7 w-48" />
        <ShimmerBlock className="mt-2 h-4 w-full max-w-2xl" />
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-6 w-28 rounded-full" />
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-border/70 bg-background/80 px-4 py-3">
              <ShimmerBlock className="h-3 w-24" />
              <ShimmerBlock className="mt-2 h-7 w-10" />
              <ShimmerBlock className="mt-1 h-3 w-32" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" aria-hidden>
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <ShimmerBlock className="h-5 w-32" />
          <div className="space-y-2">
            <ShimmerBlock className="h-3 w-24" />
            <ShimmerBlock className="h-10 w-full rounded-md" />
          </div>
          <ShimmerBlock className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <ShimmerBlock className="h-5 w-36" />
          <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
            <ShimmerBlock className="size-5 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-4 w-40" />
              <ShimmerBlock className="h-3 w-full" />
            </div>
          </div>
          <ShimmerBlock className="h-10 w-36 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function ExecutionQueuePageShimmer() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8" aria-busy="true" aria-label="Loading execution queue">
      <PageTitleShimmer />
      <MetricCardsShimmer count={3} />
      <DataTableShimmer
        title="Latest BridgeFlow Runs"
        columns={['Run ID', 'Status', 'Engine', 'Read model']}
        rowCount={1}
      />
    </div>
  )
}
