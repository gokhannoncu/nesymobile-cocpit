'use client'

import { cn } from '@nesy/metronic/lib/utils'

export function ShimmerBlock({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block animate-shimmer rounded-md bg-[linear-gradient(110deg,var(--muted)_8%,var(--background)_18%,var(--muted)_33%)] bg-[length:200%_100%]',
        className,
      )}
    />
  )
}

/** Full-page skeleton while catalog + recent history load. */
export function MongodbQueryGeneratorPageShimmer() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading MongoDB Query Generator">
      <section className="rounded-2xl border bg-card p-5 lg:p-6" aria-hidden>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <ShimmerBlock className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-3 w-28" />
              <ShimmerBlock className="h-7 w-64 max-w-full" />
              <ShimmerBlock className="h-4 w-full max-w-xl" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShimmerBlock className="h-8 w-28" />
            <ShimmerBlock className="h-8 w-32" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5" aria-hidden>
        <ShimmerBlock className="h-4 w-48" />
        <ShimmerBlock className="mt-2 h-3 w-80 max-w-full" />

        <div className="mt-4 space-y-3">
          <ShimmerBlock className="h-3 w-36" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <ShimmerBlock key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3">
                <ShimmerBlock className="h-3.5 w-3/4" />
                <ShimmerBlock className="mt-2 h-2.5 w-1/3" />
                <ShimmerBlock className="mt-2 h-8 w-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <ShimmerBlock className="h-3 w-32" />
          <ShimmerBlock className="h-[120px] w-full rounded-lg" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <ShimmerBlock className="h-3 w-16" />
              <ShimmerBlock className="h-8 w-full" />
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ShimmerBlock className="h-10 w-full" />
          <div className="space-y-2.5 rounded-lg border p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <ShimmerBlock className="h-3 w-40" />
                  <ShimmerBlock className="h-2.5 w-56 max-w-full" />
                </div>
                <ShimmerBlock className="h-5 w-9 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2 border-t pt-4">
          <ShimmerBlock className="h-9 w-36" />
          <ShimmerBlock className="h-9 w-28" />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5" aria-hidden>
        <ShimmerBlock className="h-[280px] w-full rounded-xl" />
      </section>

      <section className="space-y-3" aria-hidden>
        <ShimmerBlock className="h-3 w-16" />
        <ShimmerBlock className="h-6 w-40" />
        <ShimmerBlock className="h-3 w-72 max-w-full" />
        <RecentQueriesTableShimmer rows={5} />
      </section>
    </div>
  )
}

export function RecentQueriesTableShimmer({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-background"
      aria-busy="true"
      aria-label="Loading recent queries"
    >
      <div className="border-b bg-muted/40 px-3 py-2.5">
        <div className="flex gap-6">
          {['w-40', 'w-24', 'w-20', 'w-24', 'w-28', 'w-16', 'w-20'].map((w, i) => (
            <ShimmerBlock key={i} className={cn('h-3', w)} />
          ))}
        </div>
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-3 py-3" aria-hidden>
            <ShimmerBlock className="h-3.5 w-44" />
            <ShimmerBlock className="h-3 w-24" />
            <ShimmerBlock className="h-3 w-16" />
            <ShimmerBlock className="h-3 w-20" />
            <ShimmerBlock className="h-3 w-28" />
            <ShimmerBlock className="h-3 w-16" />
            <div className="ms-auto flex gap-2">
              <ShimmerBlock className="h-7 w-14" />
              <ShimmerBlock className="h-7 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
