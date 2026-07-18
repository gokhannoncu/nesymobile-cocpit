'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'

export function FieldCourierLoginTableShimmer({ rowCount = 8 }: { rowCount?: number }) {
  return (
    <section
      className="overflow-hidden rounded-[4px] border border-border bg-card"
      aria-busy="true"
      aria-label="Loading field courier logins"
    >
      <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px]">
        <ShimmerBlock className="h-11 w-full rounded-[4px]" />
        <ShimmerBlock className="h-11 w-full rounded-[4px]" />
        <ShimmerBlock className="h-11 w-full rounded-[4px]" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              {Array.from({ length: 7 }).map((_, index) => (
                <th key={index} className="px-5 py-5">
                  <ShimmerBlock className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border last:border-b-0">
                <td className="px-5 py-4">
                  <ShimmerBlock className="h-4 w-40" />
                  <ShimmerBlock className="mt-2 h-3 w-28" />
                </td>
                <td className="px-3 py-4">
                  <ShimmerBlock className="h-7 w-20 rounded-[4px]" />
                </td>
                <td className="px-3 py-4">
                  <ShimmerBlock className="h-4 w-24" />
                </td>
                <td className="px-3 py-4">
                  <ShimmerBlock className="h-4 w-28" />
                </td>
                <td className="px-3 py-4">
                  <ShimmerBlock className="h-4 w-20" />
                </td>
                <td className="px-3 py-4">
                  <ShimmerBlock className="h-4 w-16" />
                </td>
                <td className="px-5 py-4 text-right">
                  <ShimmerBlock className="ml-auto size-9 rounded-[4px]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
