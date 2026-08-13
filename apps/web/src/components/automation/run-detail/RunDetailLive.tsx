'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  Clipboard,
  FileSearch,
  LayoutDashboard,
} from 'lucide-react'
import { ProductPage } from '@/components/product/page-shell'
import { SegmentTabs } from '@/components/product/segment-tabs'
import { deriveLayerApplicability } from '@/lib/verdict-runtime/layer-applicability'
import { useRunLiveStream } from '@/lib/verdict-runtime/run-live-stream'
import {
  buildRunDetailViewModel,
} from '@/lib/verdict-runtime/run-detail-view-model'
import {
  fetchVerdictEvidenceJourney,
  fetchVerdictRunTelemetry,
} from '@/lib/verdict-runtime/client'
import type {
  EvidenceJourneyResult,
  RunDetailResult,
  RunTelemetryDto,
} from '@/lib/verdict-runtime/types'
import { EvidenceJourneyDrawer } from './EvidenceJourneyDrawer'
import { LiveUpdateSubscription } from './LiveUpdateSubscription'
import { RunDetailDiagnostics } from './RunDetailDiagnostics'
import { RunDetailExecution } from './RunDetailExecution'
import { RunDetailPerformance } from './RunDetailPerformance'
import { RunDetailSummary } from './RunDetailSummary'

const SUPPLEMENTAL_DEBOUNCE_MS = 450

type SourceErrors = Partial<Record<'detail' | 'evidence' | 'telemetry', string>>

/**
 * The run detail page's live body.
 *
 * The page stays a server component so the first paint is the durable snapshot —
 * a run page that rendered empty and filled in over a socket would show nothing
 * at all whenever the stream is down. From there this component owns the state:
 * every panel below reads the live copy, so what the operator sees is the run as
 * of the last event rather than as of the last page load.
 */
export function RunDetailLive({
  automationId,
  runId,
  initialDetail,
  initialEvidenceJourney,
  initialTelemetry,
  canViewRawEvidence,
  initialSourceErrors,
}: {
  automationId: string
  runId: string
  initialDetail: RunDetailResult
  initialEvidenceJourney?: EvidenceJourneyResult
  initialTelemetry?: RunTelemetryDto
  canViewRawEvidence: boolean
  initialSourceErrors?: SourceErrors
}) {
  const live = useRunLiveStream(runId, initialDetail)
  const runDetail = live.detail
  const [evidenceJourney, setEvidenceJourney] = useState(initialEvidenceJourney)
  const [telemetry, setTelemetry] = useState(initialTelemetry)
  const [sourceErrors, setSourceErrors] = useState<SourceErrors>(initialSourceErrors ?? {})
  const [supplementalRefreshing, setSupplementalRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)
  const mountedRef = useRef(true)
  const inFlightRef = useRef(false)
  const pendingRef = useRef(false)
  const supplementalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const layerStates = useMemo(() => deriveLayerApplicability(runDetail), [runDetail])
  const view = useMemo(
    () => buildRunDetailViewModel(runDetail, telemetry),
    [runDetail, telemetry],
  )

  const refreshSupplemental = useCallback(async () => {
    if (inFlightRef.current) {
      pendingRef.current = true
      return
    }
    inFlightRef.current = true
    setSupplementalRefreshing(true)
    const [evidenceResult, telemetryResult] = await Promise.allSettled([
      fetchVerdictEvidenceJourney(runId),
      fetchVerdictRunTelemetry(runId),
    ])
    if (mountedRef.current) {
      if (evidenceResult.status === 'fulfilled') setEvidenceJourney(evidenceResult.value)
      if (telemetryResult.status === 'fulfilled') setTelemetry(telemetryResult.value)
      setSourceErrors((current) => {
        const next = { ...current }
        if (evidenceResult.status === 'fulfilled') {
          delete next.evidence
        } else {
          next.evidence = errorMessage(evidenceResult.reason, 'Evidence journey refresh failed')
        }
        if (telemetryResult.status === 'fulfilled') {
          delete next.telemetry
        } else {
          next.telemetry = errorMessage(telemetryResult.reason, 'Telemetry refresh failed')
        }
        return next
      })
      setSupplementalRefreshing(false)
    }
    inFlightRef.current = false
    if (pendingRef.current && mountedRef.current) {
      pendingRef.current = false
      void refreshSupplemental()
    }
  }, [runId])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (supplementalTimerRef.current !== null) clearTimeout(supplementalTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (live.latestSeq === 0) return
    if (supplementalTimerRef.current !== null) clearTimeout(supplementalTimerRef.current)
    supplementalTimerRef.current = setTimeout(() => {
      supplementalTimerRef.current = null
      void refreshSupplemental()
    }, SUPPLEMENTAL_DEBOUNCE_MS)
    return () => {
      if (supplementalTimerRef.current !== null) clearTimeout(supplementalTimerRef.current)
    }
  }, [live.latestSeq, refreshSupplemental])

  useEffect(() => {
    if (live.error) {
      setSourceErrors((current) => ({ ...current, detail: live.error ?? undefined }))
    } else if (!live.refreshing && runDetail !== initialDetail) {
      setSourceErrors((current) => {
        if (!current.detail) return current
        const next = { ...current }
        delete next.detail
        return next
      })
    }
  }, [initialDetail, live.error, live.refreshing, runDetail])

  const refreshAll = useCallback(() => {
    live.refresh()
    void refreshSupplemental()
  }, [live, refreshSupplemental])

  const supplementalError = [sourceErrors.evidence, sourceErrors.telemetry]
    .filter(Boolean)
    .join(' · ') || undefined
  const errorCount = Object.keys(sourceErrors).length
  const blockedReason = runDetail.blockedReason
  const isBlocked = runDetail.partial || Boolean(blockedReason)

  return (
    <MotionConfig reducedMotion="user">
      <ProductPage
      path="/automation/list"
      title="Run Detail"
      toolbarHeading={
        <div className="min-w-0">
          <Link
            href={`/automation/${encodeURIComponent(automationId)}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to workflow
          </Link>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{view.header.workflowName}</h1>
            <Badge variant="outline">{view.header.lifecycle}</Badge>
          </div>
        </div>
      }
      toolbarActions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LiveUpdateSubscription
            status={live.status}
            latestSeq={live.latestSeq}
            refreshing={live.refreshing || supplementalRefreshing}
            onRefresh={refreshAll}
          />
          <EvidenceJourneyDrawer
            runId={runId}
            journey={evidenceJourney}
            canViewRawEvidence={canViewRawEvidence}
          />
        </div>
      }
    >
      <header className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Manager run dashboard
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">{view.header.workflowName}</h2>
            {view.header.workflowDescription ? (
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                {view.header.workflowDescription}
              </p>
            ) : null}
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{view.header.device}</Badge>
              <Badge variant="secondary">{view.header.environment}</Badge>
              <span className="break-all font-mono">Run ID: {runId}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Copy full run ID"
                onClick={() => {
                  void navigator.clipboard?.writeText(runId)
                    .then(() => {
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 1_500)
                    })
                    .catch(() => undefined)
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {telemetry?.measurementState ?? 'UNAVAILABLE'}
            </Badge>
            {errorCount > 0 ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                {errorCount} source{errorCount === 1 ? '' : 's'} stale
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      {isBlocked ? (
        <Alert variant="destructive">
          <AlertTitle>Execution is blocked or partial</AlertTitle>
          <AlertDescription>
            {blockedReason ?? 'The durable read model marked this run partial.'} The dashboard
            remains visible so available evidence and live events can still be inspected.
          </AlertDescription>
        </Alert>
      ) : null}

      {live.status === 'offline' || errorCount > 0 ? (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          role="status"
        >
          <span className="font-semibold">Data source status:</span>
          {live.status === 'offline' ? <span>live socket offline; showing last durable state</span> : null}
          {Object.entries(sourceErrors).map(([source, message]) => (
            <span key={source} title={message}>{source} stale</span>
          ))}
        </div>
      ) : null}

      <SegmentTabs
        appearance="segmented"
        defaultValue="summary"
        items={[
          {
            value: 'summary',
            label: 'Summary',
            description: 'Verdict, duration, progress and risk',
            icon: LayoutDashboard,
            content: <RunDetailSummary view={view} layerStates={layerStates} />,
          },
          {
            value: 'performance',
            label: 'Performance',
            description: 'Memory, HTTP, spans and throughput',
            icon: BarChart3,
            content: <RunDetailPerformance view={view} />,
          },
          {
            value: 'execution',
            label: 'Execution',
            description: 'Timeline, workflow and live events',
            icon: Activity,
            count: live.events.length || undefined,
            content: (
              <RunDetailExecution
                detail={runDetail}
                view={view}
                events={live.events}
                liveError={live.error}
              />
            ),
          },
          {
            value: 'diagnostics',
            label: 'Evidence & Diagnostics',
            description: 'Evidence, incidents, provenance and repro',
            icon: FileSearch,
            count: view.charts.incidents.length || undefined,
            // RunDetailDiagnostics owns ProvenancePanel and ReproExportPanel so
            // evidence-heavy controls stay out of the manager summary.
            content: (
              <RunDetailDiagnostics
                runId={runId}
                detail={runDetail}
                telemetry={telemetry}
                evidenceJourney={evidenceJourney}
                canViewRawEvidence={canViewRawEvidence}
                latestSeq={live.latestSeq}
                supplementalError={supplementalError}
                view={view}
              />
            ),
          },
        ]}
      />
      </ProductPage>
    </MotionConfig>
  )
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
