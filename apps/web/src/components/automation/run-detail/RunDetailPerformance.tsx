'use client'

import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, Clock3, Gauge, MemoryStick, RadioTower } from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  ChartContainer,
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
  heapMaxMb: { label: 'Heap max', color: '#64748b' },
  nativeMb: { label: 'Native', color: '#f97316' },
} satisfies ChartConfig

const latencyConfig = {
  durationMs: { label: 'HTTP latency', color: '#2563eb' },
} satisfies ChartConfig

const spanConfig = {
  durationMs: { label: 'Span duration', color: '#7c3aed' },
} satisfies ChartConfig

const throughputConfig = {
  count: { label: 'Events', color: '#0d9488' },
} satisfies ChartConfig

export function RunDetailPerformance({ view }: { view: RunDetailViewModel }) {
  const { memory, http, spans, throughput, incidents } = view.charts
  const memoryData = memory.map((sample, index) => ({
    atMs: sample.atMs ?? index,
    heapUsedMb: toMb(sample.heapUsedBytes),
    heapCommittedMb: toMb(sample.heapCommittedBytes),
    heapMaxMb: toMb(sample.heapMaxBytes),
    nativeMb: toMb(sample.nativeAllocatedBytes),
  }))
  const maxHeapMb = memoryData.reduce<number | null>(
    (maximum, item) =>
      item.heapMaxMb === null ? maximum : Math.max(maximum ?? 0, item.heapMaxMb),
    null,
  )
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
  const httpFailures = http.filter((call) => call.success === false).length
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
    <div className="space-y-6">
      <ChartCard
        title="Memory trend"
        description={
          memoryData.length === 0
            ? 'No memory samples were captured.'
            : `${memoryData.length} samples; peak observed memory ${formatBytes(
                Math.max(...memory.map((sample) => sample.peakBytes)),
              )}.`
        }
        measured={memoryData.length > 0}
        icon={MemoryStick}
      >
        <ChartContainer
          config={memoryConfig}
          className="h-[18rem] w-full"
          role="img"
          aria-label={`Memory trend with ${memoryData.length} samples showing heap used, committed, max and native memory in megabytes.`}
        >
          <LineChart data={memoryData} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="atMs" tickFormatter={formatAxisTime} minTickGap={28} />
            <YAxis width={48} unit=" MB" />
            <ChartTooltip content={<ChartTooltipContent />} />
            {maxHeapMb !== null ? (
              <ReferenceLine
                y={maxHeapMb * 0.85}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{ value: '85% max', fill: '#dc2626', fontSize: 10 }}
              />
            ) : null}
            <Line type="monotone" dataKey="heapUsedMb" stroke="var(--color-heapUsedMb)" dot={false} connectNulls />
            <Line type="monotone" dataKey="heapCommittedMb" stroke="var(--color-heapCommittedMb)" dot={false} connectNulls />
            <Line type="monotone" dataKey="heapMaxMb" stroke="var(--color-heapMaxMb)" dot={false} connectNulls />
            <Line type="monotone" dataKey="nativeMb" stroke="var(--color-nativeMb)" dot={false} connectNulls />
          </LineChart>
        </ChartContainer>
      </ChartCard>

      <section className="space-y-3" aria-labelledby="http-performance">
        <div>
          <h2 id="http-performance" className="text-base font-semibold">HTTP performance</h2>
          <p className="text-xs text-muted-foreground">Latency and outcome measurements from SDK HTTP events.</p>
        </div>
        <StatGrid cols={3}>
          <StatCard
            label="p50 latency"
            value={latencies.length === 0 ? 'NOT_MEASURED' : `${percentile(latencies, 0.5)} ms`}
            hint="Median observed request latency"
            icon={Clock3}
            tone={latencies.length === 0 ? 'gray' : 'blue'}
          />
          <StatCard
            label="p95 latency"
            value={latencies.length === 0 ? 'NOT_MEASURED' : `${percentile(latencies, 0.95)} ms`}
            hint="Tail request latency"
            icon={Gauge}
            tone={latencies.length === 0 ? 'gray' : 'purple'}
          />
          <StatCard
            label="Error rate"
            value={http.length === 0 ? 'NOT_MEASURED' : `${((httpFailures / http.length) * 100).toFixed(1)}%`}
            hint={http.length === 0 ? 'No HTTP outcomes captured' : `${httpFailures} failed of ${http.length}`}
            icon={AlertTriangle}
            tone={http.length === 0 ? 'gray' : httpFailures > 0 ? 'red' : 'green'}
          />
        </StatGrid>
        <ChartCard
          title="HTTP latency timeline"
          description={httpData.length === 0 ? 'No timed HTTP calls were captured.' : `${httpData.length} timed calls were observed.`}
          measured={httpData.length > 0}
          icon={Clock3}
        >
          <ChartContainer
            config={latencyConfig}
            className="h-[16rem] w-full"
            role="img"
            aria-label={`HTTP latency timeline for ${httpData.length} timed calls in milliseconds.`}
          >
            <LineChart data={httpData} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="atMs" tickFormatter={formatAxisTime} />
              <YAxis width={52} unit=" ms" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="durationMs" stroke="var(--color-durationMs)" dot />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <ChartCard
          title="Span durations"
          description={spans.length === 0 ? 'No execution spans were persisted.' : `${spans.length} execution spans.`}
          measured={spans.length > 0}
          icon={Gauge}
        >
          <ChartContainer
            config={spanConfig}
            className="h-[18rem] w-full"
            role="img"
            aria-label={`Bar chart of ${spans.length} execution span durations in milliseconds.`}
          >
            <BarChart
              data={spans.slice(0, 20)}
              layout="vertical"
              margin={{ left: 24, right: 12 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" unit=" ms" />
              <YAxis dataKey="name" type="category" width={92} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="durationMs" fill="var(--color-durationMs)" radius={3} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="Event throughput"
          description={throughput.length === 0 ? 'No event buckets were measured.' : `${throughput.length} five-second event buckets.`}
          measured={throughput.length > 0}
          icon={RadioTower}
        >
          <ChartContainer
            config={throughputConfig}
            className="h-[18rem] w-full"
            role="img"
            aria-label={`Event throughput across ${throughput.length} five-second buckets.`}
          >
            <AreaChart data={throughput} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="startMs" tickFormatter={formatAxisTime} />
              <YAxis width={36} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="count"
                fill="var(--color-count)"
                fillOpacity={0.18}
                stroke="var(--color-count)"
              />
            </AreaChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <section className="space-y-3" aria-labelledby="incident-timeline">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="incident-timeline" className="text-base font-semibold">Incident timeline</h2>
            <p className="text-xs text-muted-foreground">Crash, ANR, memory and unexpected-screen signals.</p>
          </div>
          <Badge variant="outline">{incidents.length || 'NOT_MEASURED'}</Badge>
        </div>
        {incidentItems.length > 0 ? (
          <Timeline items={incidentItems} />
        ) : (
          <NotMeasured message="No incident telemetry was measured; this does not assert that zero incidents occurred." />
        )}
      </section>
    </div>
  )
}

function ChartCard({
  title,
  description,
  measured,
  icon: Icon,
  children,
}: {
  title: string
  description: string
  measured: boolean
  icon: typeof Gauge
  children: ReactNode
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-card p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-4" /></span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {measured ? children : <NotMeasured message={description} />}
    </section>
  )
}

function NotMeasured({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed bg-muted/20 p-5 text-center">
      <div>
        <p className="font-mono text-xs font-semibold text-muted-foreground">NOT_MEASURED</p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      </div>
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
