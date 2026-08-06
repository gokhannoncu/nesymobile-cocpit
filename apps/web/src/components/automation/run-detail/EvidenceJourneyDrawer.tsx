'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@nesy/metronic/components/ui/sheet'
import { Button } from '@nesy/metronic/components/ui/button'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { History } from 'lucide-react'
import type { EvidenceJourneyResult } from '@/lib/verdict-runtime/types'

const STAGES = [
  'Emit',
  'WAL',
  'Transport',
  'Inbox',
  'Receipt',
  'Ordered',
  'Normalization',
  'Correlation',
  'Evaluation'
]

export function EvidenceJourneyDrawer({ runId, journey }: { runId: string; journey?: EvidenceJourneyResult }) {
  const items = journey?.items || []

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="w-4 h-4" />
          Evidence Journey
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Evidence Journey</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {STAGES.map((stage, idx) => {
            const stageData = items.find((i: any) => i.stage === stage)
            const status = (stageData?.status as string) || (idx === 0 && !items.length ? 'NOT_CAPTURED' : 'PENDING')
            return (
              <div key={stage} className="flex gap-4 relative">
                {idx !== STAGES.length - 1 && (
                  <div className="absolute left-2.5 top-6 w-px h-full bg-border -z-10" />
                )}
                <div className={`w-5 h-5 rounded-full border-2 bg-background flex-shrink-0 mt-0.5 ${status === 'COMPLETED' ? 'border-primary' : status === 'FAILED' ? 'border-destructive' : status === 'NOT_CAPTURED' ? 'border-destructive/50 border-dashed' : 'border-muted-foreground'}`} />
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{stage}</span>
                    <Badge variant={status === 'COMPLETED' ? 'primary' : status === 'FAILED' || status === 'NOT_CAPTURED' ? 'destructive' : 'secondary'}>
                      {status}
                    </Badge>
                  </div>
                  {status === 'NOT_CAPTURED' && (
                    <p className="text-xs text-destructive">EVIDENCE_UNAVAILABLE - missing evidence at this stage</p>
                  )}
                  {typeof stageData?.timestamp === 'string' || typeof stageData?.timestamp === 'number' ? (
                    <p className="text-xs text-muted-foreground">{new Date(stageData.timestamp).toLocaleString()}</p>
                  ) : null}
                  {typeof stageData?.link === 'string' && (
                    <a href={stageData.link} className="text-xs text-blue-500 hover:underline">View Raw Evidence</a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
