'use client'

import { Badge } from '@nesy/metronic/components/ui/badge'

export function OutcomePanel({ run }: { run: any }) {
  // We extract 4 outcome types separately
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-md bg-muted/20">
      <div>
        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Action</div>
        <Badge variant="secondary">COMPLETED</Badge>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Gate</div>
        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">PASS</Badge>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Oracle</div>
        <Badge variant={run?.run?.outcome === 'FAIL' ? 'destructive' : 'primary'}>
          {run?.run?.outcome || 'PENDING'}
        </Badge>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Cleanup</div>
        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">FAILED</Badge>
        <p className="text-[10px] text-muted-foreground mt-1">Does not affect Oracle</p>
      </div>
    </div>
  )
}
