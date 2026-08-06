'use client'

import { Clock, Play, AlertCircle } from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'

/** Request-scoped wait preview — aligned with WaitAnyResult family, not a persistent registry. */
export type WaitPreviewStatus =
  | 'PENDING'
  | 'EXPECTED_MATCH'
  | 'INTERRUPT_MATCH'
  | 'AMBIGUOUS'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'WAIT_CONNECTION_LOST'
  | 'MET'
  | 'FAILED'

export interface WaitPreviewRow {
  id: string
  type: 'EXPECTED' | 'INTERRUPT'
  status: WaitPreviewStatus
  description: string
  requestId?: string
  occurrenceId?: string
}

interface InspectorWaitPreviewProps {
  waits: WaitPreviewRow[]
}

function statusTone(status: WaitPreviewStatus): 'pending' | 'ok' | 'fail' {
  if (status === 'PENDING') return 'pending'
  if (
    status === 'EXPECTED_MATCH' ||
    status === 'INTERRUPT_MATCH' ||
    status === 'MET'
  ) {
    return 'ok'
  }
  return 'fail'
}

export function InspectorWaitPreview({ waits }: InspectorWaitPreviewProps) {
  if (waits.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-slate-50 flex flex-col items-center justify-center text-slate-500 min-h-[100px]">
        <Clock className="w-6 h-6 mb-2 opacity-50" />
        <span className="text-sm">No active wait conditions</span>
        <span className="text-[10px] mt-1 text-center max-w-[16rem]">
          Request-scoped wait_any only — not a persistent watch registry.
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg bg-white">
      <h3 className="font-semibold text-sm flex items-center gap-2 border-b pb-2">
        <Clock className="w-4 h-4" />
        Active wait_any
      </h3>
      <div className="space-y-2">
        {waits.map((wait) => {
          const tone = statusTone(wait.status)
          return (
            <div
              key={wait.id}
              className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                {tone === 'pending' && (
                  <Play className="w-4 h-4 text-blue-500 animate-pulse shrink-0" />
                )}
                {tone === 'ok' && (
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                )}
                {tone === 'fail' && (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="truncate">{wait.description}</div>
                  {wait.requestId ? (
                    <div className="text-[10px] font-mono text-muted-foreground truncate">
                      req:{wait.requestId}
                      {wait.occurrenceId ? ` · occ:${wait.occurrenceId}` : ''}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant={wait.type === 'EXPECTED' ? 'outline' : 'secondary'}>
                  {wait.type}
                </Badge>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {wait.status}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
