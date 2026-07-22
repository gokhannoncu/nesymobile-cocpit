'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Crosshair, Maximize2, Minus, Plus } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { cn } from '@nesy/metronic/lib/utils'
import {
  SCREEN_DOMAINS,
  SCREEN_DOMAIN_META,
  SCREEN_MAP_EDGES,
  SCREEN_MAP_HUB_ID,
  SCREEN_MAP_NODES,
  type ScreenDomain,
} from '@/data/product/screen-map'
import { toneCard, toneText, type Tone } from './tones'
import { ScreenMapCanvas } from './screen-map-canvas'
import { ScreenMapDetail } from './screen-map-detail'

export function ScreenMapExplorer() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [activeDomains, setActiveDomains] = useState<Set<ScreenDomain>>(
    () => new Set(SCREEN_DOMAINS),
  )
  const [fitRequestKey, setFitRequestKey] = useState(0)
  const viewportApiRef = useRef<{
    zoomIn: () => void
    zoomOut: () => void
    fit: () => void
  } | null>(null)

  const nodesById = useMemo(
    () => new Map(SCREEN_MAP_NODES.map((node) => [node.id, node])),
    [],
  )
  const detailId = selectedId ?? hoveredId
  const selectedNode = detailId ? (nodesById.get(detailId) ?? null) : null

  const onViewportApi = useCallback(
    (api: { zoomIn: () => void; zoomOut: () => void; fit: () => void }) => {
      viewportApiRef.current = api
    },
    [],
  )

  const toggleDomain = (domain: ScreenDomain) => {
    setActiveDomains((prev) => {
      const next = new Set(prev)
      if (next.has(domain)) {
        if (next.size === 1) return prev
        next.delete(domain)
      } else {
        next.add(domain)
      }
      return next
    })
  }

  const showAllDomains = () => setActiveDomains(new Set(SCREEN_DOMAINS))

  const focusHub = () => {
    setSelectedId(SCREEN_MAP_HUB_ID)
    setFitRequestKey((k) => k + 1)
  }

  return (
    <div className="flex min-h-[640px] flex-col gap-3 lg:min-h-[calc(100vh-14rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {SCREEN_DOMAINS.map((domain) => {
            const meta = SCREEN_DOMAIN_META[domain]
            const tone = meta.tone as Tone
            const active = activeDomains.has(domain)
            return (
              <button
                key={domain}
                type="button"
                onClick={() => toggleDomain(domain)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-opacity',
                  toneCard[tone],
                  toneText[tone],
                  active ? 'opacity-100' : 'opacity-35',
                )}
              >
                {meta.label}
              </button>
            )
          })}
          {activeDomains.size < SCREEN_DOMAINS.length ? (
            <button
              type="button"
              onClick={showAllDomains}
              className="ms-1 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:underline"
            >
              Show all
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={focusHub}
          >
            <Crosshair className="size-3.5" />
            Focus hub
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8"
            onClick={() => viewportApiRef.current?.zoomOut()}
            aria-label="Zoom out"
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8"
            onClick={() => viewportApiRef.current?.zoomIn()}
            aria-label="Zoom in"
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8"
            onClick={() => setFitRequestKey((k) => k + 1)}
            aria-label="Fit to view"
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ScreenMapCanvas
          nodes={SCREEN_MAP_NODES}
          edges={SCREEN_MAP_EDGES}
          selectedId={selectedId}
          hoveredId={hoveredId}
          activeDomains={activeDomains}
          onSelect={setSelectedId}
          onHover={setHoveredId}
          fitRequestKey={fitRequestKey}
          onViewportApi={onViewportApi}
        />
        <div className="min-h-[320px] lg:min-h-0">
          <ScreenMapDetail
            node={selectedNode}
            edges={SCREEN_MAP_EDGES}
            nodesById={nodesById}
            onFocusNode={setSelectedId}
            isPreview={!selectedId && Boolean(hoveredId)}
          />
        </div>
      </div>
    </div>
  )
}
