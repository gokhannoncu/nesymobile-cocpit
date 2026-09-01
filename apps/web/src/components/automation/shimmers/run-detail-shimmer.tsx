'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'

export function RunDetailPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading run dashboard">
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs" aria-hidden>
        <ShimmerBlock className="h-3 w-36" />
        <ShimmerBlock className="mt-3 h-7 w-72 max-w-full" />
        <ShimmerBlock className="mt-3 h-4 w-full max-w-xl" />
        <div className="mt-4 flex flex-wrap gap-2">
          <ShimmerBlock className="h-6 w-28 rounded-full" />
          <ShimmerBlock className="h-6 w-24 rounded-full" />
          <ShimmerBlock className="h-6 w-32 rounded-full" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <ShimmerBlock className="h-3 w-24" />
          <ShimmerBlock className="mt-4 h-7 w-20" />
          <ShimmerBlock className="mt-3 h-3 w-full" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-2 shadow-xs" aria-hidden>
        <div className="flex gap-1 p-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-10 flex-1 rounded-lg" />
          ))}
        </div>
        <ShimmerBlock className="mt-2 h-64 w-full rounded-lg" />
      </div>
    </div>
  )
}
