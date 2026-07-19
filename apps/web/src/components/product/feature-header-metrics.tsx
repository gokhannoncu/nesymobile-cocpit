'use client'

import { motion } from 'framer-motion'
import { Globe, ShieldAlert, Ticket, type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { EASE, type Tone, toneCard, toneDot, toneIcon, toneIconBox, toneText } from './tones'

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function countryTone(pct: number): Tone {
  if (pct >= 80) return 'green'
  if (pct >= 50) return 'teal'
  return 'amber'
}

function riskTone(score: number): Tone {
  if (score <= 2) return 'green'
  if (score === 3) return 'amber'
  if (score === 4) return 'orange'
  return 'red'
}

function ticketTone(count: number, openCount: number): Tone {
  if (openCount > 0) return 'amber'
  if (count > 0) return 'blue'
  return 'gray'
}

function HeaderMetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  progress,
  href,
  delay = 0,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  tone: Tone
  progress?: number
  href?: string
  delay?: number
}) {
  const interactive = Boolean(href)
  const sectionId = href?.replace('#', '')

  const className = cn(
    'group relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border p-3 text-left outline-none transition-shadow',
    toneCard[tone],
    interactive && 'cursor-pointer hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30',
    !interactive && 'cursor-default',
  )

  const content = (
    <>
      <span className={cn('absolute inset-x-0 top-0 h-0.5', toneDot[tone])} />

      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', toneIconBox[tone])}>
          <Icon className={cn('size-4', toneIcon[tone])} />
        </span>
        {interactive && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100">
            Git →
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className={cn('mt-0.5 text-xl font-bold tabular-nums leading-none', toneText[tone])}>{value}</p>
        {hint && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
      </div>

      {progress != null && (
        <div className="h-1 overflow-hidden rounded-full bg-background/60">
          <motion.div
            className={cn('h-full rounded-full', toneDot[tone])}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.55, ease: EASE, delay: delay + 0.1 }}
          />
        </div>
      )}
    </>
  )

  if (interactive && sectionId) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE, delay }}
        whileHover={{ y: -2 }}
        onClick={() => scrollToSection(sectionId)}
        className={className}
      >
        {content}
      </motion.button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay }}
      className={className}
    >
      {content}
    </motion.div>
  )
}

export function FeatureHeaderMetrics({
  supportedCountryCount,
  totalCountries,
  bugProneness,
  ticketCount,
  openTicketCount = 0,
  countriesHref,
  opsHref,
}: {
  supportedCountryCount: number
  totalCountries: number
  bugProneness?: number
  ticketCount: number
  openTicketCount?: number
  countriesHref?: string
  opsHref?: string
}) {
  const countryPct =
    totalCountries > 0 ? Math.round((supportedCountryCount / totalCountries) * 100) : 0
  const countryToneValue = countryTone(countryPct)

  const riskValue = bugProneness != null ? `${bugProneness}/5` : '—'
  const riskToneValue = bugProneness != null ? riskTone(bugProneness) : 'gray'
  const riskHint =
    bugProneness != null
      ? bugProneness >= 4
        ? 'Yüksek bug riski'
        : bugProneness >= 3
          ? 'Orta seviye risk'
          : 'Düşük bug riski'
      : 'Skor henüz yok'

  const ticketToneValue = ticketTone(ticketCount, openTicketCount)
  const ticketHint =
    ticketCount === 0
      ? 'Kayıtlı ticket yok'
      : openTicketCount > 0
        ? `${openTicketCount} açık ticket`
        : 'Tüm ticket’lar kapalı'

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[min(100%,22rem)]">
      <HeaderMetricCard
        icon={Globe}
        label="Ülke kapsamı"
        value={`${supportedCountryCount}/${totalCountries}`}
        hint={`${countryPct}% pazar kapsamı`}
        tone={countryToneValue}
        progress={countryPct}
        href={countriesHref}
        delay={0}
      />
      <HeaderMetricCard
        icon={ShieldAlert}
        label="Bug riski"
        value={riskValue}
        hint={riskHint}
        tone={riskToneValue}
        progress={bugProneness != null ? bugProneness * 20 : undefined}
        href={opsHref}
        delay={0.05}
      />
      <HeaderMetricCard
        icon={Ticket}
        label="Ticket’lar"
        value={String(ticketCount)}
        hint={ticketHint}
        tone={ticketToneValue}
        href={opsHref}
        delay={0.1}
      />
    </div>
  )
}
