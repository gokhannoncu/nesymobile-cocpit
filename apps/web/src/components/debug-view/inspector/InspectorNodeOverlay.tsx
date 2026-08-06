'use client'

import { MouseEvent } from 'react'
import { cn } from '@nesy/metronic/lib/utils'

export interface SemanticNode {
  id: string
  bounds: [number, number, number, number] // x, y, width, height
  type: string
  text?: string
  resourceId?: string
  isAmbiguous?: boolean
}

interface InspectorNodeOverlayProps {
  nodes: SemanticNode[]
  scale: number
  onNodeSelect: (node: SemanticNode) => void
}

export function InspectorNodeOverlay({ nodes, scale, onNodeSelect }: InspectorNodeOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {nodes.map(node => {
        const [x, y, w, h] = node.bounds
        return (
          <div
            key={node.id}
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              if (!node.isAmbiguous) onNodeSelect(node)
            }}
            className={cn(
              'absolute border-2 pointer-events-auto cursor-pointer transition-colors',
              node.isAmbiguous 
                ? 'border-amber-500/50 bg-amber-500/10 cursor-not-allowed border-dashed'
                : 'border-blue-500/50 hover:bg-blue-500/20 hover:border-blue-500'
            )}
            style={{
              left: x * scale,
              top: y * scale,
              width: w * scale,
              height: h * scale,
            }}
            title={`Type: ${node.type}\nText: ${node.text || 'N/A'}\nID: ${node.resourceId || 'N/A'}`}
          />
        )
      })}
    </div>
  )
}
