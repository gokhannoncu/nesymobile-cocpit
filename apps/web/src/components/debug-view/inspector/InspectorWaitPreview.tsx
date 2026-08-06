'use client'

import { Clock, Play, AlertCircle } from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'

interface WaitCondition {
  id: string
  type: 'EXPECTED' | 'INTERRUPT'
  status: 'PENDING' | 'MET' | 'FAILED'
  description: string
}

interface InspectorWaitPreviewProps {
  waits: WaitCondition[]
}

export function InspectorWaitPreview({ waits }: InspectorWaitPreviewProps) {
  if (waits.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-slate-50 flex flex-col items-center justify-center text-slate-500 min-h-[100px]">
        <Clock className="w-6 h-6 mb-2 opacity-50" />
        <span className="text-sm">No active wait conditions</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg bg-white">
      <h3 className="font-semibold text-sm flex items-center gap-2 border-b pb-2">
        <Clock className="w-4 h-4" />
        Wait Conditions
      </h3>
      <div className="space-y-2">
        {waits.map(wait => (
          <div key={wait.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm">
            <div className="flex items-center gap-2">
              {wait.status === 'PENDING' && <Play className="w-4 h-4 text-blue-500 animate-pulse" />}
              {wait.status === 'MET' && <div className="w-2 h-2 rounded-full bg-green-500" />}
              {wait.status === 'FAILED' && <AlertCircle className="w-4 h-4 text-red-500" />}
              <span>{wait.description}</span>
            </div>
            <Badge variant={wait.type === 'EXPECTED' ? 'outline' : 'secondary'}>
              {wait.type}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
