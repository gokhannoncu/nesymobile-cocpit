'use client'

import { ArrowDownLeft, ArrowUpRight, Map as MapIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  SCREEN_DOMAIN_META,
  getConnectedEdges,
  type ScreenEdge,
  type ScreenNode,
} from '@/data/product/screen-map'
import { toneCard, toneIconBox, toneText, type Tone } from './tones'

export function ScreenMapDetail({
  node,
  edges,
  nodesById,
  onFocusNode,
  isPreview = false,
}: {
  node: ScreenNode | null
  edges: ScreenEdge[]
  nodesById: Map<string, ScreenNode>
  onFocusNode: (id: string) => void
  /** True when showing hover preview before click selection. */
  isPreview?: boolean
}) {
  if (!node) {
    return (
      <aside className="flex h-full min-h-0 flex-col rounded-xl border border-border/70 bg-background/80 p-5">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className={cn('rounded-xl p-3', toneIconBox.gray)}>
            <MapIcon className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Select a screen</p>
            <p className="max-w-[220px] text-xs leading-relaxed text-muted-foreground">
              Click a node to see its domain, summary, and connected transitions.
            </p>
          </div>
        </div>
      </aside>
    )
  }

  const meta = SCREEN_DOMAIN_META[node.domain]
  const tone = meta.tone as Tone
  const { incoming, outgoing } = getConnectedEdges(edges, node.id)

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-background/90">
      <div className={cn('border-b border-border/60 px-4 py-4', toneCard[tone])}>
        <p className={cn('text-[10px] font-bold uppercase tracking-wider', toneText[tone])}>
          {meta.label}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{node.label}</h2>
        {isPreview ? (
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">Hover preview — click to pin</p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-foreground/80">{node.summary}</p>
        {node.sourceHint ? (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">{node.sourceHint}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <EdgeGroup
          title="Outgoing"
          icon={ArrowUpRight}
          edges={outgoing}
          nodesById={nodesById}
          direction="to"
          onFocusNode={onFocusNode}
        />
        <EdgeGroup
          title="Incoming"
          icon={ArrowDownLeft}
          edges={incoming}
          nodesById={nodesById}
          direction="from"
          onFocusNode={onFocusNode}
        />
      </div>
    </aside>
  )
}

function EdgeGroup({
  title,
  icon: Icon,
  edges,
  nodesById,
  direction,
  onFocusNode,
}: {
  title: string
  icon: typeof ArrowUpRight
  edges: ScreenEdge[]
  nodesById: Map<string, ScreenNode>
  direction: 'from' | 'to'
  onFocusNode: (id: string) => void
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
        <span className="tabular-nums text-muted-foreground/70">({edges.length})</span>
      </div>
      {edges.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1.5">
          {edges.map((edge) => {
            const otherId = direction === 'to' ? edge.to : edge.from
            const other = nodesById.get(otherId)
            return (
              <li key={edge.id}>
                <button
                  type="button"
                  onClick={() => onFocusNode(otherId)}
                  className="flex w-full items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-muted/40"
                >
                  <span className="mt-0.5 shrink-0 rounded-md bg-background px-1.5 py-0.5 text-[10px] font-semibold text-foreground/80">
                    {edge.label}
                  </span>
                  <span className="min-w-0 text-xs font-medium text-foreground">
                    {other?.label ?? otherId}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
