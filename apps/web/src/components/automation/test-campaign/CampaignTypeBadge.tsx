'use client'

import { cn } from '@nesy/metronic/lib/utils'
import { campaignTypeTone } from '@/lib/verdict-runtime/test-campaign-registry'
import { toneIconBox, toneText } from '@/components/product/tones'

export function CampaignTypeBadge({ type }: { type: string }) {
  const tone = campaignTypeTone(type)

  return (
    <span
      className={cn(
        'inline-flex rounded-md px-1.5 py-px text-[9px] font-bold uppercase tracking-wide',
        toneIconBox[tone],
        toneText[tone],
      )}
    >
      {type}
    </span>
  )
}
