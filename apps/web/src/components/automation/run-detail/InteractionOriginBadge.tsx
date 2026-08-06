'use client'

import { Badge } from '@nesy/metronic/components/ui/badge'

export type OriginType = 'BRIDGE_INJECTED' | 'MANUAL' | 'UNKNOWN'

export function InteractionOriginBadge({ origin, confidence = 100 }: { origin: OriginType, confidence?: number }) {
  const styles = {
    BRIDGE_INJECTED: 'bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200',
    MANUAL: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200',
    UNKNOWN: 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200'
  }

  return (
    <Badge variant="outline" className={`${styles[origin]} gap-1`}>
      {origin}
      <span className="opacity-50 text-[10px] ml-1">{confidence}%</span>
    </Badge>
  )
}
