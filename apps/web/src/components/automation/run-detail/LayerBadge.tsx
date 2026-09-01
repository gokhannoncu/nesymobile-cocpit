'use client'

import { Badge } from '@nesy/metronic/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@nesy/metronic/components/ui/tooltip'
import { cn } from '@nesy/metronic/lib/utils'
import {
  LAYER_ARCHITECTURE,
  type LayerApplicability,
  type LayerName,
  type LayerState,
} from '@/lib/verdict-runtime/layer-applicability'

interface LayerProps {
  layer: LayerName
  state: LayerState
  reason?: string
}

const STATE_DOT: Record<LayerState, string> = {
  PASS: 'bg-emerald-500',
  FAIL: 'bg-red-500',
  NOT_APPLICABLE: 'bg-slate-400',
  NOT_MEASURED: 'bg-amber-400',
  REQUIRED_PENDING: 'bg-blue-500',
}

const STATE_SHORT: Record<LayerState, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  NOT_APPLICABLE: 'N/A',
  NOT_MEASURED: '—',
  REQUIRED_PENDING: 'Pending',
}

function layerTooltip(meta: (typeof LAYER_ARCHITECTURE)[LayerName], state: LayerState, reason?: string) {
  const detail = `${meta.role}: ${state.replaceAll('_', ' ')}`
  return reason ? `${detail} — ${reason}` : detail
}

export function LayerBadge({
  layer,
  state,
  reason,
  compact = false,
}: LayerProps & { compact?: boolean }) {
  const meta = LAYER_ARCHITECTURE[layer]
  const title = layerTooltip(meta, state, reason)

  if (compact) {
    const badge = (
      <Badge
        variant="outline"
        title={title}
        className="gap-1.5 border-border/70 bg-card px-2 py-0.5 text-[10px] font-medium text-foreground"
      >
        <span className={cn('size-1.5 shrink-0 rounded-full', STATE_DOT[state])} aria-hidden />
        <span className="font-semibold">{meta.short}</span>
        <span className="text-muted-foreground">{STATE_SHORT[state]}</span>
      </Badge>
    )

    if (reason) {
      return (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {title}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return badge
  }

  const colors = {
    PASS: 'bg-green-100 text-green-800 border-green-200',
    FAIL: 'bg-red-100 text-red-800 border-red-200',
    NOT_APPLICABLE: 'bg-gray-100 text-gray-800 border-gray-200',
    NOT_MEASURED: 'bg-amber-100 text-amber-800 border-amber-200',
    REQUIRED_PENDING: 'bg-blue-100 text-blue-800 border-blue-200',
  }

  const badge = (
    <Badge variant="outline" className={`${colors[state]} text-xs font-mono px-1.5 py-0`}>
      {meta.short} · {meta.role}: {state}
    </Badge>
  )

  if ((state === 'NOT_APPLICABLE' || state === 'NOT_MEASURED') && reason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent><p>{reason}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}

export function LayerBadges({
  states,
  compact = false,
}: {
  states: LayerProps[] | LayerApplicability[]
  compact?: boolean
}) {
  const visible = compact
    ? states
    : states
  return (
    <div className={cn('flex flex-wrap', compact ? 'gap-1.5' : 'gap-2')}>
      {visible.map((s) => (
        <LayerBadge key={s.layer} compact={compact} {...s} />
      ))}
    </div>
  )
}
