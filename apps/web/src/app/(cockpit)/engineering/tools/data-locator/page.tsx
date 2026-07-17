'use client'

// Data Locator — "Where does this data live?"
// Business question → correct source → key fields → related sources → example query.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Compass,
  Database,
  GitBranch,
  Lightbulb,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Table2,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@nesy/metronic/components/ui/accordion'
import { Checkbox } from '@nesy/metronic/components/ui/checkbox'
import { Textarea } from '@nesy/metronic/components/ui/textarea'
import {
  Callout,
  PageSection,
  ProductPage,
  toneCard,
  toneText,
} from '@/components/product'
import { ExampleChip, ToolHeader } from '@/components/engineering/tools/shared'
import {
  ROLE_META,
  TRUTH_META,
  type DataSource,
  type Guardrail,
  type InvestigationRecipe,
  type LineageChain,
  type ResultRole,
  type SearchIntent,
} from '@/data/engineering/tools/data-locator'
import {
  fetchDataLocatorCatalog,
  searchDataLocator,
  type DataLocatorCatalogPayload,
} from '@/services/data-locator'
import { DataCatalog } from './catalog'
import { SourceDetailBody, SourceDetailHeader } from './source-detail'

type FilterState = Record<string, boolean>

function sourceMatchesFilters(source: DataSource, checked: FilterState): boolean {
  const active = Object.entries(checked).filter(([, v]) => v)
  if (!active.length) return true
  const groups = {
    domain: active.filter(([k]) => k.startsWith('domain:')).map(([k]) => k.slice('domain:'.length)),
    'source-type': active
      .filter(([k]) => k.startsWith('source-type:'))
      .map(([k]) => k.slice('source-type:'.length)),
    environment: active
      .filter(([k]) => k.startsWith('environment:'))
      .map(([k]) => k.slice('environment:'.length)),
    country: active.filter(([k]) => k.startsWith('country:')).map(([k]) => k.slice('country:'.length)),
  }
  if (groups.domain.length && !groups.domain.some((d) => source.domains.includes(d as DataSource['domains'][number]))) {
    return false
  }
  if (groups['source-type'].length && !groups['source-type'].includes(source.sourceType)) {
    return false
  }
  if (
    groups.environment.length &&
    !groups.environment.some((e) => source.environments.includes(e as DataSource['environments'][number]))
  ) {
    return false
  }
  if (
    groups.country.length &&
    !groups.country.some((c) => source.countries.includes(c as DataSource['countries'][number]))
  ) {
    return false
  }
  return true
}

function FilterRail({
  options,
  checked,
  onChange,
}: {
  options: DataLocatorCatalogPayload['filterOptions']
  checked: FilterState
  onChange: (next: FilterState) => void
}) {
  const groups: { id: string; title: string; options: readonly string[] }[] = [
    { id: 'domain', title: 'Domain', options: options.domains },
    { id: 'source-type', title: 'Source type', options: options.sourceTypes },
    { id: 'environment', title: 'Environment', options: options.environments },
    { id: 'country', title: 'Country', options: options.countries },
  ]
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="px-1 pb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        Business concepts
      </div>
      <Accordion type="multiple" defaultValue={['domain']}>
        {groups.map((g) => (
          <AccordionItem key={g.id} value={g.id}>
            <AccordionTrigger className="py-2.5 text-xs font-bold">{g.title}</AccordionTrigger>
            <AccordionContent className="pb-2.5">
              <div className="space-y-1.5">
                {g.options.map((o) => {
                  const key = `${g.id}:${o}`
                  return (
                    <label key={o} className="flex cursor-pointer items-center gap-2 text-xs text-foreground/80">
                      <Checkbox
                        size="sm"
                        checked={!!checked[key]}
                        onCheckedChange={(v) => onChange({ ...checked, [key]: v === true })}
                      />
                      {o}
                    </label>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

function LineageGraph({
  chain,
  onSelect,
}: {
  chain: LineageChain | undefined
  onSelect: (sourceId: string) => void
}) {
  if (!chain) return null
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-bold text-foreground">{chain.title}</div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{chain.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {chain.nodes.map((n, i) => (
          <span key={`${n.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/60" />}
            {n.sourceId ? (
              <button
                type="button"
                onClick={() => onSelect(n.sourceId!)}
                className="rounded-lg border border-orange-200 bg-orange-50/60 px-2.5 py-1.5 text-[11.5px] font-semibold text-orange-800 transition-colors hover:border-orange-300 hover:bg-orange-100/70 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300"
              >
                {n.label}
              </button>
            ) : (
              <span className="rounded-lg border bg-muted/40 px-2.5 py-1.5 text-[11.5px] font-medium text-foreground/70">
                {n.label}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function DataLocatorPage() {
  const [catalog, setCatalog] = useState<DataLocatorCatalogPayload | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [guidance, setGuidance] = useState<{ headline: string; detail: string } | null>(null)
  const [results, setResults] = useState<Array<{ role: ResultRole; source: DataSource }>>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({})

  const sourceById = useMemo(() => {
    const map = new Map<string, DataSource>()
    for (const s of catalog?.sources ?? []) map.set(s.id, s)
    return map
  }, [catalog])

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const data = await fetchDataLocatorCatalog()
      setCatalog(data)
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : 'Failed to load catalog')
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  const chips = useMemo(
    () => (catalog?.intents ?? []).filter((i): i is SearchIntent & { chipLabel: string } => !!i.chipLabel),
    [catalog],
  )

  const selected = selectedId ? (sourceById.get(selectedId) ?? null) : null

  const filteredResults = useMemo(
    () => results.filter((r) => sourceMatchesFilters(r.source, filters)),
    [results, filters],
  )

  const runSearch = async (text: string) => {
    setSearching(true)
    setSearchError(null)
    setSearched(true)
    try {
      const data = await searchDataLocator(text)
      setGuidance(data.intent?.guidance ?? null)
      setResults(data.results)
      setSelectedId(data.results[0]?.source.id ?? null)
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed')
      setGuidance(null)
      setResults([])
      setSelectedId(null)
    } finally {
      setSearching(false)
    }
  }

  const pickChip = async (i: SearchIntent) => {
    const text = i.chipLabel ?? ''
    setQuery(text)
    await runSearch(text)
  }

  const headerBadges = [
    { label: 'MongoDB', icon: Database },
    { label: 'Room', icon: Database },
    { label: 'Backend API', icon: GitBranch },
    { label: 'Mobile State', icon: MapPin },
    {
      label: catalogLoading ? 'Loading catalog…' : catalogError ? 'Catalog error' : 'Catalog loaded',
      icon: Sparkles,
      tone: catalogError ? ('amber' as const) : catalog ? ('green' as const) : ('gray' as const),
    },
  ]

  const noResult = catalog?.noResult ?? {
    title: 'No directly matching data source was found.',
    suggestions: ['Try a broader business term.', 'Browse the full catalog below.'],
  }

  const guardrails: Guardrail[] = catalog?.guardrails ?? []
  const recipes: InvestigationRecipe[] = catalog?.recipes ?? []

  return (
    <ProductPage path="/engineering/tools/data-locator">
      <ToolHeader
        path="/engineering/tools/data-locator"
        icon={Compass}
        title="Data Locator"
        lead="Describe the business data you need in natural language; find the right database, collection, table, and relationship path."
        tone="orange"
        badges={headerBadges}
      />

      {catalogError && (
        <Callout icon={ShieldAlert} title="Catalog could not be loaded" tone="amber">
          <p className="text-xs text-foreground/80">{catalogError}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void loadCatalog()}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </Callout>
      )}

      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-foreground">What data are you looking for?</h2>
          <Badge variant="secondary" appearance="outline" size="xs" className="gap-1">
            <Sparkles className="size-3 text-orange-500" />
            Keyword search
          </Badge>
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="E.g.: I want to see a shipment's payment and delivery statuses together."
            className="min-h-[64px] flex-1 resize-none text-sm"
            disabled={catalogLoading || !!catalogError}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void runSearch(query)
              }
            }}
          />
          <Button
            variant="primary"
            className="shrink-0"
            disabled={catalogLoading || !!catalogError || searching}
            onClick={() => void runSearch(query)}
          >
            <Search className="size-4" />
            {searching ? 'Searching…' : 'Find Data Source'}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((i) => (
            <ExampleChip key={i.id} label={i.chipLabel} onClick={() => void pickChip(i)} />
          ))}
        </div>
        {searchError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{searchError}</p>}
      </section>

      {!searched ? (
        <section className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Compass className="size-6 text-muted-foreground" />
          </span>
          <div className="mt-4 text-sm font-bold text-foreground">Describe the data concept you need</div>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            You don't need to know the technical table or collection name. Describe your business
            question; results use real NESY Mongo and Courier Mobile source names.
          </p>
        </section>
      ) : !guidance ? (
        <section className="rounded-xl border bg-card p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">{noResult.title}</div>
              <ul className="mt-2 space-y-1">
                {noResult.suggestions.map((s) => (
                  <li key={s} className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground/80">
                    <ChevronRight className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <>
          <Callout icon={Lightbulb} title="Where should I look first?" tone="orange">
            <div className="text-sm font-bold text-foreground">{guidance.headline}</div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/80">{guidance.detail}</p>
          </Callout>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_430px]">
            <aside className="hidden xl:block">
              {catalog && (
                <FilterRail options={catalog.filterOptions} checked={filters} onChange={setFilters} />
              )}
            </aside>

            <div className="min-w-0 space-y-3">
              {filteredResults.length === 0 ? (
                <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
                  No results match the current filters.
                </div>
              ) : (
                filteredResults.map((r, i) => {
                  const s = r.source
                  const role = ROLE_META[r.role]
                  const truth = TRUTH_META[s.truth]
                  const active = selectedId === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className={cn(
                        'w-full rounded-xl border bg-card p-4 text-left transition-colors',
                        active
                          ? 'border-blue-400 ring-1 ring-blue-400/40 dark:border-blue-700'
                          : 'hover:border-border hover:bg-muted/20',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
                          {i + 1}.
                        </span>
                        <Badge variant="secondary" appearance="outline" size="xs" className={toneText[role.tone]}>
                          {role.label}
                        </Badge>
                        <Badge variant="secondary" appearance="outline" size="xs">
                          {s.sourceType}
                        </Badge>
                        <span className={cn('ms-auto text-[11px] font-bold', toneText[truth.tone])}>
                          {truth.label}
                        </span>
                      </div>
                      <div className="mt-2 font-mono text-sm font-bold text-foreground">{s.name}</div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{s.system}</p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/80">{s.purpose}</p>
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {s.keyFields.slice(0, 5).map((f) => (
                          <code
                            key={f.name}
                            className="rounded bg-muted/60 px-1.5 py-0.5 text-[10.5px] text-foreground/75"
                          >
                            {f.name}
                          </code>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>Freshness: {s.freshness}</span>
                        <span>Owner: {s.owner}</span>
                      </div>
                    </button>
                  )
                })
              )}

              <LineageGraph
                chain={catalog?.lineage[0]}
                onSelect={(id) => {
                  if (sourceById.has(id)) setSelectedId(id)
                }}
              />
            </div>

            <aside className="min-w-0">
              {selected && (
                <div className="rounded-xl border bg-card p-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
                  <SourceDetailHeader source={selected} />
                  <div className="mt-5 border-t pt-5">
                    <SourceDetailBody
                      source={selected}
                      sourceById={sourceById}
                      onSelectRelated={(id) => setSelectedId(id)}
                    />
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      <PageSection
        eyebrow="Ready-made recipes"
        title="Common investigation recipes"
        icon={BookOpen}
        tone="orange"
        description="Common field investigation scenarios — with check order and primary identifier."
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          {recipes.map((r) => (
            <div key={r.id} className="flex flex-col rounded-xl border bg-card p-4">
              <div className="text-sm font-bold text-foreground">{r.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.purpose}</p>
              <ol className="mt-3 flex-1 space-y-1.5">
                {r.checkOrder.map((step, i) => (
                  <li key={step} className="flex items-start gap-2 text-xs leading-relaxed text-foreground/85">
                    <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                <code className="text-[10.5px] text-muted-foreground">{r.identifier}</code>
                <Button size="sm" variant="outline" asChild>
                  <Link href={r.cta.href}>
                    {r.cta.label}
                    <ArrowUpRight className="size-3.5 opacity-60" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Catalog"
        title="All Data Sources"
        icon={Table2}
        tone="gray"
        description="Real NESY Mongo collections (composed from the ops catalog) plus Courier Mobile local sources."
      >
        <div className="space-y-3">
          <DataCatalog sources={catalog?.sources ?? []} loading={catalogLoading} />
        </div>
      </PageSection>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {guardrails.map((g) => (
          <div key={g.title} className={cn('rounded-xl border p-4', toneCard[g.tone])}>
            <div className="flex items-center gap-2">
              <ShieldAlert className={cn('size-4', toneText[g.tone])} />
              <span className="text-xs font-bold text-foreground">{g.title}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">{g.body}</p>
          </div>
        ))}
      </div>
    </ProductPage>
  )
}
