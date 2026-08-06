'use client'

import { MouseEvent } from 'react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  mapDeviceBoundsToViewport,
  xywhToLtrb,
  type DeviceInsets,
  type DeviceOrientation,
} from '@/lib/debug-view/map-device-bounds'

export interface SemanticNode {
  id: string
  /** Device-space xywh (legacy sample) or set `boundsLtrb` for Bridge LTRB. */
  bounds: [number, number, number, number]
  boundsLtrb?: { left: number; top: number; right: number; bottom: number }
  type: string
  text?: string
  resourceId?: string
  isAmbiguous?: boolean
}

interface InspectorNodeOverlayProps {
  nodes: SemanticNode[]
  orientation?: DeviceOrientation
  applyInsets?: boolean
  insets?: DeviceInsets
  screenshotWidth?: number
  screenshotHeight?: number
  viewportWidth?: number
  viewportHeight?: number
  /** @deprecated Prefer orientation/inset mapping; retained as uniform scale fallback. */
  scale?: number
  onNodeSelect: (node: SemanticNode) => void
}

const ZERO_INSETS: DeviceInsets = { left: 0, top: 0, right: 0, bottom: 0 }

export function InspectorNodeOverlay({
  nodes,
  orientation = 'PORTRAIT',
  applyInsets = false,
  insets = ZERO_INSETS,
  screenshotWidth = 360,
  screenshotHeight = 640,
  viewportWidth = 360,
  viewportHeight = 640,
  scale,
  onNodeSelect,
}: InspectorNodeOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {nodes.map((node) => {
        const ltrb =
          node.boundsLtrb ??
          xywhToLtrb(node.bounds[0], node.bounds[1], node.bounds[2], node.bounds[3])
        const rect =
          scale !== undefined && scale !== 1
            ? {
                x: ltrb.left * scale,
                y: ltrb.top * scale,
                width: (ltrb.right - ltrb.left) * scale,
                height: (ltrb.bottom - ltrb.top) * scale,
              }
            : mapDeviceBoundsToViewport({
                bounds: ltrb,
                orientation,
                applyInsets,
                insets,
                screenshotWidth,
                screenshotHeight,
                viewportWidth,
                viewportHeight,
              })
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
                : 'border-blue-500/50 hover:bg-blue-500/20 hover:border-blue-500',
            )}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
            title={`Type: ${node.type}\nText: ${node.text || 'N/A'}\nID: ${node.resourceId || 'N/A'}`}
          />
        )
      })}
    </div>
  )
}
