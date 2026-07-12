'use client'

// Mobile Knowledge Hub — durum ve metadata rozetleri.
// Domain ve ekran başlıklarında ortak kullanılır.

import { CalendarCheck, GitBranch, Globe, ShieldCheck, UserRound } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { toneCard, toneText, type Tone } from '@/components/product'
import {
  COUNTRY_LABELS,
  DOC_STATUS_META,
  SOURCE_LEVEL_META,
  type Country,
  type DocMeta,
  type DocStatus,
  type SourceLevel,
} from '@/data/engineering/mobile-knowledge/types'

/** Küçük tonlu pill. */
export function TonePill({
  tone = 'gray',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneCard[tone],
        toneText[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function DocStatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  const meta = DOC_STATUS_META[status]
  return (
    <TonePill tone={meta.tone} className={className}>
      <ShieldCheck className="size-3" />
      {meta.label}
    </TonePill>
  )
}

export function SourceLevelBadge({ level, className }: { level: SourceLevel; className?: string }) {
  const meta = SOURCE_LEVEL_META[level]
  return (
    <TonePill tone={meta.tone} className={className}>
      {meta.label}
    </TonePill>
  )
}

function CountryChips({ countries }: { countries: Country[] }) {
  const all: Country[] = ['HR', 'BA', 'SI', 'RS']
  const label = countries.length === all.length ? 'Tüm ülkeler' : countries.join(' / ')
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={countries.map((c) => COUNTRY_LABELS[c]).join(', ')}
    >
      <Globe className="size-3.5" />
      {label}
    </span>
  )
}

/** Owner · Applies to · Mobile · Last verified · Status rozet satırı. */
export function MetaBadgeRow({ meta, className }: { meta: DocMeta; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <UserRound className="size-3.5" />
        {meta.owner}
      </span>
      <CountryChips countries={meta.countries} />
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <GitBranch className="size-3.5" />
        {meta.version}
      </span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CalendarCheck className="size-3.5" />
        {meta.lastVerified}
      </span>
      <DocStatusBadge status={meta.status} />
    </div>
  )
}
