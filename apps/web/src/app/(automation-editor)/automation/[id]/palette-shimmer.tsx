'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'

function PaletteDomainPackBannerShimmer() {
  return (
    <div
      className="mt-3 flex items-start gap-2.5 rounded-[8px] border border-slate-200/70 bg-white px-2.5 py-2.5"
      aria-hidden
    >
      <ShimmerBlock className="size-9 shrink-0 rounded-[8px]" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <ShimmerBlock className="h-4 w-[58%]" />
          <ShimmerBlock className="size-3.5 shrink-0 rounded-sm" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ShimmerBlock className="h-5 w-[4.75rem] rounded-md" />
          <ShimmerBlock className="h-5 w-12 rounded-md" />
        </div>
        <ShimmerBlock className="h-2.5 w-[46%]" />
        <ShimmerBlock className="h-2.5 w-24" />
      </div>
    </div>
  )
}

function PaletteTemplateCardShimmer() {
  return (
    <div
      className="flex min-h-[52px] items-center gap-2.5 rounded-[8px] border border-slate-200/70 bg-white px-2.5 py-2"
      aria-hidden
    >
      <ShimmerBlock className="size-8 shrink-0 rounded-[8px]" />
      <div className="min-w-0 flex-1">
        <ShimmerBlock className="h-3.5 w-[55%]" />
        <ShimmerBlock className="mt-1.5 h-2.5 w-[75%]" />
      </div>
      <ShimmerBlock className="size-4 shrink-0 rounded-sm" />
    </div>
  )
}

function PaletteTemplatesSectionShimmer() {
  return (
    <section className="mt-4" aria-hidden>
      <div className="mb-2 flex items-center gap-2 px-1">
        <ShimmerBlock className="h-4 w-24" />
        <ShimmerBlock className="h-4 w-5 rounded-full" />
        <ShimmerBlock className="ms-auto size-3.5 rounded-sm" />
      </div>
      <PaletteTemplateCardShimmer />
    </section>
  )
}

function PaletteActionCardShimmer() {
  return (
    <div
      className="flex items-start gap-2.5 rounded-[8px] border border-slate-200/70 bg-white px-2.5 py-2"
      aria-hidden
    >
      <ShimmerBlock className="mt-0.5 size-7 shrink-0 rounded-[8px]" />
      <div className="min-w-0 flex-1">
        <ShimmerBlock className="h-3.5 w-[68%]" />
        <ShimmerBlock className="mt-1.5 h-2.5 w-[88%]" />
      </div>
    </div>
  )
}

function PaletteSubgroupShimmer({ cardCount }: { cardCount: number }) {
  return (
    <div className="space-y-1.5" aria-hidden>
      <ShimmerBlock className="h-3 w-[54%]" />
      <div className="space-y-1.5">
        {Array.from({ length: cardCount }).map((_, index) => (
          <PaletteActionCardShimmer key={index} />
        ))}
      </div>
    </div>
  )
}

function PaletteSectionShimmer({ subgroupCounts }: { subgroupCounts: number[] }) {
  return (
    <section className="mt-4 border-t border-slate-200/70 pt-4" aria-hidden>
      <div className="mb-2 flex items-center gap-2 px-1">
        <ShimmerBlock className="h-4 w-[58%]" />
        <ShimmerBlock className="h-4 w-5 rounded-full" />
        <ShimmerBlock className="ms-auto size-3.5 rounded-sm" />
      </div>
      <div className="space-y-3">
        {subgroupCounts.map((count, index) => (
          <PaletteSubgroupShimmer key={index} cardCount={count} />
        ))}
      </div>
    </section>
  )
}

/** Unified left-palette skeleton — templates + domain pack sections load together. */
export function PaletteLoadingShimmer() {
  return (
    <div
      className="mt-3 space-y-0"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading component palette"
    >
      <PaletteDomainPackBannerShimmer />

      <PaletteTemplatesSectionShimmer />
      <PaletteSectionShimmer subgroupCounts={[1, 3, 2]} />

      <span className="sr-only">Loading component palette…</span>
    </div>
  )
}

/** @deprecated Use PaletteLoadingShimmer */
export const PalettePackLoadingShimmer = PaletteLoadingShimmer
