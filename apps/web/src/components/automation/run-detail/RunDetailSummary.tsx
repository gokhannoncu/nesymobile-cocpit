'use client'

import {
  Activity,
  Clock3,
  Gauge,
  Gavel,
  ListChecks,
  MemoryStick,
  MousePointerClick,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from '@nesy/metronic/components/ui/alert'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { cn } from '@nesy/metronic/lib/utils'
import { ComparisonTable } from '@/components/product/comparison'
import { StatCard, StatGrid } from '@/components/product/stats'
import { toneIcon, toneIconBox, toneText, type Tone } from '@/components/product/tones'
import type {
  OutcomeTone,
  RunDetailViewModel,
  RunOutcomeCard,
} from '@/lib/verdict-runtime/run-detail-view-model'
import { LayerBadges } from './LayerBadge'
import { WorkflowPathTimeline } from './WorkflowPathTimeline'
import type { LayerApplicability } from '@/lib/verdict-runtime/layer-applicability'

const KPI_ICONS = {
  verdict: Gavel,
  duration: Clock3,
  progress: ListChecks,
  events: Activity,
  memory: MemoryStick,
  risks: ShieldAlert,
} as const

const OUTCOME_ICONS = {
  action: MousePointerClick,
  gate: Gauge,
  oracle: Sparkles,
  cleanup: Trash2,
} as const

export function RunDetailSummary({
  view,
  layerStates,
}: {
  view: RunDetailViewModel
  layerStates: LayerApplicability[]
}) {
  return (
    <div className="space-y-6">
      {view.alert ? <RunDetailNotice alert={view.alert} /> : null}

      <section aria-labelledby="run-kpis">
        <h2 id="run-kpis" className="sr-only">Run summary metrics</h2>
        <StatGrid cols={6} dense>
          {view.kpis.map((kpi) => (
            <StatCard
              key={kpi.key}
              variant="compact"
              icon={KPI_ICONS[kpi.key]}
              label={kpi.label}
              value={kpi.value}
              hint={kpi.hint}
              tone={kpi.tone}
            />
          ))}
        </StatGrid>
      </section>

      <section className="space-y-2.5" aria-labelledby="run-outcomes">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="run-outcomes" className="text-sm font-semibold text-foreground">Decision outcomes</h2>
          <LayerBadges states={layerStates} compact />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {view.outcomes.map((outcome) => (
            <OutcomeLaneCard key={outcome.key} outcome={outcome} />
          ))}
        </div>
      </section>

      <section className="space-y-2.5" aria-labelledby="run-comparison">
        <h2 id="run-comparison" className="text-sm font-semibold text-foreground">Expected vs observed</h2>
        <ComparisonTable
          density="dense"
          headers={[
            { label: 'Checkpoint' },
            { label: 'Expected', tone: 'blue' },
            { label: 'Observed' },
            { label: 'Status' },
          ]}
          rows={view.comparisons.map((row) => [
            row.label,
            <span key={`${row.label}-expected`} className="text-muted-foreground">{row.expected}</span>,
            <span key={`${row.label}-observed`} className="font-mono text-[11px] font-medium">{row.observed}</span>,
            <Badge
              key={`${row.label}-status`}
              variant="outline"
              className={cn('h-5 px-1.5 text-[10px] font-semibold', badgeClass(row.tone))}
            >
              {row.status}
            </Badge>,
          ])}
        />
      </section>

      <section className="min-w-0 space-y-3" aria-labelledby="workflow-path">
        <h2 id="workflow-path" className="text-base font-semibold">Actual workflow path</h2>
        {view.workflowPath.length === 0 ? (
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            NOT_MEASURED — no persisted workflow steps.
          </div>
        ) : (
          <WorkflowPathTimeline elements={view.diagram} />
        )}
      </section>
    </div>
  )
}

function RunDetailNotice({
  alert,
}: {
  alert: NonNullable<RunDetailViewModel['alert']>
}) {
  const destructive = alert.severity === 'destructive'
  return (
    <Alert
      variant={destructive ? 'destructive' : 'warning'}
      appearance="light"
      size="sm"
      className="items-start sm:items-center"
    >
      <AlertIcon>
        <ShieldAlert className="size-4" strokeWidth={2} />
      </AlertIcon>
      <AlertContent className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <AlertTitle className="text-xs font-semibold leading-snug">{alert.title}</AlertTitle>
        <AlertDescription className="text-xs leading-snug text-muted-foreground sm:text-right">
          {alert.description}
        </AlertDescription>
      </AlertContent>
    </Alert>
  )
}

function OutcomeLaneCard({ outcome }: { outcome: RunOutcomeCard }) {
  const Icon = OUTCOME_ICONS[outcome.key]
  const tone = outcome.tone as Tone

  return (
    <div
      title={outcome.description}
      className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-card px-3 py-2.5 shadow-sm"
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          toneIconBox[tone],
        )}
        aria-hidden
      >
        <Icon className={cn('size-4', toneIcon[tone])} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium leading-none text-muted-foreground">
          {outcome.label}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <span className={cn('truncate text-sm font-semibold leading-tight', toneText[tone])}>
            {formatOutcomeValue(outcome.value)}
          </span>
        </div>
      </div>
    </div>
  )
}

function formatOutcomeValue(value: string): string {
  if (value === 'NOT_MEASURED') return 'Not measured'
  if (value === 'REQUIRED_PENDING') return 'Pending'
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function badgeClass(tone: OutcomeTone): string {
  if (tone === 'green') return 'border-emerald-300 bg-emerald-50 text-emerald-800'
  if (tone === 'amber') return 'border-amber-300 bg-amber-50 text-amber-800'
  if (tone === 'red') return 'border-red-300 bg-red-50 text-red-800'
  return 'text-muted-foreground'
}
