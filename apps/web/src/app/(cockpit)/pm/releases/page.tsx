'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  GitCompare,
  GitCommit,
  MapPin,
  Minus,
  PackageCheck,
  Rocket,
  RotateCcw,
  Search,
  Sparkles,
  Timer,
  Workflow,
  Wrench,
  X,
} from 'lucide-react'
import { Input } from '@nesy/metronic/components/ui/input'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  ProductPage,
  HeroCallout,
  StatCard,
  StatGrid,
  Callout,
  ComparisonTable,
  SegmentTabs,
  EASE,
  toneCard,
  toneDot,
  toneIconBox,
  toneText,
  type Tone,
} from '@/components/product'
import type { SegmentTabItem } from '@/components/product/segment-tabs'
import {
  getCarriedCodeReleases,
  getLatestProductionRelease,
  latestCountryVersions,
  productionReleases as releases,
  productionReleaseSummary,
  type ProductionRelease,
  type ProductionReleaseKind,
} from '@/data/pm/production-releases'

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const MONTH_NAMES = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

type KindFilter = ProductionReleaseKind | 'all'

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${day} ${MONTHS[month! - 1]} ${year}`
}

function formatReleaseDate(release: ProductionRelease) {
  return `${formatDate(release.date)}${release.time ? ` · ${release.time}` : ''}`
}

function compareReleaseDesc(a: ProductionRelease, b: ProductionRelease) {
  return b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '') || b.sequence - a.sequence
}

function releaseVersionLabel(release: ProductionRelease) {
  return release.versionTransitions
    .map((transition) =>
      `${transition.countryId.toUpperCase()} ${transition.from === null ? transition.to : `${transition.from}→${transition.to}`}`,
    )
    .join(' · ')
}

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

const kindTone: Record<ProductionReleaseKind, Tone> = {
  code: 'green',
  workflow: 'blue',
  rollout: 'amber',
}

const kindLabel: Record<ProductionReleaseKind, string> = {
  code: 'Uygulama kodu',
  workflow: 'Prod CI / Workflow',
  rollout: 'Yalnızca rollout',
}

const kindIcon: Record<ProductionReleaseKind, typeof Code2> = {
  code: Code2,
  workflow: Workflow,
  rollout: PackageCheck,
}

const chipCls: Record<ProductionReleaseKind, string> = {
  code:
    'bg-green-600 text-white shadow-sm shadow-green-600/20 dark:bg-green-500',
  workflow:
    'bg-blue-600 text-white shadow-sm shadow-blue-600/20 dark:bg-blue-500',
  rollout:
    'bg-amber-500 text-amber-950 shadow-sm shadow-amber-500/20 dark:bg-amber-400 dark:text-amber-950',
}

const badgeSolid: Record<ProductionReleaseKind, string> = {
  code: 'bg-green-600 text-white border-transparent',
  workflow: 'bg-blue-600 text-white border-transparent',
  rollout: 'bg-amber-500 text-amber-950 border-transparent',
}

const kindRing: Record<ProductionReleaseKind, string> = {
  code: 'ring-green-400/55',
  workflow: 'ring-blue-400/55',
  rollout: 'ring-amber-400/55',
}

function filterReleases(list: ProductionRelease[], kind: KindFilter) {
  if (kind === 'all') return list
  return list.filter((release) => release.kind === kind)
}

// ─── Shared change list panel ─────────────────────────────────────────────────

function ChangePanel({
  title,
  icon: Icon,
  items,
}: {
  title: string
  icon: typeof Sparkles
  items: string[]
}) {
  if (items.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3.5" />
          {title}
        </div>
        <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-xs leading-relaxed text-foreground/90">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/35" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function VersionTransitions({ release }: { release: ProductionRelease }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <MapPin className="size-3 text-muted-foreground" />
      {release.versionTransitions.map((transition) => {
        const isRollback = transition.from !== null && transition.to < transition.from
        return (
          <span
            key={transition.countryId}
            className={cn(
              'rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              isRollback
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                : 'border-border text-muted-foreground',
            )}
          >
            {transition.countryId.toUpperCase()}{' '}
            {transition.from === null ? transition.to : `${transition.from}→${transition.to}`}
          </span>
        )
      })}
    </div>
  )
}

function CarriedCodeSummary({ carriedReleases }: { carriedReleases: ProductionRelease[] }) {
  if (carriedReleases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
        Taşınan uygulama code değişikliği yok.
      </div>
    )
  }

  const visibleReleases = carriedReleases.slice(0, 3)
  const remainingCount = carriedReleases.length - visibleReleases.length

  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/55 p-3 dark:border-amber-900/70 dark:bg-amber-950/20">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
        <PackageCheck className="size-3.5" />
        Paketlenen codebase
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visibleReleases.map((release) => (
          <span
            key={release.id}
            className="rounded-md border border-amber-200 bg-background/85 px-2 py-1 text-[11px] font-semibold text-foreground dark:border-amber-900"
          >
            <span className="me-1 text-muted-foreground">#{release.sequence}</span>
            {release.title}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="rounded-md border border-amber-200 bg-background/85 px-2 py-1 text-[11px] font-semibold text-muted-foreground dark:border-amber-900">
            +{remainingCount} release daha
          </span>
        )}
      </div>
    </div>
  )
}

function CarriedCodeDetails({ carriedReleases }: { carriedReleases: ProductionRelease[] }) {
  if (carriedReleases.length === 0) return null

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/15 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Code2 className="size-3.5" />
        Paket içeriği
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {carriedReleases.map((release) => {
          const changes = [...release.features, ...release.fixes]

          return (
            <div key={release.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="text-xs font-bold text-foreground">
                  <span className="me-1.5 text-muted-foreground">#{release.sequence}</span>
                  {release.title}
                </div>
                <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                  {release.commit}
                </span>
              </div>
              {changes.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {changes.map((change) => (
                    <li key={change} className="flex gap-2 text-xs leading-relaxed text-foreground/90">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Timeline card ────────────────────────────────────────────────────────────

function ReleaseTimelineCard({
  release: r,
  isLast,
  defaultOpen = false,
}: {
  release: ProductionRelease
  isLast: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const KindIcon = kindIcon[r.kind]
  const hasAlerts = (r.alerts?.length ?? 0) > 0
  const changeCount = r.features.length + r.fixes.length + (r.alerts?.length ?? 0)
  const carriedCodeReleases = getCarriedCodeReleases(r)
  const hasDetails = changeCount > 0 || carriedCodeReleases.length > 0
  const panelCount =
    (r.features.length > 0 ? 1 : 0) + (r.fixes.length > 0 ? 1 : 0) + (hasAlerts ? 1 : 0)

  return (
    <motion.li
      className="relative flex gap-4 pb-5 last:pb-0"
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="flex flex-col items-center">
        <span className="z-10 mt-5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background ring-4 ring-background">
          <KindIcon className={cn('size-3.5', toneText[kindTone[r.kind]])} />
        </span>
        {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>

      <article className="mb-1 min-w-0 flex-1 rounded-xl border border-border bg-card">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge size="sm" className={badgeSolid[r.kind]}>
                  {kindLabel[r.kind]}
                </Badge>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {formatReleaseDate(r)}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-muted-foreground">
                  <GitCommit className="size-3" />
                  {r.commit}
                </span>
              </div>
              <h3 className="mt-1.5 text-base font-bold tracking-tight text-foreground sm:text-lg">
                <span className="me-2 text-muted-foreground">#{r.sequence}</span>
                {r.title}
              </h3>
              {r.notes && (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {r.notes}
                </p>
              )}
            </div>

            {hasDetails && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5',
                  'text-[11px] font-semibold text-muted-foreground transition-colors',
                  'hover:border-nesy/30 hover:text-foreground',
                )}
              >
                {open ? 'Daralt' : r.kind === 'rollout' ? 'Paket içeriği' : 'Ayrıntılar'}
                <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-muted-foreground">
            {r.features.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1">
                <Sparkles className="size-3" />
                {r.features.length} {r.features.length === 1 ? 'feature' : 'features'}
              </span>
            )}
            {r.fixes.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1">
                <Wrench className="size-3" />
                {r.fixes.length} {r.fixes.length === 1 ? 'fix' : 'fixes'}
              </span>
            )}
            {hasAlerts && (
              <span className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="size-3" />
                {r.alerts!.length} uyarı
              </span>
            )}
            {changeCount === 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1">
                Yeni kaynak kod yok
              </span>
            )}
          </div>

          {r.kind === 'rollout' && (
            <CarriedCodeSummary carriedReleases={carriedCodeReleases} />
          )}

          <VersionTransitions release={r} />

          {open && changeCount > 0 && (
            <div className={cn('grid gap-2', panelCount > 1 ? 'lg:grid-cols-2' : 'grid-cols-1')}>
              <ChangePanel title="Features" icon={Sparkles} items={r.features} />
              <ChangePanel title="Fixes" icon={Wrench} items={r.fixes} />
              {hasAlerts && (
                <div className={cn(panelCount > 1 && 'lg:col-span-2')}>
                  <ChangePanel title="Uyarı" icon={AlertTriangle} items={r.alerts!} />
                </div>
              )}
            </div>
          )}

          {open && r.kind === 'rollout' && (
            <CarriedCodeDetails carriedReleases={carriedCodeReleases} />
          )}
        </div>
      </article>
    </motion.li>
  )
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab({ kindFilter }: { kindFilter: KindFilter }) {
  const sorted = useMemo(
    () => [...filterReleases(releases, kindFilter)].sort(compareReleaseDesc),
    [kindFilter],
  )

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">Bu filtrede release yok</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tüm geçmişi görmek için release türü filtresini temizleyin.
        </p>
      </div>
    )
  }

  return (
    <ol className="relative ps-0">
      {sorted.map((r, i) => (
        <ReleaseTimelineCard
          key={r.id}
          release={r}
          isLast={i === sorted.length - 1}
          defaultOpen={i === 0 && r.kind !== 'rollout'}
        />
      ))}
    </ol>
  )
}

// ─── Release detail card ──────────────────────────────────────────────────────

function ReleaseDetailCard({ release: r }: { release: ProductionRelease }) {
  const KindIcon = kindIcon[r.kind]
  const hasAlerts = (r.alerts?.length ?? 0) > 0
  const carriedCodeReleases = getCarriedCodeReleases(r)

  return (
    <article className="rounded-xl border border-border bg-card">
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
            <KindIcon className={cn('size-4', toneText[kindTone[r.kind]])} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge size="sm" className={badgeSolid[r.kind]}>
                {kindLabel[r.kind]}
              </Badge>
              <span className="text-[11px] font-medium text-muted-foreground">
                {formatReleaseDate(r)}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-muted-foreground">
                <GitCommit className="size-3" />
                {r.commit}
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-bold tracking-tight text-foreground">
              <span className="me-2 text-muted-foreground">#{r.sequence}</span>
              {r.title}
            </h3>
            {r.notes && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.notes}</p>
            )}
          </div>
        </div>

        {r.kind === 'rollout' && (
          <CarriedCodeSummary carriedReleases={carriedCodeReleases} />
        )}

        <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-muted-foreground">
          {r.features.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1">
              <Sparkles className="size-3" />
              {r.features.length} {r.features.length === 1 ? 'feature' : 'features'}
            </span>
          )}
          {r.fixes.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1">
              <Wrench className="size-3" />
              {r.fixes.length} {r.fixes.length === 1 ? 'fix' : 'fixes'}
            </span>
          )}
          {hasAlerts && (
            <span className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="size-3" />
              {r.alerts!.length} uyarı
            </span>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <MapPin className="size-3" />
            Rollout
          </div>
          <VersionTransitions release={r} />
        </div>

        {(r.features.length > 0 || r.fixes.length > 0 || hasAlerts) && (
          <div className="grid gap-3">
            <ChangePanel title="Features" icon={Sparkles} items={r.features} />
            <ChangePanel title="Fixes" icon={Wrench} items={r.fixes} />
            {hasAlerts && (
              <ChangePanel title="Uyarı" icon={AlertTriangle} items={r.alerts!} />
            )}
          </div>
        )}

        {r.kind === 'rollout' && (
          <CarriedCodeDetails carriedReleases={carriedCodeReleases} />
        )}
      </div>
    </article>
  )
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab({ kindFilter }: { kindFilter: KindFilter }) {
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(7)
  const [selectedDate, setSelectedDate] = useState<string | null>('2026-07-10')

  const days = getCalendarDays(year, month)
  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const visible = useMemo(() => filterReleases(releases, kindFilter), [kindFilter])

  const monthReleases = useMemo(
    () =>
      visible.filter((r) => {
        const [y, m] = r.date.split('-').map(Number)
        return y === year && m === month
      }),
    [visible, year, month],
  )

  useEffect(() => {
    if (monthReleases.length === 0) {
      setSelectedDate(null)
      return
    }
    setSelectedDate((prev) => {
      if (prev && monthReleases.some((r) => r.date === prev)) return prev
      return monthReleases[0]!.date
    })
  }, [monthReleases])

  function prev() {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else setMonth(month - 1)
  }
  function next() {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else setMonth(month + 1)
  }

  function goToday() {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth() + 1)
    const hasReleaseToday = visible.some((r) => r.date === todayStr)
    setSelectedDate(hasReleaseToday ? todayStr : null)
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1

  function releasesForDate(day: number) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return visible.filter((r) => r.date === dateStr)
  }

  const selectedReleases = selectedDate
    ? visible.filter((r) => r.date === selectedDate)
    : []

  const kindLegend = (
    [
      ['code', 'Uygulama kodu', 'green'],
      ['workflow', 'Prod CI', 'blue'],
      ['rollout', 'Yalnızca rollout', 'amber'],
    ] as const
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={prev}
                aria-label="Önceki ay"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <h3 className="min-w-[9.5rem] text-center text-sm font-bold tabular-nums text-foreground">
                {MONTH_NAMES[month - 1]} {year}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={next}
                aria-label="Sonraki ay"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isCurrentMonth && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={goToday}
                >
                  Bugün
                </Button>
              )}
              <span className="rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                {monthReleases.length} release
              </span>
              <div className="hidden items-center gap-2 sm:flex">
                {kindLegend.map(([key, label, tone]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground"
                  >
                    <span className={cn('size-1.5 rounded-full', toneDot[tone])} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 sm:hidden">
            {kindLegend.map(([key, label, tone]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground"
              >
                <span className={cn('size-1.5 rounded-full', toneDot[tone])} />
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {dayNames.map((d) => (
              <div
                key={d}
                className="px-1.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
              >
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
              const isToday = dateStr === todayStr
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!day}
                  onClick={() => day && setSelectedDate(dateStr)}
                  className={cn(
                    'relative flex min-h-[88px] flex-col items-stretch gap-1 border-b border-r border-border/50 p-1.5 text-sm transition-colors',
                    !day && 'bg-muted/10 cursor-default',
                    day &&
                      'cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nesy/35',
                    day && matched.length === 0 && 'hover:bg-muted/30',
                    isSelected && 'z-[1] bg-nesy-soft/50 ring-1 ring-inset ring-nesy/30 dark:bg-nesy-soft/20',
                  )}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          'inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold self-start',
                          isToday && 'bg-nesy text-white shadow-sm',
                          !isToday && matched.length > 0 && 'text-foreground',
                          !isToday && matched.length === 0 && 'text-muted-foreground font-medium',
                        )}
                      >
                        {day}
                      </span>
                      {matched.length > 0 && (
                        <div className="flex flex-col gap-1 min-w-0 mt-auto">
                          {matched.slice(0, 2).map((r) => (
                            <span
                              key={r.id}
                              className={cn(
                                'truncate rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-tight tracking-tight',
                                chipCls[r.kind],
                              )}
                              title={`#${r.sequence} · ${r.title} · ${kindLabel[r.kind]}`}
                            >
                              #{r.sequence} · {r.versionTransitions.length} ülke
                            </span>
                          ))}
                          {matched.length > 2 && (
                            <span className="px-1 text-[10px] font-semibold text-muted-foreground">
                              +{matched.length - 2} daha
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Detail column */}
        <div className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {selectedDate ? formatDate(selectedDate) : 'Release ayrıntısı'}
            </h4>
            {selectedReleases.length > 1 && (
              <span className="text-[11px] font-semibold text-muted-foreground">
                {selectedReleases.length} release
              </span>
            )}
          </div>

          {selectedDate && selectedReleases.length > 0 && (
            <div className="space-y-3">
              {selectedReleases.map((r) => (
                <ReleaseDetailCard key={r.id} release={r} />
              ))}
            </div>
          )}

          {selectedDate && selectedReleases.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
              <CalendarDays className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">Bu tarihte release yok</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {kindFilter !== 'all'
                  ? `Seçili gün için “${kindLabel[kindFilter]}” eşleşmesi yok.`
                  : 'Takvimde vurgulanan bir günü seçin.'}
              </p>
            </div>
          )}

          {!selectedDate && (
            <div className="rounded-2xl border border-dashed bg-muted/20 px-5 py-10 text-center">
              <CalendarDays className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">Bir release günü seçin</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Renkli günlerde version chip’leri gösterilir; ayrıntılar için güne tıklayın.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Comparison Tab ───────────────────────────────────────────────────────────

const COMPARE_TONES: Tone[] = ['green', 'teal', 'blue', 'indigo']
const MAX_COMPARE = 4
const MIN_COMPARE = 2
const comparableReleases = releases.filter((release) => release.kind !== 'rollout')

function defaultCompareIds() {
  return [...comparableReleases]
    .sort(compareReleaseDesc)
    .slice(0, 4)
    .map((r) => r.id)
}

function MetricCell({
  value,
  baseline,
  isBaseline,
}: {
  value: number
  baseline: number
  isBaseline: boolean
}) {
  const delta = value - baseline
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm font-bold tabular-nums text-foreground">{value}</span>
      {!isBaseline && delta !== 0 && (
        <span
          className={cn(
            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
            delta > 0
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
          )}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
      {!isBaseline && delta === 0 && (
        <span className="text-[10px] font-medium text-muted-foreground">aynı</span>
      )}
    </div>
  )
}

function PresenceCell({ present }: { present: boolean }) {
  return present ? (
    <span className="inline-flex size-6 items-center justify-center rounded-md bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
      <Check className="size-3.5" />
    </span>
  ) : (
    <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Minus className="size-3.5" />
    </span>
  )
}

type CompareKindFilter = ProductionReleaseKind | 'all'

function releaseChangeCount(release: ProductionRelease) {
  return release.features.length + release.fixes.length + (release.alerts?.length ?? 0)
}

function ReleaseComparePicker({
  allSorted,
  selectedIds,
  baselineId,
  onToggle,
  onBaseline,
  onClear,
  onReset,
}: {
  allSorted: ProductionRelease[]
  selectedIds: string[]
  baselineId: string
  onToggle: (id: string) => void
  onBaseline: (id: string) => void
  onClear: () => void
  onReset: () => void
}) {
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<CompareKindFilter>('all')

  const selectedMap = useMemo(() => new Map(allSorted.map((r) => [r.id, r])), [allSorted])
  const selected = useMemo(
    () => selectedIds.map((id) => selectedMap.get(id)).filter(Boolean) as ProductionRelease[],
    [selectedIds, selectedMap],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return allSorted.filter((release) => {
      if (kindFilter !== 'all' && release.kind !== kindFilter) return false
      if (!needle) return true
      return (
        String(release.sequence).includes(needle) ||
        release.title.toLowerCase().includes(needle) ||
        release.commit.toLowerCase().includes(needle) ||
        kindLabel[release.kind].toLowerCase().includes(needle)
      )
    })
  }, [allSorted, kindFilter, query])

  const canAdd = selectedIds.length < MAX_COMPARE
  const kindFilters: { value: CompareKindFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Tümü', count: allSorted.length },
    { value: 'code', label: 'Kod', count: allSorted.filter((r) => r.kind === 'code').length },
    {
      value: 'workflow',
      label: 'CI',
      count: allSorted.filter((r) => r.kind === 'workflow').length,
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-gradient-to-br from-muted/40 via-background to-background px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-teal-200/70 bg-teal-50 dark:border-teal-900/50 dark:bg-teal-950/40">
              <GitCompare className="size-4 text-teal-700 dark:text-teal-300" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground">Karşılaştırılacak release&apos;ler</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                En az {MIN_COMPARE}, en fazla {MAX_COMPARE} seçin · rollout paketleri hariç
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 && (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onClear}>
                <X className="size-3.5" />
                Seçimi temizle
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onReset}>
              <RotateCcw className="size-3.5" />
              Son 4 kod release
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sıra, başlık veya commit ara…"
              className="h-9 ps-9 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {kindFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setKindFilter(filter.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                  kindFilter === filter.value
                    ? 'border-foreground/15 bg-foreground text-background shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                )}
              >
                {filter.label}
                <span
                  className={cn(
                    'rounded-md px-1 py-0.5 text-[10px] tabular-nums',
                    kindFilter === filter.value ? 'bg-background/15' : 'bg-muted',
                  )}
                >
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="border-b border-border bg-muted/20 px-4 py-3 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Seçili · {selected.length}/{MAX_COMPARE}
            </span>
            {selected.length >= MIN_COMPARE && (
              <span className="text-[11px] text-muted-foreground">
                Baseline için bir kart seçin
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map((release) => {
              const isBaseline = release.id === baselineId
              const tone = kindTone[release.kind]
              const KindIcon = kindIcon[release.kind]
              return (
                <button
                  key={release.id}
                  type="button"
                  onClick={() => onBaseline(release.id)}
                  className={cn(
                    'group min-w-[11rem] max-w-full flex-1 rounded-xl border px-3 py-2.5 text-left transition-all sm:max-w-[16rem]',
                    isBaseline
                      ? cn(toneCard[tone], 'ring-2 ring-offset-1 ring-offset-background shadow-sm', kindRing[release.kind])
                      : 'border-border bg-background hover:border-foreground/15',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn('text-xs font-bold tabular-nums', toneText[tone])}>
                          #{release.sequence}
                        </span>
                        {isBaseline && (
                          <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-background">
                            Baseline
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-foreground">
                        {release.title}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDate(release.date)}
                        {release.time ? ` · ${release.time}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-lg border',
                        isBaseline ? cn(toneIconBox[tone], 'border-transparent') : 'border-border bg-muted/40',
                      )}
                    >
                      <KindIcon className={cn('size-3.5', isBaseline ? toneText[tone] : 'text-muted-foreground')} />
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                      {release.commit}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggle(release.id)
                      }}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`#${release.sequence} seçimini kaldır`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="max-h-[min(28rem,55vh)] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Search className="mx-auto size-7 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-foreground">Eşleşen release yok</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Arama veya filtre kriterlerini genişletin.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((release) => {
              const active = selectedIds.includes(release.id)
              const disabled = !active && !canAdd
              const tone = kindTone[release.kind]
              const KindIcon = kindIcon[release.kind]
              const changes = releaseChangeCount(release)

              return (
                <li key={release.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggle(release.id)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors sm:px-5',
                      active ? 'bg-muted/35' : 'hover:bg-muted/20',
                      disabled && 'cursor-not-allowed opacity-45',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                        active
                          ? cn(toneDot[tone], 'border-transparent text-white')
                          : 'border-border bg-background text-transparent',
                      )}
                      aria-hidden
                    >
                      {active && <Check className="size-3" />}
                    </span>

                    <span
                      className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border',
                        active ? cn(toneIconBox[tone], 'border-transparent') : 'border-border bg-muted/30',
                      )}
                    >
                      <KindIcon className={cn('size-3.5', active ? toneText[tone] : 'text-muted-foreground')} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-bold tabular-nums text-foreground">
                          #{release.sequence}
                        </span>
                        <Badge size="xs" className={cn(badgeSolid[release.kind])}>
                          {kindLabel[release.kind]}
                        </Badge>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {formatDate(release.date)}
                          {release.time ? ` · ${release.time}` : ''}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm font-medium leading-snug text-foreground">
                        {release.title}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-mono font-semibold">
                          <GitCommit className="size-3" />
                          {release.commit}
                        </span>
                        {release.features.length > 0 && (
                          <span>{release.features.length} feature</span>
                        )}
                        {release.fixes.length > 0 && <span>{release.fixes.length} fix</span>}
                        {changes === 0 && <span>Yeni kaynak kod yok</span>}
                        {(release.alerts?.length ?? 0) > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            {release.alerts!.length} uyarı
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="hidden shrink-0 pt-1 text-[11px] font-semibold text-muted-foreground sm:block">
                      {active ? 'Seçili' : canAdd ? 'Ekle' : 'Dolu'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!canAdd && (
        <div className="border-t border-border bg-muted/20 px-4 py-2 text-center text-[11px] text-muted-foreground sm:px-5">
          En fazla {MAX_COMPARE} release seçilebilir. Yeni eklemek için bir seçimi kaldırın.
        </div>
      )}
    </div>
  )
}

function ComparisonTab() {
  const allSorted = useMemo(
    () => [...comparableReleases].sort(compareReleaseDesc),
    [],
  )

  const [selectedIds, setSelectedIds] = useState<string[]>(defaultCompareIds)
  const [baselineId, setBaselineId] = useState<string>(defaultCompareIds()[0] ?? '')

  // Hot reload veya eski state içindeki rollout seçimlerini de temizle.
  useEffect(() => {
    setSelectedIds((previous) => {
      const validIds = previous.filter((id) => allSorted.some((release) => release.id === id))
      return validIds.slice(0, MAX_COMPARE)
    })
  }, [allSorted])

  const selected = useMemo(() => {
    const map = new Map(allSorted.map((r) => [r.id, r]))
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as ProductionRelease[]
  }, [allSorted, selectedIds])

  // Keep baseline inside the selection
  useEffect(() => {
    if (selected.length === 0) return
    if (!selected.some((r) => r.id === baselineId)) {
      setBaselineId(selected[0]!.id)
    }
  }, [selected, baselineId])

  const baseline = selected.find((r) => r.id === baselineId) ?? selected[0]
  const baselineIndex = Math.max(
    0,
    selected.findIndex((r) => r.id === baseline?.id),
  )

  function toggleVersion(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id)
      }
      if (prev.length >= MAX_COMPARE) return prev
      const next = [...prev, id]
      const order = new Map(allSorted.map((r, i) => [r.id, i]))
      return next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    })
  }

  function resetDefaults() {
    const ids = defaultCompareIds()
    setSelectedIds(ids)
    setBaselineId(ids[0] ?? '')
  }

  function clearSelection() {
    setSelectedIds([])
    setBaselineId('')
  }

  const headers = [
    { label: 'Alan' },
    ...selected.map((r, i) => ({
      label: `#${r.sequence}`,
      tone: COMPARE_TONES[i] ?? ('gray' as Tone),
    })),
  ]

  const metricRows: { label: string; get: (r: ProductionRelease) => number }[] = [
    { label: 'Features', get: (r) => r.features.length },
    { label: 'Fixes', get: (r) => r.fixes.length },
    { label: 'Toplam değişiklik', get: (r) => r.features.length + r.fixes.length },
    { label: 'Uyarı', get: (r) => r.alerts?.length ?? 0 },
    { label: 'Version geçişi', get: (r) => r.versionTransitions.length },
  ]

  const rows = [
    [
      'Tarih',
      ...selected.map((r) => (
        <span key={r.id} className="text-sm font-medium">
          {formatDate(r.date)}
          {r.time ? <span className="block text-[11px] text-muted-foreground">{r.time}</span> : null}
        </span>
      )),
    ],
    [
      'Release türü',
      ...selected.map((r) => (
        <Badge key={r.id} size="xs" className={cn(badgeSolid[r.kind])}>
          {kindLabel[r.kind]}
        </Badge>
      )),
    ],
    [
      'Commit',
      ...selected.map((r) => (
        <span key={r.id} className="font-mono text-xs font-semibold">
          {r.commit}
        </span>
      )),
    ],
    [
      'Rollout',
      ...selected.map((r) => (
        <span key={r.id} className="text-xs leading-relaxed text-foreground/85">
          {releaseVersionLabel(r)}
        </span>
      )),
    ],
    ...metricRows.map((m) => [
      m.label,
      ...selected.map((r) => (
        <MetricCell
          key={r.id}
          value={m.get(r)}
          baseline={baseline ? m.get(baseline) : 0}
          isBaseline={r.id === baseline?.id}
        />
      )),
    ]),
  ]

  // Qualitative diff: union of features/fixes across selection
  const allFeatures = useMemo(() => {
    const set = new Set<string>()
    selected.forEach((r) => r.features.forEach((f) => set.add(f)))
    return [...set]
  }, [selected])

  const allFixes = useMemo(() => {
    const set = new Set<string>()
    selected.forEach((r) => r.fixes.forEach((f) => set.add(f)))
    return [...set]
  }, [selected])

  const allAlerts = useMemo(() => {
    const set = new Set<string>()
    selected.forEach((r) => (r.alerts ?? []).forEach((alert) => set.add(alert)))
    return [...set]
  }, [selected])

  return (
    <div className="space-y-4">
      <ReleaseComparePicker
        allSorted={allSorted}
        selectedIds={selectedIds}
        baselineId={baselineId}
        onToggle={toggleVersion}
        onBaseline={setBaselineId}
        onClear={clearSelection}
        onReset={resetDefaults}
      />

      {selected.length < MIN_COMPARE ? (
        <div className="rounded-[24px] border border-dashed bg-muted/15 px-6 py-10 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <GitCompare className="size-4.5" />
          </span>
          <p className="mt-3 text-sm font-semibold text-foreground">
            {selected.length === 0 ? 'Henüz release seçilmedi' : 'Bir release daha seçin'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Karşılaştırma tablosu en az {MIN_COMPARE} seçimle oluşturulur.
          </p>
        </div>
      ) : (
        <>
          <ComparisonTable
            headers={headers}
            rows={rows}
            highlightCol={baselineIndex + 1}
          />

          {/* Qualitative change matrix */}
          {(allFeatures.length > 0 || allFixes.length > 0 || allAlerts.length > 0) && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Değişiklik varlık matrisi
              </h4>
              {allFeatures.length > 0 && (
                <ComparisonTable
                  className="border-teal-200/60 dark:border-teal-900/40"
                  headers={[
                    { label: 'Features', tone: 'teal' },
                    ...selected.map((r, i) => ({
                      label: `#${r.sequence}`,
                      tone: COMPARE_TONES[i],
                    })),
                  ]}
                  rows={allFeatures.map((f) => [
                    <span key={f} className="text-xs leading-relaxed">
                      {f}
                    </span>,
                    ...selected.map((r) => (
                      <PresenceCell key={r.id} present={r.features.includes(f)} />
                    )),
                  ])}
                  highlightCol={baselineIndex + 1}
                />
              )}
              {allFixes.length > 0 && (
                <ComparisonTable
                  className="border-amber-200/60 dark:border-amber-900/40"
                  headers={[
                    { label: 'Fixes', tone: 'amber' },
                    ...selected.map((r, i) => ({
                      label: `#${r.sequence}`,
                      tone: COMPARE_TONES[i],
                    })),
                  ]}
                  rows={allFixes.map((f) => [
                    <span key={f} className="text-xs leading-relaxed">
                      {f}
                    </span>,
                    ...selected.map((r) => (
                      <PresenceCell key={r.id} present={r.fixes.includes(f)} />
                    )),
                  ])}
                  highlightCol={baselineIndex + 1}
                />
              )}
              {allAlerts.length > 0 && (
                <ComparisonTable
                  className="border-orange-200/60 dark:border-orange-900/40"
                  headers={[
                    { label: 'Uyarı', tone: 'orange' },
                    ...selected.map((r, i) => ({
                      label: `#${r.sequence}`,
                      tone: COMPARE_TONES[i],
                    })),
                  ]}
                  rows={allAlerts.map((f) => [
                    <span key={f} className="text-xs leading-relaxed">
                      {f}
                    </span>,
                    ...selected.map((r) => (
                      <PresenceCell
                        key={r.id}
                        present={(r.alerts ?? []).includes(f)}
                      />
                    )),
                  ])}
                  highlightCol={baselineIndex + 1}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReleasesPage() {
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [tab, setTab] = useState('timeline')

  const latest = getLatestProductionRelease()

  function toggleKind(kind: ProductionReleaseKind) {
    setKindFilter((prev) => (prev === kind ? 'all' : kind))
    if (tab === 'comparison') setTab('timeline')
  }

  const filteredCount = filterReleases(releases, kindFilter).length

  const tabs: SegmentTabItem[] = [
    {
      value: 'timeline',
      label: 'Zaman çizelgesi',
      icon: Timer,
      description: 'Kronolojik release geçmişi',
      count: filteredCount,
      content: <TimelineTab kindFilter={kindFilter} />,
    },
    {
      value: 'calendar',
      label: 'Takvim',
      icon: CalendarDays,
      description: 'Release’leri tarihe göre incele',
      count: filteredCount,
      content: <CalendarTab kindFilter={kindFilter} />,
    },
    {
      value: 'comparison',
      label: 'Karşılaştırma',
      icon: GitCompare,
      description: 'Release’lerin diff’lerini yan yana incele',
      count: `${MIN_COMPARE}–${MAX_COMPARE}`,
      content: <ComparisonTab />,
    },
  ]

  const chips = [
    'rel/env-prod · first-parent',
    '22 Mar – 10 Tem 2026',
    `Güncel · HR ${latestCountryVersions.hr} · SI ${latestCountryVersions.si} · RS ${latestCountryVersions.rs} · BA ${latestCountryVersions.ba} · ME ${latestCountryVersions.me}`,
    latest ? `Son commit ${latest.commit}` : null,
  ].filter(Boolean) as string[]

  return (
    <ProductPage path="/pm/releases" hideToolbar>
      <HeroCallout
        icon={Rocket}
        eyebrow="Release & Versions"
        tone="purple"
        title="Release geçmişi"
        lead="Prod dalındaki gerçek release’leri kod içeriği, ülke bazlı version geçişleri ve commit kanıtlarıyla birlikte inceleyin."
        chips={chips}
        layout="stack"
      >
        <StatGrid cols={4}>
          <StatCard
            icon={Rocket}
            label="Toplam release"
            value={productionReleaseSummary.total}
            tone="purple"
            hint="first-parent merge"
            active={kindFilter === 'all'}
            onClick={() => setKindFilter('all')}
          />
          <StatCard
            icon={Code2}
            label="Uygulama kodu"
            value={productionReleaseSummary.code}
            tone="green"
            hint="gerçek diff içeriyor"
            active={kindFilter === 'code'}
            onClick={() => toggleKind('code')}
          />
          <StatCard
            icon={Workflow}
            label="Prod CI / Workflow"
            value={productionReleaseSummary.workflow}
            tone="blue"
            hint="ilk prod matrisi"
            active={kindFilter === 'workflow'}
            onClick={() => toggleKind('workflow')}
          />
          <StatCard
            icon={PackageCheck}
            label="Yalnızca rollout"
            value={productionReleaseSummary.rollout}
            tone="amber"
            hint="yeni kaynak kod yok"
            active={kindFilter === 'rollout'}
            onClick={() => toggleKind('rollout')}
          />
        </StatGrid>
      </HeroCallout>

      {kindFilter !== 'all' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Filtre:</span>
          <Badge
            variant="secondary"
            size="sm"
            className={cn(
              kindFilter === 'code' && 'bg-green-500/15 text-green-700 dark:text-green-400',
              kindFilter === 'workflow' && 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
              kindFilter === 'rollout' && 'bg-amber-500/20 text-amber-800 dark:text-amber-300',
            )}
          >
            {kindLabel[kindFilter]}
          </Badge>
          <button
            type="button"
            onClick={() => setKindFilter('all')}
            className="ml-auto font-medium text-primary hover:underline"
          >
            Filtreyi temizle
          </button>
        </div>
      )}

      <SegmentTabs
        appearance="segmented"
        items={tabs}
        value={tab}
        onValueChange={setTab}
      />

      <Callout icon={GitCommit} title="Analiz yöntemi" tone="amber">
        Her <code>rel/env-prod</code> first-parent merge’i bir release olarak sayıldı; PR içindeki
        commit’ler ayrıca sayılmadı. Kod değişikliği sınıflandırması commit mesajından değil,
        merge’lerin gerçek diff içeriğinden üretildi.
      </Callout>
    </ProductPage>
  )
}
