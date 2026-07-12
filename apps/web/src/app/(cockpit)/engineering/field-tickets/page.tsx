'use client'

// Field Ticket Intelligence — sahadan gelen ticket'ları, kanonik kök nedenleri,
// uygulanan müdahaleleri ve tekrar risklerini ilişkisel olarak analiz eden merkez.
// İlke: ticket'lar kendi kök neden metnini üretmez; kanonik Root Cause / Action /
// Edge Case kayıtlarına bağlanır (Engineering Knowledge Graph).

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  ClipboardList,
  FileQuestion,
  LayoutDashboard,
  Network,
  Scale,
  Search,
  Table2,
  Ticket,
  Wrench,
  X,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'
import {
  HeroCallout,
  ProductPage,
  StatCard,
  StatGrid,
} from '@/components/product'
import {
  DATA_SOURCES,
  FIELD_TICKETS,
  LAST_UPDATED,
  QUICK_FILTERS,
  SAVED_VIEWS,
  SEVERITY_META,
  fieldTicketKpis,
  searchFieldTickets,
  type FieldTicket,
} from '@/data/engineering/field-tickets'
import { RootCauseGraph } from './graph'
import { RootCauseDrawer, TicketDrawer, TicketPoolTable } from './pool'
import { ActionsView, KnowledgeView, OverviewView, PatternsView } from './views'

export default function FieldTicketIntelligencePage() {
  const [tab, setTab] = useState('overview')
  const [search, setSearch] = useState('')
  const [quick, setQuick] = useState<string[]>([])
  const [savedView, setSavedView] = useState<string | null>(null)
  const [selected, setSelected] = useState<FieldTicket | null>(null)
  const [selectedRc, setSelectedRc] = useState<string | null>(null)

  const kpi = fieldTicketKpis()

  const filtered = useMemo(() => {
    let items = FIELD_TICKETS
    const view = SAVED_VIEWS.find((v) => v.id === savedView)
    if (view) items = items.filter(view.match)
    for (const qid of quick) {
      const qf = QUICK_FILTERS.find((q) => q.id === qid)
      if (qf) items = items.filter(qf.match)
    }
    items = searchFieldTickets(search, items)
    return [...items].sort(
      (a, b) =>
        SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank ||
        Number(a.status === 'closed') - Number(b.status === 'closed') ||
        b.ghId - a.ghId,
    )
  }, [search, quick, savedView])

  const hasFilter = search.trim() !== '' || quick.length > 0 || savedView !== null

  const openRc = (rcId: string) => {
    setSelected(null)
    setSelectedRc(rcId)
  }
  const openTicket = (t: FieldTicket) => {
    setSelectedRc(null)
    setSelected(t)
  }
  const jumpToPool = (query: string) => {
    setSearch(query)
    setQuick([])
    setSavedView(null)
    setTab('pool')
  }

  return (
    <ProductPage path="/engineering/field-tickets">
      <HeroCallout
        icon={Ticket}
        eyebrow="Reliability & Operations"
        tone="indigo"
        title="Field Ticket Intelligence"
        lead={`${kpi.total} saha ticket'ı ${kpi.rootCauses} kanonik kök neden altında kümeleniyor. Açık ticket'ların çoğu Finans & Ödeme ile Barcode & Scan alanlarında yoğunlaşıyor; ${kpi.highRepeatRc} kök neden yüksek tekrar riski taşıyor ve ${kpi.workaroundClosed} ticket workaround ile kapatıldı — Closed ≠ Eliminated.`}
        chips={[
          `${kpi.total} ticket`,
          `${kpi.rootCauses} kök neden`,
          `${kpi.families} mühendislik alanı`,
          `${kpi.open} açık`,
          `Güncelleme: ${LAST_UPDATED}`,
          DATA_SOURCES,
        ]}
      >
        <StatGrid cols={2}>
          <StatCard
            label="Workaround ile Kapalı"
            value={kpi.workaroundClosed}
            tone="amber"
            icon={Scale}
            hint="Ticket kapalı ancak mimari risk devam ediyor"
          />
          <StatCard label="Kritik" value={kpi.critical} tone="red" icon={AlertTriangle} />
        </StatGrid>
      </HeroCallout>

      {/* ── KPI şeridi ── */}
      <StatGrid cols={4}>
        <StatCard
          label="Kanonik Kök Neden"
          value={kpi.rootCauses}
          tone="indigo"
          icon={Network}
          hint="Tekrar etmeyen gerçek neden sayısı"
        />
        <StatCard
          label="Yüksek Tekrar Riski"
          value={kpi.highRepeatRc}
          tone="red"
          icon={AlertTriangle}
          hint="Mevcut mimaride yeniden oluşması beklenen kök neden"
        />
        <StatCard
          label="Kök Nedeni Belirsiz"
          value={kpi.unclear}
          tone="amber"
          icon={FileQuestion}
          hint="Confidence < 65 — hâlâ hipotez aşamasında"
        />
        <StatCard
          label="Açık Kalıcı Aksiyon"
          value={kpi.openActions}
          tone="blue"
          icon={Wrench}
          hint="Mimari çözüm tamamlanmamış / doğrulanmamış"
        />
      </StatGrid>

      {/* ── Sticky arama & filtre barı ── */}
      <div className="sticky top-2 z-20 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
                placeholder='Ara — serbest metin veya status:closed workaround:true · rootcause:"race" · country:RS'
                className="h-9 w-full rounded-lg border bg-background pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-indigo-500/30"
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
              <option value="">Saved View: Tümü</option>
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
                      ? 'border-indigo-400 bg-indigo-100 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
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
                <X className="size-3.5" /> Temizle · {filtered.length}/{kpi.total} ticket
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Görünümler ── */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList variant="button" className="mb-5 flex-wrap justify-start">
          <TabsTrigger value="overview"><LayoutDashboard className="size-4" /> Overview</TabsTrigger>
          <TabsTrigger value="pool"><Table2 className="size-4" /> Ticket Pool</TabsTrigger>
          <TabsTrigger value="graph"><Network className="size-4" /> Root Cause Graph</TabsTrigger>
          <TabsTrigger value="patterns"><BarChart3 className="size-4" /> Patterns</TabsTrigger>
          <TabsTrigger value="actions"><ClipboardList className="size-4" /> Actions</TabsTrigger>
          <TabsTrigger value="knowledge"><BookOpen className="size-4" /> Knowledge Base</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewView onOpenRc={openRc} onJumpPool={jumpToPool} />
        </TabsContent>

        <TabsContent value="pool">
          <TicketPoolTable items={filtered} onSelect={openTicket} onSelectRc={openRc} />
        </TabsContent>

        <TabsContent value="graph">
          <RootCauseGraph tickets={filtered} onOpenTicket={openTicket} onOpenRc={openRc} />
        </TabsContent>

        <TabsContent value="patterns">
          <PatternsView onOpenRc={openRc} />
        </TabsContent>

        <TabsContent value="actions">
          <ActionsView onOpenRc={openRc} />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeView onOpenRc={openRc} />
        </TabsContent>
      </Tabs>

      <TicketDrawer ticket={selected} onClose={() => setSelected(null)} onSelectRc={openRc} />
      <RootCauseDrawer
        rcId={selectedRc}
        onClose={() => setSelectedRc(null)}
        onSelectTicket={openTicket}
      />
    </ProductPage>
  )
}
