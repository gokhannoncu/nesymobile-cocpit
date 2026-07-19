'use client'

import { cn } from '@nesy/metronic/lib/utils'
import { toneDot, toneText, type Tone } from './tones'

const severityColors: Record<number, string> = {
  1: 'bg-emerald-500',
  2: 'bg-lime-500',
  3: 'bg-amber-500',
  4: 'bg-orange-500',
  5: 'bg-red-500',
}

type ScoreEntry = {
  key: string
  label: string
  value: number
  higherIsWorse: boolean
}

function ScoreMeter({ label, value, higherIsWorse }: Omit<ScoreEntry, 'key'>) {
  const severity = higherIsWorse ? value : 6 - value
  const clamped = Math.min(5, Math.max(1, severity)) as 1 | 2 | 3 | 4 | 5

  return (
    <div className="min-w-0 px-3 py-2.5 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold text-foreground">{label}</span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
          {value}
          <span className="text-[10px] font-medium text-muted-foreground">/5</span>
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', severityColors[clamped])}
          style={{ width: `${value * 20}%` }}
        />
      </div>
    </div>
  )
}

export function FeatureScoreStrip({ scores }: { scores: ScoreEntry[] }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border/50 border-b border-border/50 bg-muted/10 sm:grid-cols-4 sm:divide-y-0">
      {scores.map((entry) => (
        <ScoreMeter
          key={entry.key}
          label={entry.label}
          value={entry.value}
          higherIsWorse={entry.higherIsWorse}
        />
      ))}
    </div>
  )
}

export function FeatureOpsTips({ tips, tone = 'orange' }: { tips: string[]; tone?: Tone }) {
  if (tips.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
        Kayıtlı operasyon notu yok.
      </p>
    )
  }

  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className={cn('text-[11px] font-bold uppercase tracking-wide', toneText[tone])}>
          Operasyon notları
        </p>
        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
          {tips.length} not
        </span>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {tips.map((tip, index) => (
          <li
            key={tip}
            className="flex gap-2 rounded-lg border border-border/50 bg-background/70 px-2.5 py-2"
          >
            <span
              className={cn(
                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white',
                toneDot[tone],
              )}
            >
              {index + 1}
            </span>
            <p className="min-w-0 text-[12px] leading-snug text-foreground/85">{tip}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function FeatureOpsPanel({
  scores,
  tips,
  tone = 'orange',
}: {
  scores: ScoreEntry[]
  tips: string[]
  tone?: Tone
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <FeatureScoreStrip scores={scores} />
      <FeatureOpsTips tips={tips} tone={tone} />
    </div>
  )
}

export type { ScoreEntry }
