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
    <div className="mx-auto max-w-4xl space-y-8 p-8" aria-busy="true" aria-label="Loading test profile">
      <div className="space-y-2" aria-hidden>
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-8 w-48" />
          <ShimmerBlock className="h-6 w-20 rounded-full" />
        </div>
        <ShimmerBlock className="h-4 w-24" />
      </div>
      <div className="space-y-4" aria-hidden>
        <ShimmerBlock className="h-5 w-32" />
        <div className="flex justify-between gap-4">
          <ShimmerBlock className="h-4 w-24" />
          <ShimmerBlock className="h-4 w-20" />
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
    <div className="mx-auto max-w-6xl space-y-8 p-8" aria-busy="true" aria-label="Loading campaign">
      <div className="flex items-center gap-3" aria-hidden>
        <ShimmerBlock className="h-8 w-64" />
        <ShimmerBlock className="h-6 w-20 rounded-full" />
      </div>
      <ShimmerBlock className="h-20 w-full rounded-xl" />
      <div className="grid gap-3 md:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border/70 bg-background/80 p-4">
            <ShimmerBlock className="h-3 w-20" />
            <ShimmerBlock className="mt-3 h-8 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FeatureDetailPageShimmer() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading feature detail">
      <div className="space-y-2" aria-hidden>
        <ShimmerBlock className="h-3 w-40" />
        <ShimmerBlock className="h-8 w-72 max-w-full" />
        <ShimmerBlock className="h-4 w-56" />
      </div>
      <ShimmerBlock className="h-80 w-full rounded-xl" />
    </div>
  )
}
