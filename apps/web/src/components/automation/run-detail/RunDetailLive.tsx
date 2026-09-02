'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import {
  Activity,
  BarChart3,
  FileSearch,
  LayoutDashboard,
  Network,
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
import { RunDetailDiagnostics } from './RunDetailDiagnostics'
import { RunDetailExecution } from './RunDetailExecution'
import { RunDetailHero } from './RunDetailHero'
import { RunDetailNetwork } from './RunDetailNetwork'
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
      // The permission has to be repeated on every refetch. The API withholds
      // captured HTTP bodies unless asked, so omitting it here would let the
      // first server render carry them and the first live refresh silently drop
      // them again — panels emptying themselves a moment after the page settles.
      fetchVerdictRunTelemetry(runId, canViewRawEvidence),
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
  }, [runId, canViewRawEvidence])

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

  const copyRunId = useCallback(() => {
    void navigator.clipboard?.writeText(runId)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1_500)
      })
      .catch(() => undefined)
  }, [runId])

  return (
    <MotionConfig reducedMotion="user">
      <ProductPage path="/automation/list" title="Run Detail" hideToolbar>
        <div className="space-y-4">
          <RunDetailHero
            automationId={automationId}
            runId={runId}
            view={view}
            telemetry={telemetry}
            evidenceJourney={evidenceJourney}
            canViewRawEvidence={canViewRawEvidence}
            liveStatus={live.status}
            latestSeq={live.latestSeq}
            liveRefreshing={live.refreshing}
            supplementalRefreshing={supplementalRefreshing}
            onRefreshAll={refreshAll}
            copied={copied}
            onCopyRunId={copyRunId}
            isBlocked={isBlocked}
            blockedReason={blockedReason}
            partial={runDetail.partial}
            staleSourceCount={errorCount}
          />

          {live.status === 'offline' || errorCount > 0 ? (
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-xs text-amber-950"
              role="status"
            >
              <span className="font-semibold">Data source status</span>
              {live.status === 'offline' ? (
                <span>Live socket offline — showing last durable state</span>
              ) : null}
              {Object.entries(sourceErrors).map(([source, message]) => (
                <span key={source} title={message}>
                  {source} stale
                </span>
              ))}
            </div>
          ) : null}

          <SegmentTabs
        appearance="pill"
        defaultValue="summary"
        items={[
          {
            value: 'summary',
            label: 'Summary',
            icon: LayoutDashboard,
            content: <RunDetailSummary view={view} layerStates={layerStates} />,
          },
          {
            value: 'performance',
            label: 'Performance',
            icon: BarChart3,
            content: <RunDetailPerformance view={view} />,
          },
          {
            value: 'network',
            label: 'Network',
            icon: Network,
            count: view.charts.network.length || undefined,
            content: (
              <RunDetailNetwork view={view} canViewRawEvidence={canViewRawEvidence} />
            ),
          },
          {
            value: 'execution',
            label: 'Execution',
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
            label: 'Diagnostics',
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
        </div>
      </ProductPage>
    </MotionConfig>
  )
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
