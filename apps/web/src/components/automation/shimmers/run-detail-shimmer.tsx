'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'

export function RunDetailPageShimmer() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading run dashboard">
      <div className="overflow-hidden rounded-[8px] border border-slate-200/90 bg-white" aria-hidden>
        <div className="border-b border-slate-200/80 px-4 py-3 sm:px-5">
          <ShimmerBlock className="h-3 w-28" />
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ShimmerBlock className="h-7 w-64 max-w-full" />
                <ShimmerBlock className="h-6 w-16 rounded-[8px]" />
                <ShimmerBlock className="h-6 w-20 rounded-[8px]" />
              </div>
              <ShimmerBlock className="h-4 w-full max-w-2xl" />
              <ShimmerBlock className="h-4 w-full max-w-xl" />
              <div className="flex flex-wrap gap-2 pt-1">
                <ShimmerBlock className="h-10 w-28 rounded-[8px]" />
                <ShimmerBlock className="h-10 w-24 rounded-[8px]" />
                <ShimmerBlock className="h-10 w-36 rounded-[8px]" />
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-wrap gap-2">
                <ShimmerBlock className="h-8 w-24 rounded-[8px]" />
                <ShimmerBlock className="h-8 w-28 rounded-[8px]" />
                <ShimmerBlock className="h-8 w-32 rounded-[8px]" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <ShimmerBlock className="h-6 w-24 rounded-[8px]" />
                <ShimmerBlock className="h-6 w-28 rounded-[8px]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[8px] border border-slate-200/90 bg-white p-4">
            <ShimmerBlock className="h-3 w-24" />
            <ShimmerBlock className="mt-4 h-7 w-20" />
            <ShimmerBlock className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>

      <div className="rounded-[8px] border border-slate-200/90 bg-white p-2" aria-hidden>
        <div className="flex gap-1 p-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-10 flex-1 rounded-[8px]" />
          ))}
        </div>
        <ShimmerBlock className="mt-2 h-64 w-full rounded-[8px]" />
      </div>
    </div>
  )
}
