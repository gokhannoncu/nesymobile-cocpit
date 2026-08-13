'use client'

import {
  Activity,
  CheckCircle2,
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
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { CardGrid, InfoCard } from '@/components/product/cards'
import { ComparisonTable } from '@/components/product/comparison'
import { StatCard, StatGrid } from '@/components/product/stats'
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
      {view.alert ? (
        <Alert variant={view.alert.severity === 'destructive' ? 'destructive' : 'warning'}>
          <ShieldAlert className="size-4" />
          <AlertTitle>{view.alert.title}</AlertTitle>
          <AlertDescription>{view.alert.description}</AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="run-kpis">
        <h2 id="run-kpis" className="sr-only">Run summary metrics</h2>
        <StatGrid cols={3}>
          {view.kpis.map((kpi) => (
            <StatCard
              key={kpi.key}
              icon={KPI_ICONS[kpi.key]}
              label={kpi.label}
              value={kpi.value}
              hint={kpi.hint}
              tone={kpi.tone}
            />
          ))}
        </StatGrid>
      </section>

      <section className="space-y-3" aria-labelledby="run-outcomes">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="run-outcomes" className="text-base font-semibold">Decision outcomes</h2>
            <p className="text-xs text-muted-foreground">
              Persisted action, gate, oracle and cleanup lanes; missing values fail closed.
            </p>
          </div>
          <LayerBadges states={layerStates} />
        </div>
        <CardGrid cols={4}>
          {view.outcomes.map((outcome) => (
            <OutcomeInfoCard key={outcome.key} outcome={outcome} />
          ))}
        </CardGrid>
      </section>

      <section className="space-y-3" aria-labelledby="run-comparison">
        <h2 id="run-comparison" className="text-base font-semibold">Expected vs observed</h2>
        <ComparisonTable
          headers={[
            { label: 'Checkpoint' },
            { label: 'Expected', tone: 'blue' },
            { label: 'Observed' },
            { label: 'Status' },
          ]}
          rows={view.comparisons.map((row) => [
            row.label,
            row.expected,
            <span key={`${row.label}-observed`} className="font-mono text-xs">{row.observed}</span>,
            <Badge
              key={`${row.label}-status`}
              variant={row.tone === 'red' ? 'destructive' : 'outline'}
              className={badgeClass(row.tone)}
            >
              {row.status}
            </Badge>,
          ])}
        />
      </section>

      <section className="min-w-0 space-y-3" aria-labelledby="workflow-path">
        <div>
          <h2 id="workflow-path" className="text-base font-semibold">Actual workflow path</h2>
          <p className="text-xs text-muted-foreground">
            Each step shows its measured duration and Oracle validation across Bridge (UI), SDK (App),
            Local DB and Backend planes.
          </p>
        </div>
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

function OutcomeInfoCard({ outcome }: { outcome: RunOutcomeCard }) {
  return (
    <InfoCard
      icon={OUTCOME_ICONS[outcome.key]}
      title={outcome.label}
      eyebrow={outcome.value}
      desc={outcome.description}
      tone={outcome.tone}
      footer={
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="size-3.5" />
          Durable read model
        </div>
      }
    />
  )
}

function badgeClass(tone: OutcomeTone): string {
  if (tone === 'green') return 'border-emerald-300 bg-emerald-50 text-emerald-800'
  if (tone === 'amber') return 'border-amber-300 bg-amber-50 text-amber-800'
  if (tone === 'red') return 'border-red-300 bg-red-50 text-red-800'
  return 'text-muted-foreground'
}
