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
        <ShimmerBlock className="h-3.5 w-32" />
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

function DomainPackGroupCardShimmer({ compactHeader = false }: { compactHeader?: boolean }) {
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
      className="overflow-hidden rounded-lg border bg-gradient-to-br from-nesy-soft/80 via-background to-background p-4 lg:p-5"
      aria-hidden
    >
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
      <div className="flex gap-2">
        <ShimmerBlock className="h-10 flex-1 rounded-lg" />
        <ShimmerBlock className="size-10 shrink-0 rounded-lg" />
      </div>
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
    <div className="container mx-auto max-w-7xl space-y-6 p-6" aria-busy="true" aria-label="Loading domain pack">
      <header className="flex flex-col gap-4 border-b border-border pb-6" aria-hidden>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ShimmerBlock className="size-9 shrink-0 rounded-full" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <ShimmerBlock className="h-7 w-48" />
                <ShimmerBlock className="h-6 w-20 rounded-full" />
              </div>
              <ShimmerBlock className="h-4 w-56" />
            </div>
          </div>
          <div className="flex gap-2">
            <ShimmerBlock className="h-9 w-28 rounded-lg" />
            <ShimmerBlock className="h-9 w-28 rounded-lg" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      </header>
      <div className="flex gap-2" aria-hidden>
        {Array.from({ length: 5 }).map((_, index) => (
          <ShimmerBlock key={index} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      <ShimmerBlock className="h-96 w-full rounded-lg" />
    </div>
  )
}

export function DomainPackSurfacesPageShimmer() {
  return (
    <div className="container mx-auto max-w-7xl p-6" aria-busy="true" aria-label="Loading surface registry">
      <div className="mb-6 flex items-center gap-3" aria-hidden>
        <ShimmerBlock className="size-9 shrink-0 rounded-full" />
        <div className="space-y-2">
          <ShimmerBlock className="h-7 w-44" />
          <ShimmerBlock className="h-4 w-40" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="border-b border-border/70 px-4 py-3">
          <ShimmerBlock className="h-4 w-32" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border/70">
                {['Screen', 'Surface', 'Targets', 'Actions'].map((col) => (
                  <th key={col} className="px-4 py-3 text-left">
                    <ShimmerBlock className="h-3 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50 last:border-b-0">
                <td className="px-4 py-3"><ShimmerBlock className="h-4 w-28" /></td>
                <td className="px-4 py-3"><ShimmerBlock className="h-4 w-36" /></td>
                <td className="px-4 py-3"><ShimmerBlock className="h-4 w-12" /></td>
                <td className="px-4 py-3"><ShimmerBlock className="ms-auto h-8 w-20 rounded-lg" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
