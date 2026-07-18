'use client'

import { Fragment, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  BarChart3,
  Bug,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  FileSearch,
  Gauge,
  GitCommitVertical,
  Globe,
  Info,
  Kanban,
  Layers,
  LineChart as LineChartIcon,
  ListChecks,
  Map,
  MapPin,
  Microscope,
  Network,
  Printer,
  Rocket,
  ScatterChart as ScatterChartIcon,
  Scale,
  Server,
  ShieldCheck,
  ShieldQuestion,
  Smartphone,
  Timer,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Callout,
  ComparisonTable,
  EvidenceRef,
  GuardrailCallout,
  HeroCallout,
  PageSection,
  ProductPage,
  SegmentTabs,
  Timeline,
  toneCard,
  toneDot,
  toneText,
  type Tone,
} from '@/components/product'
import { PERF_REPORTS, PERF_TARGETS, type CountryPerfReport } from '@/data/engineering/performance'
import {
  HEALTH_LABELS,
  PI_ACTION_COLUMNS,
  PI_ACTIONS,
  PI_APP_START_TARGET,
  PI_APP_START_TREND,
  PI_BRIEF,
  PI_COUNTRIES,
  PI_DATA_QUALITY,
  PI_ENDPOINT_IMPACT,
  PI_EVIDENCE_RULES,
  PI_FINDINGS,
  PI_GUARDRAILS,
  PI_KPIS,
  PI_META,
  PI_METRIC_FLOWS,
  PI_NARRATIVE,
  PI_NETWORK_TREND,
  PI_PILLARS,
  PI_PRIORITY_ENDPOINTS,
  PI_TIMELINE,
  PI_TREND_NOTES,
  type HealthStatus,
  type KpiTone,
  type PiAction,
} from '@/data/engineering/performance-intelligence'

// ═══ View modes ═════════════════════════════════════════════════════════

type ViewMode = 'executive' | 'engineering' | 'print'

const VIEW_LABELS: Record<ViewMode, string> = {
  executive: 'Executive',
  engineering: 'Engineering',
  print: 'Print',
}

// ═══ Status / tone mappings ══════════════════════════════════════════════════

const healthTone: Record<HealthStatus, Tone> = {
  'on-target': 'green',
  'near-target': 'blue',
  watch: 'amber',
  action: 'amber',
  validate: 'blue',
  nodata: 'gray',
}

function HealthBadge({ status }: { status: HealthStatus }) {
  const tone = healthTone[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold',
        toneCard[tone],
        toneText[tone],
      )}
    >
      <span className={cn('size-1.5 rounded-full', toneDot[tone])} />
      {HEALTH_LABELS[status]}
    </span>
  )
}

const kpiBorder: Record<KpiTone, string> = {
  green: 'border-s-green-500',
  blue: 'border-s-blue-500',
  amber: 'border-s-amber-500',
  gray: 'border-s-muted-foreground/40',
  red: 'border-s-red-500',
}

// Country line colors — shared across charts.
const COUNTRY_COLORS: Record<string, string> = {
  hr: '#3b82f6',
  ba: '#f59e0b',
  si: '#8b5cf6',
  rs: '#14b8a6',
}
const COUNTRY_NAMES: Record<string, string> = { hr: 'HR', ba: 'BA', si: 'SI', rs: 'RS' }

const chartTooltipStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
}

// ═══ 2 · KPI Strip ═══════════════════════════════════════════════════════════

function KpiStrip() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 metric-card">
      {PI_KPIS.map((k) => (
        <div
          key={k.label}
          className={cn('rounded-xl border border-s-4 bg-card p-4 metric-card', kpiBorder[k.tone])}
        >
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{k.label}</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-foreground">{k.value}</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{k.secondary}</div>
        </div>
      ))}
    </div>
  )
}

// ═══ 3 · Executive narrative ═══════════════════════════════════════════════════

function NarrativeRow() {
  const blocks = [
    { title: 'What happened this week?', icon: Activity, body: PI_NARRATIVE.whatHappened },
    { title: 'Why does it matter?', icon: Scale, body: PI_NARRATIVE.whyItMatters },
    { title: 'What are we doing?', icon: Wrench, body: PI_NARRATIVE.whatWeAreDoing },
  ]
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
      {blocks.map((b) => (
        <div key={b.title} className="rounded-xl border border-border bg-card p-4 insight-card">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground">
            <b.icon className="size-4 text-indigo-500" /> {b.title}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{b.body}</p>
        </div>
      ))}
    </div>
  )
}

// ═══ 4 · Country Health Overview ═════════════════════════════════════════════

function CountryScorecards() {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      {PI_COUNTRIES.map((c) => (
        <div key={c.id} className="flex flex-col rounded-xl border border-border bg-card p-4 metric-card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-foreground">{c.name}</div>
              <div className="text-[11px] text-muted-foreground">{c.domain}</div>
            </div>
            <HealthBadge status={c.status} />
          </div>
          <dl className="mt-3 space-y-1.5 text-xs">
            {[
              ['App Start', `${c.appStart} · ${c.appStartDeltaPct > 0 ? '+' : ''}${c.appStartDeltaPct}%`],
              ['Network', c.network + (c.networkNote ? ` · ${c.networkNote}` : '')],
              ['Latency', c.latency],
              ['Crash-free', c.crashFree],
              ['Sample', `${c.samples} · confidence: ${c.confidence}`],
              ['Weekly direction', c.direction],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">{k}</dt>
                <dd className="text-end font-medium tabular-nums text-foreground/90">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-border/60 pt-2.5 text-xs leading-relaxed text-muted-foreground">
            {c.sentence}
          </p>
        </div>
      ))}
    </div>
  )
}

// ═══ 6 · Trend grafikleri ════════════════════════════════════════════════════

function ChartCard({
  title,
  foot,
  icon: Icon,
  children,
}: {
  title: string
  foot: string
  icon: typeof LineChartIcon
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 metric-card">
      <div className="mb-4 flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-indigo-500" />
        <div className="text-sm font-semibold leading-snug text-foreground">{title}</div>
      </div>
      {children}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{foot}</p>
    </div>
  )
}

function AppStartTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={PI_APP_START_TREND} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
        <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke="currentColor"
          opacity={0.5}
          domain={[0, 3]}
          tickFormatter={(v: number) => `${v}s`}
        />
        <RTooltip contentStyle={chartTooltipStyle} formatter={(v) => `${v} s`} />
        <ReferenceLine
          y={PI_APP_START_TARGET}
          stroke="#ef4444"
          strokeDasharray="6 4"
          label={{ value: 'Target 2.0 s', position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }}
        />
        {(['hr', 'ba', 'si', 'rs'] as const).map((id) => (
          <Line
            key={id}
            type="monotone"
            dataKey={id}
            name={COUNTRY_NAMES[id]}
            stroke={COUNTRY_COLORS[id]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function NetworkStabilityChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={PI_NETWORK_TREND} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
        <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
        <YAxis yAxisId="vol" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} tickFormatter={(v: number) => `${v}M`} />
        <YAxis
          yAxisId="pct"
          orientation="right"
          domain={[98, 100]}
          tick={{ fontSize: 12 }}
          stroke="currentColor"
          opacity={0.5}
          tickFormatter={(v: number) => `%${v}`}
        />
        {/* Latency in its own invisible axis — doesn't overlap with M and % axes */}
        <YAxis yAxisId="lat" hide domain={[400, 900]} />
        <RTooltip contentStyle={chartTooltipStyle} />
        <Bar yAxisId="vol" dataKey="volumeM" name="Volume (M requests)" fill="#6366f1" fillOpacity={0.25} radius={[4, 4, 0, 0]} />
        <Line yAxisId="pct" type="monotone" dataKey="successPct" name="Success %" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
        <Line yAxisId="lat" type="monotone" dataKey="latencyMs" name="P90 latency (ms)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function EndpointImpactChart() {
  const data = PI_ENDPOINT_IMPACT.map((e) => ({
    ...e,
    absChange: Math.min(Math.abs(e.changePct), 1200),
  }))
  const byCountry = (['hr', 'ba', 'si', 'rs'] as const).map((id) => ({
    id,
    rows: data.filter((d) => d.country.toLowerCase() === id),
  }))
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 8, right: 12, left: -6, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
        <XAxis
          type="number"
          dataKey="p90s"
          name="P90"
          tick={{ fontSize: 12 }}
          stroke="currentColor"
          opacity={0.5}
          tickFormatter={(v: number) => `${v}s`}
          domain={[0, 32]}
          label={{ value: 'P90 latency (s)', position: 'insideBottom', offset: -2, fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="volume"
          name="Volume"
          scale="log"
          domain={[100, 1000000]}
          tick={{ fontSize: 11 }}
          stroke="currentColor"
          opacity={0.5}
          tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}K` : `${v}`)}
        />
        <ZAxis type="number" dataKey="absChange" range={[60, 420]} name="Weekly change" />
        <RTooltip
          contentStyle={chartTooltipStyle}
          cursor={{ strokeDasharray: '3 3' }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as (typeof data)[number] | undefined
            if (!p) return null
            return (
              <div className="rounded-lg border border-border bg-background p-2.5 text-xs shadow-sm">
                <div className="font-semibold text-foreground">{p.name}</div>
                <div className="mt-1 space-y-0.5 text-muted-foreground">
                  <div>{p.country} · {p.flow}</div>
                  <div>P90 {p.p90s} s · volume {p.volume.toLocaleString('en-US')}</div>
                  <div>Weekly {p.changePct > 0 ? '+' : ''}{p.changePct}%</div>
                  <div>Confidence: {p.confidence === 'confirmed' ? 'high' : 'validation required'}</div>
                </div>
              </div>
            )
          }}
        />
        {byCountry.map(({ id, rows }) => (
          <Scatter key={id} name={COUNTRY_NAMES[id]} data={rows} fill={COUNTRY_COLORS[id]} fillOpacity={0.7} />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ═══ 7 · Experience Pillars ══════════════════════════════════════════════════

const pillarIcons = [Rocket, Network, Timer, Gauge]

function ExperiencePillars({ engineering }: { engineering: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
      {PI_PILLARS.map((p, i) => {
        const Icon = pillarIcons[i] ?? Gauge
        const metrics = engineering && p.engineeringMetrics ? [...p.metrics, ...p.engineeringMetrics] : p.metrics
        return (
          <div key={p.key} className="flex flex-col rounded-xl border border-border bg-card p-4 metric-card">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Icon className="size-4 text-indigo-500" /> {p.title}
              </div>
              <HealthBadge status={p.status} />
            </div>
            <dl className="mt-3 flex-1 space-y-1.5 text-xs">
              {metrics.map((m) => (
                <div key={m.label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{m.label}</dt>
                  <dd className="text-end font-medium text-foreground/90">{m.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-border/60 pt-2.5 text-xs leading-relaxed text-muted-foreground">
              {p.sentence}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ═══ 8 · Country Comparison ══════════════════════════════════════════════════

function CountryComparison() {
  return (
    <ComparisonTable
      headers={[
        { label: 'Country' },
        { label: 'App Start P90' },
        { label: 'Weekly' },
        { label: 'Network' },
        { label: 'Latency (>600 ms)' },
        { label: 'Crash-free' },
        { label: 'Sample' },
        { label: 'Status' },
      ]}
      rows={PI_COUNTRIES.map((c) => [
        <span key="n" className="font-semibold">{c.name} ({c.id.toUpperCase()})</span>,
        <span key="a" className={cn('font-semibold tabular-nums', c.status !== 'on-target' && 'text-amber-600 dark:text-amber-400')}>
          {c.appStart}
        </span>,
        <span key="d" className={cn('tabular-nums text-xs font-medium', c.appStartDeltaPct > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400')}>
          {c.appStartDeltaPct > 0 ? '+' : ''}{c.appStartDeltaPct}%
        </span>,
        c.network,
        c.latency.replace(' endpoint > 600 ms', ''),
        c.crashFree,
        <span key="s" className="inline-flex items-center gap-1.5">
          {c.samples}
          {c.confidence === 'Low' && (
            <Badge variant="secondary" appearance="outline" size="xs">low sample</Badge>
          )}
        </span>,
        <HealthBadge key="h" status={c.status} />,
      ])}
    />
  )
}

// ═══ 9 · Endpoint Priority Map ═══════════════════════════════════════════════

function PriorityEndpointTable({ engineering, print }: { engineering: boolean; print: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  const rows = engineering ? PI_PRIORITY_ENDPOINTS : PI_PRIORITY_ENDPOINTS.slice(0, 3)

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {['Endpoint', 'Flow', 'P90', 'Volume', 'Change', 'Business impact', 'Confidence', 'Recommended action'].map((h, i) => (
              <th
                key={h}
                className={cn(
                  'px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap',
                  i === 0 && 'sticky start-0 bg-muted/50 backdrop-blur',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => {
            const expanded = print || open === i
            return (
              <Fragment key={e.endpoint + e.country}>
                <tr
                  className={cn('border-b border-border/60 transition-colors hover:bg-muted/30', !print && 'cursor-pointer')}
                  onClick={() => !print && setOpen(open === i ? null : i)}
                >
                  <td className="sticky start-0 bg-card px-4 py-3 font-medium text-foreground">
                    <span className="flex items-center gap-1.5">
                      {!print && (expanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />)}
                      <code className="text-xs">{e.endpoint}</code>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{e.flow}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{e.p90}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">{e.volume}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">{e.change}</td>
                  <td className="px-4 py-3 text-xs">{e.businessImpact}</td>
                  <td className="px-4 py-3">
                    <EvidenceRef
                      level={e.confidence}
                      label={e.confidence === 'confirmed' ? 'High' : 'Medium'}
                      tooltip={e.detail.notes}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">{e.action}</td>
                </tr>
                {expanded && (
                  <tr className="border-b border-border/60 bg-muted/20">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
                        <div><span className="font-semibold text-foreground">Country distribution:</span> <span className="text-muted-foreground">{e.detail.countries}</span></div>
                        <div><span className="font-semibold text-foreground">Version:</span> <span className="text-muted-foreground">{e.detail.versions}</span></div>
                        <div className="my-1.5 h-px w-full bg-border" />
                        <div><span className="font-semibold text-foreground">Action status:</span> <span className="text-muted-foreground">{e.detail.actionStatus}</span></div>
                        <div><span className="font-semibold text-foreground">Note:</span> <span className="text-muted-foreground">{e.detail.actionNote}</span></div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {!engineering && (
        <div className="border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          First 3 priorities shown — full list in Engineering view.
        </div>
      )}
    </div>
  )
}

// ═══ 10 · Metric → Action Flow ═══════════════════════════════════════════════

const FLOW_STEPS = ['Signal', 'Validation', 'Probable user impact', 'Action', 'Success criteria'] as const
const flowStepTones: Tone[] = ['indigo', 'blue', 'amber', 'teal', 'green']

function MetricFlows() {
  return (
    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
      {PI_METRIC_FLOWS.map((f) => {
        const values = [f.signal, f.validation, f.impact, f.action, f.successCriteria]
        return (
          <div key={f.signal} className="rounded-xl border border-border bg-card p-4 insight-card">
            {FLOW_STEPS.map((step, i) => {
              const stepTone = flowStepTones[i] ?? 'gray'
              return (
              <Fragment key={step}>
                <div className={cn('rounded-lg border p-2.5', toneCard[stepTone])}>
                  <div className={cn('text-[10px] font-bold uppercase tracking-[0.15em]', toneText[stepTone])}>
                    {step}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-foreground/90">{values[i]}</div>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowDown className="size-3.5 text-muted-foreground/50" />
                  </div>
                )}
              </Fragment>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ═══ 11 · Key Findings ═══════════════════════════════════════════════════════

function KeyFindings() {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {PI_FINDINGS.map((f) => (
        <div key={f.title} className="flex flex-col rounded-xl border border-border bg-card p-4 insight-card">
          <div className="text-sm font-bold text-foreground">{f.title}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{f.scope}</div>
          <p className="mt-2 text-xs leading-relaxed text-foreground/85">{f.body}</p>
          <div className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground border-l-2 border-indigo-500/30 pl-2 ml-1">
            <span className="font-semibold text-foreground/80">Comment:</span> {f.analystComment}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
            <EvidenceRef
              level={f.level}
              label={f.level === 'confirmed' ? 'High confidence' : 'Validation needed'}
              tooltip={f.evidence}
            />
            <span className="text-[11px] text-muted-foreground">{f.evidence}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══ 12 · Action Tracker ═════════════════════════════════════════════════════

const priorityTone: Record<PiAction['priority'], string> = {
  P1: 'text-red-600 dark:text-red-400',
  P2: 'text-orange-600 dark:text-orange-400',
  P3: 'text-muted-foreground',
}

function ActionCard({ a }: { a: PiAction }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 insight-card">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold leading-snug text-foreground">{a.title}</div>
        <Badge variant="secondary" appearance="outline" size="xs" className={priorityTone[a.priority]}>
          {a.priority}
        </Badge>
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        <div className="text-[11px] text-muted-foreground">owner: {a.owner} · deadline: {a.deadline}</div>
        <div className="text-[11px] text-muted-foreground mt-1"><span className="font-medium text-foreground/80">Expected:</span> {a.expectedResult}</div>
      </div>
      <div className="mt-2">
        <EvidenceRef level={a.level} label={a.evidence} />
      </div>
    </div>
  )
}

function ActionTracker({ print }: { print: boolean }) {
  if (print) {
    return (
      <ComparisonTable
        headers={[
          { label: 'Priority' },
          { label: 'Action' },
          { label: 'Owner' },
          { label: 'Deadline' },
          { label: 'Country' },
          { label: 'Success criteria' },
          { label: 'Status' },
        ]}
        rows={PI_ACTIONS.map((a) => [
          <span key="p" className={cn('font-bold', priorityTone[a.priority])}>{a.priority}</span>,
          a.title,
          a.owner,
          a.due,
          a.countries,
          <span key="e" className="text-xs">{a.expected}</span>,
          PI_ACTION_COLUMNS.find((c) => c.key === a.column)?.label ?? a.column,
        ])}
      />
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
      {PI_ACTION_COLUMNS.map((col) => {
        const items = PI_ACTIONS.filter((a) => a.column === col.key)
        return (
          <div key={col.key} className={cn('rounded-xl border p-3', toneCard[col.tone])}>
            <div className={cn('mb-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide', toneText[col.tone])}>
              {col.label}
              <span className="rounded-full bg-background/70 px-2 py-0.5 tabular-nums">{items.length}</span>
            </div>
            <div className="space-y-2.5">
              {items.map((a) => <ActionCard key={a.title} a={a} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══ 13 · Timeline ═══════════════════════════════════════════════════════════

const tagTone: Record<string, Tone> = {
  Release: 'blue',
  Config: 'teal',
  Incident: 'red',
  'Metric anomaly': 'amber',
  'Monitoring change': 'gray',
}

// ═══ Engineering · country detail ═══════════════════════════════════════════════

function CountryEngineeringDetail({ r }: { r: CountryPerfReport }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
          <Globe className="size-4" /> {r.country} · {r.domain}
          <Badge variant="secondary" appearance="outline" size="xs">{r.window}</Badge>
          <Badge variant="secondary" appearance="outline" size="xs">{r.period}</Badge>
        </div>
        <div className="mt-1.5 text-sm font-semibold text-foreground">{r.headline}</div>
        <div className="text-xs text-muted-foreground mb-4">
          Data: {r.stats.volPct} share · {r.stats.userCount} users · {r.stats.sessionCount} sessions
          {r.appStart.lowSample && ' · low sample'}
        </div>
        {r.appStart.spikeNote && <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">{r.appStart.spikeNote}</div>}
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {r.customTraces.map((t) => (
          <div key={t.name} className="rounded-xl border border-border bg-card p-3.5 metric-card">
            <code className="text-xs text-muted-foreground">{t.name}</code>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold tabular-nums text-foreground">{t.value}</span>
              <span className="text-xs font-semibold text-muted-foreground">{t.delta}</span>
            </div>
          </div>
        ))}
      </div>

      <ComparisonTable
        headers={[{ label: 'Endpoint' }, { label: 'Response (P90)' }, { label: 'Success' }, { label: 'Volume' }, { label: 'Note' }]}
        rows={r.topEndpoints.map((e) => [
          <code key="n" className="text-xs">{e.name}</code>,
          <span key="r" className="font-semibold tabular-nums">{e.responseP90}</span>,
          e.success,
          e.volume ?? '—',
          <span
            key="x"
            className={cn(
              'text-xs',
              e.regression === true
                ? 'text-amber-600 dark:text-amber-400'
                : e.regression === false
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-muted-foreground',
            )}
          >
            {e.note ?? '—'}
          </span>,
        ])}
      />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 insight-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <FileSearch className="size-4 text-indigo-500" /> Observations
          </div>
          <ul className="space-y-1.5 text-xs text-foreground/85">
            {r.findings.map((f) => (
              <li key={f} className="flex gap-1.5">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-indigo-500" />
                <span className="leading-relaxed">{f}</span>
              </li>
            ))}
            {r.crashlytics && (
              <li className="flex gap-1.5">
                <Bug className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                <span className="leading-relaxed">{r.crashlytics}</span>
              </li>
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 insight-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <ListChecks className="size-4 text-indigo-500" /> Recommendations
          </div>
          <ul className="space-y-1.5">
            {r.recommendations.map((rec) => (
              <li key={rec.text} className="flex items-start gap-2 text-xs">
                <Badge variant="secondary" appearance="outline" size="xs" className={priorityTone[rec.priority]}>
                  {rec.priority}
                </Badge>
                <span className="leading-relaxed text-foreground/85">{rec.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ═══ Sayfa ═══════════════════════════════════════════════════════════════════

export default function PerformanceIntelligencePage() {
  const [view, setView] = useState<ViewMode>('executive')
  const engineering = view !== 'executive'
  const print = view === 'print'

  return (
    <ProductPage path="/engineering/performance">
      {/* ─── View toggle ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 print-hidden">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors',
                view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        {print && (
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print (A4)
          </Button>
        )}
      </div>

      {/* ─── Slide 1 · Executive summary (brief + KPI + narrative) ───────────── */}
      <div data-pdf-slide className="space-y-8">
      {/* ─── 1 · Executive Brief ───────────────────────────────────────── */}
      <div className="report-section">
        <HeroCallout
          icon={Gauge}
          eyebrow="Reliability & Operations"
          tone="indigo"
          title={PI_BRIEF.headline}
          lead={PI_BRIEF.summary}
          chips={[
            `Period: ${PI_META.periodRange}`,
            `Source: ${PI_META.source}`,
            `Mode: ${view.toUpperCase()}`,
            `Last data: ${PI_META.dataTimestamp}`,
            `Environment: ${PI_META.environment}`,
            `Data confidence: ${PI_META.confidence}`,
          ]}
        >
          <div className={cn('rounded-xl border p-4 lg:min-w-72', toneCard[PI_BRIEF.overallTone])}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Overall status</div>
            <div className={cn('mt-1 text-lg font-bold', toneText[PI_BRIEF.overallTone])}>{PI_BRIEF.overallStatus}</div>
            <ul className="mt-2.5 space-y-1 text-xs text-foreground/85">
              {PI_BRIEF.statusBullets.map((b) => (
                <li key={b} className="flex items-start gap-1.5">
                  <span className={cn('mt-[6px] size-1 shrink-0 rounded-full', toneDot[PI_BRIEF.overallTone])} />
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </HeroCallout>
      </div>

      {/* ─── 2 · KPI Strip ─────────────────────────────────────────────── */}
      <div className="report-section"><KpiStrip /></div>

      {/* ─── 3 · Executive narrative ─────────────────────────────────────── */}
      <div className="report-section"><NarrativeRow /></div>
      </div>

      {/* ─── Slide 2 · Country Health Overview ─────────────────────────── */}
      <PageSection
        slide
        eyebrow="Country Health"
        title="Country health overview"
        icon={MapPin}
        tone="blue"
        className="report-section"
        description="Comparable scorecards of four countries. Status labels don't carry incident language; unverified signals are marked separately."
      >
        <CountryScorecards />
      </PageSection>

      {/* ─── Slide 3 · Performance Trends ──────────────────────────────── */}
      <PageSection
        slide
        eyebrow="Trends"
        title="Performance trends"
        icon={TrendingUp}
        tone="indigo"
        className="report-section print-page-break"
        description="A single weekly value doesn't describe the trend — the 6-week direction, target line and volume context should be read together."
      >
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          <ChartCard icon={LineChartIcon} title={PI_TREND_NOTES.appStartTitle} foot={PI_TREND_NOTES.appStartFoot}>
            <AppStartTrendChart />
          </ChartCard>
          <ChartCard icon={BarChart3} title={PI_TREND_NOTES.networkTitle} foot={PI_TREND_NOTES.networkFoot}>
            <NetworkStabilityChart />
          </ChartCard>
        </div>
        <ChartCard icon={ScatterChartIcon} title={PI_TREND_NOTES.scatterTitle} foot={PI_TREND_NOTES.scatterFoot}>
          <EndpointImpactChart />
        </ChartCard>
      </PageSection>

      {/* ─── Slide 4 · Experience Pillars ──────────────────────────────── */}
      <PageSection
        slide
        eyebrow="Experience Pillars"
        title="Experience pillars"
        icon={Smartphone}
        tone="teal"
        className="report-section"
        description="Four main performance areas — status, base metrics and natural language comment in each card."
      >
        <ExperiencePillars engineering={engineering} />
      </PageSection>

      {/* ─── Slide 5 · Country Comparison ──────────────────────────────── */}
      <PageSection
        slide
        eyebrow="Comparison"
        title="Country comparison"
        icon={BarChart3}
        tone="blue"
        className="report-section print-page-break"
        description="HR and RS meet the start target. Since the measurement volume is limited for BA and SI, change percentages should be interpreted carefully."
      >
        <CountryComparison />
      </PageSection>

      {/* ─── Slide 6 · Endpoint Priority Map ───────────────────────────── */}
      <PageSection
        slide
        eyebrow="Priority Map"
        title="Endpoint priority map"
        icon={Server}
        tone="orange"
        className="report-section"
        description="The order is not based solely on latency; it relies on the combination of business criticality, volume, deviation, and regression confidence. Clicking the row opens the rationale."
      >
        <PriorityEndpointTable engineering={engineering} print={print} />
      </PageSection>

      {/* ─── Slide 7 · Metric → Action ─────────────────────────────────── */}
      <PageSection
        slide
        eyebrow="Metric to Action"
        title="Metric to action"
        icon={Activity}
        tone="indigo"
        className="report-section"
        description="For every critical finding: signal → validation → probable user impact → action → success criteria."
      >
        <MetricFlows />
      </PageSection>

      {/* ─── Slide 8 · Key Findings ────────────────────────────────────── */}
      <PageSection
        slide
        eyebrow="Key Findings"
        title="Key findings"
        icon={Microscope}
        tone="purple"
        className="report-section print-page-break"
        description="Every finding is presented with scope, confidence level and evidence reference."
      >
        <KeyFindings />
      </PageSection>

      {/* ─── Slide 9 · Action Tracker ──────────────────────────────────── */}
      <PageSection
        slide
        eyebrow="Action Tracker"
        title="Action tracker"
        icon={Kanban}
        tone="indigo"
        className="report-section"
        description="Not a recommendation list, a manageable action area: owner, deadline, expected result and evidence."
      >
        <ActionTracker print={print} />
      </PageSection>

      {/* ─── Slide 10 · Engineering · country details ───────────────────── */}
      {engineering && (
        <PageSection
          slide
          eyebrow="Engineering"
          title="Country details"
          icon={Map}
          tone="indigo"
          className="report-section print-page-break"
          description="Custom traces, riskiest endpoints, version breakdown and country-based recommendations."
        >
          {print ? (
            <div className="space-y-8">
              {PERF_REPORTS.map((r) => <CountryEngineeringDetail key={r.id} r={r} />)}
            </div>
          ) : (
            <SegmentTabs
              items={PERF_REPORTS.map((r) => ({
                value: r.id,
                label: `${r.country} · ${r.id.toUpperCase()}`,
                icon: Activity,
                content: <CountryEngineeringDetail r={r} />,
              }))}
            />
          )}
        </PageSection>
      )}

      {/* ─── Slide 11 · Change Timeline ────────────────────────────────── */}
      <PageSection
        slide
        eyebrow="Timeline"
        title="Change timeline"
        icon={GitCommitVertical}
        tone="gray"
        className="report-section"
        description="Shows release and anomaly correlation; does not claim causality."
      >
        <Timeline
          items={PI_TIMELINE.map((t) => ({
            period: t.date,
            title: t.title,
            desc: t.desc,
            tone: tagTone[t.tag] ?? 'blue',
            badges: [t.tag],
          }))}
        />
      </PageSection>

      {/* ─── Slide 12 · Guardrails ─────────────────────────────────────── */}
      <PageSection
        slide
        eyebrow="Guardrails"
        title="How should the numbers be read?"
        icon={ShieldQuestion}
        tone="indigo"
        className="report-section"
      >
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {PI_GUARDRAILS.map((g) => (
            <GuardrailCallout key={g.title} title={g.title} tone="amber" icon={AlertTriangle} className="insight-card">
              {g.body}
            </GuardrailCallout>
          ))}
        </div>
      </PageSection>

      {/* ─── Slide 13 · Evidence & Data Quality ────────────────────────── */}
      <PageSection
        slide
        eyebrow="Evidence & Data Quality"
        title="Evidence and data quality"
        icon={ShieldCheck}
        tone="green"
        className="report-section print-page-break"
        description="Every comment carries an evidence label. The label's color shows the strength of the evidence, the text shows the need for validation."
      >
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div className={cn('rounded-xl border p-4 insight-card', toneCard.green)}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
              <span className={cn('text-xs font-bold uppercase tracking-wide', toneText.green)}>Evidence · High confidence</span>
            </div>
            <ul className="mt-2.5 space-y-1 text-xs text-foreground/85">
              {PI_EVIDENCE_RULES.strong.map((s) => (
                <li key={s} className="flex items-start gap-1.5">
                  <span className="mt-[6px] size-1 shrink-0 rounded-full bg-green-600" />
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg bg-background/60 p-2 font-mono text-[11px] text-muted-foreground">
              Evidence · High confidence<br />Firebase Performance · 31K requests · 4 countries
            </div>
          </div>
          <div className={cn('rounded-xl border p-4 insight-card', toneCard.amber)}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              <span className={cn('text-xs font-bold uppercase tracking-wide', toneText.amber)}>Evidence · Validation needed</span>
            </div>
            <ul className="mt-2.5 space-y-1 text-xs text-foreground/85">
              {PI_EVIDENCE_RULES.weak.map((s) => (
                <li key={s} className="flex items-start gap-1.5">
                  <span className="mt-[6px] size-1 shrink-0 rounded-full bg-amber-500" />
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg bg-background/60 p-2 font-mono text-[11px] text-muted-foreground">
              Evidence · Validation needed<br />318 app starts · single-week observation
            </div>
          </div>
        </div>

        {engineering && (
          <ComparisonTable
            headers={[
              { label: 'Country' },
              { label: 'App start sample' },
              { label: 'Network volume' },
              { label: 'Rendering' },
              { label: 'Crash data' },
              { label: 'Confidence' },
            ]}
            rows={PI_DATA_QUALITY.map((d) => [
              d.country,
              d.appStartSamples,
              d.networkVolume,
              d.rendering,
              d.crash,
              <Badge
                key="c"
                variant="secondary"
                appearance="outline"
                size="xs"
                className={d.confidence === 'High' ? 'text-green-600 dark:text-green-400' : d.confidence === 'Low' ? 'text-amber-600 dark:text-amber-400' : ''}
              >
                {d.confidence}
              </Badge>,
            ])}
          />
        )}
      </PageSection>

      {/* ─── Slayt 14 · Metodoloji / rapor ritmi ───────────────────────── */}
      <div data-pdf-slide>
      <Callout icon={ClipboardList} title="Metodoloji ve rapor ritmi" tone="indigo" className="report-section">
        Source: {PI_META.source} · {PI_META.period}. All values {PI_META.percentile}, {PI_META.environment} environment.
        Targets: app start {PERF_TARGETS.appStart} · success {PERF_TARGETS.networkSuccess} · {PERF_TARGETS.latencyThreshold}.
        Reports are produced weekly by the Performance Team; when new week data arrives{' '}
        <code>src/data/engineering/performance.ts</code> and <code>performance-intelligence.ts</code> is updated.
      </Callout>
      </div>

      <Callout icon={Info} tone="gray" className="report-section print-hidden">
        This page is a single continuous report: Executive view shows the executive summary, Engineering view shows all endpoint and
        data quality details. Print view opens all sections and is arranged for A4 portrait output.
      </Callout>
    </ProductPage>
  )
}
