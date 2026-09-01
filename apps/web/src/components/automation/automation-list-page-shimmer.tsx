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
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
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
    <article
      className="flex min-h-[232px] flex-col overflow-hidden rounded-xl border border-border/90 bg-card shadow-xs"
      aria-hidden
    >
      <div className="flex flex-1 flex-col p-4 pb-3">
        <div className="flex gap-3">
          <ShimmerBlock className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <ShimmerBlock className="h-4 w-4/5" />
            <ShimmerBlock className="mt-2 h-4 w-3/5" />
            <div className="mt-2 flex gap-2">
              <ShimmerBlock className="h-5 w-16 rounded-md" />
              <ShimmerBlock className="h-5 w-14 rounded-md" />
            </div>
          </div>
        </div>
        <div className="mt-3 min-h-[3.75rem] flex-1">
          <ShimmerBlock className="h-4 w-full" />
          <ShimmerBlock className="mt-2 h-4 w-11/12" />
          <ShimmerBlock className="mt-2 h-4 w-4/5" />
        </div>
        <div className="mt-3 flex gap-2 border-t border-border/70 pt-3">
          <ShimmerBlock className="h-3 w-16 rounded-sm" />
          <ShimmerBlock className="h-3 w-8 rounded-sm" />
          <ShimmerBlock className="h-3 w-14 rounded-sm" />
        </div>
      </div>
      <div className="mt-auto border-t border-border/80 bg-muted/15 px-4 py-2.5">
        <ShimmerBlock className="h-4 w-28" />
      </div>
    </article>
  )
}
