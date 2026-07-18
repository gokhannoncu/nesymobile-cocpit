'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Database,
  DatabaseZap,
  Eraser,
  EyeOff,
  History,
  ListChecks,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@nesy/metronic/components/ui/collapsible'
import { Label } from '@nesy/metronic/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import { Switch } from '@nesy/metronic/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'
import { Textarea } from '@nesy/metronic/components/ui/textarea'
import { PageSection, ProductPage } from '@/components/product'
import { ToolCard, ToolHeader } from '@/components/engineering/tools/shared'
import {
  QUERY_TYPES,
  SAFETY_TOGGLES,
  TIME_RANGES,
  WRITE_INTENT_NOTICE,
  hasWriteIntent,
} from '@/data/engineering/tools/mongodb-generator'
import {
  deleteMongoQuery,
  fetchMongoCatalog,
  fetchRecentMongoQueries,
  generateMongoQuery,
  reuseMongoQuery,
  type MongoCatalogCollection,
  type MongoPredefinedQuery,
  type MongoQueryRun,
} from '@/services/mongo-query'
import { MongodbQueryGeneratorPageShimmer } from './page-shimmer'
import { QueryWorkspace } from './workspace'
import { RecentQueriesTable } from './recent-queries'

const PATH = '/engineering/tools/mongodb-query-generator'

const PREDEFINED_TABS: { value: string; label: string }[] = [
  { value: 'top', label: 'Top ops' },
  { value: 'identity', label: 'Identity' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'pickup', label: 'Pickup & zone' },
  { value: 'status', label: 'Status & events' },
  { value: 'money', label: 'COD & fiscal' },
  { value: 'courier', label: 'Courier & auth' },
  { value: 'transfer', label: 'Transfer' },
]

function AmberNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
      <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-300">
        {children}
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function PredefinedQueryPicker({
  queries,
  activeId,
  onSelect,
}: {
  queries: MongoPredefinedQuery[]
  activeId?: number | null
  onSelect: (q: MongoPredefinedQuery) => void
}) {
  if (!queries.length) {
    return (
      <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
        No predefined queries in this category.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {queries.map((q) => {
        const selected = activeId === q.id
        return (
          <button
            key={q.id}
            type="button"
            title={q.reason}
            onClick={() => onSelect(q)}
            className={cn(
              'rounded-lg border px-3 py-2.5 text-left transition-colors',
              selected
                ? 'border-orange-300 bg-orange-50/80 dark:border-orange-800 dark:bg-orange-950/40'
                : 'border-border bg-card hover:border-orange-200 hover:bg-muted/40 dark:hover:border-orange-900',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold leading-snug text-foreground">{q.label}</p>
              {q.priority === 'P0' && (
                <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                  P0
                </span>
              )}
            </div>
            <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
              {q.collection}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
              {q.reason}
            </p>
          </button>
        )
      })}
    </div>
  )
}

export default function MongodbQueryGeneratorPage() {
  const searchParams = useSearchParams()
  const [text, setText] = useState('')
  const [database, setDatabase] = useState('NESY_ShipmentDB')
  const [collection, setCollection] = useState('Shipment')
  const [queryType, setQueryType] = useState('Find')
  const [timeRange, setTimeRange] = useState('Last 24 hours')
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(SAFETY_TOGGLES.map((t) => [t.id, true])),
  )
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [predefinedTab, setPredefinedTab] = useState('top')
  const [activePredefinedId, setActivePredefinedId] = useState<number | null>(null)
  const [catalog, setCatalog] = useState<MongoCatalogCollection[]>([])
  const [predefinedQueries, setPredefinedQueries] = useState<MongoPredefinedQuery[]>([])
  const [databases, setDatabases] = useState<string[]>(['NESY_ShipmentDB'])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [recent, setRecent] = useState<MongoQueryRun[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState<string | null>(null)
  const [result, setResult] = useState<MongoQueryRun | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const collectionsForDb = useMemo(
    () => catalog.filter((c) => c.database === database),
    [catalog, database],
  )
  const selectedEntry = useMemo(
    () => catalog.find((c) => c.database === database && c.collection === collection) ?? null,
    [catalog, database, collection],
  )

  const queriesByTab = useMemo(() => {
    const map: Record<string, MongoPredefinedQuery[]> = {
      top: predefinedQueries.filter((q) => q.priority === 'P0'),
    }
    for (const tab of PREDEFINED_TABS) {
      if (tab.value === 'top') continue
      map[tab.value] = predefinedQueries.filter((q) => q.category === tab.value)
    }
    return map
  }, [predefinedQueries])

  const applyPredefined = (q: MongoPredefinedQuery) => {
    setDatabase(q.database)
    setCollection(q.collection)
    setText(q.text)
    setActivePredefinedId(q.id)
  }

  const loadRecent = useCallback(async () => {
    setRecentLoading(true)
    setRecentError(null)
    try {
      const rows = await fetchRecentMongoQueries()
      setRecent(rows)
    } catch (e) {
      setRecentError(e instanceof Error ? e.message : 'Failed to load recent queries')
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setCatalogLoading(true)
      try {
        const data = await fetchMongoCatalog()
        if (cancelled) return
        setCatalog(data.collections)
        setPredefinedQueries(data.predefinedQueries ?? [])
        setDatabases(data.databases)
        setCatalogError(null)
        const paramDb = searchParams.get('database')
        const paramCol = searchParams.get('collection')
        if (
          paramDb &&
          paramCol &&
          data.collections.some((c) => c.database === paramDb && c.collection === paramCol)
        ) {
          setDatabase(paramDb)
          setCollection(paramCol)
        } else {
          const firstDb = data.databases[0]
          if (firstDb && !data.databases.includes(database)) {
            setDatabase(firstDb)
          }
          const first = data.collections.find((c) => c.database === (firstDb ?? database))
          if (
            first &&
            !data.collections.some((c) => c.database === database && c.collection === collection)
          ) {
            setDatabase(first.database)
            setCollection(first.collection)
          }
        }
      } catch (e) {
        if (!cancelled) {
          setCatalogError(e instanceof Error ? e.message : 'Failed to load catalog')
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    void loadRecent()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [loadRecent])

  useEffect(() => {
    if (!collectionsForDb.length) return
    if (!collectionsForDb.some((c) => c.collection === collection)) {
      setCollection(collectionsForDb[0].collection)
    }
  }, [collectionsForDb, collection])

  const writeIntent = hasWriteIntent(text)

  const resetForm = () => {
    setText('')
    setDatabase(databases[0] ?? 'NESY_ShipmentDB')
    const first = catalog.find((c) => c.database === (databases[0] ?? 'NESY_ShipmentDB'))
    setCollection(first?.collection ?? 'Shipment')
    setQueryType('Find')
    setTimeRange('Last 24 hours')
    setToggles(Object.fromEntries(SAFETY_TOGGLES.map((t) => [t.id, true])))
    setActivePredefinedId(null)
    setResult(null)
    setGenerateError(null)
  }

  const onGenerate = async () => {
    if (!text.trim() || generating) return
    setResult(null)
    setGenerateError(null)
    setGenerating(true)
    try {
      const run = await generateMongoQuery({
        naturalLanguage: text.trim(),
        environment: 'n/a',
        database,
        collection,
        queryType,
        country: 'All',
        timeRange,
        toggles,
      })
      setResult(run)
      await loadRecent()
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setGenerating(false)
    }
  }

  const reuseQuery = async (q: MongoQueryRun) => {
    setText(q.naturalLanguage)
    setDatabase(q.database)
    setCollection(q.collection)
    setQueryType(q.queryType)
    setActivePredefinedId(null)
    setResult(q)
    setGenerateError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const updated = await reuseMongoQuery(q.id)
      setRecent((prev) => {
        const rest = prev.filter((r) => r.id !== updated.id)
        return [updated, ...rest]
      })
    } catch {
      // reuse bump is optional
    }
  }

  const deleteQuery = async (q: MongoQueryRun) => {
    try {
      await deleteMongoQuery(q.id)
      setRecent((prev) => prev.filter((r) => r.id !== q.id))
      if (result?.id === q.id) setResult(null)
      setRecentError(null)
    } catch (e) {
      setRecentError(e instanceof Error ? e.message : 'Failed to delete query')
      throw e
    }
  }

  if (catalogLoading) {
    return (
      <ProductPage path={PATH}>
        <MongodbQueryGeneratorPageShimmer />
      </ProductPage>
    )
  }

  return (
    <ProductPage path={PATH}>
      <ToolHeader
        path={PATH}
        icon={Database}
        title="MongoDB Query Generator"
        lead="Describe your data needs in natural language, generate a safe MongoDB query via Claude CLI (haiku), and verify step-by-step what the query does."
        tone="orange"
      />

      <div className="space-y-6">
        <ToolCard
          step="1"
          title="Define your data needs"
          description="Pick a predefined ops query or write your own prompt, then choose database and collection."
          className="w-full"
        >
          {catalogError && <AmberNotice>{catalogError}</AmberNotice>}

          {predefinedQueries.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Predefined queries
              </p>
              <Tabs value={predefinedTab} onValueChange={setPredefinedTab} className="w-full">
                <TabsList variant="button" className="mb-3 flex h-auto w-full flex-wrap justify-start gap-1">
                  {PREDEFINED_TABS.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {PREDEFINED_TABS.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} className="mt-0 outline-none">
                    <PredefinedQueryPicker
                      queries={queriesByTab[tab.value] ?? []}
                      activeId={activePredefinedId}
                      onSelect={applyPredefined}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Natural language
            </Label>
            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setActivePredefinedId(null)
              }}
              placeholder="Show shipments with ShipmentStatus Return in HR in the last 24 hours, newest first."
              className="min-h-[120px] text-sm"
            />
          </div>

          {writeIntent && <AmberNotice>{WRITE_INTENT_NOTICE}</AmberNotice>}
          {generateError && <AmberNotice>{generateError}</AmberNotice>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Database">
              <Select value={database} onValueChange={setDatabase}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {databases.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Collection">
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {collectionsForDb.map((c) => (
                    <SelectItem key={c.collection} value={c.collection}>
                      {c.collection}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Query type">
              <Select value={queryType} onValueChange={setQueryType}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUERY_TYPES.map((q) => (
                    <SelectItem key={q} value={q}>
                      {q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Time range">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Collapsible open={schemaOpen} onOpenChange={setSchemaOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50">
                <span className="inline-flex items-center gap-1.5">
                  <DatabaseZap className="size-3.5 text-muted-foreground" />
                  Schema information
                  {selectedEntry ? ` · ${selectedEntry.service}` : ''}
                </span>
                <ChevronDown
                  className={cn(
                    'size-3.5 text-muted-foreground transition-transform',
                    schemaOpen && 'rotate-180',
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-2">
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[440px] border-collapse text-xs">
                      <thead className="border-b bg-muted/40">
                        <tr>
                          {['Field name', 'Data type', 'Description', 'Example value'].map((h) => (
                            <th
                              key={h}
                              className="px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedEntry?.keyFields ?? []).map((row) => (
                          <tr key={row.field} className="border-b last:border-b-0">
                            <td className="px-2.5 py-2 font-mono font-semibold text-foreground">
                              {row.field}
                            </td>
                            <td className="px-2.5 py-2 text-foreground/80">{row.type}</td>
                            <td className="px-2.5 py-2 text-muted-foreground">{row.description}</td>
                            <td className="px-2.5 py-2 font-mono text-foreground/80">{row.example}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button size="sm" variant="outline" disabled title="Catalog schema (live Mongo sync later)">
                    <RefreshCw className="size-3.5" />
                    Catalog schema
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3">
              {SAFETY_TOGGLES.map((t) => {
                const icons: Record<string, typeof ListChecks> = {
                  limit: ListChecks,
                  mask: EyeOff,
                  timeRange: CalendarClock,
                  explain: Sparkles,
                }
                const Icon = icons[t.id] ?? ListChecks
                return (
                  <div key={t.id} className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{t.label}</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {t.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      size="sm"
                      checked={toggles[t.id]}
                      onCheckedChange={(checked) =>
                        setToggles((prev) => ({ ...prev, [t.id]: checked }))
                      }
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              variant="primary"
              onClick={() => void onGenerate()}
              disabled={!text.trim() || generating || !selectedEntry}
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generating ? 'Generating…' : 'Generate Query'}
            </Button>
            <Button variant="outline" onClick={resetForm} disabled={generating}>
              <Eraser className="size-4" />
              Clear form
            </Button>
          </div>
        </ToolCard>

        <div className="w-full">
          <QueryWorkspace run={result} loading={generating} />
        </div>
      </div>

      <PageSection
        eyebrow="History"
        title="Recent Queries"
        icon={History}
        tone="orange"
        description="Queries auto-saved to Postgres on every Generate — click a row to open details and reuse."
      >
        <RecentQueriesTable
          queries={recent}
          loading={recentLoading}
          error={recentError}
          onReuse={(q) => void reuseQuery(q)}
          onDelete={deleteQuery}
        />
      </PageSection>
    </ProductPage>
  )
}
