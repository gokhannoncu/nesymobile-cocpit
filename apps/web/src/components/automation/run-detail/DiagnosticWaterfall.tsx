'use client'

import { Badge } from '@nesy/metronic/components/ui/badge'
import type { RunDetailResult } from '@/lib/verdict-runtime/types'

interface WaterfallRow {
  id: string
  phase: string
  atMs: number | null
  deviceMonoTs: number | null
  clockUncertainty: 'KNOWN' | 'UNKNOWN'
  evidenceRef?: string
}

function rowsFromRun(run: RunDetailResult | null | undefined): WaterfallRow[] {
  const transitions = run?.actionTransitions ?? []
  return transitions.map((item, index) => {
    const row = item as Record<string, unknown>
    const atMs =
      typeof row.atMs === 'number'
        ? row.atMs
        : typeof row.at_ms === 'number'
          ? row.at_ms
          : null
    const deviceMonoTs =
      typeof row.deviceMonoTs === 'number'
        ? row.deviceMonoTs
        : typeof row.monoTs === 'number'
          ? row.monoTs
          : null
    return {
      id: String(row.id ?? `wt-${index}`),
      phase: String(row.phase ?? row.transitionPhase ?? 'UNKNOWN_PHASE'),
      atMs,
      deviceMonoTs,
      clockUncertainty: deviceMonoTs !== null && atMs !== null ? 'KNOWN' : 'UNKNOWN',
      evidenceRef:
        typeof row.evidenceRef === 'string'
          ? row.evidenceRef
          : typeof row.evidence_ref === 'string'
            ? row.evidence_ref
            : undefined,
    }
  })
}

/**
 * Diagnostic waterfall from persisted action transitions.
 * Does not invent chronology — clockUncertainty is UNKNOWN when device mono is absent.
 */
export function DiagnosticWaterfall({ run }: { run: RunDetailResult | null | undefined }) {
  const rows = rowsFromRun(run)

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No action transitions persisted — waterfall unavailable (NOT_CAPTURED).
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Phase</th>
            <th className="px-3 py-2 font-medium">Host atMs</th>
            <th className="px-3 py-2 font-medium">Device mono</th>
            <th className="px-3 py-2 font-medium">Clock</th>
            <th className="px-3 py-2 font-medium">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="px-3 py-2 font-mono font-medium">{row.phase}</td>
              <td className="px-3 py-2 font-mono">
                {row.atMs === null ? '—' : row.atMs}
              </td>
              <td className="px-3 py-2 font-mono">
                {row.deviceMonoTs === null ? '—' : row.deviceMonoTs}
              </td>
              <td className="px-3 py-2">
                <Badge
                  variant="outline"
                  className={
                    row.clockUncertainty === 'UNKNOWN'
                      ? 'border-amber-300 text-amber-800 bg-amber-50'
                      : 'border-emerald-300 text-emerald-800 bg-emerald-50'
                  }
                >
                  {row.clockUncertainty === 'UNKNOWN' ? 'uncertainty' : 'aligned'}
                </Badge>
              </td>
              <td className="px-3 py-2 font-mono text-muted-foreground">
                {row.evidenceRef ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
