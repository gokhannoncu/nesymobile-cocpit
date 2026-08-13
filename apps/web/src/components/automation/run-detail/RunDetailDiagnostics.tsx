'use client'

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
import { Badge } from '@nesy/metronic/components/ui/badge'
import type {
  EvidenceJourneyResult,
  RunDetailResult,
  RunTelemetryDto,
} from '@/lib/verdict-runtime/types'
import type { RunDetailViewModel } from '@/lib/verdict-runtime/run-detail-view-model'
import { EvidenceJourneyDrawer } from './EvidenceJourneyDrawer'
import { InteractionOriginsPanel } from './InteractionOriginsPanel'
import { ProvenancePanel } from './ProvenancePanel'
import { ReproExportPanel } from './ReproExportPanel'

export function RunDetailDiagnostics({
  runId,
  detail,
  telemetry,
  evidenceJourney,
  canViewRawEvidence,
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
  return (
    <div className="space-y-6">
      {supplementalError ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Some diagnostic sources are stale</p>
          <p className="mt-1 text-xs">{supplementalError}. Last successful data remains visible.</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <DiagnosticMetric
          icon={Database}
          label="Evidence facts"
          value={evidenceJourney ? String(evidenceJourney.items.length) : 'UNAVAILABLE'}
          detail="Durable normalized evidence journey"
        />
        <DiagnosticMetric
          icon={RadioTower}
          label="Stream health"
          value={telemetry ? String(telemetry.streamHealth.length) : 'UNAVAILABLE'}
          detail="Durable stream/session health rows"
        />
        <DiagnosticMetric
          icon={Camera}
          label="Diagnostic captures"
          value={telemetry ? String(telemetry.diagnosticCaptures.length) : 'UNAVAILABLE'}
          detail="Triggered device diagnostic captures"
        />
      </div>

      <Section title="Latest SDK health snapshot" icon={HeartPulse}>
        {telemetry?.latestHealth ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HealthDatum
              icon={Activity}
              label="Runtime context"
              value={telemetry.latestHealth.screen ?? 'UNAVAILABLE'}
              detail={telemetry.latestHealth.operation ?? 'No active operation captured'}
            />
            <HealthDatum
              icon={MemoryStick}
              label="Heap"
              value={formatHeap(
                telemetry.latestHealth.heapUsedMb,
                telemetry.latestHealth.heapMaxMb,
              )}
              detail={
                telemetry.latestHealth.nativeHeapMb === null
                  ? 'Native heap not measured'
                  : `${telemetry.latestHealth.nativeHeapMb.toFixed(1)} MB native`
              }
            />
            <HealthDatum
              icon={AlertTriangle}
              label="ANR watchdog"
              value={telemetry.latestHealth.anrLevel ?? 'UNAVAILABLE'}
              detail={
                telemetry.latestHealth.anrBlockedMs === null
                  ? 'Blocked duration not measured'
                  : `${telemetry.latestHealth.anrBlockedMs.toLocaleString()} ms blocked`
              }
            />
            <HealthDatum
              icon={RadioTower}
              label="Delivery"
              value={telemetry.latestHealth.walState ?? 'UNAVAILABLE'}
              detail={formatDelivery(
                telemetry.latestHealth.eventsEmitted,
                telemetry.latestHealth.droppedSince,
              )}
            />
          </div>
        ) : (
          <Unavailable message="The device did not provide a get_health snapshot." />
        )}
      </Section>

      <Section title="Evidence journey" icon={Database}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Follow raw events through normalization and business evidence. Raw deep links remain
            protected by evidence:read RBAC.
          </p>
          <EvidenceJourneyDrawer
            runId={runId}
            journey={evidenceJourney}
            canViewRawEvidence={canViewRawEvidence}
          />
        </div>
      </Section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Section title="Incidents" icon={AlertTriangle}>
          {view.charts.incidents.length === 0 ? (
            <Unavailable message="Incident telemetry was not measured." />
          ) : (
            <div className="space-y-2">
              {view.charts.incidents.map((incident, index) => (
                <div
                  key={`${incident.event}-${incident.atMs ?? index}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs"
                >
                  <Badge variant={incident.severity === 'warning' ? 'outline' : 'destructive'}>
                    {incident.severity}
                  </Badge>
                  <span className="font-medium">{incident.event.replaceAll('_', ' ')}</span>
                  <span className="text-muted-foreground">
                    {[incident.screen, incident.operation].filter(Boolean).join(' · ') || 'No context'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Stream health" icon={RadioTower}>
          {!telemetry || telemetry.streamHealth.length === 0 ? (
            <Unavailable message="No stream health rows are available." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Session</th>
                    <th className="pb-2 font-medium">Contiguous seq</th>
                    <th className="pb-2 font-medium">Pending</th>
                    <th className="pb-2 font-medium">Lag</th>
                    <th className="pb-2 font-medium">Dead letter</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetry.streamHealth.map((stream, index) => (
                    <tr key={stream.sessionId ?? index} className="border-t">
                      <td className="py-2 font-mono">{stream.sessionId ?? 'UNAVAILABLE'}</td>
                      <td className="py-2">{stream.contiguousSeq ?? 'UNAVAILABLE'}</td>
                      <td className="py-2">{stream.receiptPending ?? 'UNAVAILABLE'}</td>
                      <td className="py-2">{stream.orderedLag ?? 'UNAVAILABLE'}</td>
                      <td className="py-2">{stream.deadLetteredCount ?? 'UNAVAILABLE'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <Section title="Diagnostic captures" icon={Camera}>
        {!telemetry || telemetry.diagnosticCaptures.length === 0 ? (
          <Unavailable message="No diagnostic capture records are available." />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {telemetry.diagnosticCaptures.map((capture, index) => (
              <div key={capture.captureId ?? index} className="rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-medium">{capture.captureId ?? 'UNAVAILABLE'}</span>
                  <Badge variant="outline">{capture.status ?? 'UNAVAILABLE'}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {[capture.triggerEvent, capture.screen, capture.operation].filter(Boolean).join(' · ') || 'No capture context'}
                </p>
                {capture.sensitive ? (
                  <p className="mt-2 flex items-center gap-1 text-amber-700">
                    <ShieldCheck className="size-3.5" /> Sensitive capture; access remains restricted.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Interaction origins" icon={ShieldCheck}>
        <InteractionOriginsPanel runId={runId} refreshToken={latestSeq} />
      </Section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <ProvenancePanel run={detail} />
        <ReproExportPanel run={detail} />
      </div>
    </div>
  )
}

function DiagnosticMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Database
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-mono text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function HealthDatum({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Database
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-lg border bg-muted/15 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 font-mono text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function formatHeap(usedMb: number | null, maxMb: number | null): string {
  if (usedMb === null) return 'UNAVAILABLE'
  return maxMb === null
    ? `${usedMb.toFixed(1)} MB`
    : `${usedMb.toFixed(1)} / ${maxMb.toFixed(1)} MB`
}

function formatDelivery(eventsEmitted: number | null, droppedSince: number | null): string {
  if (eventsEmitted === null && droppedSince === null) return 'Event counters not measured'
  return `${eventsEmitted?.toLocaleString() ?? '—'} emitted · ${droppedSince?.toLocaleString() ?? '—'} dropped`
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Database
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-4">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  )
}

function Unavailable({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
      <span className="font-mono font-semibold">NOT_MEASURED</span>
      <p className="mt-1">{message}</p>
    </div>
  )
}
