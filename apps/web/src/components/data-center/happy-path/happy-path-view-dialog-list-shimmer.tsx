"use client";

import { cn } from "@nesy/metronic/lib/utils";
import { ScrollArea } from "@nesy/metronic/components/ui/scroll-area";
import { ShimmerBlock } from "@/components/data-center/happy-path/happy-path-page-shimmer";

function ListRowShimmer() {
  return (
    <div
      className="flex items-center gap-2 border-b border-border/50 px-5 py-2.5 sm:gap-3 sm:px-6"
      aria-hidden
    >
      <ShimmerBlock className="size-4 shrink-0 rounded" />
      <ShimmerBlock className="size-7 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <ShimmerBlock className="h-3.5 w-[min(100%,12rem)]" />
        <ShimmerBlock className="h-3 w-[min(100%,8rem)]" />
      </div>
      <ShimmerBlock className="h-5 w-14 shrink-0 rounded-full" />
      <ShimmerBlock className="hidden h-4 w-16 shrink-0 sm:block" />
      <ShimmerBlock className="size-4 shrink-0 rounded" />
    </div>
  );
}

function GroupHeaderShimmer() {
  return (
    <div
      className="flex items-center justify-between border-b bg-muted/80 px-5 py-2 sm:px-6"
      aria-hidden
    >
      <ShimmerBlock className="h-3 w-24" />
      <ShimmerBlock className="h-3 w-6" />
    </div>
  );
}

function ToolbarShimmer() {
  return (
    <div
      className="flex min-h-14 shrink-0 items-center border-b bg-muted/10 px-5 py-0 sm:px-6"
      aria-hidden
    >
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="inline-flex h-9 items-center gap-1 rounded-lg border bg-background p-0.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerBlock key={i} className={cn("h-full rounded-md", i === 0 ? "w-16" : "w-[5.5rem]")} />
          ))}
        </div>
        <ShimmerBlock className="h-9 min-w-0 flex-1 rounded-md sm:min-w-[12rem]" />
      </div>
    </div>
  );
}

export function HappyPathViewDialogHeaderShimmer() {
  return (
    <div className="mt-3 space-y-2" aria-hidden>
      <div className="rounded-xl border bg-muted/25 p-1">
        <ShimmerBlock className="h-10 w-full rounded-lg" />
        <div className="flex items-center justify-between gap-2 px-1 pt-2">
          <ShimmerBlock className="h-3 w-48 max-w-full" />
          <ShimmerBlock className="h-5 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function HappyPathViewDialogListShimmer() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-busy aria-label="Loading set entries">
      <ToolbarShimmer />
      <ScrollArea className="min-h-0 flex-1">
        <GroupHeaderShimmer />
        {Array.from({ length: 5 }).map((_, i) => (
          <ListRowShimmer key={`s-${i}`} />
        ))}
        <GroupHeaderShimmer />
        {Array.from({ length: 2 }).map((_, i) => (
          <ListRowShimmer key={`p-${i}`} />
        ))}
        <GroupHeaderShimmer />
        <ListRowShimmer />
      </ScrollArea>
    </div>
  );
}
