'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'

function RunHistoryHeroShimmer() {
  return (
    <div
      className="overflow-hidden rounded-lg border bg-gradient-to-br from-nesy-soft/80 via-background to-background p-4 lg:p-5"
      aria-hidden
    >
      <ShimmerBlock className="h-3 w-40" />
      <ShimmerBlock className="mt-2 h-7 w-44" />
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

function RunHistoryCommandShimmer() {
  return (
    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-xs" aria-hidden>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <ShimmerBlock className="h-10 flex-1 rounded-lg" />
        <ShimmerBlock className="h-10 w-48 shrink-0 rounded-lg" />
        <ShimmerBlock className="size-10 shrink-0 rounded-lg" />
      </div>
    </div>
  )
}

export function AutomationHistoryStatCardsShimmer() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-card p-4 shadow-xs"
          aria-hidden
        >
          <ShimmerBlock className="h-3 w-24" />
          <ShimmerBlock className="mt-3 h-8 w-12" />
          <ShimmerBlock className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

export function AutomationHistoryPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading run history">
      <div className="space-y-4">
        <RunHistoryHeroShimmer />
        <RunHistoryCommandShimmer />
      </div>
      <AutomationHistoryTableShimmer rowCount={1} />
    </div>
  )
}

export function AutomationHistoryTableShimmer({ rowCount = 1 }: { rowCount?: number }) {
  const cellGrid = 'border-b border-r border-border last:border-r-0'
  const thClass = `px-2.5 py-1.5 ${cellGrid}`
  const tdClass = `px-2.5 py-1.5 align-middle ${cellGrid}`

  return (
    <article
      className="overflow-hidden rounded-lg border border-border bg-card shadow-xs ring-1 ring-border/40"
      aria-busy="true"
      aria-label="Loading run history table"
    >
      <div className="border-b border-border bg-muted/15 px-3 py-2" aria-hidden>
        <ShimmerBlock className="h-4 w-32" />
        <ShimmerBlock className="mt-1.5 h-3 w-48" />
      </div>
      <div className="overflow-x-auto border-t border-border">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40">
              {['', 'Workflow', 'Status', 'Started', 'Open'].map((col) => (
                <th key={col || 'select'} className={`text-left ${thClass}`}>
                  <ShimmerBlock className="h-2.5 w-14" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <tr
                key={rowIndex}
                className={rowIndex % 2 === 1 ? 'bg-muted/50' : undefined}
              >
                <td className={tdClass}>
                  <ShimmerBlock className="size-4 rounded-sm" />
                </td>
                <td className={tdClass}>
                  <div className="flex items-center gap-2">
                    <ShimmerBlock className="size-7 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <ShimmerBlock className="h-3.5 w-40 max-w-full" />
                      <div className="flex gap-1">
                        <ShimmerBlock className="h-4 w-12 rounded-md" />
                        <ShimmerBlock className="h-4 w-24 rounded-md" />
                      </div>
                    </div>
                  </div>
                </td>
                <td className={tdClass}>
                  <ShimmerBlock className="h-6 w-20 rounded-md" />
                </td>
                <td className={tdClass}>
                  <ShimmerBlock className="h-3.5 w-24" />
                  <ShimmerBlock className="mt-1 h-2.5 w-20" />
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

      <div className="flex flex-col gap-3 border-t border-border px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
        <ShimmerBlock className="h-4 w-36" />
        <ShimmerBlock className="h-9 w-52 rounded-lg" />
        <ShimmerBlock className="h-9 w-36 rounded-lg" />
      </div>
    </article>
  )
}
