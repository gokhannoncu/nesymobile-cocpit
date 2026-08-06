'use client'

import { Badge } from '@nesy/metronic/components/ui/badge'

export function VerdictDisposition({ run }: { run: any }) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Lifecycle</span>
        <Badge variant="secondary">{run?.run?.status || 'UNKNOWN'}</Badge>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Business Verdict</span>
        <Badge variant={run?.run?.outcome === 'FAIL' ? 'destructive' : 'primary'}>
          {run?.run?.outcome || 'PENDING'}
        </Badge>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Termination</span>
        <Badge variant="outline">NORMAL</Badge>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Cleanup</span>
        <Badge variant="outline" className="border-red-200 text-red-600">FAILED</Badge>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Operational</span>
        <Badge variant="outline">READY</Badge>
      </div>
    </div>
  )
}
