'use client'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@nesy/metronic/components/ui/tooltip'
import Link from 'next/link'

export interface CampaignCellView {
  cellKey?: string
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
    return (
      <div className="w-full h-full min-h-[40px] bg-muted/30 border border-dashed rounded flex items-center justify-center p-1">
        <span className="text-[10px] text-muted-foreground text-center leading-tight">
          {status === 'NO_EVIDENCE' ? 'NO EVIDENCE' : 'AWAITING RUN'}
        </span>
      </div>
    )
  }

  const colors: Record<string, string> = {
    PASS: 'bg-green-100 border-green-300 text-green-800',
    FAIL: 'bg-red-100 border-red-300 text-red-800',
    BLOCKED: 'bg-amber-100 border-amber-300 text-amber-800'
  }

  const color = colors[status] || 'bg-gray-100 border-gray-300 text-gray-800'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={cell.runDetailPath ?? `/automation/dummy/runs/${runId}`} className={`block w-full h-full min-h-[40px] rounded border ${color} flex flex-col items-center justify-center p-1 hover:brightness-95 transition-all`}>
            <span className="text-xs font-bold">{status}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>Run: {runId}</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">Ref: {evidenceRef}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
