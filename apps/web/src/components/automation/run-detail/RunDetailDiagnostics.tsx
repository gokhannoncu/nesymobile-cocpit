'use client'

import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  Camera,
  Database,
  HeartPulse,
  MemoryStick,
  RadioTower,
  ShieldCheck,
} from 'lucide-react'
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from '@nesy/metronic/components/ui/alert'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { cn } from '@nesy/metronic/lib/utils'
import { ComparisonTable } from '@/components/product/comparison'
import { StatCard, StatGrid } from '@/components/product/stats'
import type { Tone } from '@/components/product/tones'
import type {
  EvidenceJourneyResult,
  RunDetailResult,
  RunTelemetryDto,
} from '@/lib/verdict-runtime/types'
import type { RunDetailViewModel } from '@/lib/verdict-runtime/run-detail-view-model'
import { InteractionOriginsPanel } from './InteractionOriginsPanel'
import { ProvenancePanel } from './ProvenancePanel'
import { ReproExportPanel } from './ReproExportPanel'

const METRIC_TONES = {
  evidence: 'blue',
  stream: 'teal',
  captures: 'gray',
} as const satisfies Record<string, Tone>

const HEALTH_TONES = {
  runtime: 'purple',
  heap: 'blue',
  anr: 'amber',
  delivery: 'teal',
} as const satisfies Record<string, Tone>

export function RunDetailDiagnostics({
  runId,
  detail,
  telemetry,
  evidenceJourney,
  latestSeq,
  supplementalError,
  view,
}: {
  runId: string
  detail: RunDetailResult
  telemetry?: RunTelemetryDto
  evidenceJourney?: EvidenceJourneyResult
  canViewRawEvidence: boolean
  latestSeq: number
  supplementalError?: string
  view: RunDetailViewModel
}) {
  void evidenceJourney

  const streamRows =
    telemetry?.streamHealth.map((stream, index) => [
      <span
        key={`session-${index}`}
        className="block max-w-[9rem] truncate font-mono text-[11px]"
        title={stream.sessionId ?? undefined}
      >
        {stream.sessionId ?? '—'}
      </span>,
      stream.contiguousSeq ?? '—',
      stream.receiptPending ?? '—',
      stream.orderedLag ?? '—',
      stream.deadLetteredCount ?? '—',
    ]) ?? []

  const incidentRows = view.charts.incidents.map((incident, index) => [
    <Badge
      key={`sev-${index}`}
      variant="outline"
      className={cn(
        'h-5 px-1.5 text-[10px] font-semibold',
        incident.severity === 'warning'
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border-red-300 bg-red-50 text-red-800',
      )}
    >
      {incident.severity}
    </Badge>,
    <span key={`evt-${index}`} className="font-medium">
      {incident.event.replaceAll('_', ' ')}
    </span>,
    <span key={`ctx-${index}`} className="text-muted-foreground">
      {[incident.screen, incident.operation].filter(Boolean).join(' · ') || '—'}
    </span>,
  ])

  const captureRows =
    telemetry?.diagnosticCaptures.map((capture, index) => [
      <span key={`id-${index}`} className="font-mono text-[11px]">
        {capture.captureId ?? '—'}
      </span>,
      <Badge key={`st-${index}`} variant="outline" className="h-5 px-1.5 text-[10px] font-semibold">
        {capture.status ?? '—'}
      </Badge>,
      <span key={`ctx-${index}`} className="text-muted-foreground">
        {[capture.triggerEvent, capture.screen, capture.operation].filter(Boolean).join(' · ') || '—'}
      </span>,
      capture.sensitive ? (
        <span key={`sen-${index}`} className="text-amber-700">
          Sensitive
        </span>
      ) : (
        '—'
      ),
    ]) ?? []

  const hasIncidents = incidentRows.length > 0
  const hasCaptures = captureRows.length > 0
  const hasStream = streamRows.length > 0
  const allSignalsEmpty = !hasIncidents && !hasCaptures && !hasStream

  return (
    <div className="space-y-4">
      {supplementalError ? (
        <Alert variant="warning" appearance="light" size="sm" className="items-center">
          <AlertIcon>
            <AlertTriangle className="size-4" />
          </AlertIcon>
          <AlertContent className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
            <AlertTitle className="text-xs font-semibold">Some sources are stale</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground sm:text-right">
              {supplementalError}. Last successful data remains visible.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <StatGrid cols={3} dense>
        <StatCard
          variant="compact"
          icon={Database}
          label="Evidence facts"
          value={evidenceJourney ? evidenceJourney.items.length : '—'}
          hint="Durable normalized evidence journey"
          tone={METRIC_TONES.evidence}
        />
        <StatCard
          variant="compact"
          icon={RadioTower}
          label="Stream health"
          value={telemetry ? telemetry.streamHealth.length : '—'}
          hint="Durable stream/session health rows"
          tone={METRIC_TONES.stream}
        />
        <StatCard
          variant="compact"
          icon={Camera}
          label="Diagnostic captures"
          value={telemetry ? telemetry.diagnosticCaptures.length : '—'}
          hint="Triggered device diagnostic captures"
          tone={METRIC_TONES.captures}
        />
      </StatGrid>

      <section className="overflow-hidden rounded-lg border border-sky-200/70 bg-gradient-to-r from-sky-50/60 via-card to-card shadow-sm dark:border-sky-900/40 dark:from-sky-950/20">
        <div className="flex items-center gap-2 border-b border-sky-100/80 px-3 py-2 dark:border-sky-900/30">
          <HeartPulse className="size-3.5 text-sky-700 dark:text-sky-300" strokeWidth={2} aria-hidden />
          <h2 className="text-xs font-semibold text-foreground">SDK health snapshot</h2>
        </div>
        <div className="p-3">
          {telemetry?.latestHealth ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <HealthChip
                icon={Activity}
                label="Runtime"
                value={telemetry.latestHealth.screen ?? 'Not measured'}
                hint={telemetry.latestHealth.operation ?? 'No active operation'}
                tone={HEALTH_TONES.runtime}
              />
              <HealthChip
                icon={MemoryStick}
                label="Heap"
                value={formatHeap(telemetry.latestHealth.heapUsedMb, telemetry.latestHealth.heapMaxMb)}
                hint={
                  telemetry.latestHealth.nativeHeapMb === null
                    ? 'Native heap not measured'
                    : `${telemetry.latestHealth.nativeHeapMb.toFixed(1)} MB native`
                }
                tone={HEALTH_TONES.heap}
              />
              <HealthChip
                icon={AlertTriangle}
                label="ANR watchdog"
                value={telemetry.latestHealth.anrLevel ?? 'Not measured'}
                hint={
                  telemetry.latestHealth.anrBlockedMs === null
                    ? 'Blocked duration not measured'
                    : `${telemetry.latestHealth.anrBlockedMs.toLocaleString()} ms blocked`
                }
                tone={HEALTH_TONES.anr}
              />
              <HealthChip
                icon={RadioTower}
                label="Delivery"
                value={telemetry.latestHealth.walState ?? 'Not measured'}
                hint={formatDelivery(
                  telemetry.latestHealth.eventsEmitted,
                  telemetry.latestHealth.droppedSince,
                )}
                tone={HEALTH_TONES.delivery}
              />
            </div>
          ) : (
            <InlineEmpty message="No get_health snapshot from device." />
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Runtime signals</h2>
        {allSignalsEmpty ? (
          <InlineEmpty message="No incidents, stream health rows, or diagnostic captures for this run." />
        ) : (
          <div className="grid min-w-0 gap-3 xl:grid-cols-12">
            {hasStream ? (
              <SignalPanel
                className="xl:col-span-7"
                title="Stream health"
                icon={RadioTower}
                accent="teal"
                badge={String(streamRows.length)}
              >
                <ComparisonTable
                  density="dense"
                  headers={[
                    { label: 'Session' },
                    { label: 'Seq' },
                    { label: 'Pending' },
                    { label: 'Lag' },
                    { label: 'Dead letter' },
                  ]}
                  rows={streamRows}
                />
              </SignalPanel>
            ) : null}

            <div
              className={cn(
                'grid min-w-0 gap-3',
                hasStream ? 'xl:col-span-5' : 'xl:col-span-12 xl:grid-cols-2',
              )}
            >
              <SignalPanel
                title="Incidents"
                icon={AlertTriangle}
                accent="amber"
                badge={hasIncidents ? String(incidentRows.length) : '—'}
              >
                {hasIncidents ? (
                  <ComparisonTable
                    density="dense"
                    headers={[{ label: 'Severity' }, { label: 'Event' }, { label: 'Context' }]}
                    rows={incidentRows}
                  />
                ) : (
                  <InlineEmpty message="Not measured" />
                )}
              </SignalPanel>

              <SignalPanel
                title="Captures"
                icon={Camera}
                accent="gray"
                badge={hasCaptures ? String(captureRows.length) : '—'}
              >
                {hasCaptures ? (
                  <ComparisonTable
                    density="dense"
                    headers={[
                      { label: 'Capture ID' },
                      { label: 'Status' },
                      { label: 'Context' },
                      { label: 'Access' },
                    ]}
                    rows={captureRows}
                  />
                ) : (
                  <InlineEmpty message="No capture records" />
                )}
              </SignalPanel>
            </div>
          </div>
        )}
      </section>

      <SignalPanel title="Interaction origins" icon={ShieldCheck} accent="purple">
        <InteractionOriginsPanel runId={runId} refreshToken={latestSeq} />
      </SignalPanel>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ProvenancePanel run={detail} />
        <ReproExportPanel run={detail} />
      </div>
    </div>
  )
}

const ACCENT_STYLES = {
  teal: 'border-l-teal-500',
  amber: 'border-l-amber-500',
  gray: 'border-l-slate-400',
  purple: 'border-l-violet-500',
} as const

function SignalPanel({
  title,
  icon: Icon,
  accent = 'gray',
  badge,
  className,
  children,
}: {
  title: string
  icon: typeof Database
  accent?: keyof typeof ACCENT_STYLES
  badge?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-lg border border-border/80 border-l-[3px] bg-card shadow-sm',
        ACCENT_STYLES[accent],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 text-muted-foreground" strokeWidth={2} aria-hidden />
          <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        </div>
        {badge ? (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold tabular-nums">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="border-t border-border/60 px-2 pb-2 pt-1">{children}</div>
    </section>
  )
}

function HealthChip({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Database
  label: string
  value: string
  hint: string
  tone: Tone
}) {
  return (
    <StatCard variant="compact" icon={Icon} label={label} value={value} hint={hint} tone={tone} />
  )
}

function InlineEmpty({ message }: { message: string }) {
  return (
    <p className="px-2 py-3 text-center text-xs text-muted-foreground">{message}</p>
  )
}

function formatHeap(usedMb: number | null, maxMb: number | null): string {
  if (usedMb === null) return 'Not measured'
  return maxMb === null
    ? `${usedMb.toFixed(1)} MB`
    : `${usedMb.toFixed(1)} / ${maxMb.toFixed(1)} MB`
}

function formatDelivery(eventsEmitted: number | null, droppedSince: number | null): string {
  if (eventsEmitted === null && droppedSince === null) return 'Counters not measured'
  return `${eventsEmitted?.toLocaleString() ?? '—'} emitted · ${droppedSince?.toLocaleString() ?? '—'} dropped`
}
