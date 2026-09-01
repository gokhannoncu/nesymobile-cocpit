'use client'

import { cn } from '@nesy/metronic/lib/utils'
import { campaignTypeBadgeClass } from '@/lib/verdict-runtime/test-campaign-registry'

export function CampaignTypeBadge({ type }: { type: string }) {
  return (
    <span className={cn(campaignTypeBadgeClass(type), 'max-w-[6.5rem] truncate')}>{type}</span>
  )
}
