'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@nesy/metronic/components/ui/tooltip'
import Link from 'next/link'
import { cn } from '@nesy/metronic/lib/utils'
import { campaignCellResultTone } from '@/lib/verdict-runtime/test-campaign-registry'
import { toneIconBox, toneText } from '@/components/product/tones'

export interface CampaignCellView {
  cellKey?: string
  profileKey?: string
  deviceCell?: string
  runId?: string
  runIds?: string[]
  runDetailPath?: string
  evidenceRef?: string
  evidenceSummaryRef?: string
  result?: string
  status?: string
  blockedReason?: string
}

export function CampaignCell({ cell }: { cell: CampaignCellView }) {
  const runId = cell.runId ?? cell.runIds?.[0]
  const evidenceRef = cell.evidenceRef ?? cell.evidenceSummaryRef
  const hasEvidence = Boolean(evidenceRef && runId)
  const status = cell.result ?? cell.status ?? 'NO_EVIDENCE'

  if (!hasEvidence) {
    const tone = status === 'BLOCKED' ? 'orange' : 'gray'
    return (
      <div
        className={cn(
          'flex min-h-[44px] w-full items-center justify-center rounded-[4px] border border-dashed p-1.5',
          toneIconBox[tone],
        )}
      >
        <span className={cn('text-center text-[10px] font-semibold uppercase leading-tight', toneText[tone])}>
          {status === 'NO_EVIDENCE' ? 'No evidence' : status === 'BLOCKED' ? 'Blocked' : 'Awaiting run'}
        </span>
      </div>
    )
  }

  const tone = campaignCellResultTone(status)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={cell.runDetailPath ?? `/automation/runs/${runId}`}
            className={cn(
              'flex min-h-[44px] w-full flex-col items-center justify-center rounded-[4px] border border-current/10 p-1.5 transition hover:brightness-95',
              toneIconBox[tone],
              toneText[tone],
            )}
          >
            <span className="text-xs font-bold uppercase">{status}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Run: {runId}</p>
          {cell.blockedReason ? (
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">{cell.blockedReason}</p>
          ) : null}
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">Ref: {evidenceRef}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
