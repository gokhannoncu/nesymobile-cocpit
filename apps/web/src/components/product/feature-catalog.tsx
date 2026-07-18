'use client'

import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { TagBadge } from './collection'
import { type Tone, toneCard, toneIcon, toneText } from './tones'
import type { Country, Feature, Module } from '@/data/product/nesy'
import { isSupported } from '@/data/product/nesy'
import { toFeatureSlug } from '@/data/product/feature-slug'

const COUNTRY_DOT_ORDER = ['hr', 'si', 'rs', 'ba', 'me', 'sk'] as const

export function FeatureCatalogCard({
  feature,
  module,
  countries,
  tone = 'orange',
}: {
  feature: Feature
  module: Module
  countries: Country[]
  tone?: Tone
}) {
  const isCore = isSupported(feature.values.core)
  const activeCountries = countries.filter((country) => country.id !== 'core')
  const supportedCount = activeCountries.filter((country) =>
    isSupported(feature.values[country.id]),
  ).length
  const highRisk = feature.detail ? feature.detail.score.bugProneness >= 4 : false
  const ticketCount = feature.detail?.tickets.length ?? 0

  return (
    <Link
      href={`/product/feature-library/${toFeatureSlug(feature.id)}`}
      className={cn(
        'group block rounded-xl border bg-background p-3.5 text-left transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        toneCard[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-snug text-foreground">{feature.title}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{feature.desc}</p>
        </div>
        {isCore ? (
          <TagBadge label="CORE" tone="indigo" />
        ) : (
          <TagBadge label="No CORE" tone="gray" />
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md border border-border bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {module.title}
        </span>
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
            supportedCount === activeCountries.length
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : supportedCount > 0
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {supportedCount}/{activeCountries.length} countries
        </span>
        {highRisk && (
          <TagBadge label={`Risk ${feature.detail!.score.bugProneness}/5`} tone="red" />
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-1" aria-label="Country coverage">
        {COUNTRY_DOT_ORDER.map((countryId) => {
          const supported = isSupported(feature.values[countryId])
          return (
            <span
              key={countryId}
              title={countryId.toUpperCase()}
              className={cn(
                'flex size-[18px] items-center justify-center rounded-[3px] text-[8px] font-bold uppercase',
                supported
                  ? 'bg-emerald-500 text-white'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {countryId}
            </span>
          )
        })}
      </div>

      <div className="mt-2 text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        {ticketCount > 0 ? `${ticketCount} tickets · View details →` : 'View details →'}
      </div>
    </Link>
  )
}

export function FeatureDomainSection({
  id,
  title,
  description,
  icon: Icon,
  tone = 'orange',
  coreFeatures,
  relatedFeatures,
  countries,
}: {
  id: string
  title: string
  description: string
  icon?: LucideIcon
  tone?: Tone
  coreFeatures: { feature: Feature; module: Module }[]
  relatedFeatures: { feature: Feature; module: Module }[]
  countries: Country[]
}) {
  const total = coreFeatures.length + relatedFeatures.length
  if (total === 0) return null

  return (
    <section id={id} className="scroll-mt-28 space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon className={cn('size-4', toneIcon[tone])} />}
            <h2 className={cn('text-base font-bold', toneText[tone])}>{title}</h2>
            <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {total}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </header>

      {coreFeatures.length > 0 && (
        <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/25">
          <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">
            Core capabilities
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {coreFeatures.map(({ feature, module }) => (
              <FeatureCatalogCard
                key={feature.id}
                feature={feature}
                module={module}
                countries={countries}
                tone="indigo"
              />
            ))}
          </div>
        </div>
      )}

      {relatedFeatures.length > 0 && (
        <div className="space-y-2">
          <div className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Related / country-scoped
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {relatedFeatures.map(({ feature, module }) => (
              <FeatureCatalogCard
                key={feature.id}
                feature={feature}
                module={module}
                countries={countries}
                tone={tone}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
