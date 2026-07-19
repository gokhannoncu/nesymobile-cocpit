'use client'

import { StatPill } from '@/components/product'
import type { Filters, Severity } from '@/data/pm/types'

interface OverviewSectionProps {
  total: number
  open: number
  closed: number
  critical: number
  high: number
  medium: number
  low: number
  filters: Filters
  onStatClick: (key: 'severity' | 'status' | '', value: string) => void
}

const severityMeta: { key: Severity; label: string; tone: 'red' | 'orange' | 'amber' | 'green' }[] = [
  { key: 'Critical', label: 'Critical', tone: 'red' },
  { key: 'High', label: 'High', tone: 'orange' },
  { key: 'Medium', label: 'Medium', tone: 'amber' },
  { key: 'Low', label: 'Low', tone: 'green' },
]

function pct(value: number, total: number): number {
  return total ? Math.round((value / total) * 100) : 0
}

export function OverviewSection({
  total,
  open,
  closed,
  critical,
  high,
  medium,
  low,
  filters,
  onStatClick,
}: OverviewSectionProps) {
  const counts: Record<Severity, number> = {
    Critical: critical,
    High: high,
    Medium: medium,
    Low: low,
  }

  const noScopeFilter = !filters.severity && !filters.status

  return (
    <div className="pm-td-stat-strip flex flex-wrap items-center gap-1.5">
      <StatPill
        label="Toplam"
        value={total}
        tone="nesy"
        active={noScopeFilter}
        delay={0}
        title={`${open} açık · ${closed} kapalı — tıkla sıfırla`}
        onClick={() => onStatClick('', '')}
      />
      <StatPill
        label="Açık"
        value={open}
        pct={pct(open, total)}
        tone="red"
        active={filters.status === 'open'}
        delay={0.04}
        title="Açık ticket'ları filtrele"
        onClick={() => onStatClick('status', 'open')}
      />
      <StatPill
        label="Kapalı"
        value={closed}
        pct={pct(closed, total)}
        tone="green"
        active={filters.status === 'closed'}
        delay={0.08}
        title="Kapalı ticket'ları filtrele"
        onClick={() => onStatClick('status', 'closed')}
      />

      <span className="mx-0.5 hidden h-4 w-px shrink-0 bg-border/70 sm:block" aria-hidden />

      {severityMeta.map(({ key, label, tone }, index) => {
        const count = counts[key]
        return (
          <StatPill
            key={key}
            label={label}
            value={count}
            pct={pct(count, total)}
            tone={tone}
            active={filters.severity === key}
            delay={0.12 + index * 0.04}
            title={`${label} severity filtrele`}
            onClick={() => onStatClick('severity', key)}
          />
        )
      })}
    </div>
  )
}
