'use client'

import { Badge } from '@nesy/metronic/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@nesy/metronic/components/ui/tooltip'
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

export function LayerBadge({ layer, state, reason }: LayerProps) {
  const meta = LAYER_ARCHITECTURE[layer]
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
    ? states.filter((s) => s.state !== 'NOT_APPLICABLE' && s.state !== 'NOT_MEASURED')
    : states
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((s) => <LayerBadge key={s.layer} {...s} />)}
    </div>
  )
}
