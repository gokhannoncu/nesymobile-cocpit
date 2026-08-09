'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchVerdictInteractions } from '@/lib/verdict-runtime/client'
import {
  asInteractionOrigin,
  countInteractionOrigins,
} from '@/lib/verdict-runtime/interaction-origin-metrics'
import { InteractionOriginBadge, type OriginType } from './InteractionOriginBadge'

interface InteractionRow {
  id: string
  origin: OriginType
  confidence?: number
  summary?: string
  revision?: number
}

/**
 * Durable interactions for a run. Human baseline counts MANUAL only —
 * BRIDGE_INJECTED never inflates the baseline (Phase 7.17 / CHECKPOINT 54–57).
 */
export function InteractionOriginsPanel({ runId }: { runId: string }) {
  const [rows, setRows] = useState<InteractionRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchVerdictInteractions(runId, 0)
      .then((page) => {
        if (cancelled) return
        setError(null)
        setRows(
          page.items.map((item, index) => {
            const row = item as Record<string, unknown>
            return {
              id: String(row.eventId ?? row.id ?? `ix-${index}`),
              origin: asInteractionOrigin(row.origin),
              confidence: typeof row.confidence === 'number' ? row.confidence : undefined,
              summary: typeof row.summary === 'string' ? row.summary : undefined,
              revision: typeof row.revision === 'number' ? row.revision : undefined,
            }
          }),
        )
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Interactions unavailable')
          setRows([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [runId])

  const counts = useMemo(() => countInteractionOrigins(rows), [rows])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading durable interactions…</p>
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No durable interactions for this run — UNKNOWN/MANUAL/BRIDGE_INJECTED will appear when
        classified events arrive.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-1.5">
            <InteractionOriginBadge origin={row.origin} confidence={row.confidence ?? 0} />
            {row.summary ? (
              <span className="text-[11px] text-muted-foreground max-w-[12rem] truncate">
                {row.summary}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground sm:grid-cols-4">
        <div>
          <dt className="inline">BRIDGE_INJECTED </dt>
          <dd className="inline text-foreground">{counts.bridge}</dd>
        </div>
        <div>
          <dt className="inline">MANUAL </dt>
          <dd className="inline text-foreground">{counts.manual}</dd>
        </div>
        <div>
          <dt className="inline">UNKNOWN </dt>
          <dd className="inline text-foreground">{counts.unknown}</dd>
        </div>
        <div>
          <dt className="inline">human baseline </dt>
          <dd className="inline text-foreground">{counts.humanBaseline}</dd>
          <span className="ml-1 text-[10px]">(excludes bridge)</span>
        </div>
      </dl>
    </div>
  )
}
