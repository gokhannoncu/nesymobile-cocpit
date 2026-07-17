"use client";

import { cn } from "@nesy/metronic/lib/utils";

export function ShimmerBlock({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-shimmer rounded-md bg-[linear-gradient(110deg,var(--muted)_8%,var(--background)_18%,var(--muted)_33%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

const TABLE_COLUMNS = ["min-w-[12rem] flex-[2]", "w-20", "w-24", "w-28", "w-24", "w-20", "w-36"] as const;

export function HappyPathPageShimmer() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading happy path operations">
      <section className="rounded-2xl border bg-card p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <ShimmerBlock className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <ShimmerBlock className="h-3 w-24" />
              <ShimmerBlock className="h-7 w-72 max-w-full" />
              <ShimmerBlock className="h-4 w-full max-w-2xl" />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ShimmerBlock className="h-10 w-[108px]" />
            <ShimmerBlock className="h-10 w-[124px]" />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b px-3.5 py-3.5">
          <ShimmerBlock className="h-10 w-full sm:w-[320px]" />
          <ShimmerBlock className="h-10 w-[140px]" />
          <ShimmerBlock className="h-10 w-[156px]" />
        </div>

        <div className="hidden border-b bg-muted/40 px-4 py-3 sm:flex sm:gap-4">
          {TABLE_COLUMNS.map((widthClass, index) => (
            <ShimmerBlock key={index} className={cn("h-3", widthClass)} />
          ))}
        </div>

        {Array.from({ length: 3 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex flex-col gap-2 border-b px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className={cn("space-y-1.5", TABLE_COLUMNS[0])}>
              <ShimmerBlock className="h-4 w-4/5" />
              <ShimmerBlock className="h-3 w-1/2" />
            </div>
            <ShimmerBlock className={cn("hidden h-6 lg:block", TABLE_COLUMNS[1])} />
            <ShimmerBlock className={cn("hidden h-6 lg:block", TABLE_COLUMNS[2])} />
            <ShimmerBlock className={cn("h-4", TABLE_COLUMNS[3])} />
            <ShimmerBlock className={cn("h-6", TABLE_COLUMNS[4])} />
            <ShimmerBlock className={cn("h-4", TABLE_COLUMNS[5])} />
            <div className={cn("flex gap-2", TABLE_COLUMNS[6])}>
              <ShimmerBlock className="h-8 w-16" />
              <ShimmerBlock className="h-8 w-16" />
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between border-t px-4 py-3">
          <ShimmerBlock className="h-4 w-32" />
          <ShimmerBlock className="h-8 w-48" />
        </div>
      </section>
    </div>
  );
}
