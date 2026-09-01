'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Clipboard, Info } from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@nesy/metronic/components/ui/popover'
import { cn } from '@nesy/metronic/lib/utils'
import type { RunDetailViewModel } from '@/lib/verdict-runtime/run-detail-view-model'
import type { RunTelemetryDto } from '@/lib/verdict-runtime/types'
import type { RunLiveStatus } from '@/lib/verdict-runtime/run-live-stream'
import { EvidenceJourneyDrawer } from './EvidenceJourneyDrawer'
import { LiveUpdateSubscription } from './LiveUpdateSubscription'
import type { EvidenceJourneyResult } from '@/lib/verdict-runtime/types'

function formatRunId(runId: string): string {
  if (runId.length <= 20) return runId
  return `${runId.slice(0, 10)}…${runId.slice(-8)}`
}

function lifecycleBadgeClass(lifecycle: string): string {
  const value = lifecycle.toUpperCase()
  if (value.includes('COMPLET') || value === 'CLOSED' || value === 'PASS') {
    return 'border-emerald-200/90 bg-emerald-50 text-emerald-800'
  }
  if (value.includes('RUN') || value.includes('ACTIVE') || value.includes('OPEN')) {
    return 'border-sky-200/90 bg-sky-50 text-sky-800'
  }
  if (value.includes('FAIL') || value.includes('BLOCK') || value.includes('ERROR')) {
    return 'border-rose-200/90 bg-rose-50 text-rose-800'
  }
  return 'border-slate-200/90 bg-slate-50 text-slate-700'
}

function verdictBadgeClass(tone: string): string {
  if (tone === 'green') return 'border-emerald-200/90 bg-emerald-50 text-emerald-800'
  if (tone === 'red') return 'border-rose-200/90 bg-rose-50 text-rose-800'
  if (tone === 'amber') return 'border-amber-200/90 bg-amber-50 text-amber-900'
  return 'border-slate-200/90 bg-slate-50 text-slate-700'
}

export function RunDetailHero({
  automationId,
  runId,
  view,
  telemetry,
  evidenceJourney,
  canViewRawEvidence,
  liveStatus,
  latestSeq,
  liveRefreshing,
  supplementalRefreshing,
  onRefreshAll,
  copied,
  onCopyRunId,
  isBlocked,
  blockedReason,
  partial,
  staleSourceCount,
}: {
  automationId: string
  runId: string
  view: RunDetailViewModel
  telemetry?: RunTelemetryDto
  evidenceJourney?: EvidenceJourneyResult
  canViewRawEvidence: boolean
  liveStatus: RunLiveStatus
  latestSeq: number
  liveRefreshing: boolean
  supplementalRefreshing: boolean
  onRefreshAll: () => void
  copied: boolean
  onCopyRunId: () => void
  isBlocked: boolean
  blockedReason?: string
  partial: boolean
  staleSourceCount: number
}) {
  const verdictKpi = view.kpis.find((kpi) => kpi.key === 'verdict')
  const measurement = telemetry?.measurementState ?? 'UNAVAILABLE'
  const showPartialBadge = partial || measurement === 'PARTIAL'

  return (
    <header className="rounded-[8px] border border-slate-200/90 bg-white">
      <div className="border-b border-slate-200/80 px-4 py-2 sm:px-5">
        <Link
          href={`/automation/${encodeURIComponent(automationId)}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
          Back
        </Link>
      </div>

      <div className="space-y-3 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="min-w-0 text-lg font-semibold leading-snug tracking-tight text-slate-950 sm:text-xl">
                {view.header.workflowName}
              </h1>
              <Badge
                variant="outline"
                className={cn('shrink-0 font-semibold uppercase tracking-wide', lifecycleBadgeClass(view.header.lifecycle))}
              >
                {view.header.lifecycle}
              </Badge>
              {verdictKpi ? (
                <Badge
                  variant="outline"
                  className={cn('shrink-0 font-mono text-[10px] font-semibold', verdictBadgeClass(verdictKpi.tone))}
                >
                  {verdictKpi.value}
                </Badge>
              ) : null}
              {showPartialBadge ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-200/90 bg-amber-50 text-[10px] font-semibold text-amber-900"
                >
                  Partial
                </Badge>
              ) : null}
              {staleSourceCount > 0 ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-200/90 bg-amber-50 text-[10px] font-semibold text-amber-900"
                  title={`${staleSourceCount} data source${staleSourceCount === 1 ? '' : 's'} could not be refreshed`}
                >
                  {staleSourceCount} stale
                </Badge>
              ) : null}
              {view.header.workflowDescription ? (
                <WorkflowAboutPopover description={view.header.workflowDescription} />
              ) : null}
            </div>

            <RunMetaStrip
              device={view.header.device}
              environment={view.header.environment}
              runId={runId}
              copied={copied}
              onCopyRunId={onCopyRunId}
            />
          </div>

          <LiveUpdateSubscription
              status={liveStatus}
              latestSeq={latestSeq}
              refreshing={liveRefreshing || supplementalRefreshing}
              onRefresh={onRefreshAll}
              actions={
                <EvidenceJourneyDrawer
                  runId={runId}
                  journey={evidenceJourney}
                  canViewRawEvidence={canViewRawEvidence}
                />
              }
            />
        </div>

        {isBlocked ? (
          <div className="rounded-[8px] border border-rose-200/90 bg-rose-50/80 px-3 py-2 text-sm text-rose-950">
            <p className="font-medium">
              {blockedReason ?? 'Run marked partial — panels show available evidence only.'}
            </p>
          </div>
        ) : null}
      </div>
    </header>
  )
}

function RunMetaStrip({
  device,
  environment,
  runId,
  copied,
  onCopyRunId,
}: {
  device: string
  environment: string
  runId: string
  copied: boolean
  onCopyRunId: () => void
}) {
  return (
    <dl className="inline-flex max-w-full flex-wrap overflow-hidden rounded-lg border border-border/80 bg-muted/25 text-xs shadow-sm">
      <MetaSegment label="Device" value={device} title={device} />
      <MetaSegment label="Env" value={environment} />
      <MetaSegment
        label="Run"
        value={formatRunId(runId)}
        title={runId}
        mono
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label="Copy full run ID"
            title="Copy run ID"
            onClick={onCopyRunId}
          >
            {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
          </Button>
        }
      />
    </dl>
  )
}

function MetaSegment({
  label,
  value,
  title,
  mono = false,
  action,
}: {
  label: string
  value: string
  title?: string
  mono?: boolean
  action?: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-r border-border/80 px-2.5 py-1.5 last:border-r-0">
      <dt className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 truncate font-semibold text-foreground',
          mono && 'font-mono text-[11px] font-medium',
        )}
        title={title ?? value}
      >
        {value}
      </dd>
      {action}
    </div>
  )
}

function WorkflowAboutPopover({ description }: { description: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 rounded-[6px] text-slate-400 hover:text-slate-700"
          aria-label="About this workflow"
        >
          <Info className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-sm text-sm leading-relaxed text-slate-600">
        {description}
      </PopoverContent>
    </Popover>
  )
}
