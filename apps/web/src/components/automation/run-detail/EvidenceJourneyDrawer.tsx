'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@nesy/metronic/components/ui/sheet'
import { Button } from '@nesy/metronic/components/ui/button'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { History } from 'lucide-react'
import type { EvidenceJourneyResult } from '@/lib/verdict-runtime/types'
import {
  EVIDENCE_JOURNEY_STAGES,
  latestItemPerStage,
  normalizeJourneyState,
  reducerTraceSteps,
  type EvidenceJourneyItem,
  type EvidenceJourneyState,
} from '@/lib/verdict-runtime/evidence-journey'

function stateBadgeVariant(
  state: EvidenceJourneyState,
): 'primary' | 'destructive' | 'secondary' | 'outline' {
  if (state === 'OBSERVED') return 'primary'
  if (state === 'BLOCKED' || state === 'NOT_OBSERVED') return 'destructive'
  if (state === 'UNKNOWN') return 'outline'
  return 'secondary'
}

function RawNormalizedTrace({
  item,
  canViewRawEvidence,
  runId,
}: {
  item: EvidenceJourneyItem
  canViewRawEvidence: boolean
  runId: string
}) {
  const [open, setOpen] = useState(false)
  const steps = reducerTraceSteps(item.reducerTrace)
  const hasTrace = Boolean(item.rawEventRef) || steps.length > 0 || item.value !== undefined

  if (!hasTrace) return null

  return (
    <div className="mt-1 space-y-1">
      <button
        type="button"
        className="text-xs text-blue-600 hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide' : 'Show'} raw → normalized trace
      </button>
      {open ? (
        <div className="rounded border bg-muted/40 p-2 font-mono text-[10px] space-y-1">
          <div>
            <span className="text-muted-foreground">rawEventRef: </span>
            {item.rawEventRef ? (
              canViewRawEvidence ? (
                <a
                  href={`?runId=${encodeURIComponent(runId)}&rawEventRef=${encodeURIComponent(String(item.rawEventRef))}#evidence-raw`}
                  className="text-blue-600 hover:underline"
                  id="evidence-raw"
                >
                  {String(item.rawEventRef)}
                </a>
              ) : (
                <span title="Requires evidence:read">
                  {String(item.rawEventRef)}{' '}
                  <span className="text-amber-700">(deep-link locked — evidence:read)</span>
                </span>
              )
            ) : (
              <span className="text-muted-foreground">NOT_CAPTURED</span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">reducerTrace: </span>
            {steps.length > 0 ? steps.join(' → ') : '—'}
          </div>
          <div>
            <span className="text-muted-foreground">factKey: </span>
            {item.factKey ?? '—'}
            {item.revision !== undefined ? ` · rev ${item.revision}` : null}
          </div>
          <div className="break-all">
            <span className="text-muted-foreground">value: </span>
            {item.value === undefined ? '—' : JSON.stringify(item.value)}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function EvidenceJourneyDrawer({
  runId,
  journey,
  canViewRawEvidence = false,
}: {
  runId: string
  journey?: EvidenceJourneyResult
  /** When false, raw deep-links stay locked (RBAC). Trace expand still works. */
  canViewRawEvidence?: boolean
}) {
  const items = (journey?.items ?? []) as EvidenceJourneyItem[]
  const byStage = latestItemPerStage(items)
  const empty = items.length === 0

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="w-4 h-4" />
          Evidence Journey
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Evidence Journey</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {empty ? (
            <p className="text-sm text-muted-foreground">
              No evidence facts persisted for this run — stages remain PENDING / NOT_OBSERVED.
            </p>
          ) : null}
          {EVIDENCE_JOURNEY_STAGES.map((stage, idx) => {
            const stageData = byStage.get(stage)
            const state: EvidenceJourneyState = stageData
              ? normalizeJourneyState(stageData.journeyState)
              : empty
                ? 'NOT_OBSERVED'
                : 'PENDING'
            return (
              <div key={stage} className="flex gap-4 relative">
                {idx !== EVIDENCE_JOURNEY_STAGES.length - 1 && (
                  <div className="absolute left-2.5 top-6 w-px h-full bg-border -z-10" />
                )}
                <div
                  className={`w-5 h-5 rounded-full border-2 bg-background flex-shrink-0 mt-0.5 ${
                    state === 'OBSERVED'
                      ? 'border-primary'
                      : state === 'BLOCKED' || state === 'NOT_OBSERVED'
                        ? 'border-destructive'
                        : 'border-muted-foreground'
                  }`}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm font-mono">{stage}</span>
                    <Badge variant={stateBadgeVariant(state)}>{state}</Badge>
                  </div>
                  {state === 'NOT_OBSERVED' && (
                    <p className="text-xs text-destructive">
                      NOT_OBSERVED — no fact recorded at this stage
                    </p>
                  )}
                  {stageData?.observedAt !== undefined && stageData.observedAt !== null ? (
                    <p className="text-xs text-muted-foreground">
                      {new Date(stageData.observedAt).toLocaleString()}
                      {typeof stageData.revision === 'number' ? ` · rev ${stageData.revision}` : ''}
                    </p>
                  ) : null}
                  {stageData ? (
                    <RawNormalizedTrace
                      item={stageData}
                      canViewRawEvidence={canViewRawEvidence}
                      runId={runId}
                    />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
