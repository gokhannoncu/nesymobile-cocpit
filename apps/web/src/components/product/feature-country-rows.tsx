'use client'

import { cn } from '@nesy/metronic/lib/utils'
import { toneCard, toneDot, toneText, type Tone } from './tones'

export type FeatureCountryRow = {
  id: string
  name: string
  subtitle: string
  value: string
}

type SupportKind = 'active' | 'none' | 'out'

function supportOf(value: string): {
  kind: SupportKind
  label: string
  tone: Tone
  lines: string[]
} {
  if (value === '—') {
    return { kind: 'none', label: 'Yok', tone: 'red', lines: [] }
  }
  if (value === 'N/A') {
    return { kind: 'out', label: 'Kapsam dışı', tone: 'gray', lines: [] }
  }
  const lines = value
    .split('\n')
    .map((line) => line.replace(/^[•\-]\s*/, '').trim())
    .filter(Boolean)
  return { kind: 'active', label: 'Aktif', tone: 'green', lines }
}

function countryCode(id: string, name: string): string {
  if (id === 'core') return 'CORE'
  const fromId = id.toUpperCase()
  if (fromId.length <= 3) return fromId
  const match = name.match(/\b([A-Z]{2})\b/)
  return match?.[1] ?? fromId.slice(0, 2)
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  if (value === 0) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium',
        toneCard[tone],
        toneText[tone],
      )}
    >
      <span className={cn('size-1.5 rounded-full', toneDot[tone])} aria-hidden />
      {label}
      <span className="font-bold tabular-nums text-foreground">{value}</span>
    </span>
  )
}

function BehaviorTags({ lines, muted }: { lines: string[]; muted: boolean }) {
  if (lines.length === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {lines.map((line) => (
        <span
          key={line}
          className={cn(
            'inline-flex max-w-full truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-tight',
            muted
              ? 'border-border/50 bg-muted/20 text-muted-foreground'
              : 'border-border/60 bg-background text-foreground/85',
          )}
          title={line}
        >
          {line}
        </span>
      ))}
    </div>
  )
}

function CountryRow({ row, isCore }: { row: FeatureCountryRow; isCore?: boolean }) {
  const support = supportOf(row.value)
  const code = countryCode(row.id, row.name)
  const muted = support.kind !== 'active'

  return (
    <div
      role="row"
      className={cn(
        'group grid grid-cols-[2.75rem_minmax(0,10rem)_4.25rem_minmax(0,1fr)] items-center gap-x-3 border-b border-border/40 px-3 py-1.5 last:border-b-0 sm:grid-cols-[3rem_minmax(0,11rem)_5rem_minmax(0,1fr)] sm:gap-x-4 sm:px-4',
        'transition-colors hover:bg-muted/15',
        muted && 'opacity-70',
        isCore && 'bg-indigo-500/[0.04]',
      )}
    >
      <span
        role="cell"
        className={cn(
          'inline-flex w-full items-center justify-center rounded px-1 py-0.5 text-[10px] font-bold tracking-wide',
          isCore
            ? 'bg-indigo-600 text-white dark:bg-indigo-500'
            : 'bg-foreground/[0.06] text-foreground',
        )}
      >
        {code}
      </span>

      <div role="cell" className="min-w-0 truncate">
        <span className="text-xs font-semibold text-foreground">{row.name}</span>
        <span className="text-[11px] text-muted-foreground"> · {row.subtitle}</span>
      </div>

      <span
        role="cell"
        className={cn(
          'inline-flex w-fit items-center gap-1 text-[10px] font-semibold uppercase tracking-wide',
          toneText[support.tone],
        )}
      >
        <span className={cn('size-1.5 shrink-0 rounded-full', toneDot[support.tone])} aria-hidden />
        {support.label}
      </span>

      <div role="cell" className="min-w-0">
        <BehaviorTags lines={support.lines} muted={muted} />
      </div>
    </div>
  )
}

export function FeatureCountryRows({ rows }: { rows: FeatureCountryRow[] }) {
  const counts = rows.reduce(
    (acc, row) => {
      acc[supportOf(row.value).kind] += 1
      return acc
    },
    { active: 0, none: 0, out: 0 } as Record<SupportKind, number>,
  )

  const core = rows.find((row) => row.id === 'core')
  const markets = rows.filter((row) => row.id !== 'core')
  const ordered = core ? [core, ...markets] : markets

  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-muted/20 px-3 py-2 sm:px-4">
        <SummaryChip label="Aktif" value={counts.active} tone="green" />
        <SummaryChip label="Yok" value={counts.none} tone="red" />
        <SummaryChip label="Kapsam dışı" value={counts.out} tone="gray" />
        <span className="ms-auto text-[11px] tabular-nums text-muted-foreground">
          {counts.active}/{rows.length} pazar
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[36rem]" role="table">
          <div
            role="row"
            className="grid grid-cols-[2.75rem_minmax(0,10rem)_4.25rem_minmax(0,1fr)] gap-x-3 border-b border-border/50 bg-muted/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[3rem_minmax(0,11rem)_5rem_minmax(0,1fr)] sm:gap-x-4 sm:px-4"
          >
            <span role="columnheader">Kod</span>
            <span role="columnheader">Pazar</span>
            <span role="columnheader">Durum</span>
            <span role="columnheader">Davranış</span>
          </div>

          {ordered.map((row) => (
            <CountryRow key={row.id} row={row} isCore={row.id === 'core'} />
          ))}
        </div>
      </div>
    </div>
  )
}
