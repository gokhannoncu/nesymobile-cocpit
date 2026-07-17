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

export function AutomationListStatCardsShimmer() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-md border border-border bg-card px-4 py-2.5 shadow-xs"
          aria-hidden
        >
          <div className="flex items-center gap-3">
            <ShimmerBlock className="size-11 shrink-0" />
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

export function AutomationListGridShimmer({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Loading workflows"
    >
      {Array.from({ length: count }).map((_, index) => (
        <WorkflowCardSkeleton key={index} />
      ))}
    </div>
  )
}

function WorkflowCardSkeleton() {
  return (
    <article className="rounded-md border border-border bg-card p-4 shadow-xs" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <ShimmerBlock className="h-6 w-20" />
        <ShimmerBlock className="h-6 w-24" />
      </div>
      <div className="mt-5 flex items-center gap-4">
        <ShimmerBlock className="size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <ShimmerBlock className="h-6 w-4/5" />
          <ShimmerBlock className="mt-2 h-4 w-3/5" />
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0 flex-1">
          <ShimmerBlock className="h-3 w-24" />
          <ShimmerBlock className="mt-2 h-3 w-12" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ShimmerBlock className="h-9 w-16" />
          <ShimmerBlock className="h-9 w-20" />
        </div>
      </div>
    </article>
  )
}
