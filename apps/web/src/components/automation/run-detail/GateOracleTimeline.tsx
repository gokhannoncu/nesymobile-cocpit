'use client'

import { Badge } from '@nesy/metronic/components/ui/badge'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'

export function GateOracleTimeline({ run }: { run: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Evaluation Timeline</h3>
      <div className="relative border-l border-border ml-3 space-y-6">
        
        {/* Continue Gate */}
        <div className="relative pl-6">
          <div className="absolute -left-[9px] top-1 bg-background">
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium">Continue Gate</span>
            <Badge variant="outline" className="bg-green-50 text-green-700">PASS</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Evaluated preconditions and setup state.</div>
        </div>

        {/* Final Oracle */}
        <div className="relative pl-6">
          <div className="absolute -left-[9px] top-1 bg-background">
            {run?.run?.outcome === 'FAIL' ? (
              <XCircle className="w-4 h-4 text-destructive" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium">Final Oracle</span>
            <Badge variant={run?.run?.outcome === 'FAIL' ? 'destructive' : 'primary'}>
              {run?.run?.outcome || 'PENDING'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Final business rule validation.</div>
        </div>

      </div>
    </div>
  )
}
