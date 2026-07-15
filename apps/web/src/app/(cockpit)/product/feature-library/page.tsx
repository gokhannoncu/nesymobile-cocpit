'use client'

import { useMemo, useState } from 'react'
import {
  Boxes,
  Globe,
  Grid3x3,
  PackageCheck,
  PackageSearch,
  Route,
  Search,
  Table2,
  Truck,
  X,
} from 'lucide-react'
import { Input } from '@nesy/metronic/components/ui/input'
import { cn } from '@nesy/metronic/lib/utils'
import {
  BoardGrid,
  Callout,
  DataTable,
  HeroCallout,
  PageSection,
  ProductPage,
  TagBadge,
} from '@/components/product'
import { COUNTRIES, MODULES, TOTAL_FEATURES, isSupported } from '@/data/product/nesy'
import { toFeatureSlug } from '@/data/product/feature-slug'

const moduleIcons = [PackageCheck, PackageSearch, Route, Truck, Globe, Boxes] as const
const moduleTones = ['orange', 'amber', 'teal', 'blue', 'purple', 'indigo'] as const

export default function FeatureLibraryPage() {
  const activeCountries = COUNTRIES.filter((country) => country.id !== 'core')
  const [query, setQuery] = useState('')
  const [activeModule, setActiveModule] = useState('all')

  const filteredModules = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')

    return MODULES.map((module) => ({
      ...module,
      features: module.features.filter((feature) => {
        const matchesModule = activeModule === 'all' || module.id === activeModule
        const matchesQuery =
          normalizedQuery.length === 0 ||
          `${feature.title} ${feature.desc}`.toLocaleLowerCase('tr-TR').includes(normalizedQuery)

        return matchesModule && matchesQuery
      }),
    })).filter((module) => module.features.length > 0)
  }, [activeModule, query])

  const visibleFeatureCount = filteredModules.reduce(
    (total, module) => total + module.features.length,
    0,
  )

  return (
    <ProductPage path="/product/feature-library">
      <HeroCallout
        icon={Grid3x3}
        eyebrow="Capabilities & Countries"
        tone="orange"
        title="Every product capability lives in a single inventory."
        lead="The feature board consolidates all Nesy Mobile capabilities with their modules in one place. Compare country coverage; click a card to explore the workflow, APIs, risks, and tickets."
        chips={[
          `${TOTAL_FEATURES} features`,
          `${MODULES.length} modules`,
          `${activeCountries.length} countries`,
          'Single inventory',
        ]}
      />

      <section aria-label="Feature filters" className="rounded-2xl border bg-card p-3 shadow-sm">
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

          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 xl:pb-0" role="group" aria-label="Module filter">
            <button
              type="button"
              onClick={() => setActiveModule('all')}
              aria-pressed={activeModule === 'all'}
              className={cn(
                'shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                activeModule === 'all'
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground',
              )}
            >
              All · {TOTAL_FEATURES}
            </button>
            {MODULES.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => setActiveModule(module.id)}
                aria-pressed={activeModule === module.id}
                className={cn(
                  'shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                  activeModule === module.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                )}
              >
                {module.title} · {module.features.length}
              </button>
            ))}
          </div>

          <div className="hidden shrink-0 text-xs font-medium text-muted-foreground xl:block">
            {visibleFeatureCount} results
          </div>
        </div>
      </section>

      <PageSection
        eyebrow="Capability Inventory"
        title="Feature board — all capabilities by module"
        icon={Grid3x3}
        tone="orange"
        description="Each column represents a product module; each card represents a single user-facing feature. Badges on the card summarize CORE status and country coverage."
      >
        {visibleFeatureCount > 0 ? (
          <BoardGrid
            columns={filteredModules.map((module) => {
              const moduleIndex = MODULES.findIndex((item) => item.id === module.id)
              const tone = moduleTones[moduleIndex % moduleTones.length]!

              return {
                title: module.title,
                tone,
                icon: moduleIcons[moduleIndex % moduleIcons.length],
                cards: module.features.map((feature) => {
                  const supportedCountryCount = activeCountries.filter((country) =>
                    isSupported(feature.values[country.id]),
                  ).length
                  const detail = feature.detail
                  const highRisk = detail ? detail.score.bugProneness >= 4 : false
                  const ticketCount = detail?.tickets.length ?? 0

                  return {
                    title: feature.title,
                    desc: feature.desc,
                    icon: moduleIcons[moduleIndex % moduleIcons.length],
                    badges: [
                      {
                        label: isSupported(feature.values.core) ? 'CORE' : 'No CORE',
                        tone: isSupported(feature.values.core) ? ('indigo' as const) : ('gray' as const),
                      },
                      {
                        label: `${supportedCountryCount}/${activeCountries.length} countries`,
                        tone:
                          supportedCountryCount === activeCountries.length
                            ? ('teal' as const)
                            : supportedCountryCount > 0
                              ? ('amber' as const)
                              : ('gray' as const),
                      },
                      ...(highRisk
                        ? [{ label: `Risk ${detail!.score.bugProneness}/5`, tone: 'red' as const }]
                        : []),
                    ],
                    meta: ticketCount > 0 ? `${ticketCount} tickets · View details` : 'View details',
                    href: `/product/feature-library/${toFeatureSlug(feature.id)}`,
                  }
                }),
              }
            })}
          />
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-14 text-center">
            <Search className="mx-auto size-8 text-muted-foreground/50" />
            <h2 className="mt-3 text-sm font-bold text-foreground">No matching features found</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different search term or select another module.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setActiveModule('all')
              }}
              className="mt-4 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background"
            >
              Clear filters
            </button>
          </div>
        )}
      </PageSection>

      <PageSection
        eyebrow="Card Schema"
        title="What fields does a feature card carry?"
        icon={Table2}
        tone="blue"
        description="The feature card displays only decision-driving signals for quick scanning; operational details open when the card is clicked."
      >
        <DataTable
          columns={[
             { key: 'field', label: 'Field', className: 'min-w-40' },
             { key: 'card', label: 'On Card', className: 'min-w-48' },
             { key: 'detail', label: 'In Detail View', className: 'min-w-56' },
             { key: 'purpose', label: 'Purpose', className: 'min-w-64' },
          ]}
          rows={[
            {
              field: <b>Feature identity</b>,
              card: 'Title, short description, module',
              detail: 'What it is, how it works, screens',
              purpose: 'Defines what the feature is and its place within the product.',
            },
            {
              field: <b>Country coverage</b>,
              card: <TagBadge label={`Up to ${activeCountries.length} countries`} tone="amber" />,
              detail: 'All CORE and country-specific behaviors',
              purpose: 'Separates global standards from country-level customizations.',
            },
            {
              field: <b>Technical context</b>,
              card: 'Risk and open ticket count',
              detail: 'APIs, parameters, domain experts, and test coverage',
              purpose: 'Makes the cost of change and operational risk visible.',
            },
            {
              field: <b>Workflow</b>,
              card: <TagBadge label="View details" tone="teal" />,
              detail: 'Steps, flow diagram, and implementation tips',
              purpose: 'Keeps feature knowledge in a single record instead of scattered documents.',
            },
          ]}
        />
      </PageSection>

      <Callout icon={Grid3x3} title="When adding a new feature" tone="orange">
        A feature is first defined with its CORE behavior, then country differences are mapped into the matrix. Source
        file: <code>src/data/product/nesy.ts</code> — card and matrix pages update automatically.
        Detail data: <code>src/data/product/feature-details.ts</code>
      </Callout>

    </ProductPage>
  )
}
