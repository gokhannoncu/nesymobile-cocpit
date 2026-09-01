'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import { cn } from '@nesy/metronic/lib/utils'

function TestProfileRegistryHeroShimmer() {
  return (
    <div
      className="overflow-hidden rounded-lg border bg-gradient-to-br from-nesy-soft/80 via-background to-background p-4 lg:p-5"
      aria-hidden
    >
      <ShimmerBlock className="h-3 w-40" />
      <ShimmerBlock className="mt-2 h-7 w-52" />
      <ShimmerBlock className="mt-2 h-4 w-full max-w-2xl" />
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <ShimmerBlock key={index} className="h-6 w-20 rounded-full" />
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

function TestProfileRegistryCommandShimmer() {
  return (
    <div className="rounded-[8px] border border-border/80 bg-card p-3" aria-hidden>
      <div className="flex gap-2">
        <ShimmerBlock className="h-9 flex-1 rounded-[8px]" />
        <ShimmerBlock className="size-9 shrink-0 rounded-[8px]" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <ShimmerBlock key={index} className="h-7 w-20 rounded-[8px]" />
        ))}
      </div>
    </div>
  )
}

function TestProfileTableRowShimmer() {
  const cellGrid = 'border-b border-r border-border last:border-r-0'
  const tdClass = `px-2.5 py-1.5 align-middle ${cellGrid}`

  return (
    <tr className="bg-card" aria-hidden>
      <td className={tdClass}>
        <ShimmerBlock className="h-4 w-16 rounded-[8px]" />
      </td>
      <td className={tdClass}>
        <ShimmerBlock className="h-3.5 w-36" />
        <ShimmerBlock className="mt-1 h-2.5 w-12" />
      </td>
      <td className={tdClass}>
        <ShimmerBlock className="h-4 w-16 rounded-[8px]" />
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <ShimmerBlock className="h-4 w-12 rounded-[8px]" />
      </td>
      <td className={cn('hidden lg:table-cell', tdClass)}>
        <ShimmerBlock className="h-3.5 w-24" />
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <ShimmerBlock className="h-3.5 w-12" />
        </div>
      </td>
    </tr>
  )
}

function TestProfilePackGroupShimmer() {
  const cellGrid = 'border-b border-r border-border last:border-r-0'
  const thClass = `px-2.5 py-1.5 ${cellGrid}`

  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
      <div className="flex flex-col gap-2 border-b border-border bg-muted/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <ShimmerBlock className="h-4 w-36" />
          <ShimmerBlock className="h-3 w-56" />
        </div>
        <ShimmerBlock className="h-3 w-20" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40">
              {['Kind', 'Profile', 'Result', 'Gate', 'Owner', 'Open'].map((col) => (
                <th
                  key={col}
                  className={cn(
                    'text-left',
                    thClass,
                    col === 'Gate' && 'hidden md:table-cell',
                    col === 'Owner' && 'hidden lg:table-cell',
                  )}
                >
                  <ShimmerBlock className="h-2.5 w-14" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TestProfileTableRowShimmer />
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function TestProfilesPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading test profiles">
      <div className="space-y-4">
        <TestProfileRegistryHeroShimmer />
        <TestProfileRegistryCommandShimmer />
      </div>
      <TestProfilePackGroupShimmer />
    </div>
  )
}

export function TestProfileDetailPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading test profile">
      <div className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />
          <div className="flex items-start gap-3">
            <ShimmerBlock className="size-10 shrink-0 rounded-[8px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-7 w-72 max-w-full" />
              <ShimmerBlock className="h-5 w-96 max-w-full" />
              <ShimmerBlock className="h-4 w-full max-w-lg" />
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-16 rounded-[8px]" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2" aria-hidden>
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-[8px] border border-border bg-card">
            <div className="border-b border-border bg-muted/10 px-4 py-3">
              <ShimmerBlock className="h-4 w-32" />
              <ShimmerBlock className="mt-1.5 h-3 w-56" />
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {Array.from({ length: 4 }).map((__, chipIndex) => (
                <ShimmerBlock key={chipIndex} className="h-7 w-28 rounded-[4px]" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="border-b border-border bg-muted/10 px-4 py-3">
          <ShimmerBlock className="h-4 w-36" />
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-16 rounded-[8px]" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function TestCampaignsPageShimmer() {
  const cellGrid = 'border-b border-r border-border last:border-r-0'
  const thClass = `px-2.5 py-1.5 ${cellGrid}`
  const tdClass = `px-2.5 py-1.5 align-middle ${cellGrid}`

  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading test campaigns">
      <div className="space-y-4">
        <TestProfileRegistryHeroShimmer />
        <TestProfileRegistryCommandShimmer />
      </div>

      <article className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="border-b border-border bg-muted/10 px-3 py-2">
          <ShimmerBlock className="h-4 w-32" />
          <ShimmerBlock className="mt-1.5 h-3 w-48" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40">
                {['Type', 'Campaign', 'Status', 'Cells', 'Gate', 'Open'].map((col) => (
                  <th key={col} className={thClass}>
                    <ShimmerBlock className="h-2.5 w-14" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 2 }).map((_, index) => (
                <tr key={index} className="bg-card">
                  <td className={tdClass}>
                    <ShimmerBlock className="h-4 w-16 rounded-[8px]" />
                  </td>
                  <td className={tdClass}>
                    <ShimmerBlock className="h-3.5 w-40" />
                    <ShimmerBlock className="mt-1 h-2.5 w-12" />
                  </td>
                  <td className={tdClass}>
                    <ShimmerBlock className="h-4 w-16 rounded-[8px]" />
                  </td>
                  <td className={tdClass}>
                    <ShimmerBlock className="h-3.5 w-8" />
                  </td>
                  <td className={tdClass}>
                    <ShimmerBlock className="h-4 w-20 rounded-md" />
                  </td>
                  <td className={tdClass}>
                    <div className="flex justify-end">
                      <ShimmerBlock className="h-3.5 w-12" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}

export function TestCampaignDetailPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading campaign detail">
      <div className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />
          <div className="flex items-start gap-3">
            <ShimmerBlock className="size-10 shrink-0 rounded-[8px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-2">
                <ShimmerBlock className="h-5 w-16 rounded-[4px]" />
                <ShimmerBlock className="h-5 w-20 rounded-[4px]" />
              </div>
              <ShimmerBlock className="h-7 w-80 max-w-full" />
              <ShimmerBlock className="h-4 w-64 max-w-full" />
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-16 rounded-[8px]" />
            ))}
          </div>
        </div>
      </div>
      <ShimmerBlock className="h-20 w-full rounded-[8px]" />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-hidden>
        {Array.from({ length: 5 }).map((_, index) => (
          <ShimmerBlock key={index} className="h-20 rounded-[8px]" />
        ))}
      </div>
      <div className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="border-b border-border bg-muted/10 px-4 py-3">
          <ShimmerBlock className="h-4 w-36" />
        </div>
        <div className="p-4">
          <ShimmerBlock className="h-40 w-full rounded-[8px]" />
        </div>
      </div>
    </div>
  )
}

export function FeatureDetailPageShimmer() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading feature detail">
      <div className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />
          <div className="flex items-start gap-3">
            <ShimmerBlock className="size-9 shrink-0 rounded-full" />
            <ShimmerBlock className="size-10 shrink-0 rounded-[8px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-7 w-64 max-w-full" />
              <ShimmerBlock className="h-5 w-80 max-w-full rounded-[4px]" />
              <ShimmerBlock className="h-4 w-full max-w-lg" />
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-16 rounded-[8px]" />
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-[8px] border border-border bg-card" aria-hidden>
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
          <ShimmerBlock className="h-4 w-32" />
          <ShimmerBlock className="h-8 w-40 rounded-[8px]" />
        </div>
        <div className="grid min-h-[480px] lg:grid-cols-2">
          <div className="space-y-3 border-b border-border p-4 lg:border-b-0 lg:border-r lg:p-5">
            <ShimmerBlock className="h-3 w-28" />
            <ShimmerBlock className="h-24 w-full rounded-[8px]" />
            <ShimmerBlock className="h-32 w-full rounded-[8px]" />
            <ShimmerBlock className="h-20 w-full rounded-[8px]" />
          </div>
          <div className="p-4 lg:p-5">
            <ShimmerBlock className="mb-3 h-3 w-24" />
            <ShimmerBlock className="h-[min(420px,50vh)] w-full rounded-[8px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
