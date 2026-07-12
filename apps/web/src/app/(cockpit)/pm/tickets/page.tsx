'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  KanbanSquare,
  Search,
  X,
  ChevronDown,
  AlertTriangle,
  Bug,
  Wrench,
  Eye,
  ArrowDown,
  Zap,
  MessageSquare,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  ProductPage,
  HeroCallout,
  PageSection,
  StatCard,
  StatGrid,
  SegmentTabs,
  SeverityBadge,
  StatusBadge,
  RecurrenceRiskBadge,
} from '@/components/product'
import {
  tickets,
  filterTickets,
  sortTickets,
  ALL_GROUPS,
  ALL_SCREENS,
} from '@/data/pm/tickets'
import {
  emptyFilters,
  type Ticket,
  type Filters,
  type SortColumn,
} from '@/data/pm/types'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

// ═══ Phase icon map ══════════════════════════════════════════════════════
const phaseIcons: Record<string, typeof Bug> = {
  symptom: Eye,
  cause: Bug,
  fix: Wrench,
  why: MessageSquare,
  state: Zap,
  todo: ArrowDown,
}

const phaseLabels: Record<string, string> = {
  symptom: 'Belirti',
  cause: 'Neden',
  fix: 'Çözüm',
  why: 'Neden Böyle?',
  state: 'Güncel Durum',
  todo: 'Yapılacak',
}

export default function TicketsPage() {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [detailTab, setDetailTab] = useState<'ozet' | 'kokneden'>('ozet')

  // Close modal on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedTicket(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // ═══ Stats ═══════════════════════════════════════════════════════════
  const totalTickets = tickets.length
  const openTickets = tickets.filter((t) => t.status === 'open').length
  const criticalCount = tickets.filter((t) => t.severity === 'Critical').length
  const highCount = tickets.filter((t) => t.severity === 'High').length

  return (
    <ProductPage path="/pm/tickets">
      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <HeroCallout
        icon={KanbanSquare}
        eyebrow="Ticket Management"
        tone="purple"
        title="Ticket Board"
        lead="Proje ticket'larını kanban, tablo ve analitik görünümlerinde takip edin."
        chips={['Kanban', 'Tablo', 'Analitik']}
      >
        <StatGrid cols={4}>
          <StatCard label="Total" value={totalTickets} tone="purple" icon={KanbanSquare} />
          <StatCard label="Open" value={openTickets} tone="blue" icon={AlertTriangle} />
          <StatCard label="Critical" value={criticalCount} tone="red" icon={Bug} />
          <StatCard label="High" value={highCount} tone="orange" icon={Zap} />
        </StatGrid>
      </HeroCallout>

      {/* ─── Tabs ────────────────────────────────────────────────────── */}
      <SegmentTabs
        items={[
          {
            value: 'kanban',
            label: 'Kanban Board',
            icon: KanbanSquare,
            content: <KanbanView onSelect={setSelectedTicket} />,
          },
          {
            value: 'tablo',
            label: 'Tablo Görünümü',
            content: <TabloView onSelect={setSelectedTicket} />,
          },
          {
            value: 'analitik',
            label: 'Analitik',
            content: <AnalyticsView />,
          },
        ]}
      />

      {/* ─── Detail Modal ────────────────────────────────────────────── */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedTicket(null)}
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 hover:bg-muted transition-colors"
            >
              <X className="size-4" />
            </button>

            {/* Header */}
            <div className="border-b p-5">
              <div className="flex items-center gap-2 mb-2">
                <SeverityBadge severity={selectedTicket.severity} />
                <StatusBadge status={selectedTicket.status} />
              </div>
              <h2 className="text-lg font-bold text-foreground pr-8">
                #{selectedTicket.id} — {selectedTicket.title}
              </h2>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 border-b px-5">
              <button
                onClick={() => setDetailTab('ozet')}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors border-b-2',
                  detailTab === 'ozet'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                Özet
              </button>
              <button
                onClick={() => setDetailTab('kokneden')}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors border-b-2',
                  detailTab === 'kokneden'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                Kök Neden
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              {detailTab === 'ozet' ? (
                <div className="space-y-4">
                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Grup
                      </span>
                      <p className="mt-0.5 font-medium">{selectedTicket.group}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Ekran
                      </span>
                      <p className="mt-0.5 font-medium">{selectedTicket.screen}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Ülke
                      </span>
                      <p className="mt-0.5 font-medium">{selectedTicket.country}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Tarih
                      </span>
                      <p className="mt-0.5 font-medium">{selectedTicket.date}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Tip
                      </span>
                      <p className="mt-0.5 font-medium">{selectedTicket.type}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Müşteri Ref
                      </span>
                      <p className="mt-0.5 font-medium">{selectedTicket.customer_ticket}</p>
                    </div>
                  </div>
                  {/* Summary */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                      Özet
                    </h4>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {selectedTicket.summary}
                    </p>
                  </div>
                  {/* Links */}
                  <div className="flex gap-2">
                    {selectedTicket.gh_url && (
                      <a
                        href={selectedTicket.gh_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        GitHub
                      </a>
                    )}
                    {selectedTicket.customer_refs.map((ref) => (
                      <a
                        key={ref.url}
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        {ref.repo}#{ref.num}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedTicket.analysis ? (
                    <>
                      <RecurrenceRiskBadge risk={selectedTicket.analysis.recurrenceRisk} />

                      {selectedTicket.analysis.story &&
                      selectedTicket.analysis.story.length > 0 ? (
                        <div className="space-y-3 mt-3">
                          {selectedTicket.analysis.story.map((step, i) => {
                            const StepIcon = phaseIcons[step.k] ?? Bug
                            return (
                              <div
                                key={i}
                                className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30"
                              >
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
                                  <StepIcon className="size-3.5 text-purple-600 dark:text-purple-400" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                    {phaseLabels[step.k] ?? step.k}
                                    {step.confidence != null && (
                                      <span className="ml-2 text-purple-600 dark:text-purple-400">
                                        {step.confidence}% güven
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-0.5 text-sm leading-relaxed text-foreground/90">
                                    {step.text}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2 mt-3">
                          <div className="rounded-lg border p-3 bg-muted/30">
                            <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                              Rapor
                            </h4>
                            <p className="text-sm text-foreground/90">
                              {selectedTicket.analysis.report}
                            </p>
                          </div>
                          {selectedTicket.analysis.rootCause && (
                            <div className="rounded-lg border p-3 bg-muted/30">
                              <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                                Kök Neden
                              </h4>
                              <p className="text-sm text-foreground/90">
                                {selectedTicket.analysis.rootCause}
                              </p>
                            </div>
                          )}
                          {selectedTicket.analysis.fix && (
                            <div className="rounded-lg border p-3 bg-muted/30">
                              <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                                Çözüm
                              </h4>
                              <p className="text-sm text-foreground/90">
                                {selectedTicket.analysis.fix}
                              </p>
                            </div>
                          )}
                          {selectedTicket.analysis.verdict && (
                            <div className="rounded-lg border p-3 bg-muted/30">
                              <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                                Karar
                              </h4>
                              <p className="text-sm text-foreground/90">
                                {selectedTicket.analysis.verdict}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedTicket.analysis.edgeCases.length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                            Edge Cases
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {selectedTicket.analysis.edgeCases.map((ec) => (
                              <Badge key={ec} variant="secondary" size="sm">
                                {ec}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Bu ticket için kök neden analizi henüz yapılmamış.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ProductPage>
  )
}

// ═══ Kanban View ═════════════════════════════════════════════════════════
function KanbanView({ onSelect }: { onSelect: (t: Ticket) => void }) {
  const hasFixStep = (t: Ticket) =>
    t.analysis?.story?.some((s) => s.k === 'fix') ?? false

  const openTickets = tickets.filter((t) => t.status === 'open' && !hasFixStep(t))
  const inProgressTickets = tickets.filter((t) => t.status === 'open' && hasFixStep(t))
  const closedTickets = tickets.filter((t) => t.status === 'closed')

  const columns = [
    {
      label: 'Open',
      items: openTickets,
      headerBg: 'bg-blue-100 dark:bg-blue-900/40',
      headerText: 'text-blue-700 dark:text-blue-300',
      dotBg: 'bg-blue-500',
    },
    {
      label: 'In Progress',
      items: inProgressTickets,
      headerBg: 'bg-amber-100 dark:bg-amber-900/40',
      headerText: 'text-amber-700 dark:text-amber-300',
      dotBg: 'bg-amber-500',
    },
    {
      label: 'Closed',
      items: closedTickets,
      headerBg: 'bg-green-100 dark:bg-green-900/40',
      headerText: 'text-green-700 dark:text-green-300',
      dotBg: 'bg-green-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columns.map((col) => (
        <div key={col.label} className="rounded-xl border bg-card overflow-hidden">
          <div className={cn('flex items-center justify-between px-4 py-2.5', col.headerBg)}>
            <div className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', col.dotBg)} />
              <span className={cn('text-sm font-bold', col.headerText)}>{col.label}</span>
            </div>
            <Badge variant="secondary" size="sm">
              {col.items.length}
            </Badge>
          </div>
          <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
            {col.items.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className="w-full text-left rounded-lg border p-3 bg-background hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <SeverityBadge severity={t.severity} />
                </div>
                <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                  {t.title}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant="secondary" size="sm">
                    {t.group}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t.country} · {t.date}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══ Tablo View ══════════════════════════════════════════════════════════
function TabloView({ onSelect }: { onSelect: (t: Ticket) => void }) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [sortCol, setSortCol] = useState<SortColumn>('severity')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  const filtered = useMemo(() => {
    const f = filterTickets(tickets, filters, search)
    return sortTickets(f, sortCol, sortDir)
  }, [search, filters, sortCol, sortDir])

  const handleSort = useCallback(
    (col: SortColumn) => {
      if (col === sortCol) {
        setSortDir((d) => (d === 1 ? -1 : 1))
      } else {
        setSortCol(col)
        setSortDir(1)
      }
    },
    [sortCol],
  )

  const SortHeader = ({ col, children }: { col: SortColumn; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(col)}
      className="px-3 py-2.5 text-start text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortCol === col && (
          <ChevronDown
            className={cn('size-3 transition-transform', sortDir === -1 && 'rotate-180')}
          />
        )}
      </span>
    </th>
  )

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Ticket ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          />
        </div>
        <select
          value={filters.severity ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, severity: (e.target.value || null) as Filters['severity'] }))
          }
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tüm Severity</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select
          value={filters.status ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: (e.target.value || null) as Filters['status'] }))
          }
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tüm Durum</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={filters.group ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, group: e.target.value || null }))}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tüm Gruplar</option>
          {ALL_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <SortHeader col="id">#</SortHeader>
              <SortHeader col="title">Başlık</SortHeader>
              <SortHeader col="severity">Severity</SortHeader>
              <th className="px-3 py-2.5 text-start text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Durum
              </th>
              <SortHeader col="group">Grup</SortHeader>
              <th className="px-3 py-2.5 text-start text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Ekran
              </th>
              <th className="px-3 py-2.5 text-start text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Ülke
              </th>
              <SortHeader col="date">Tarih</SortHeader>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                onClick={() => onSelect(t)}
                className="border-b border-border/60 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{t.id}</td>
                <td className="px-3 py-2.5 font-medium text-foreground max-w-xs truncate">
                  {t.title}
                </td>
                <td className="px-3 py-2.5">
                  <SeverityBadge severity={t.severity} />
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {t.group}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {t.screen}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{t.country}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {t.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Sonuç bulunamadı.
          </div>
        )}
      </div>
    </div>
  )
}

// ═══ Analytics View ══════════════════════════════════════════════════════
function AnalyticsView() {
  const groupData = useMemo(() => {
    const counts = new Map<string, number>()
    tickets.forEach((t) => counts.set(t.group, (counts.get(t.group) || 0) + 1))
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [])

  const statusData = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'open').length
    const closed = tickets.filter((t) => t.status === 'closed').length
    return [
      { name: 'Open', value: open },
      { name: 'Closed', value: closed },
    ]
  }, [])

  const statusColors = ['#3b82f6', '#22c55e']

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border p-6 bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Gruplara Göre Ticket</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={groupData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              opacity={0.5}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="value" name="Ticket" fill="#a855f7" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl border p-6 bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Açık / Kapalı Dağılımı</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              paddingAngle={3}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {statusData.map((entry, i) => (
                <Cell key={entry.name} fill={statusColors[i]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
