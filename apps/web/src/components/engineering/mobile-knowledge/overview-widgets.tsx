'use client'

// Overview widget'ları — Documentation Coverage, Recently Updated, Needs Attention.

import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, Clock } from 'lucide-react'
import { Progress } from '@nesy/metronic/components/ui/progress'
import { cn } from '@nesy/metronic/lib/utils'
import { toneText, type Tone } from '@/components/product'
import { COVERAGE, NEEDS_ATTENTION, RECENTLY_UPDATED } from '@/data/engineering/mobile-knowledge/coverage'

function pctTone(pct: number): Tone {
  if (pct >= 80) return 'green'
  if (pct >= 65) return 'amber'
  return 'red'
}

export function CoverageCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {COVERAGE.map((row) => {
        const tone = pctTone(row.pct)
        return (
          <div key={row.area} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-medium">{row.area}</span>
              <span className={cn('text-lg font-semibold tabular-nums', toneText[tone])}>
                %{row.pct}
              </span>
            </div>
            <Progress value={row.pct} className="h-2" />
          </div>
        )
      })}
    </div>
  )
}

export function RecentlyUpdated() {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {RECENTLY_UPDATED.map((item) => (
        <li key={item.title}>
          <Link
            href={item.href}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent"
          >
            <span className="flex items-center gap-2.5 text-sm">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              {item.title}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {item.when}
              <ArrowUpRight className="size-3.5" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function NeedsAttention() {
  return (
    <ul className="space-y-2">
      {NEEDS_ATTENTION.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          {item}
        </li>
      ))}
    </ul>
  )
}
