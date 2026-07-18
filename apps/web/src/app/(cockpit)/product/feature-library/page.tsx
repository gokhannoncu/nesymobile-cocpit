'use client'

import { useMemo, useState } from 'react'
import {
  Banknote,
  Boxes,
  Grid3x3,
  MapPinned,
  PackageSearch,
  Search,
  Truck,
  X,
} from 'lucide-react'
import { Input } from '@nesy/metronic/components/ui/input'
import { cn } from '@nesy/metronic/lib/utils'
import {
  FeatureDomainSection,
  HeroCallout,
  PageSection,
  ProductPage,
} from '@/components/product'
import type { Tone } from '@/components/product/tones'
import {
  COUNTRIES,
  FEATURE_DOMAINS,
  TOTAL_FEATURES,
  isSupported,
  listFeatureRecordsByDomain,
} from '@/data/product/nesy'
import type { FeatureDomainId } from '@/data/product/nesy'

const domainMeta: Record<
  FeatureDomainId,
  { icon: typeof Banknote; tone: Tone }
> = {
  'payments-fiscal': { icon: Banknote, tone: 'orange' },
  'delivery-outcomes': { icon: Truck, tone: 'amber' },
  'pickup-operations': { icon: PackageSearch, tone: 'teal' },
  'tour-stops': { icon: MapPinned, tone: 'blue' },
  'tracking-self-service': { icon: Boxes, tone: 'purple' },
}

export default function FeatureLibraryPage() {
  const activeCountries = COUNTRIES.filter((country) => country.id !== 'core')
  const [query, setQuery] = useState('')
  const [coreOnly, setCoreOnly] = useState(false)
  const catalogRecords = useMemo(() => listFeatureRecordsByDomain(), [])

  const filteredDomains = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')

    return FEATURE_DOMAINS.map((domain) => {
      const records = catalogRecords.filter((record) => {
        if (record.feature.domainId !== domain.id) return false
        const matchesQuery =
          normalizedQuery.length === 0 ||
          `${record.feature.title} ${record.feature.desc}`
            .toLocaleLowerCase('tr-TR')
            .includes(normalizedQuery)
        const matchesCore =
          !coreOnly || isSupported(record.feature.values.core)
        return matchesQuery && matchesCore
      })

      const coreFeatures = records.filter((record) =>
        isSupported(record.feature.values.core),
      )
      const relatedFeatures = records.filter(
        (record) => !isSupported(record.feature.values.core),
      )

      return { domain, coreFeatures, relatedFeatures, total: records.length }
    }).filter((entry) => entry.total > 0)
  }, [catalogRecords, coreOnly, query])

  const visibleFeatureCount = filteredDomains.reduce(
    (total, entry) => total + entry.total,
    0,
  )

  const scrollToDomain = (domainId: FeatureDomainId) => {
    const el = document.getElementById(`domain-${domainId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <ProductPage path="/product/feature-library">
      <HeroCallout
        icon={Grid3x3}
        eyebrow="Capabilities by domain"
        tone="orange"
        title="Every product capability, grouped by what it does — Core first."
        lead="Browse Nesy Mobile features by capability domain. Core baseline sits at the top of each group; process module and country coverage stay on every card."
        chips={[
          `${TOTAL_FEATURES} features`,
          `${FEATURE_DOMAINS.length} domains`,
          `${activeCountries.length} countries`,
          'Core baseline',
        ]}
      />

      <section
        aria-label="Feature filters"
        className="sticky top-0 z-20 rounded-2xl border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 xl:w-80 xl:shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search features..."
              aria-label="Search features"
              className="h-10 bg-background pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div
            className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 xl:pb-0"
            role="group"
            aria-label="Jump to domain"
          >
            {FEATURE_DOMAINS.map((domain) => (
              <button
                key={domain.id}
                type="button"
                onClick={() => scrollToDomain(domain.id)}
                className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                {domain.title}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setCoreOnly((value) => !value)}
              aria-pressed={coreOnly}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                coreOnly
                  ? 'border-indigo-500 bg-indigo-500 text-white'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground',
              )}
            >
              Core only
            </button>
            <div className="hidden text-xs font-medium text-muted-foreground xl:block">
              {visibleFeatureCount} results
            </div>
          </div>
        </div>
      </section>

      <PageSection
        eyebrow="Capability inventory"
        title="Feature catalog — domains, Core first"
        icon={Grid3x3}
        tone="orange"
        description="Each section is a capability domain. Core capabilities lead; related and country-scoped features follow. Cards keep process module, country dots, risk, and tickets."
      >
        {visibleFeatureCount > 0 ? (
          <div className="space-y-10">
            {filteredDomains.map(({ domain, coreFeatures, relatedFeatures }) => {
              const meta = domainMeta[domain.id]
              return (
                <FeatureDomainSection
                  key={domain.id}
                  id={`domain-${domain.id}`}
                  title={domain.title}
                  description={domain.desc}
                  icon={meta.icon}
                  tone={meta.tone}
                  coreFeatures={coreFeatures}
                  relatedFeatures={relatedFeatures}
                  countries={COUNTRIES}
                />
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-14 text-center">
            <Search className="mx-auto size-8 text-muted-foreground/50" />
            <h2 className="mt-3 text-sm font-bold text-foreground">No matching features found</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different search term or turn off Core only.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setCoreOnly(false)
              }}
              className="mt-4 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background"
            >
              Clear filters
            </button>
          </div>
        )}
      </PageSection>
    </ProductPage>
  )
}
