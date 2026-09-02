'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'

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

export function ExecutionQueueTableShimmer() {
  return (
    <article
      className="overflow-hidden rounded-[8px] border border-border bg-card"
      aria-busy="true"
      aria-label="Loading execution queue table"
    >
      <div className="border-b border-border bg-muted/10 px-3 py-2.5 sm:px-4" aria-hidden>
        <ShimmerBlock className="h-3.5 w-36" />
        <ShimmerBlock className="mt-1.5 h-3 w-52" />
      </div>
      <div className="overflow-x-auto border-t border-border p-0">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40">
              {Array.from({ length: 5 }).map((_, index) => (
                <th
                  key={index}
                  className="border-b border-r border-border px-2.5 py-2 text-left last:border-r-0"
                >
                  <ShimmerBlock className="h-2.5 w-14" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-muted/50">
              <td className="border-b border-r border-border px-2.5 py-2 last:border-r-0">
                <div className="flex items-center gap-2">
                  <ShimmerBlock className="size-7 shrink-0 rounded-[8px]" />
                  <div className="min-w-0 flex-1">
                    <ShimmerBlock className="h-3.5 w-40" />
                  </div>
                </div>
              </td>
              <td className="border-b border-r border-border px-2.5 py-2">
                <ShimmerBlock className="h-6 w-20 rounded-[4px]" />
              </td>
              <td className="border-b border-r border-border px-2.5 py-2">
                <ShimmerBlock className="h-6 w-16 rounded-[4px]" />
              </td>
              <td className="border-b border-r border-border px-2.5 py-2">
                <ShimmerBlock className="h-3.5 w-24" />
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <ShimmerBlock className="ms-auto h-3.5 w-12" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-border px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
        <ShimmerBlock className="h-3.5 w-40" />
        <ShimmerBlock className="h-8 w-52 rounded-lg" />
        <ShimmerBlock className="h-8 w-36 rounded-lg" />
      </div>
    </article>
  )
}

export function ExecutionQueuePageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading execution queue">
      <div className="space-y-4">
        <div
          className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-nesy-soft/80 via-background to-background p-4 lg:p-5"
          aria-hidden
        >
          <ShimmerBlock className="absolute right-4 top-4 h-10 w-[7.5rem] rounded-full" />
          <ShimmerBlock className="h-3 w-40" />
          <ShimmerBlock className="mt-2 h-7 w-52" />
          <ShimmerBlock className="mt-2 h-4 w-full max-w-2xl" />
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-6 w-32 rounded-full" />
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
        <div className="rounded-[8px] border border-border bg-card p-3" aria-hidden>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <ShimmerBlock className="h-10 flex-1 rounded-lg" />
            <ShimmerBlock className="h-10 w-48 shrink-0 rounded-lg" />
          </div>
        </div>
      </div>

      <ExecutionQueueTableShimmer />
    </div>
  )
}
