'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'

export function LoadTourFlowPageShimmer() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading load and tour flow">
      <ShimmerBlock className="h-10 w-full max-w-xl rounded-md" />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs" aria-hidden>
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <ShimmerBlock className="h-5 w-40" />
            <ShimmerBlock className="h-4 w-64" />
          </div>
          <ShimmerBlock className="h-9 w-28 rounded-md" />
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <ShimmerBlock className="h-5 w-32" />
            <ShimmerBlock className="mt-3 h-10 w-full rounded-md" />
            <div className="mt-3 space-y-2">
              <ShimmerBlock className="h-11 w-full rounded-[4px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
