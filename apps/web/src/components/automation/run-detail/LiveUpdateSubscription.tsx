'use client'

import { Badge } from '@nesy/metronic/components/ui/badge'
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { RunLiveStatus } from '@/lib/verdict-runtime/run-live-stream'

const STATUS_META: Record<
  RunLiveStatus,
  { label: string; className: string; icon: typeof Wifi; spin?: boolean }
> = {
  live: {
    label: 'Live',
    className: 'text-green-600 border-green-200 bg-green-50',
    icon: Wifi,
  },
  connecting: {
    label: 'Connecting…',
    className: 'text-amber-600 border-amber-200 bg-amber-50',
    icon: Loader2,
    spin: true,
  },
  reconnecting: {
    label: 'Reconnecting…',
    className: 'text-amber-600 border-amber-200 bg-amber-50',
    icon: Loader2,
    spin: true,
  },
  offline: {
    label: 'Stream offline',
    className: 'text-red-600 border-red-200 bg-red-50',
    icon: WifiOff,
  },
}

/**
 * Whether the run's socket stream is actually up.
 *
 * State is owned by the page's live stream, not fetched here: a badge that
 * probed its own endpoint could read "Live" while the stream carrying the run's
 * events was down — which is precisely the failure it exists to reveal.
 */
export function LiveUpdateSubscription({
  status,
  latestSeq,
  refreshing,
  onRefresh,
}: {
  status: RunLiveStatus
  latestSeq: number
  refreshing?: boolean
  onRefresh?: () => void
}) {
  const meta = STATUS_META[status]
  const Icon = meta.icon

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <Badge variant="outline" className={cn('gap-1.5', meta.className)}>
        <Icon className={cn('h-3 w-3', meta.spin === true && 'animate-spin motion-reduce:animate-none')} />
        {meta.label}
      </Badge>
      <span className="font-mono text-xs text-muted-foreground">seq:{latestSeq}</span>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh run detail, evidence, and telemetry"
          disabled={refreshing === true}
          className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/60"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing === true && 'animate-spin motion-reduce:animate-none')} />
          refresh
        </button>
      ) : null}
    </div>
  )
}
