import type { TestCampaignCatalogItemApi } from '@/lib/verdict-runtime/types'
import type { Tone } from '@/components/product/tones'

export type CampaignStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | string
export type CampaignGateResult = 'PASS' | 'FAIL' | 'NOT_EVALUATED' | string

export function testCampaignDetailHref(campaignId: string): string {
  return `/automation/test-campaigns/${encodeURIComponent(campaignId)}`
}

export function campaignTypeTone(type: string): Tone {
  const normalized = type.replace(/^persist-/, '').toUpperCase()
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
