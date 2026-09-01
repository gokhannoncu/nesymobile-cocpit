'use client'

import type { ReactNode } from 'react'
import { Button } from '@nesy/metronic/components/ui/button'
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { RunLiveStatus } from '@/lib/verdict-runtime/run-live-stream'

const STATUS_META: Record<
  RunLiveStatus,
  { label: string; dot: string; pulse?: boolean; icon?: typeof Wifi; spin?: boolean }
> = {
  live: {
    label: 'Live',
    dot: 'bg-emerald-500',
    pulse: true,
    icon: Wifi,
  },
  connecting: {
    label: 'Connecting',
    dot: 'bg-amber-400',
    icon: Loader2,
    spin: true,
  },
  reconnecting: {
    label: 'Reconnecting',
    dot: 'bg-amber-400',
    icon: Loader2,
    spin: true,
  },
  offline: {
    label: 'Offline',
    dot: 'bg-red-500',
    icon: WifiOff,
  },
}

const TOOLBAR_BTN =
  'size-7 shrink-0 rounded-md text-muted-foreground hover:bg-background hover:text-foreground'

function ToolbarDivider() {
  return <span className="h-4 w-px shrink-0 bg-border/80" aria-hidden />
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
  actions,
}: {
  status: RunLiveStatus
  latestSeq: number
  refreshing?: boolean
  onRefresh?: () => void
  /** Extra icon actions rendered inside the same toolbar (e.g. evidence journey). */
  actions?: ReactNode
}) {
  const meta = STATUS_META[status]
  const Icon = meta.icon

  return (
    <div
      className="inline-flex items-center rounded-lg border border-border/80 bg-muted/25"
      aria-live="polite"
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5"
        title={`Stream ${meta.label.toLowerCase()}`}
      >
        <span className="relative flex size-2 shrink-0 items-center justify-center" aria-hidden>
          <span className={cn('size-1.5 rounded-full', meta.dot)} />
          {meta.pulse ? (
            <span className={cn('absolute size-2 animate-ping rounded-full opacity-40 motion-reduce:animate-none', meta.dot)} />
          ) : null}
        </span>
        {Icon && status !== 'live' ? (
          <Icon
            className={cn(
              'size-3 shrink-0 text-muted-foreground',
              meta.spin === true && 'animate-spin motion-reduce:animate-none',
            )}
            aria-hidden
          />
        ) : null}
        <span className="text-xs font-medium text-foreground">{meta.label}</span>
      </div>

      <ToolbarDivider />

      <span
        className="px-2.5 py-1.5 font-mono text-[10px] font-medium tabular-nums text-muted-foreground"
        title={`Latest sequence: ${latestSeq}`}
      >
        {latestSeq}
      </span>

      {onRefresh ? (
        <>
          <ToolbarDivider />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={TOOLBAR_BTN}
            aria-label="Refresh run detail, evidence, and telemetry"
            title="Refresh"
            disabled={refreshing === true}
            onClick={onRefresh}
          >
            <RefreshCw className={cn('size-3.5', refreshing === true && 'animate-spin motion-reduce:animate-none')} />
          </Button>
        </>
      ) : null}

      {actions ? (
        <>
          <ToolbarDivider />
          <div className="flex items-center pr-0.5">{actions}</div>
        </>
      ) : null}
    </div>
  )
}

export { TOOLBAR_BTN }
