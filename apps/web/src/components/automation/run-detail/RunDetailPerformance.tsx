'use client'

import type { ReactNode } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, Clock3, Gauge, MemoryStick, RadioTower } from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { cn } from '@nesy/metronic/lib/utils'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@nesy/metronic/components/ui/chart'
import { StatCard, StatGrid } from '@/components/product/stats'
import { Timeline, type TimelineItem } from '@/components/product/timeline'
import {
  formatBytes,
  formatDuration,
  type RunDetailViewModel,
} from '@/lib/verdict-runtime/run-detail-view-model'

const memoryConfig = {
  heapUsedMb: { label: 'Heap used', color: '#2563eb' },
  heapCommittedMb: { label: 'Heap committed', color: '#7c3aed' },
  nativeMb: { label: 'Native', color: '#f97316' },
} satisfies ChartConfig

const latencyConfig = {
  durationMs: { label: 'Latency', color: '#2563eb' },
} satisfies ChartConfig

const spanConfig = {
  durationMs: { label: 'Duration', color: '#7c3aed' },
} satisfies ChartConfig

const throughputConfig = {
  count: { label: 'Events', color: '#0d9488' },
} satisfies ChartConfig

const CHART_MARGIN = { left: 0, right: 8, top: 12, bottom: 0 }

export function RunDetailPerformance({ view }: { view: RunDetailViewModel }) {
  const { memory, http, spans, throughput, incidents } = view.charts
  const memoryData = memory.map((sample, index) => ({
    atMs: sample.atMs ?? index,
    heapUsedMb: toMb(sample.heapUsedBytes),
    heapCommittedMb: toMb(sample.heapCommittedBytes),
    heapMaxMb: toMb(sample.heapMaxBytes),
    nativeMb: toMb(sample.nativeAllocatedBytes),
  }))
  const memoryPeakMb = maxFinite(
    memoryData.flatMap((item) => [item.heapUsedMb, item.heapCommittedMb, item.nativeMb]),
  )
  const heapCapMb = maxFinite(memoryData.map((item) => item.heapMaxMb))
  const memoryYMax = Math.max(8, Math.ceil((memoryPeakMb ?? 8) * 1.2))

  const httpData = http.flatMap((call, index) =>
    call.durationMs === null
      ? []
      : [{
          atMs: call.atMs ?? index,
          durationMs: call.durationMs,
          label: `${call.method ?? 'HTTP'} ${call.path ?? call.host ?? 'request'}`,
          failed: call.success === false,
        }],
  )
  const latencies = httpData.map((call) => call.durationMs)
  const p50 = latencies.length === 0 ? null : percentile(latencies, 0.5)
  const p95 = latencies.length === 0 ? null : percentile(latencies, 0.95)
  const httpYMax = Math.max(100, Math.ceil((maxFinite(latencies) ?? 100) * 1.15))
  const httpFailures = http.filter((call) => call.success === false).length

  const spanData = spans.slice(0, 16).map((span) => ({
    ...span,
    shortName: truncate(span.name, 22),
    tone: spanTone(span.status),
  }))
  const spanXMax = Math.max(50, Math.ceil((maxFinite(spanData.map((s) => s.durationMs)) ?? 50) * 1.1))

  const throughputPeak = maxFinite(throughput.map((bucket) => bucket.count)) ?? 1

  const incidentItems: TimelineItem[] = incidents.map((incident) => ({
    period: incident.atMs === null ? 'UNAVAILABLE' : formatDuration(incident.atMs),
    title: incident.event.replaceAll('_', ' '),
    desc: [incident.screen, incident.operation].filter(Boolean).join(' · ') || 'Runtime incident',
    icon: AlertTriangle,
    tone: incident.severity === 'warning' ? 'amber' : 'red',
    status: 'done',
    badges: [incident.severity.toUpperCase()],
  }))

  return (
    <div className="space-y-4">
      <ChartPanel
        title="Memory trend"
        meta={
          memoryData.length === 0
            ? 'No samples'
            : `${memoryData.length} samples · peak ${formatBytes(Math.max(...memory.map((s) => s.peakBytes)))}`
        }
        icon={MemoryStick}
        measured={memoryData.length > 0}
        emptyMessage="No memory samples were captured."
      >
        <ChartContainer
          config={memoryConfig}
          className="h-[220px] w-full min-h-0 [&_.recharts-responsive-container]:!h-full"
          role="img"
          aria-label={`Memory trend with ${memoryData.length} samples.`}
        >
          <ComposedChart data={memoryData} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="heapUsedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-heapUsedMb)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-heapUsedMb)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
            <XAxis
              dataKey="atMs"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatAxisTime}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[0, memoryYMax]}
              tickFormatter={(value) => `${value}`}
              unit=" MB"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatAxisTime(Number(value))}
                  formatter={(value, name) => [`${value} MB`, String(name)]}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {heapCapMb !== null ? (
              <ReferenceLine
                y={heapCapMb * 0.85}
                stroke="#dc2626"
                strokeDasharray="4 4"
                strokeOpacity={0.8}
                label={{
                  value: `85% of ${heapCapMb.toFixed(0)} MB cap`,
                  position: 'insideTopRight',
                  fill: '#dc2626',
                  fontSize: 10,
                }}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="heapUsedMb"
              stroke="var(--color-heapUsedMb)"
              strokeWidth={2}
              fill="url(#heapUsedGradient)"
              connectNulls
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="heapCommittedMb"
              stroke="var(--color-heapCommittedMb)"
              strokeWidth={1.75}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="nativeMb"
              stroke="var(--color-nativeMb)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ChartContainer>
      </ChartPanel>

      <section className="space-y-2.5" aria-labelledby="http-performance">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="http-performance" className="text-sm font-semibold text-foreground">HTTP performance</h2>
          {http.length > 0 ? (
            <span className="text-[11px] text-muted-foreground">{http.length} requests observed</span>
          ) : null}
        </div>
        <StatGrid cols={3} dense>
          <StatCard
            variant="compact"
            label="p50 latency"
            value={p50 === null ? '—' : `${p50} ms`}
            hint="Median observed request latency"
            icon={Clock3}
            tone={p50 === null ? 'gray' : 'blue'}
          />
          <StatCard
            variant="compact"
            label="p95 latency"
            value={p95 === null ? '—' : `${p95} ms`}
            hint="Tail request latency"
            icon={Gauge}
            tone={p95 === null ? 'gray' : 'purple'}
          />
          <StatCard
            variant="compact"
            label="Error rate"
            value={http.length === 0 ? '—' : `${((httpFailures / http.length) * 100).toFixed(1)}%`}
            hint={http.length === 0 ? 'No HTTP outcomes captured' : `${httpFailures} failed of ${http.length}`}
            icon={AlertTriangle}
            tone={http.length === 0 ? 'gray' : httpFailures > 0 ? 'red' : 'green'}
          />
        </StatGrid>

        <ChartPanel
          title="HTTP latency"
          meta={httpData.length === 0 ? 'No timed calls' : `${httpData.length} timed calls`}
          icon={Clock3}
          measured={httpData.length > 0}
          emptyMessage="No timed HTTP calls were captured."
        >
          <ChartContainer
            config={latencyConfig}
            className="h-[220px] w-full min-h-0 [&_.recharts-responsive-container]:!h-full"
            role="img"
            aria-label={`HTTP latency timeline for ${httpData.length} timed calls.`}
          >
            <ComposedChart data={httpData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-durationMs)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-durationMs)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis
                dataKey="atMs"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={28}
                tickFormatter={formatAxisTime}
              />
              <YAxis
                width={48}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                domain={[0, httpYMax]}
                unit=" ms"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const row = payload[0]?.payload as { label?: string; atMs?: number } | undefined
                      return row?.label ?? formatAxisTime(Number(row?.atMs ?? 0))
                    }}
                    formatter={(value) => [`${value} ms`, 'Latency']}
                  />
                }
              />
              {p50 !== null ? (
                <ReferenceLine
                  y={p50}
                  stroke="#2563eb"
                  strokeDasharray="5 4"
                  strokeOpacity={0.65}
                  label={{ value: `p50 ${p50}ms`, fill: '#2563eb', fontSize: 10, position: 'insideTopLeft' }}
                />
              ) : null}
              {p95 !== null ? (
                <ReferenceLine
                  y={p95}
                  stroke="#7c3aed"
                  strokeDasharray="5 4"
                  strokeOpacity={0.65}
                  label={{ value: `p95 ${p95}ms`, fill: '#7c3aed', fontSize: 10, position: 'insideTopRight' }}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="durationMs"
                stroke="var(--color-durationMs)"
                strokeWidth={2}
                fill="url(#latencyGradient)"
                dot={(props) => {
                  const { cx, cy, payload } = props as {
                    cx?: number
                    cy?: number
                    payload?: { failed?: boolean }
                  }
                  if (cx === undefined || cy === undefined) return null
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={payload?.failed ? 3.5 : 2}
                      fill={payload?.failed ? '#dc2626' : 'var(--color-durationMs)'}
                      stroke={payload?.failed ? '#fff' : 'none'}
                      strokeWidth={1}
                    />
                  )
                }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ChartContainer>
        </ChartPanel>
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Span durations"
          meta={spans.length === 0 ? 'No spans' : `${Math.min(spans.length, 16)} of ${spans.length} spans`}
          icon={Gauge}
          measured={spanData.length > 0}
          emptyMessage="No execution spans were persisted."
        >
          <ChartContainer
            config={spanConfig}
            className="h-[260px] w-full min-h-0 [&_.recharts-responsive-container]:!h-full"
            role="img"
            aria-label={`Bar chart of ${spanData.length} execution span durations.`}
          >
            <BarChart data={spanData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis
                type="number"
                domain={[0, spanXMax]}
                tickLine={false}
                axisLine={false}
                unit=" ms"
              />
              <YAxis
                dataKey="shortName"
                type="category"
                width={108}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => String(payload[0]?.payload?.name ?? 'Span')}
                    formatter={(value) => [`${value} ms`, 'Duration']}
                  />
                }
              />
              <Bar dataKey="durationMs" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {spanData.map((entry) => (
                  <Cell key={entry.name} fill={entry.tone} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </ChartPanel>

        <ChartPanel
          title="Event throughput"
          meta={throughput.length === 0 ? 'No buckets' : `${throughput.length} × 5s buckets · peak ${throughputPeak}`}
          icon={RadioTower}
          measured={throughput.length > 0}
          emptyMessage="No event buckets were measured."
        >
          <ChartContainer
            config={throughputConfig}
            className="h-[260px] w-full min-h-0 [&_.recharts-responsive-container]:!h-full"
            role="img"
            aria-label={`Event throughput across ${throughput.length} buckets.`}
          >
            <ComposedChart data={throughput} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis
                dataKey="startMs"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={28}
                tickFormatter={formatAxisTime}
              />
              <YAxis
                width={36}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
                domain={[0, Math.ceil(throughputPeak * 1.15)]}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatAxisTime(Number(value))}
                    formatter={(value) => [String(value), 'Events / 5s']}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-count)"
                strokeWidth={2}
                fill="url(#throughputGradient)"
                dot={{ r: 2, fill: 'var(--color-count)' }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ChartContainer>
        </ChartPanel>
      </div>

      <section className="space-y-2.5" aria-labelledby="incident-timeline">
        <div className="flex items-center justify-between gap-2">
          <h2 id="incident-timeline" className="text-sm font-semibold text-foreground">Incident timeline</h2>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold">
            {incidents.length || '—'}
          </Badge>
        </div>
        {incidentItems.length > 0 ? (
          <Timeline items={incidentItems} />
        ) : (
          <EmptyChart message="No incident telemetry was measured." />
        )}
      </section>
    </div>
  )
}

function ChartPanel({
  title,
  meta,
  measured,
  icon: Icon,
  emptyMessage,
  children,
}: {
  title: string
  meta: string
  measured: boolean
  icon: typeof Gauge
  emptyMessage: string
  children: ReactNode
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
          <h2 className="truncate text-xs font-semibold text-foreground">{title}</h2>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">{meta}</span>
      </div>
      <div className="p-3 pt-2">
        {measured ? children : <EmptyChart message={emptyMessage} />}
      </div>
    </section>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex min-h-[140px] items-center justify-center rounded-md border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-center">
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

function toMb(value: number | null): number | null {
  return value === null ? null : Number((value / (1024 * 1024)).toFixed(2))
}

function formatAxisTime(value: number): string {
  return formatDuration(value)
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  return Math.round(sorted[index] ?? 0)
}

function maxFinite(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (nums.length === 0) return null
  return Math.max(...nums)
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

function spanTone(status: string | null): string {
  const key = (status ?? '').toUpperCase()
  if (key.includes('FAIL') || key.includes('ERROR')) return '#dc2626'
  if (key.includes('RUN') || key.includes('ACTIVE')) return '#2563eb'
  if (key.includes('OK') || key.includes('PASS') || key.includes('DONE')) return '#16a34a'
  return '#7c3aed'
}
