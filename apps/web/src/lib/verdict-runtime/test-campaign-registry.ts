import type { TestCampaignCatalogItemApi } from '@/lib/verdict-runtime/types'
import type { Tone } from '@/components/product/tones'
import { cn } from '@nesy/metronic/lib/utils'

export type CampaignStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | string
export type CampaignGateResult = 'PASS' | 'FAIL' | 'NOT_EVALUATED' | string

export const campaignBadgeBase =
  'inline-flex rounded-[4px] border px-1.5 py-px text-[8px] font-bold uppercase tracking-wide leading-none'

export const campaignBadgePrimary = cn(
  campaignBadgeBase,
  'border-nesy/30 bg-nesy-soft text-nesy-ink dark:border-nesy/35 dark:bg-nesy-soft/20 dark:text-nesy',
)

export const campaignBadgeSecondary = cn(
  campaignBadgeBase,
  'border-nesy/25 bg-background text-nesy-ink dark:border-nesy/30 dark:bg-card dark:text-nesy',
)

export const campaignBadgeWarning = cn(
  campaignBadgeBase,
  'border-nesy-muted/70 bg-nesy-muted/25 text-nesy-ink dark:border-nesy/25 dark:bg-nesy-soft/10 dark:text-nesy',
)

export const campaignBadgeNeutral = cn(
  campaignBadgeBase,
  'border-border bg-muted/35 text-muted-foreground',
)

function normalizeCampaignType(type: string): string {
  return type.replace(/^persist-/, '').toUpperCase()
}

export function campaignTypeBadgeClass(type: string): string {
  switch (normalizeCampaignType(type)) {
    case 'RELEASE':
      return campaignBadgePrimary
    case 'PR':
    case 'NIGHTLY':
    case 'WEEKLY':
      return campaignBadgeSecondary
    default:
      return campaignBadgeNeutral
  }
}

export function campaignStatusBadgeClass(status: CampaignStatus): string {
  switch (status) {
    case 'RUNNING':
      return campaignBadgePrimary
    case 'COMPLETED':
      return campaignBadgeSecondary
    case 'BLOCKED':
      return campaignBadgeWarning
    case 'PENDING':
      return campaignBadgeNeutral
    default:
      return campaignBadgeNeutral
  }
}

export function campaignGateResultBadgeClass(result: CampaignGateResult): string {
  switch (result) {
    case 'PASS':
      return campaignBadgePrimary
    case 'FAIL':
      return campaignBadgeWarning
    case 'NOT_EVALUATED':
      return campaignBadgeNeutral
    default:
      return campaignBadgeNeutral
  }
}

export function campaignCellResultBadgeClass(result: string): string {
  switch (result) {
    case 'PASS':
      return campaignBadgePrimary
    case 'FAIL':
    case 'BLOCKED':
      return campaignBadgeWarning
    case 'PARTIAL':
      return campaignBadgeSecondary
    case 'PENDING':
      return campaignBadgeNeutral
    default:
      return campaignBadgeNeutral
  }
}

export function testCampaignDetailHref(campaignId: string): string {
  return `/automation/test-campaigns/${encodeURIComponent(campaignId)}`
}

export function campaignTypeTone(type: string): Tone {
  const normalized = normalizeCampaignType(type)
  switch (normalized) {
    case 'PR':
      return 'blue'
    case 'NIGHTLY':
      return 'purple'
    case 'WEEKLY':
      return 'teal'
    case 'RELEASE':
      return 'nesy'
    default:
      return 'gray'
  }
}

export function campaignStatusTone(status: CampaignStatus): Tone {
  switch (status) {
    case 'RUNNING':
      return 'blue'
    case 'COMPLETED':
      return 'teal'
    case 'BLOCKED':
      return 'orange'
    case 'PENDING':
      return 'gray'
    default:
      return 'gray'
  }
}

export function campaignGateResultTone(result: CampaignGateResult): Tone {
  switch (result) {
    case 'PASS':
      return 'teal'
    case 'FAIL':
      return 'orange'
    case 'NOT_EVALUATED':
      return 'gray'
    default:
      return 'gray'
  }
}

export function countCampaignsByType(items: readonly TestCampaignCatalogItemApi[]) {
  const counts: Record<string, number> = {}
  for (const item of items) counts[item.campaignKey] = (counts[item.campaignKey] ?? 0) + 1
  return counts
}

export function campaignStatusRank(status: CampaignStatus): number {
  switch (status) {
    case 'BLOCKED':
      return 0
    case 'RUNNING':
      return 1
    case 'PENDING':
      return 2
    case 'COMPLETED':
      return 3
    default:
      return 4
  }
}

export function sumCampaignCells(items: readonly TestCampaignCatalogItemApi[]): number {
  return items.reduce((total, item) => total + item.cellCount, 0)
}

export function campaignCellResultTone(result: string): Tone {
  switch (result) {
    case 'PASS':
      return 'teal'
    case 'FAIL':
      return 'red'
    case 'BLOCKED':
      return 'orange'
    case 'PARTIAL':
      return 'amber'
    case 'PENDING':
      return 'gray'
    default:
      return 'gray'
  }
}
