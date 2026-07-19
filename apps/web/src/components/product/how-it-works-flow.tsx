'use client'

import { cn } from '@nesy/metronic/lib/utils'
import { toneCard, toneDot, toneText, type Tone } from './tones'

type HowItWorksFlowProps = {
  steps: string[]
  tone?: Tone
  /** `grid` — compact 2-column step cards (default). `timeline` — vertical timeline. */
  variant?: 'grid' | 'timeline'
}

export function HowItWorksFlow({ steps, tone = 'orange', variant = 'grid' }: HowItWorksFlowProps) {
  if (steps.length === 0) return null

  if (variant === 'timeline') {
    return (
      <div>
        <FlowHeader stepCount={steps.length} tone={tone} />
        <ol className="relative ms-2 mt-3 space-y-0 border-s border-border/60 ps-4">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1
            return (
              <li key={`${index}-${step}`} className={cn('relative', !isLast && 'pb-1.5')}>
                <StepBadge index={index} tone={tone} className="absolute -start-[1.0625rem] top-0.5" />
                <p className="text-[13px] leading-5 text-foreground/85">{step}</p>
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  return (
    <div>
      <FlowHeader stepCount={steps.length} tone={tone} />
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li
            key={`${index}-${step}`}
            className="flex gap-2.5 rounded-lg border border-border/50 bg-background/70 px-3 py-2.5"
          >
            <StepBadge index={index} tone={tone} className="mt-0.5 shrink-0" />
            <p className="min-w-0 text-[13px] leading-snug text-foreground/85">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function FlowHeader({ stepCount, tone }: { stepCount: number; tone: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className={cn('text-[11px] font-bold uppercase tracking-wide', toneText[tone])}>
        Nasıl çalışır
      </p>
      <span className="shrink-0 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
        {stepCount} adım
      </span>
    </div>
  )
}

function StepBadge({
  index,
  tone,
  className,
}: {
  index: number
  tone: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-background',
        toneDot[tone],
        className,
      )}
    >
      {index + 1}
    </span>
  )
}

export function FeatureOverviewPanel({
  whatIs,
  steps,
  tone = 'orange',
}: {
  whatIs: string
  steps: string[]
  tone?: Tone
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border', toneCard[tone])}>
      <div className="border-b border-border/50 px-4 py-4 sm:px-5">
        <p className="max-w-3xl text-[15px] leading-7 text-foreground/90">{whatIs}</p>
      </div>
      {steps.length > 0 && (
        <div className="bg-background/40 px-4 py-4 sm:px-5">
          <HowItWorksFlow steps={steps} tone={tone} variant="grid" />
        </div>
      )}
    </div>
  )
}
