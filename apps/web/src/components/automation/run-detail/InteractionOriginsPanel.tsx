'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

const ORIGIN_META: Array<{ key: keyof ReturnType<typeof countInteractionOrigins>; label: string }> = [
  { key: 'manual', label: 'Manual' },
  { key: 'bridge', label: 'Bridge' },
  { key: 'unknown', label: 'Unknown' },
  { key: 'humanBaseline', label: 'Human baseline' },
]

/**
 * Durable interactions for a run. Human baseline counts MANUAL only —
 * BRIDGE_INJECTED never inflates the baseline (Phase 7.17 / CHECKPOINT 54–57).
 */
export function InteractionOriginsPanel({
  runId,
  refreshToken = 0,
}: {
  runId: string
  refreshToken?: number
}) {
  const [rows, setRows] = useState<InteractionRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const loadedOnceRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (!loadedOnceRef.current) setLoading(true)
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
        if (cancelled) return
        loadedOnceRef.current = true
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [runId, refreshToken])

  const counts = useMemo(() => countInteractionOrigins(rows), [rows])

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading interactions…</p>
  }

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ORIGIN_META.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-center"
          >
            <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{counts[key]}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No classified interactions yet — events will appear as MANUAL, BRIDGE_INJECTED, or UNKNOWN.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {rows.map((row) => (
            <div
              key={row.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-1"
            >
              <InteractionOriginBadge origin={row.origin} confidence={row.confidence ?? 0} />
              {row.summary ? (
                <span className="max-w-[12rem] truncate text-[10px] text-muted-foreground">
                  {row.summary}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
