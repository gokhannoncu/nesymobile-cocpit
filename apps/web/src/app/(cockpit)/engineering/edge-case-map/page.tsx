'use client'

// Edge Case Intelligence — living Edge Case Pool + Risk Registry + Test Coverage Center.
// Default view is the DataGrid table; the legacy categorized card screen is preserved as "Reading View".

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Bug,
  Crosshair,
  FlaskConical,
  Layers,
  Lightbulb,
  Radar,
  Search,
  Table2,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'
import {
  Callout,
  HeroCallout,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
  toneCard,
  toneText,
} from '@/components/product'
import {
  EDGE_CATEGORIES,
  SEVERITY_META,
  type EdgeCategory,
} from '@/data/engineering/edge-cases'
import {
  EDGE_FULL,
  edgeKpis,
  QUICK_FILTERS,
  RELEASE_VERSION,
  SAVED_VIEWS,
  searchEdgeCases,
  type EdgeCaseFull,
} from '@/data/engineering/edge-case-ops'
import { EdgeCaseDrawer, PoolTable } from './pool'
import { CoverageView, RelationshipsView, RiskMapView, TestNextPanel } from './insights'

const CATEGORY_ORDER: EdgeCategory[] = [
  'payment', 'api', 'data', 'conflict', 'offline', 'state', 'scan', 'ui', 'location',
]

const SEV_RANK = { critical: 0, high: 1, medium: 2 } as const

export default function EdgeCaseIntelligencePage() {
  const [tab, setTab] = useState('pool')
  const [search, setSearch] = useState('')
  const [quick, setQuick] = useState<string[]>([])
  const [savedView, setSavedView] = useState<string | null>(null)
  const [selected, setSelected] = useState<EdgeCaseFull | null>(null)

  const kpi = edgeKpis()

  const filtered = useMemo(() => {
    let items = EDGE_FULL
    const view = SAVED_VIEWS.find((v) => v.id === savedView)
    if (view) items = items.filter(view.match)
    for (const qid of quick) {
      const qf = QUICK_FILTERS.find((q) => q.id === qid)
      if (qf) items = items.filter(qf.match)
    }
    items = searchEdgeCases(search, items)
    return [...items].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])
  }, [search, quick, savedView])

  const hasFilter = search.trim() !== '' || quick.length > 0 || savedView !== null

  const jumpToPool = (query: string) => {
    setSearch(query)
    setQuick([])
    setSavedView(null)
    setTab('pool')
  }

  return (
    <ProductPage path="/engineering/edge-case-map">
      <HeroCallout
        icon={Radar}
        eyebrow="Reliability & Operations"
        tone="orange"
        title="Edge Case Intelligence"
        lead="Manage known edge cases, test coverage, incident links, and permanent fixes in a single hub. Each record is not merely a 'known problem': it shows under which conditions it occurs, how it is detected, how it is tested, and what safeguards exist against recurrence."
        chips={[
          `${kpi.total} edge case`,
          `Release ${RELEASE_VERSION}`,
          `${kpi.incidentLinked} records linked to incidents`,
        ]}
      >
        <StatGrid cols={2}>
          <StatCard
            label="Release Ready"
            value={kpi.releaseReady}
            suffix="%"
            tone={kpi.releaseReady >= 80 ? 'green' : kpi.releaseReady >= 50 ? 'amber' : 'red'}
            icon={Zap}
            hint={`Test coverage ratio of ${kpi.releaseRisk} records within ${RELEASE_VERSION} scope`}
          />
          <StatCard label="Critical" value={kpi.critical} tone="red" icon={AlertTriangle} />
        </StatGrid>
      </HeroCallout>

      {/* ── Sticky action & filter bar ── */}
      <div className="sticky top-2 z-20 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
                placeholder="Search — free text or severity:critical automation:false domain:offline"
                className="h-9 w-full rounded-lg border bg-background pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-orange-500/30"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <select
              value={savedView ?? ''}
              onChange={(ev) => setSavedView(ev.target.value || null)}
              className="h-9 rounded-lg border bg-background px-2.5 text-sm text-foreground"
              title={SAVED_VIEWS.find((v) => v.id === savedView)?.desc}
            >
              <option value="">Saved View: All</option>
              {SAVED_VIEWS.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_FILTERS.map((q) => {
              const active = quick.includes(q.id)
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() =>
                    setQuick((prev) =>
                      active ? prev.filter((id) => id !== q.id) : [...prev, q.id],
                    )
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                    active
                      ? 'border-orange-400 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {q.label}
                </button>
              )
            })}
            {hasFilter && (
              <button
                type="button"
                onClick={() => { setSearch(''); setQuick([]); setSavedView(null) }}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" /> Clear · {filtered.length}/{kpi.total} records
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Views ── */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList variant="button" className="mb-5 flex-wrap justify-start">
          <TabsTrigger value="pool"><Table2 className="size-4" /> Pool</TabsTrigger>
          <TabsTrigger value="risk"><Crosshair className="size-4" /> Risk Map</TabsTrigger>
          <TabsTrigger value="coverage"><FlaskConical className="size-4" /> Coverage</TabsTrigger>
          <TabsTrigger value="relationships"><Layers className="size-4" /> Relationships</TabsTrigger>
          <TabsTrigger value="reading"><BookOpen className="size-4" /> Reading View</TabsTrigger>
        </TabsList>

        <TabsContent value="pool" className="space-y-8">
          <PoolTable items={filtered} onSelect={setSelected} />
          <TestNextPanel onSelect={setSelected} />
        </TabsContent>

        <TabsContent value="risk">
          <RiskMapView onSelect={setSelected} />
        </TabsContent>

        <TabsContent value="coverage">
          <CoverageView onSelect={setSelected} />
        </TabsContent>

        <TabsContent value="relationships">
          <RelationshipsView onPoolClick={jumpToPool} />
        </TabsContent>

        <TabsContent value="reading" className="space-y-8">
          <ReadingView onSelect={setSelected} />
        </TabsContent>
      </Tabs>

      {/* ── Process rules ── */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Callout icon={Bug} title="Incident integration" tone="red">
          Mandatory question when closing an incident: <em>does the root cause match an existing edge case?</em>{' '}
          If yes, the incident is linked to the record and occurrence/reproduce data is updated. If no, a new
          E-number is created, an owner is assigned, and a minimum regression test is planned. The pool grows with every incident
          — it is not a static document.
        </Callout>
        <Callout icon={Lightbulb} title="How to add a new edge case?" tone="orange">
          Source: <code>src/data/engineering/edge-cases.ts</code> (catalog) +{' '}
          <code>edge-case-ops.ts</code> (test/risk layer). Four steps: what happened (expected vs
          actual) → what triggers it → what is the risk (including detectability &amp; recoverability) → how
          do we protect against it (reproduce, mitigation, recovery, owner). If a similar record exists, do not create a duplicate
          — increment the existing record's occurrence count.
        </Callout>
      </div>

      <EdgeCaseDrawer edge={selected} onClose={() => setSelected(null)} />
    </ProductPage>
  )
}

// ── Reading View — legacy categorized card catalog ─────────────────

function ReadingView({ onSelect }: { onSelect: (e: EdgeCaseFull) => void }) {
  return (
    <>
      {CATEGORY_ORDER.map((cat) => {
        const items = EDGE_FULL.filter((e) => e.category === cat)
        if (items.length === 0) return null
        const meta = EDGE_CATEGORIES[cat]
        return (
          <PageSection
            key={cat}
            eyebrow={`${items.length} records`}
            title={meta.label}
            description={meta.desc}
            icon={Radar}
            tone="orange"
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {items.map((e) => {
                const sev = SEVERITY_META[e.severity]
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelect(e)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-shadow hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/30',
                      toneCard[sev.tone],
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <code className={cn('text-xs font-bold', toneText[sev.tone])}>{e.id}</code>
                        <span className="text-sm font-bold text-foreground">{e.title}</span>
                      </div>
                      <Badge variant="secondary" appearance="outline" size="xs">
                        {sev.label}
                      </Badge>
                    </div>
                    <dl className="mt-2.5 space-y-1.5 text-xs leading-relaxed">
                      <div>
                        <dt className="inline font-bold text-foreground/70">Trigger: </dt>
                        <dd className="inline text-foreground/85">{e.trigger}</dd>
                      </div>
                      <div>
                        <dt className="inline font-bold text-foreground/70">Impact: </dt>
                        <dd className="inline text-foreground/85">{e.impact}</dd>
                      </div>
                      <div>
                        <dt className={cn('inline font-bold', toneText[sev.tone])}>Mitigation: </dt>
                        <dd className="inline text-muted-foreground">{e.mitigation}</dd>
                      </div>
                    </dl>
                  </button>
                )
              })}
            </div>
          </PageSection>
        )
      })}
    </>
  )
}
