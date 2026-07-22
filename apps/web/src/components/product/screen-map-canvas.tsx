'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  SCREEN_DOMAIN_META,
  SCREEN_MAP_HUB_ID,
  SCREEN_NODE_HEIGHT,
  SCREEN_NODE_WIDTH,
  domainZoneBounds,
  orthogonalEdgePath,
  resolveScreenEdges,
  screenMapBounds,
  type ScreenDomain,
  type ScreenEdge,
  type ScreenNode,
} from '@/data/product/screen-map'
import { toneCard, toneStroke, toneText, type Tone } from './tones'

const MIN_SCALE = 0.35
const MAX_SCALE = 1.8
const ZOOM_BUTTON_FACTOR = 1.15
const WHEEL_ZOOM_SENSITIVITY = 0.0018

type Viewport = { x: number; y: number; scale: number }

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

function edgeLabelPoint(fromPort: { x: number; y: number }, toPort: { x: number; y: number }) {
  return {
    x: (fromPort.x + toPort.x) / 2,
    y: (fromPort.y + toPort.y) / 2,
  }
}

export function ScreenMapCanvas({
  nodes,
  edges,
  selectedId,
  hoveredId,
  activeDomains,
  onSelect,
  onHover,
  fitRequestKey = 0,
  onViewportApi,
}: {
  nodes: ScreenNode[]
  edges: ScreenEdge[]
  selectedId: string | null
  hoveredId: string | null
  activeDomains: Set<ScreenDomain>
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  fitRequestKey?: number
  onViewportApi?: (api: { zoomIn: () => void; zoomOut: () => void; fit: () => void }) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const vpRef = useRef<Viewport>({ x: 40, y: 40, scale: 0.85 })
  const [viewport, setViewport] = useState<Viewport>(vpRef.current)
  const [isPanning, setIsPanning] = useState(false)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const panRef = useRef<{
    active: boolean
    startClientX: number
    startClientY: number
    startVpX: number
    startVpY: number
  } | null>(null)

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const bounds = useMemo(() => screenMapBounds(nodes), [nodes])

  const resolvedEdges = useMemo(
    () => resolveScreenEdges(edges, nodesById),
    [edges, nodesById],
  )

  const focusId = selectedId ?? hoveredId

  const connectedIds = useMemo(() => {
    if (!focusId) return null
    const ids = new Set<string>([focusId])
    for (const edge of edges) {
      if (edge.from === focusId || edge.to === focusId) {
        ids.add(edge.from)
        ids.add(edge.to)
      }
    }
    return ids
  }, [edges, focusId])

  const domainZones = useMemo(() => {
    const zones: { domain: ScreenDomain; bounds: NonNullable<ReturnType<typeof domainZoneBounds>> }[] =
      []
    for (const domain of activeDomains) {
      const zone = domainZoneBounds(nodes, domain)
      if (zone) zones.push({ domain, bounds: zone })
    }
    return zones
  }, [activeDomains, nodes])

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

  const hasFocus = Boolean(focusId)

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full min-h-[520px] w-full overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-slate-50/95 to-slate-100/90 dark:from-slate-900/95 dark:to-slate-950',
        isPanning ? 'cursor-grabbing' : 'cursor-grab',
      )}
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
      onPointerLeave={() => {
        onHover(null)
        setHoveredEdgeId(null)
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 0)',
          backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />

      {!hasFocus ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-border/60 bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
          Click or hover a screen to trace its connections
        </div>
      ) : null}

      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        {/* Domain swimlanes */}
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
          {domainZones.map(({ domain, bounds: zone }) => {
            const meta = SCREEN_DOMAIN_META[domain]
            const tone = meta.tone as Tone
            const stroke = toneStroke[tone]
            return (
              <g key={domain}>
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  rx={14}
                  fill={stroke}
                  fillOpacity={0.04}
                  stroke={stroke}
                  strokeOpacity={0.12}
                  strokeWidth={1.5}
                />
                <text
                  x={zone.x + 12}
                  y={zone.y + 18}
                  className="fill-muted-foreground text-[10px] font-bold uppercase tracking-wider"
                  opacity={0.55}
                >
                  {meta.label}
                </text>
              </g>
            )
          })}
        </svg>

        <svg className="absolute left-0 top-0 overflow-visible" width={1} height={1}>
          <defs>
            {(['teal', 'blue', 'indigo', 'green', 'amber', 'orange', 'purple', 'gray'] as Tone[]).map(
              (tone) => (
                <marker
                  key={tone}
                  id={`screen-map-arrow-${tone}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={toneStroke[tone]} />
                </marker>
              ),
            )}
          </defs>

          {resolvedEdges.map(({ edge, fromPort, toPort, laneOffset, isReturn }) => {
            const from = nodesById.get(edge.from)
            const to = nodesById.get(edge.to)
            if (!from || !to) return null

            const domainVisible = activeDomains.has(from.domain) && activeDomains.has(to.domain)
            const related =
              !focusId || edge.from === focusId || edge.to === focusId
            const edgeHovered = hoveredEdgeId === edge.id
            const active = Boolean(focusId && related)
            const dimmed = Boolean(focusId && !related) || !domainVisible
            const showLabel = (active || edgeHovered) && domainVisible

            const fromTone = SCREEN_DOMAIN_META[from.domain].tone as Tone
            const strokeColor = toneStroke[fromTone]
            const path = orthogonalEdgePath(fromPort, toPort, laneOffset)
            const labelAt = edgeLabelPoint(fromPort, toPort)
            const labelWidth = Math.max(36, edge.label.length * 6.4 + 12)

            return (
              <g
                key={edge.id}
                className={cn('transition-opacity duration-150', dimmed ? 'opacity-12' : 'opacity-100')}
                onPointerEnter={() => setHoveredEdgeId(edge.id)}
                onPointerLeave={() => setHoveredEdgeId(null)}
              >
                {/* Wide hit area for hover */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="pointer-events-stroke cursor-pointer"
                />
                <path
                  d={path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={active || edgeHovered ? 2.5 : isReturn ? 1.25 : 1.75}
                  strokeDasharray={isReturn ? '6 4' : undefined}
                  strokeOpacity={active || edgeHovered ? 1 : isReturn ? 0.45 : 0.65}
                  markerEnd={`url(#screen-map-arrow-${fromTone})`}
                  className="pointer-events-none"
                />
                {showLabel ? (
                  <>
                    <rect
                      x={labelAt.x - labelWidth / 2}
                      y={labelAt.y - 9}
                      width={labelWidth}
                      height={18}
                      rx={4}
                      className="fill-background stroke-border/80"
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
                  </>
                ) : null}
              </g>
            )
          })}
        </svg>

        {nodes.map((node) => {
          const meta = SCREEN_DOMAIN_META[node.domain]
          const tone = meta.tone as Tone
          const selected = selectedId === node.id
          const hovered = hoveredId === node.id
          const isHub = node.id === SCREEN_MAP_HUB_ID
          const related = !connectedIds || connectedIds.has(node.id)
          const domainVisible = activeDomains.has(node.domain)
          const dimmed = !domainVisible || Boolean(focusId && !related)

          return (
            <button
              key={node.id}
              type="button"
              data-screen-node
              onClick={(e) => {
                e.stopPropagation()
                onSelect(selected ? null : node.id)
              }}
              onPointerEnter={() => onHover(node.id)}
              onPointerLeave={() => onHover(null)}
              className={cn(
                'absolute flex flex-col justify-center rounded-lg border px-3 py-2 text-left shadow-sm transition-[opacity,box-shadow,transform] duration-150',
                toneCard[tone],
                isHub && 'border-2',
                selected && 'ring-2 ring-sky-500 ring-offset-2 ring-offset-background',
                hovered && !selected && 'ring-2 ring-sky-400/60 ring-offset-1 ring-offset-background',
                dimmed ? 'opacity-20' : 'opacity-100 hover:-translate-y-0.5 hover:shadow-md',
              )}
              style={{
                left: node.x,
                top: node.y,
                width: SCREEN_NODE_WIDTH,
                height: SCREEN_NODE_HEIGHT,
                ...(isHub ? { borderColor: toneStroke[tone] } : {}),
              }}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn('text-[10px] font-bold uppercase tracking-wide', toneText[tone])}>
                  {meta.label}
                </span>
                {isHub ? (
                  <span
                    className="rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: toneStroke[tone] }}
                  >
                    Hub
                  </span>
                ) : null}
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
