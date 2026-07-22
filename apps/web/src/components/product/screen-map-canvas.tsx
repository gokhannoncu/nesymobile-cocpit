'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  SCREEN_DOMAIN_META,
  SCREEN_NODE_HEIGHT,
  SCREEN_NODE_WIDTH,
  orthogonalEdgePath,
  screenMapBounds,
  type ScreenDomain,
  type ScreenEdge,
  type ScreenNode,
} from '@/data/product/screen-map'
import { toneCard, toneText, type Tone } from './tones'

const MIN_SCALE = 0.4
const MAX_SCALE = 1.8
const ZOOM_BUTTON_FACTOR = 1.15
const WHEEL_ZOOM_SENSITIVITY = 0.0018

type Viewport = { x: number; y: number; scale: number }

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

function edgeLabelPoint(from: ScreenNode, to: ScreenNode) {
  const fromRight = from.x + SCREEN_NODE_WIDTH
  const fromMidY = from.y + SCREEN_NODE_HEIGHT / 2
  const toLeft = to.x
  const toMidY = to.y + SCREEN_NODE_HEIGHT / 2
  if (to.x >= fromRight - 8) {
    const midX = (fromRight + toLeft) / 2
    return { x: midX, y: (fromMidY + toMidY) / 2 }
  }
  if (to.x + SCREEN_NODE_WIDTH <= from.x + 8) {
    const midX = (from.x + to.x + SCREEN_NODE_WIDTH) / 2
    return { x: midX, y: (fromMidY + toMidY) / 2 }
  }
  return {
    x: (from.x + to.x + SCREEN_NODE_WIDTH) / 2,
    y: Math.max(from.y + SCREEN_NODE_HEIGHT, to.y + SCREEN_NODE_HEIGHT) + 28,
  }
}

export function ScreenMapCanvas({
  nodes,
  edges,
  selectedId,
  activeDomains,
  onSelect,
  fitRequestKey = 0,
  onViewportApi,
}: {
  nodes: ScreenNode[]
  edges: ScreenEdge[]
  selectedId: string | null
  activeDomains: Set<ScreenDomain>
  onSelect: (id: string | null) => void
  /** Increment to trigger fit-to-view. */
  fitRequestKey?: number
  onViewportApi?: (api: { zoomIn: () => void; zoomOut: () => void; fit: () => void }) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const vpRef = useRef<Viewport>({ x: 40, y: 40, scale: 0.85 })
  const [viewport, setViewport] = useState<Viewport>(vpRef.current)
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef<{
    active: boolean
    startClientX: number
    startClientY: number
    startVpX: number
    startVpY: number
  } | null>(null)

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const bounds = useMemo(() => screenMapBounds(nodes), [nodes])

  const connectedIds = useMemo(() => {
    if (!selectedId) return null
    const ids = new Set<string>([selectedId])
    for (const edge of edges) {
      if (edge.from === selectedId || edge.to === selectedId) {
        ids.add(edge.from)
        ids.add(edge.to)
      }
    }
    return ids
  }, [edges, selectedId])

  const updateViewport = useCallback((next: Viewport | ((prev: Viewport) => Viewport)) => {
    setViewport((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      vpRef.current = value
      return value
    })
  }, [])

  const zoomAtViewportPoint = useCallback(
    (pointX: number, pointY: number, factor: number) => {
      updateViewport((prev) => {
        const nextScale = clampScale(prev.scale * factor)
        const worldX = (pointX - prev.x) / prev.scale
        const worldY = (pointY - prev.y) / prev.scale
        return {
          x: pointX - worldX * nextScale,
          y: pointY - worldY * nextScale,
          scale: nextScale,
        }
      })
    },
    [updateViewport],
  )

  const fit = useCallback(() => {
    const el = containerRef.current
    if (!el || bounds.width <= 0) return
    const pad = 32
    const scaleX = (el.clientWidth - pad * 2) / bounds.width
    const scaleY = (el.clientHeight - pad * 2) / bounds.height
    const scale = clampScale(Math.min(scaleX, scaleY, 1))
    updateViewport({
      x: pad - bounds.minX * scale + (el.clientWidth - pad * 2 - bounds.width * scale) / 2,
      y: pad - bounds.minY * scale + (el.clientHeight - pad * 2 - bounds.height * scale) / 2,
      scale,
    })
  }, [bounds, updateViewport])

  const zoomIn = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    zoomAtViewportPoint(el.clientWidth / 2, el.clientHeight / 2, ZOOM_BUTTON_FACTOR)
  }, [zoomAtViewportPoint])

  const zoomOut = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    zoomAtViewportPoint(el.clientWidth / 2, el.clientHeight / 2, 1 / ZOOM_BUTTON_FACTOR)
  }, [zoomAtViewportPoint])

  useEffect(() => {
    onViewportApi?.({ zoomIn, zoomOut, fit })
  }, [fit, onViewportApi, zoomIn, zoomOut])

  useEffect(() => {
    const id = requestAnimationFrame(() => fit())
    return () => cancelAnimationFrame(id)
  }, [fit, fitRequestKey])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // Trackpad pan / shift+wheel → pan; otherwise zoom at cursor.
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        updateViewport((prev) => ({
          ...prev,
          x: prev.x - (e.deltaX || e.deltaY),
          y: prev.y - (e.shiftKey ? 0 : e.deltaY),
        }))
        return
      }
      const rect = el.getBoundingClientRect()
      zoomAtViewportPoint(
        e.clientX - rect.left,
        e.clientY - rect.top,
        Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY),
      )
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [updateViewport, zoomAtViewportPoint])

  const stopPan = useCallback(() => {
    panRef.current = null
    setIsPanning(false)
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const pan = panRef.current
      if (!pan?.active) return
      updateViewport({
        x: pan.startVpX + (e.clientX - pan.startClientX),
        y: pan.startVpY + (e.clientY - pan.startClientY),
        scale: vpRef.current.scale,
      })
    }
    const onUp = () => stopPan()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [stopPan, updateViewport])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full min-h-[520px] w-full overflow-hidden rounded-xl border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(241,245,249,0.9))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.98))]',
        isPanning ? 'cursor-grabbing' : 'cursor-grab',
      )}
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 0)',
        backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const target = e.target as HTMLElement
        if (target.closest('[data-screen-node]')) return
        panRef.current = {
          active: true,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startVpX: vpRef.current.x,
          startVpY: vpRef.current.y,
        }
        setIsPanning(true)
        onSelect(null)
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
          <defs>
            <marker
              id="screen-map-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-400 dark:fill-slate-500" />
            </marker>
            <marker
              id="screen-map-arrow-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-sky-500" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const from = nodesById.get(edge.from)
            const to = nodesById.get(edge.to)
            if (!from || !to) return null
            const domainVisible =
              activeDomains.has(from.domain) && activeDomains.has(to.domain)
            const related =
              !selectedId || edge.from === selectedId || edge.to === selectedId
            const active = Boolean(selectedId && related)
            const dimmed = Boolean(selectedId && !related) || !domainVisible
            const path = orthogonalEdgePath(
              { x: from.x, y: from.y, width: SCREEN_NODE_WIDTH, height: SCREEN_NODE_HEIGHT },
              { x: to.x, y: to.y, width: SCREEN_NODE_WIDTH, height: SCREEN_NODE_HEIGHT },
            )
            const labelAt = edgeLabelPoint(from, to)
            const labelWidth = Math.max(36, edge.label.length * 6.4 + 12)
            return (
              <g
                key={edge.id}
                className={cn(
                  'transition-opacity duration-150',
                  dimmed ? 'opacity-15' : 'opacity-100',
                )}
              >
                <path
                  d={path}
                  fill="none"
                  strokeWidth={active ? 2.25 : 1.5}
                  className={active ? 'stroke-sky-500' : 'stroke-slate-400 dark:stroke-slate-500'}
                  markerEnd={active ? 'url(#screen-map-arrow-active)' : 'url(#screen-map-arrow)'}
                />
                <rect
                  x={labelAt.x - labelWidth / 2}
                  y={labelAt.y - 9}
                  width={labelWidth}
                  height={18}
                  rx={4}
                  className="fill-background stroke-border/70"
                  strokeWidth={1}
                />
                <text
                  x={labelAt.x}
                  y={labelAt.y + 3.5}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-semibold"
                >
                  {edge.label}
                </text>
              </g>
            )
          })}
        </svg>

        {nodes.map((node) => {
          const meta = SCREEN_DOMAIN_META[node.domain]
          const tone = meta.tone as Tone
          const selected = selectedId === node.id
          const related = !connectedIds || connectedIds.has(node.id)
          const domainVisible = activeDomains.has(node.domain)
          const dimmed = !domainVisible || Boolean(selectedId && !related)
          return (
            <button
              key={node.id}
              type="button"
              data-screen-node
              onClick={(e) => {
                e.stopPropagation()
                onSelect(node.id)
              }}
              className={cn(
                'absolute flex flex-col justify-center rounded-lg border px-3 py-2 text-left shadow-sm transition-[opacity,box-shadow,transform] duration-150',
                toneCard[tone],
                selected && 'ring-2 ring-sky-500 ring-offset-2 ring-offset-background',
                dimmed ? 'opacity-25' : 'opacity-100 hover:-translate-y-0.5 hover:shadow-md',
              )}
              style={{
                left: node.x,
                top: node.y,
                width: SCREEN_NODE_WIDTH,
                height: SCREEN_NODE_HEIGHT,
              }}
            >
              <span className={cn('text-[10px] font-bold uppercase tracking-wide', toneText[tone])}>
                {meta.label}
              </span>
              <span className="truncate text-sm font-semibold text-foreground">{node.label}</span>
            </button>
          )
        })}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border/60 bg-background/85 px-2 py-1 text-[11px] font-medium tabular-nums text-muted-foreground backdrop-blur">
        {Math.round(viewport.scale * 100)}%
      </div>
    </div>
  )
}
