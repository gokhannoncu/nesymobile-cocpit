'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'

export function AutomationHistoryStatCardsShimmer() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-md border border-border bg-card px-4 py-2.5 shadow-xs"
          aria-hidden
        >
          <div className="flex items-center gap-3">
            <ShimmerBlock className="size-11 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <ShimmerBlock className="h-3 w-24" />
              <ShimmerBlock className="mt-2 h-6 w-12" />
              <ShimmerBlock className="mt-2 h-3 w-32 max-w-full" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

export function AutomationHistoryTableShimmer({ rowCount = 1 }: { rowCount?: number }) {
  return (
    <section
      className="overflow-hidden rounded-md border border-border bg-card shadow-xs"
      aria-busy="true"
      aria-label="Loading run history"
    >
      <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_220px]">
        <ShimmerBlock className="h-11 w-full rounded-md" />
        <ShimmerBlock className="h-11 w-full rounded-md" />
        <ShimmerBlock className="h-11 w-full rounded-md" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {Array.from({ length: 7 }).map((_, index) => (
                <th key={index} className="px-4 py-3">
                  <ShimmerBlock className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 align-middle">
                  <ShimmerBlock className="size-4 rounded-sm" />
                </td>
                <td className="px-3 py-3 align-middle">
                  <ShimmerBlock className="h-4 w-44 max-w-full" />
                  <ShimmerBlock className="mt-2 h-3 w-32 max-w-full" />
                </td>
                <td className="px-3 py-3 align-middle">
                  <ShimmerBlock className="h-7 w-24 rounded-full" />
                </td>
                <td className="px-3 py-3 align-middle">
                  <ShimmerBlock className="h-5 w-14 rounded-md" />
                </td>
                <td className="px-3 py-3 align-middle">
                  <ShimmerBlock className="h-4 w-24" />
                  <ShimmerBlock className="mt-1.5 h-3 w-20" />
                </td>
                <td className="px-3 py-3 align-middle">
                  <ShimmerBlock className="h-4 w-12" />
                </td>
                <td className="px-4 py-3 align-middle text-right">
                  <div className="flex justify-end gap-0.5">
                    <ShimmerBlock className="size-8 rounded-md" />
                    <ShimmerBlock className="size-8 rounded-md" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 border-t border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <ShimmerBlock className="h-4 w-28" />
        <ShimmerBlock className="h-10 w-52" />
        <ShimmerBlock className="h-10 w-36" />
      </div>
    </section>
  )
}
