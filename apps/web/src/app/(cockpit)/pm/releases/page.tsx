'use client'

import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, GitCompare, Rocket, Timer } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  ProductPage,
  HeroCallout,
  PageSection,
  StatCard,
  StatGrid,
  Callout,
  Timeline,
  ComparisonTable,
  SegmentTabs,
} from '@/components/product'
import type { TimelineItem } from '@/components/product/timeline'
import type { SegmentTabItem } from '@/components/product/segment-tabs'
import { releases, getReleasedVersions, getLatestRelease } from '@/data/pm/releases'
import { COUNTRY_LABELS } from '@/data/pm/versions'

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDow = (firstDay.getDay() + 6) % 7 // 0=Mon
  const days: (number | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)
  return days
}

const statusTone: Record<string, 'green' | 'blue' | 'gray' | 'red'> = {
  released: 'green',
  staging: 'blue',
  planned: 'gray',
  'rolled-back': 'red',
}

const statusMap: Record<string, 'done' | 'active' | 'next'> = {
  released: 'done',
  staging: 'active',
  planned: 'next',
}

const statusLabel: Record<string, string> = {
  released: 'Released',
  staging: 'Staging',
  planned: 'Planned',
  'rolled-back': 'Rolled Back',
}

const dotColor: Record<string, string> = {
  released: 'bg-green-500',
  staging: 'bg-blue-500',
  planned: 'bg-gray-400',
  'rolled-back': 'bg-red-500',
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab() {
  const sorted = [...releases].sort((a, b) => b.date.localeCompare(a.date))
  const items: TimelineItem[] = sorted.map((r) => {
    const d = new Date(r.date)
    const period = `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
    const title = `v${r.version}${r.codename ? ` — ${r.codename}` : ''}`
    const bullets = [...r.features, ...r.fixes].slice(0, 5)
    const badges = [
      ...r.countries.map((c) => COUNTRY_LABELS[c] ?? c.toUpperCase()),
      r.version,
    ]
    return {
      period,
      title,
      desc: r.notes,
      tone: statusTone[r.status],
      status: statusMap[r.status],
      bullets,
      badges,
    }
  })
  return <Timeline items={items} />
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab() {
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(7)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const days = getCalendarDays(year, month)
  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

  function prev() {
    if (month === 1) { setMonth(12); setYear(year - 1) }
    else setMonth(month - 1)
  }
  function next() {
    if (month === 12) { setMonth(1); setYear(year + 1) }
    else setMonth(month + 1)
  }

  function releasesForDate(day: number) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return releases.filter((r) => r.date === dateStr)
  }

  const selectedReleases = selectedDate
    ? releases.filter((r) => r.date === selectedDate)
    : []

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-3">
        <button
          onClick={prev}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-bold text-foreground">
          {TR_MONTHS[month - 1]} {year}
        </span>
        <button
          onClick={next}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {dayNames.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const matched = day ? releasesForDate(day) : []
            const dateStr = day
              ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              : null
            const isSelected = dateStr === selectedDate
            return (
              <button
                key={i}
                disabled={!day}
                onClick={() => day && setSelectedDate(isSelected ? null : dateStr)}
                className={cn(
                  'relative flex min-h-[56px] flex-col items-center gap-1 border-b border-r border-border/40 p-1.5 text-sm transition-colors',
                  day ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default',
                  isSelected && 'bg-primary/10 ring-1 ring-primary/30',
                )}
              >
                {day && (
                  <>
                    <span className={cn(
                      'text-xs font-medium',
                      matched.length > 0 ? 'text-foreground font-bold' : 'text-muted-foreground',
                    )}>
                      {day}
                    </span>
                    {matched.length > 0 && (
                      <div className="flex gap-0.5">
                        {matched.map((r) => (
                          <span
                            key={r.id}
                            className={cn('size-1.5 rounded-full', dotColor[r.status])}
                            title={`v${r.version}`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedDate && selectedReleases.length > 0 && (
        <div className="space-y-3">
          {selectedReleases.map((r) => {
            const d = new Date(r.date)
            return (
              <div key={r.id} className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" size="sm" className={cn(
                    r.status === 'released' && 'bg-green-500/15 text-green-700 dark:text-green-400',
                    r.status === 'staging' && 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
                    r.status === 'planned' && 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
                  )}>
                    {statusLabel[r.status]}
                  </Badge>
                  <span className="text-sm font-bold text-foreground">
                    v{r.version}{r.codename ? ` — ${r.codename}` : ''}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{r.notes}</p>
                <div className="flex flex-wrap gap-1">
                  {r.countries.map((c) => (
                    <Badge key={c} variant="secondary" appearance="outline" size="xs">
                      {COUNTRY_LABELS[c] ?? c.toUpperCase()}
                    </Badge>
                  ))}
                </div>
                {r.features.length > 0 && (
                  <ul className="space-y-0.5">
                    {r.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-foreground/85">
                        <span className="mt-1 text-[10px]">✨</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {r.fixes.length > 0 && (
                  <ul className="space-y-0.5">
                    {r.fixes.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-foreground/85">
                        <span className="mt-1 text-[10px]">🐛</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedDate && selectedReleases.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Bu tarihte release bulunmuyor.
        </div>
      )}
    </div>
  )
}

// ─── Comparison Tab ───────────────────────────────────────────────────────────

function ComparisonTab() {
  const last4 = getReleasedVersions()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)

  const headers = [
    { label: 'Özellik' },
    ...last4.map((r) => ({ label: `v${r.version}`, tone: 'blue' as const })),
  ]

  const rows = [
    ['Tarih', ...last4.map((r) => {
      const d = new Date(r.date)
      return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
    })],
    ['Codename', ...last4.map((r) => r.codename ?? '—')],
    ['Ülkeler', ...last4.map((r) =>
      r.countries.map((c) => COUNTRY_LABELS[c] ?? c.toUpperCase()).join(', '),
    )],
    ['Ticket Fix', ...last4.map((r) => String(r.ticketIds.length))],
    ['Feature', ...last4.map((r) => String(r.features.length))],
    ['Fix', ...last4.map((r) => String(r.fixes.length))],
    ['Breaking Change', ...last4.map((r) => String(r.breakingChanges?.length ?? 0))],
  ]

  return <ComparisonTable headers={headers} rows={rows} highlightCol={1} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReleasesPage() {
  const releasedCount = releases.filter((r) => r.status === 'released').length
  const stagingCount = releases.filter((r) => r.status === 'staging').length
  const plannedCount = releases.filter((r) => r.status === 'planned').length
  const latest = getLatestRelease()

  const tabs: SegmentTabItem[] = [
    {
      value: 'timeline',
      label: 'Zaman Çizelgesi',
      icon: Timer,
      content: <TimelineTab />,
    },
    {
      value: 'takvim',
      label: 'Takvim',
      icon: CalendarDays,
      content: <CalendarTab />,
    },
    {
      value: 'karsilastirma',
      label: 'Karşılaştırma',
      icon: GitCompare,
      content: <ComparisonTab />,
    },
  ]

  return (
    <ProductPage path="/pm/releases" title="Release Geçmişi">
      <HeroCallout
        icon={Rocket}
        eyebrow="Release & Versions"
        tone="purple"
        title="Release Geçmişi"
        lead="Tüm sürümlerin kronolojik kaydı — hangi özellik ve düzeltme hangi versiyonda, hangi ülkelere deploy edildi."
      >
        <StatGrid cols={4}>
          <StatCard label="Released" value={releasedCount} tone="green" />
          <StatCard label="Staging" value={stagingCount} tone="blue" />
          <StatCard label="Planned" value={plannedCount} tone="gray" />
          <StatCard label="Son Versiyon" value={latest?.version ?? '—'} tone="purple" />
        </StatGrid>
      </HeroCallout>

      <SegmentTabs items={tabs} defaultValue="timeline" />

      <Callout icon={Rocket} title="Release Test Kuralı" tone="amber">
        Her release staging ortamında en az 48 saat test edilmeden production&apos;a alınmamalıdır.
        Hotfix release&apos;lerde bile minimum smoke test zorunludur. Breaking change içeren sürümler
        tüm ülke ekiplerinin onayını gerektirir.
      </Callout>
    </ProductPage>
  )
}
