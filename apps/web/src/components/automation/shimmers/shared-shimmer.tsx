'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'

export function PageSectionHeaderShimmer() {
  return (
    <header className="space-y-2" aria-hidden>
      <ShimmerBlock className="h-3 w-32" />
      <div className="flex items-center gap-2">
        <ShimmerBlock className="size-5 shrink-0 rounded" />
        <ShimmerBlock className="h-6 w-52 max-w-full" />
      </div>
      <ShimmerBlock className="h-4 w-full max-w-2xl" />
    </header>
  )
}

export function PageTitleShimmer({ withDescription = true }: { withDescription?: boolean }) {
  return (
    <div className="space-y-2" aria-hidden>
      <ShimmerBlock className="h-3 w-40" />
      <ShimmerBlock className="h-8 w-64 max-w-full" />
      {withDescription ? <ShimmerBlock className="h-4 w-full max-w-xl" /> : null}
    </div>
  )
}

export function MetricCardsShimmer({ count = 3, columns = 'md:grid-cols-3' }: { count?: number; columns?: string }) {
  return (
    <div className={`grid gap-4 ${columns}`} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <ShimmerBlock className="h-3 w-20" />
          <ShimmerBlock className="mt-3 h-8 w-12" />
          <ShimmerBlock className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

export function DataTableShimmer({
  columns,
  rowCount = 1,
  title,
}: {
  columns: string[]
  rowCount?: number
  title?: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs" aria-hidden>
      {title ? (
        <div className="border-b border-border/70 px-5 py-3">
          <ShimmerBlock className="h-4 w-40" />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left">
              {columns.map((column) => (
                <th key={column} className="px-4 py-3">
                  <ShimmerBlock className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/50 last:border-b-0">
                {columns.map((column, colIndex) => (
                  <td key={column} className="px-4 py-3">
                    <ShimmerBlock
                      className={
                        colIndex === 0 ? 'h-4 w-36' : colIndex === columns.length - 1 ? 'ms-auto h-6 w-16 rounded-full' : 'h-4 w-20'
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function RegistryToolbarShimmer({ withKindFilter = false }: { withKindFilter?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs" aria-hidden>
      <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <ShimmerBlock className="h-4 w-40" />
          <ShimmerBlock className="h-3 w-56" />
        </div>
        <ShimmerBlock className="h-9 w-full rounded-lg sm:max-w-xs" />
      </div>
      {withKindFilter ? (
        <div className="border-b border-border/70 px-4 py-3">
          <ShimmerBlock className="mb-2 h-3 w-12" />
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-muted/35 p-1 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-9 rounded-lg" />
            ))}
          </div>
        </div>
      ) : null}
      <div className="px-4 py-3">
        <ShimmerBlock className="mb-2 h-3 w-20" />
        <div className="flex gap-2">
          {Array.from({ length: 1 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-8 w-28 shrink-0 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
