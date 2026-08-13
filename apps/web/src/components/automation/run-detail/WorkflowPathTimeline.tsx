'use client'

import { Check, CircleDashed, Clock3, Flag, Minus, Play, X } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { DiagramElement, DiagramLayerTick } from '@/data/product/nesy-types'
import { formatDuration } from '@/lib/verdict-runtime/run-detail-view-model'

type Node = Extract<DiagramElement, { type: 'node' }>

const LAYER_META: Record<
  DiagramLayerTick['layer'],
  { label: string; role: string; text: string; ring: string }
> = {
  UI: {
    label: 'UI',
    role: 'Bridge',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-800',
  },
  App: {
    label: 'APP',
    role: 'SDK',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-200 dark:ring-blue-800',
  },
  Local: {
    label: 'LOCAL',
    role: 'Local DB',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200 dark:ring-amber-800',
  },
  Remote: {
    label: 'REMOTE',
    role: 'Backend',
    text: 'text-purple-700 dark:text-purple-300',
    ring: 'ring-purple-200 dark:ring-purple-800',
  },
}

function stateStyle(state: DiagramLayerTick['state']) {
  switch (state) {
    case 'PASS':
      return { Icon: Check, bg: 'bg-emerald-600 text-white' }
    case 'FAIL':
      return { Icon: X, bg: 'bg-red-600 text-white' }
    case 'REQUIRED_PENDING':
      return { Icon: Clock3, bg: 'bg-amber-500 text-white' }
    case 'NOT_APPLICABLE':
      return { Icon: Minus, bg: 'bg-slate-400 text-white dark:bg-slate-600' }
    case 'NOT_MEASURED':
    default:
      return { Icon: CircleDashed, bg: 'bg-muted text-muted-foreground' }
  }
}

const STATUS_TONES: Array<[RegExp, string]> = [
  [
    /(SUCCEEDED|PASS|SUCCESS|COMPLETED|DONE|VERIFIED|RELEASED)/i,
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  ],
  [
    /(FAIL|ERROR|CRASH|ABORT|REJECT|BLOCK|VIOLATED|INCONCLUSIVE|LEAKED)/i,
    'border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300',
  ],
  [
    /(PENDING|RUNNING|WAITING|NOT_STARTED|NOT_EVALUATED|QUEUED|ACTIVE|STARTED)/i,
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
  ],
]

function statusToneClass(status: string): string {
  for (const [pattern, cls] of STATUS_TONES) if (pattern.test(status)) return cls
  return 'border-border bg-muted/30 text-muted-foreground'
}

function stateLabel(state: DiagramLayerTick['state']): string {
  if (state === 'PASS') return 'validated'
  if (state === 'FAIL') return 'failed'
  if (state === 'REQUIRED_PENDING') return 'pending'
  if (state === 'NOT_APPLICABLE') return 'not applicable'
  return 'not measured'
}

export function WorkflowPathTimeline({
  elements,
  className,
}: {
  elements: DiagramElement[]
  className?: string
}) {
  const [start, ...rest] = elements.filter((element): element is Node => element.type === 'node')
  if (!start) return null

  const end = rest.at(-1) ?? null
  const steps = end ? rest.slice(0, -1) : []

  return (
    <ol
      className={cn('divide-y divide-border/60 rounded-xl border border-border/60 bg-card', className)}
      aria-label="Actual workflow path"
    >
      <TimelineRow role="start" label={start.label} desc={start.desc} />
      {steps.map((step, index) => (
        <TimelineRow
          key={`${index}-${step.label}`}
          role={step.variant === 'error' ? 'failed-step' : 'step'}
          index={index + 1}
          label={step.label}
          desc={step.desc}
          durationMs={step.durationMs}
          layers={step.layers}
        />
      ))}
      {end ? (
        <TimelineRow
          role="result"
          label={end.label}
          desc={end.desc}
          layers={end.layers}
          resultVariant={end.variant}
        />
      ) : null}
    </ol>
  )
}

function TimelineRow({
  role,
  index,
  label,
  desc,
  durationMs,
  layers,
  resultVariant,
}: {
  role: 'start' | 'step' | 'failed-step' | 'result'
  index?: number
  label: string
  desc?: string
  durationMs?: number
  layers?: DiagramLayerTick[]
  resultVariant?: string
}) {
  const isStart = role === 'start'
  const isResult = role === 'result'
  const isFailedResult = isResult && resultVariant === 'error'
  const isDecisionResult = isResult && resultVariant === 'decision'
  const isFailedStep = role === 'failed-step'

  const markerClass = cn(
    'flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-background',
    isStart && 'bg-teal-600',
    isResult && !isFailedResult && !isDecisionResult && 'bg-emerald-600',
    isFailedResult && 'bg-red-600',
    isDecisionResult && 'bg-amber-500',
    role === 'step' && 'bg-blue-600',
    isFailedStep && 'bg-red-600',
  )

  const eyebrow = isStart ? 'Start' : isResult ? 'Result' : `Step ${index}`

  return (
    <li className="flex items-center gap-3 px-3 py-2 first:rounded-t-xl last:rounded-b-xl">
      <span className={markerClass} aria-hidden>
        {isStart ? (
          <Play className="size-3" fill="currentColor" />
        ) : isResult ? (
          <Flag className="size-3" />
        ) : (
          <span>{index}</span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
            {eyebrow}
          </span>
          <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">{label}</span>
        </div>
        {isStart && desc ? (
          <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{desc}</span>
        ) : null}
      </div>

      {!isStart ? <StepDuration durationMs={durationMs} /> : null}

      {!isStart && desc ? (
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide',
            statusToneClass(desc),
          )}
        >
          {desc}
        </span>
      ) : null}

      {layers && layers.length > 0 ? (
        <LayerTicks layers={layers} />
      ) : isStart ? null : (
        <NoLayerVerdictHint />
      )}
    </li>
  )
}

function StepDuration({ durationMs }: { durationMs?: number }) {
  const measured = typeof durationMs === 'number'
  return (
    <span
      className={cn(
        'w-16 shrink-0 text-right font-mono text-[11px] tabular-nums',
        measured ? 'text-muted-foreground' : 'text-muted-foreground/40',
      )}
      title={
        measured
          ? 'Wall-clock time between the persisted start and completion of this step'
          : 'No persisted start/completion pair for this step'
      }
    >
      {measured ? formatDuration(durationMs) : '—'}
    </span>
  )
}

/**
 * A step that neither touched the screen nor declared an oracle policy has
 * nothing to validate across the four planes. Saying so is the honest
 * alternative to four empty ticks, which read as a measurement failure.
 */
function NoLayerVerdictHint() {
  return (
    <span
      className="shrink-0 border-s border-border/60 ps-3 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/60"
      title="This step performed no Bridge action and declared no continue gate or final oracle policy, so no plane produced a verdict. Its evidence is judged by a later oracle step."
    >
      no verdict
    </span>
  )
}

function LayerTicks({ layers }: { layers: DiagramLayerTick[] }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-s border-border/60 ps-3">
      {layers.map((layer) => {
        const meta = LAYER_META[layer.layer]
        const { Icon, bg } = stateStyle(layer.state)
        const label = stateLabel(layer.state)
        return (
          <span
            key={layer.layer}
            className="inline-flex items-center gap-1"
            title={
              layer.reason
                ? `${meta.label} · ${meta.role}: ${label}. ${layer.reason}`
                : `${meta.label} · ${meta.role}: ${label}`
            }
          >
            <span className={cn('font-mono text-[9px] font-bold uppercase tracking-wide', meta.text)}>
              {meta.label}
            </span>
            <span
              className={cn(
                'flex size-4 items-center justify-center rounded-full ring-1',
                bg,
                meta.ring,
              )}
              aria-label={`${meta.role} ${label}`}
            >
              <Icon className="size-2.5" strokeWidth={3} />
            </span>
          </span>
        )
      })}
    </div>
  )
}
