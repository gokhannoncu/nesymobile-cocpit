'use client'

import { cn } from '@nesy/metronic/lib/utils'
import { campaignTypeTone } from '@/lib/verdict-runtime/test-campaign-registry'
import { toneIconBox, toneText } from '@/components/product/tones'

export function CampaignTypeBadge({ type }: { type: string }) {
  const tone = campaignTypeTone(type)

  return (
    <span
      className={cn(
        'inline-flex rounded-[4px] border border-current/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        toneIconBox[tone],
        toneText[tone],
      )}
    >
      {type}
    </span>
  )
}
