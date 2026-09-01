'use client'

import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import { DataTableShimmer, MetricCardsShimmer, PageTitleShimmer } from './shared-shimmer'

export function TestProfilesPageShimmer() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8" aria-busy="true" aria-label="Loading test profiles">
      <PageTitleShimmer />
      <DataTableShimmer
        columns={['Profile', 'Kind', 'Last Result', 'Release Gate', 'Owner']}
        rowCount={1}
      />
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
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8" aria-busy="true" aria-label="Loading test campaigns">
      <PageTitleShimmer withDescription={false} />
      <ShimmerBlock className="h-4 w-80" />
      <DataTableShimmer
        columns={['Campaign', 'Type', 'Status', 'Cells', 'Release Gate']}
        rowCount={1}
      />
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
      <MetricCardsShimmer count={4} columns="md:grid-cols-4" />
      <div className="space-y-4" aria-hidden>
        <ShimmerBlock className="h-6 w-40" />
        <DataTableShimmer columns={['Device', 'Profile', 'Result', 'Run', 'Blocked']} rowCount={1} />
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
