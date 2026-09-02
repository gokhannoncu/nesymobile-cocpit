'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import { cn } from '@nesy/metronic/lib/utils'

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = `px-2.5 py-1.5 ${cellGrid}`
const tdClass = `px-2.5 py-1.5 align-middle ${cellGrid}`

function DomainPackTableRowShimmer({ highlight }: { highlight?: boolean }) {
  return (
    <tr className={highlight ? 'bg-nesy-soft/30' : 'bg-muted/50'} aria-hidden>
      <td className={tdClass}>
        <div className="flex items-center gap-1.5">
          <ShimmerBlock className="h-3.5 w-14" />
          {highlight ? <ShimmerBlock className="h-4 w-12 rounded-md" /> : null}
        </div>
      </td>
      <td className={tdClass}>
        <ShimmerBlock className="h-5 w-20 rounded-md" />
      </td>
      <td className={tdClass}>
        <ShimmerBlock className="h-3.5 w-8" />
      </td>
      <td className={tdClass}>
        <ShimmerBlock className="h-3.5 w-20" />
        <ShimmerBlock className="mt-1 h-2.5 w-12" />
      </td>
      <td className={cn('hidden lg:table-cell', tdClass)}>
        <ShimmerBlock className="h-4 w-36 rounded-md" />
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <ShimmerBlock className="h-3.5 w-12" />
        </div>
      </td>
    </tr>
  )
}

export function DomainPackGroupCardShimmer({ compactHeader = false }: { compactHeader?: boolean }) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card" aria-hidden>
      {!compactHeader ? (
        <header className="relative border-b border-border/80 bg-gradient-to-br from-nesy-soft/25 via-background to-muted/15 px-4 py-4">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />
          <div className="flex flex-wrap items-center gap-2.5">
            <ShimmerBlock className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ShimmerBlock className="h-5 w-36" />
                <ShimmerBlock className="h-5 w-20 rounded-full" />
              </div>
              <ShimmerBlock className="h-3 w-44" />
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-16 rounded-lg" />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <ShimmerBlock className="h-8 w-28 rounded-lg" />
            <ShimmerBlock className="h-8 w-24 rounded-lg" />
          </div>
        </header>
      ) : (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/15 px-3 py-2">
          <div className="space-y-1.5">
            <ShimmerBlock className="h-4 w-32" />
            <ShimmerBlock className="h-3 w-40" />
          </div>
          <ShimmerBlock className="h-3 w-28" />
        </div>
      )}

      <div className="overflow-x-auto border-t border-border">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className={thClass}>Version</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Revision</th>
              <th className={thClass}>Published</th>
              <th className={cn('hidden lg:table-cell', thClass)}>Digest</th>
              <th className={cn('w-16 text-right', thClass)}>Open</th>
            </tr>
          </thead>
          <tbody>
            <DomainPackTableRowShimmer highlight />
          </tbody>
        </table>
      </div>
    </article>
  )
}

function DomainPackCatalogHeroShimmer() {
  return (
    <div
      className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-nesy-soft/80 via-background to-background p-4 lg:p-5"
      aria-hidden
    >
      <ShimmerBlock className="absolute right-4 top-4 h-10 w-[7.5rem] rounded-full" />
      <ShimmerBlock className="h-3 w-36" />
      <ShimmerBlock className="mt-2 h-7 w-56" />
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

function DomainPackCatalogCommandShimmer() {
  return (
    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-xs" aria-hidden>
      <ShimmerBlock className="h-10 w-full rounded-lg" />
      <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <ShimmerBlock className="size-10 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <div className="flex gap-2">
              <ShimmerBlock className="h-4 w-28" />
              <ShimmerBlock className="h-4 w-20 rounded-full" />
            </div>
            <ShimmerBlock className="h-3 w-36" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2 lg:justify-center">
          {Array.from({ length: 3 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-8 w-28 rounded-full" />
          ))}
        </div>
        <div className="flex gap-2">
          <ShimmerBlock className="h-8 w-28 rounded-lg" />
          <ShimmerBlock className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function DomainPackCatalogPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading domain pack catalog">
      <div className="space-y-4">
        <DomainPackCatalogHeroShimmer />
        <DomainPackCatalogCommandShimmer />
      </div>
      <DomainPackGroupCardShimmer compactHeader />
    </div>
  )
}

export function DomainPackDetailPageShimmer() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading domain pack">
      <header className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShimmerBlock className="size-9 shrink-0 rounded-full" />
              <ShimmerBlock className="size-10 shrink-0 rounded-[8px]" />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <ShimmerBlock className="h-7 w-48" />
                  <ShimmerBlock className="h-5 w-20 rounded-[4px]" />
                </div>
                <ShimmerBlock className="h-4 w-56" />
              </div>
            </div>
            <ShimmerBlock className="h-10 w-56 rounded-[8px]" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-16 rounded-[8px]" />
            ))}
          </div>
          <div className="mt-3 border-t border-border/70 pt-3">
            <ShimmerBlock className="h-7 w-48 rounded-[4px]" />
          </div>
        </div>
      </header>
      <div className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="flex min-h-[520px] flex-col lg:flex-row">
          <div className="hidden border-e border-border bg-muted/10 p-3 lg:block lg:w-[15.5rem]">
            <ShimmerBlock className="mb-3 h-3 w-24" />
            <div className="space-y-1.5">
              {Array.from({ length: 9 }).map((_, index) => (
                <ShimmerBlock key={index} className="h-14 rounded-[8px]" />
              ))}
            </div>
          </div>
          <div className="border-b border-border bg-muted/10 p-3 lg:hidden">
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 5 }).map((_, index) => (
                <ShimmerBlock key={index} className="h-9 w-28 shrink-0 rounded-[8px]" />
              ))}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="border-b border-border bg-muted/10 px-4 py-3 lg:px-5">
              <div className="flex items-start gap-3">
                <ShimmerBlock className="size-9 shrink-0 rounded-[8px]" />
                <div className="space-y-2">
                  <ShimmerBlock className="h-4 w-32" />
                  <ShimmerBlock className="h-3 w-56" />
                </div>
              </div>
            </div>
            <div className="p-4 lg:p-5">
              <ShimmerBlock className="h-96 w-full rounded-[8px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DomainPackSurfacesPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading surface registry">
      <div className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />
          <div className="flex items-start gap-3">
            <ShimmerBlock className="size-10 shrink-0 rounded-[8px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-7 w-48 max-w-full" />
              <ShimmerBlock className="h-4 w-56 max-w-full" />
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-16 rounded-[8px]" />
            ))}
          </div>
        </div>
      </div>
      <ShimmerBlock className="h-36 w-full rounded-[8px]" />
      <div className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="border-b border-border bg-muted/10 px-4 py-3">
          <ShimmerBlock className="h-4 w-32" />
        </div>
        <div className="p-4">
          <ShimmerBlock className="h-56 w-full rounded-[8px]" />
        </div>
      </div>
      <ShimmerBlock className="h-72 w-full rounded-[8px]" />
    </div>
  )
}
