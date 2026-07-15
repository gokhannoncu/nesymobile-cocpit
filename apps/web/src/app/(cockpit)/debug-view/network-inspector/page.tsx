'use client'

// Debug View — Network Inspector (Fiddler-like)
// Live NesyMobile OkHttp traffic streamed from the device via
// /api/adb/network/stream (SSE over `adb logcat`): requests/responses,
// durations, headers and bodies. Left list + right detail panel.

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownUp, KeyRound, Pause, Play, Radio, Search, Smartphone, Trash2, Wifi, X, Zap } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input } from '@nesy/metronic/components/ui/input'
import { ProductPage, StatCard, StatGrid, EASE, toneText, type Tone } from '@/components/product'
import { DebugHeader, DebugCrossLinks, CodeBlock, InfoRow, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import type { NetworkTransaction } from '@/data/debug-view/types'

const MAX_TRANSACTIONS = 1000

/**
 * Headers appended by NesyMobile's AuthInterceptor (di/AuthInterceptor.kt).
 * They only appear in the log stream when the logging interceptor runs after
 * AuthInterceptor in the OkHttp chain (NetworkModule.kt order).
 */
const AUTH_INTERCEPTOR_HEADERS = [
  'X-DeviceId',
  'X-Client-Request-Time',
  'X-Client-Request-Lat',
  'X-Client-Request-Long',
  'X-Channel',
  'X-Client-Version',
  'X-Device-Info',
  'Authorization',
  'X-AppName',
  'X-Protected-Request-Key',
]

type StreamState = 'connecting' | 'live' | 'error'

function statusTone(status: number | null): Tone {
  if (status === null) return 'red'
  if (status >= 500) return 'red'
  if (status >= 400) return 'orange'
  if (status >= 300) return 'amber'
  return 'green'
}

function methodTone(method: string): Tone {
  return method === 'GET' ? 'blue' : method === 'DELETE' ? 'red' : 'purple'
}

const TIMING_SEGMENTS: { key: keyof NetworkTransaction['timing']; label: string; color: string }[] = [
  { key: 'dnsMs', label: 'DNS', color: 'bg-indigo-500' },
  { key: 'connectMs', label: 'Connect', color: 'bg-blue-500' },
  { key: 'tlsMs', label: 'TLS', color: 'bg-purple-500' },
  { key: 'requestMs', label: 'Request', color: 'bg-teal-500' },
  { key: 'waitingMs', label: 'Waiting (TTFB)', color: 'bg-amber-500' },
  { key: 'responseMs', label: 'Response', color: 'bg-green-500' },
]

/** Streams live transactions for a device serial over SSE. */
function useNetworkStream(serial: string | null) {
  const [transactions, setTransactions] = useState<NetworkTransaction[]>([])
  const [streamState, setStreamState] = useState<StreamState>('connecting')
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const bufferRef = useRef<NetworkTransaction[]>([])

  useEffect(() => {
    setTransactions([])
    bufferRef.current = []
    if (!serial) return

    setStreamState('connecting')
    const source = new EventSource(`/api/adb/network/stream?serial=${encodeURIComponent(serial)}`)

    source.onopen = () => setStreamState('live')
    source.onerror = () => setStreamState('error')
    source.onmessage = (e) => {
      const txn = JSON.parse(e.data) as NetworkTransaction
      if (pausedRef.current) {
        bufferRef.current = [txn, ...bufferRef.current].slice(0, MAX_TRANSACTIONS)
      } else {
        setTransactions((prev) => [txn, ...prev].slice(0, MAX_TRANSACTIONS))
      }
    }

    return () => source.close()
  }, [serial])

  const togglePause = () => {
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    if (!next && bufferRef.current.length > 0) {
      const buffered = bufferRef.current
      bufferRef.current = []
      setTransactions((prev) => [...buffered, ...prev].slice(0, MAX_TRANSACTIONS))
    }
  }

  const clear = () => {
    bufferRef.current = []
    setTransactions([])
  }

  return { transactions, streamState, paused, togglePause, clear }
}

export default function NetworkInspectorPage() {
  const { selectedDevice } = useDebugView()
  const serial = selectedDevice?.serial ?? null
  const { transactions, streamState, paused, togglePause, clear } = useNetworkStream(serial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return transactions
    return transactions.filter(
      (t) => t.path.toLowerCase().includes(q) || t.host.toLowerCase().includes(q) || t.method.toLowerCase().includes(q),
    )
  }, [query, transactions])

  const selected = transactions.find((t) => t.id === selectedId) ?? null
  const showCaptureHero = transactions.length === 0 && !query.trim()

  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId != null) setSelectedId(null)
      return
    }
    if (!selectedId || !filtered.some((t) => t.id === selectedId)) {
      setSelectedId(filtered[0]!.id)
    }
  }, [filtered, selectedId])

  const stats = useMemo(() => {
    const total = transactions.length
    if (total === 0) return { total: 0, failed: 0, avg: 0, kb: 0 }
    const failed = transactions.filter((t) => t.status === null || (t.status ?? 0) >= 400).length
    const avg = Math.round(transactions.reduce((s, t) => s + t.timing.totalMs, 0) / total)
    const bytes = transactions.reduce((s, t) => s + t.responseSizeBytes, 0)
    return { total, failed, avg, kb: Math.round(bytes / 1024) }
  }, [transactions])

  return (
    <ProductPage path="/debug-view/network-inspector">
      <DebugHeader
        icon={Wifi}
        title="Network Inspector"
        lead="Live OkHttp traffic captured from the device via adb logcat: requests/responses, durations, headers and bodies — like Fiddler, in near real time."
        tone="orange"
        badges={[{ label: 'OkHttp interceptor' }, { label: 'adb logcat stream' }, { label: 'SSE realtime' }]}
        actions={<DebugCrossLinks currentPath="/debug-view/network-inspector" />}
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard icon={ArrowDownUp} label="Total requests" value={stats.total} tone="orange" />
            <StatCard icon={X} label="Failed / timeout" value={stats.failed} tone={stats.failed > 0 ? 'red' : 'green'} />
            <StatCard icon={Wifi} label="Avg. duration" value={stats.avg} suffix="ms" tone="orange" />
            <StatCard icon={ArrowDownUp} label="Downloaded" value={stats.kb} suffix="KB" tone="orange" />
          </StatGrid>

          {showCaptureHero ? (
            <NetworkCaptureEmptyHero
              deviceName={selectedDevice.name}
              serial={selectedDevice.serial}
              streamState={streamState}
              paused={paused}
              onTogglePause={togglePause}
              onClear={clear}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-orange-50/40 px-4 py-3 dark:bg-orange-950/15">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10">
                    <Wifi className="size-4 text-orange-600 dark:text-orange-400" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Live capture</div>
                    <div className="text-[11px] text-muted-foreground">
                      {filtered.length} request{filtered.length === 1 ? '' : 's'}
                      {query.trim() ? ' matching filter' : ' in buffer'}
                      {' · '}
                      <code className="font-mono text-[10px]">OkHttpLog</code>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StreamStatusBadge streamState={streamState} paused={paused} />
                  <Badge variant="secondary" appearance="outline" size="xs" className="font-mono">
                    {selectedDevice.serial}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={togglePause} className="h-8 gap-1 text-[11px]">
                    {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
                    {paused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clear} className="h-8 gap-1 text-[11px]">
                    <Trash2 className="size-3" />
                    Clear
                  </Button>
                </div>
              </div>

              <div className="flex min-h-[min(72vh,640px)] flex-col xl:flex-row">
                <div className="flex w-full shrink-0 flex-col border-b border-border/70 xl:w-[min(42%,420px)] xl:border-b-0 xl:border-e">
                  <div className="shrink-0 border-b border-border/60 p-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search path, host or method…"
                        className="h-9 border-border/80 bg-background pl-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    {filtered.length === 0 ? (
                      <NetworkListEmptyState
                        query={query}
                        onClearSearch={() => setQuery('')}
                      />
                    ) : (
                      <table className="w-full text-left">
                        <thead className="sticky top-0 z-10 border-b border-border bg-muted/60 backdrop-blur">
                          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="w-[4.5rem] px-2.5 py-2 font-semibold">Method</th>
                            <th className="px-2.5 py-2 font-semibold">Endpoint</th>
                            <th className="w-14 px-2.5 py-2 font-semibold">Status</th>
                            <th className="w-16 px-2.5 py-2 text-right font-semibold">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          <AnimatePresence initial={false}>
                            {filtered.map((t) => (
                              <motion.tr
                                key={t.id}
                                layout="position"
                                initial={{ opacity: 0, backgroundColor: 'rgba(249,115,22,0.12)' }}
                                animate={{ opacity: 1, backgroundColor: 'rgba(249,115,22,0)' }}
                                transition={{ duration: 0.6, ease: EASE }}
                                onClick={() => setSelectedId(t.id)}
                                className={cn(
                                  'cursor-pointer transition-colors hover:bg-muted/40',
                                  selectedId === t.id && 'bg-orange-500/8 shadow-[inset_3px_0_0_0_rgb(249,115,22)]',
                                )}
                              >
                                <td className="px-2.5 py-2.5">
                                  <Badge variant="secondary" appearance="outline" size="xs" className={cn('font-mono', toneText[methodTone(t.method)])}>
                                    {t.method}
                                  </Badge>
                                </td>
                                <td className="px-2.5 py-2.5">
                                  <div className="truncate text-[11px] font-medium text-foreground">/{t.path}</div>
                                  <div className="truncate font-mono text-[10px] text-muted-foreground">{t.host}</div>
                                </td>
                                <td className="px-2.5 py-2.5">
                                  <span className={cn('text-xs font-bold', toneText[statusTone(t.status)])}>
                                    {t.status ?? 'ERR'}
                                  </span>
                                </td>
                                <td className="px-2.5 py-2.5 text-right">
                                  <span className={cn('font-mono text-[11px]', t.timing.totalMs > 5000 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                                    {t.timing.totalMs >= 1000 ? `${(t.timing.totalMs / 1000).toFixed(1)}s` : `${t.timing.totalMs}ms`}
                                  </span>
                                </td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1 bg-muted/10">
                  <AnimatePresence mode="wait">
                    {selected ? (
                      <motion.div
                        key={selected.id}
                        className="h-full"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE }}
                      >
                        <TransactionDetail txn={selected} />
                      </motion.div>
                    ) : (
                      <NetworkDetailEmptyState />
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </ProductPage>
  )
}

function StreamStatusBadge({ streamState, paused }: { streamState: StreamState; paused: boolean }) {
  const label = paused
    ? 'Paused'
    : streamState === 'live'
      ? 'Live'
      : streamState === 'connecting'
        ? 'Connecting'
        : 'Reconnecting'

  const tone: Tone = paused ? 'amber' : streamState === 'live' ? 'green' : streamState === 'connecting' ? 'gray' : 'red'

  return (
    <Badge variant="secondary" appearance="outline" size="xs" className={cn('gap-1.5', toneText[tone])}>
      <Radio className={cn('size-3', !paused && streamState === 'live' && 'animate-pulse')} />
      {label}
    </Badge>
  )
}

function NetworkCaptureEmptyHero({
  deviceName,
  serial,
  streamState,
  paused,
  onTogglePause,
  onClear,
}: {
  deviceName: string
  serial: string
  streamState: StreamState
  paused: boolean
  onTogglePause: () => void
  onClear: () => void
}) {
  const steps = [
    {
      step: '1',
      icon: Radio,
      title: 'Stream is ready',
      desc: 'OkHttp logs flow from the device via adb logcat (tag: OkHttpLog).',
    },
    {
      step: '2',
      icon: Smartphone,
      title: 'Use NesyMobile',
      desc: `Open the app on ${deviceName} and trigger any API call.`,
    },
    {
      step: '3',
      icon: Zap,
      title: 'Inspect instantly',
      desc: 'Requests appear here in near real time with headers, body and timing.',
    },
  ]

  return (
    <motion.div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-orange-50/40 px-4 py-3 dark:bg-orange-950/15">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10">
            <Wifi className="size-4 text-orange-600 dark:text-orange-400" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">Waiting for traffic</div>
            <div className="font-mono text-[11px] text-muted-foreground">{serial}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StreamStatusBadge streamState={streamState} paused={paused} />
          <Button size="sm" variant="outline" onClick={onTogglePause} className="h-8 gap-1 text-[11px]">
            {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear} className="h-8 gap-1 text-[11px]">
            <Trash2 className="size-3" />
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center px-6 py-14 text-center lg:py-16">
        <div className="relative">
          <div className="flex size-16 items-center justify-center rounded-3xl border border-orange-500/25 bg-orange-500/8">
            <Wifi className="size-8 text-orange-600 dark:text-orange-400" />
          </div>
          {!paused && streamState === 'live' ? (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-green-500 ring-2 ring-card">
              <span className="size-2 animate-pulse rounded-full bg-white" />
            </span>
          ) : null}
        </div>

        <h3 className="mt-5 text-lg font-bold text-foreground">No traffic captured yet</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          The inspector is connected to your device. Use NesyMobile on the phone — every HTTP request will show up here automatically.
        </p>

        <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {steps.map((item) => (
            <div key={item.step} className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-orange-500/10 font-mono text-[11px] font-bold text-orange-700 dark:text-orange-300">
                  {item.step}
                </span>
                <item.icon className="size-4 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-semibold text-foreground">{item.title}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function NetworkListEmptyState({
  query,
  onClearSearch,
}: {
  query: string
  onClearSearch: () => void
}) {
  return (
    <motion.div
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <div className="flex size-11 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/25">
        <Search className="size-5 text-muted-foreground/70" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">No matching requests</p>
        <p className="mt-1 max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
          Nothing matches <code className="font-mono text-foreground">{query.trim()}</code>. Try path, host or HTTP method.
        </p>
      </div>
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClearSearch}>
        Clear search
      </Button>
    </motion.div>
  )
}

function NetworkDetailEmptyState() {
  return (
    <motion.div
      className="flex h-full min-h-[min(72vh,640px)] flex-col items-center justify-center gap-3 px-8 py-12 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-dashed border-orange-500/30 bg-orange-500/5">
        <ArrowDownUp className="size-6 text-orange-500/70" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Select a request</p>
        <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
          Pick any captured call from the list to inspect URL, headers, bodies and duration.
        </p>
      </div>
    </motion.div>
  )
}

/** Request headers rendered as rows, AuthInterceptor-injected ones marked. */
function RequestHeaders({ txn }: { txn: NetworkTransaction }) {
  const entries = Object.entries(txn.requestHeaders)
  const authHeaderSet = new Set(AUTH_INTERCEPTOR_HEADERS.map((h) => h.toLowerCase()))
  const hasAuthHeaders = entries.some(([k]) => authHeaderSet.has(k.toLowerCase()))

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
        <div className="border-b border-border bg-muted/40 px-3 py-1.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Request Headers
          </span>
        </div>
        {entries.length === 0 ? (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">(no headers logged)</div>
        ) : (
          <div className="divide-y divide-border/50 px-3 py-1">
            {entries.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 py-1.5">
                <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground">
                  {authHeaderSet.has(k.toLowerCase()) && <KeyRound className="size-3 text-amber-500" />}
                  {k}
                </span>
                <span className="min-w-0 break-all text-right font-mono text-[11px] text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!hasAuthHeaders && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground dark:border-amber-900 dark:bg-amber-950/20">
          <span className="font-semibold text-foreground">AuthInterceptor headers are not in this capture.</span>{' '}
          The app adds {AUTH_INTERCEPTOR_HEADERS.join(', ')} after the logging interceptor in this build,
          so their values never reach logcat. Install a build where the logger is registered last in
          NetworkModule.kt to capture them with real values.
        </div>
      )}
    </div>
  )
}

function TransactionDetail({ txn }: { txn: NetworkTransaction }) {
  const [tab, setTab] = useState<'overview' | 'request' | 'response' | 'timing'>('overview')
  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'request', label: 'Request' },
    { key: 'response', label: 'Response' },
    { key: 'timing', label: 'Timing' },
  ]
  const hasTimingBreakdown = TIMING_SEGMENTS.some((seg) => txn.timing[seg.key] > 0)

  return (
    <div>
      {/* Header */}
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" appearance="outline" size="sm" className={cn('font-mono', toneText[methodTone(txn.method)])}>
            {txn.method}
          </Badge>
          <span className={cn('text-sm font-bold', toneText[statusTone(txn.status)])}>
            {txn.status ?? 'ERR'} {txn.statusText}
          </span>
        </div>
        <div className="mt-1 break-all font-mono text-[11px] text-foreground">{txn.fullUrl}</div>
        {txn.error && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50/60 px-2.5 py-1.5 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {txn.error}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-border px-2 pt-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.key
                ? 'border-b-2 border-orange-500 bg-orange-500/5 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {tab === 'overview' && (
          <div className="divide-y divide-border/60">
            <InfoRow label="Host" value={txn.host} mono />
            <InfoRow label="Scheme" value={txn.scheme.toUpperCase()} />
            <InfoRow label="Started" value={new Date(txn.startedAt).toLocaleString('tr-TR')} />
            <InfoRow label="Total time" value={`${txn.timing.totalMs} ms`} />
            <InfoRow label="Request size" value={`${txn.requestSizeBytes} B`} />
            <InfoRow label="Response size" value={`${txn.responseSizeBytes} B`} />
            <InfoRow label="Content-Type" value={txn.contentType || '—'} mono />
            {txn.correlationId && <InfoRow label="Correlation ID" value={txn.correlationId} mono />}
            <InfoRow label="Initiator" value={txn.initiator} />
          </div>
        )}

        {tab === 'request' && (
          <div className="space-y-3">
            <RequestHeaders txn={txn} />
            {txn.requestBody && <CodeBlock label="Request Body" code={txn.requestBody} />}
          </div>
        )}

        {tab === 'response' && (
          <div className="space-y-3">
            <CodeBlock label="Response Headers" code={Object.entries(txn.responseHeaders).map(([k, v]) => `${k}: ${v}`).join('\n') || '(empty)'} />
            <CodeBlock label="Response Body" code={txn.responseBody ?? '(no body / failed)'} />
          </div>
        )}

        {tab === 'timing' && (
          <div className="space-y-3">
            {hasTimingBreakdown ? (
              <>
                <div className="flex h-6 w-full overflow-hidden rounded-md border border-border">
                  {TIMING_SEGMENTS.map((seg) => {
                    const val = txn.timing[seg.key]
                    const pct = (val / txn.timing.totalMs) * 100
                    if (pct <= 0) return null
                    return <div key={seg.key} className={seg.color} style={{ width: `${pct}%` }} title={`${seg.label}: ${val}ms`} />
                  })}
                </div>
                <div className="divide-y divide-border/60">
                  {TIMING_SEGMENTS.map((seg) => (
                    <div key={seg.key} className="flex items-center justify-between py-1.5 text-xs">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className={cn('size-2.5 rounded-sm', seg.color)} />
                        {seg.label}
                      </span>
                      <span className="font-mono text-foreground">{txn.timing[seg.key]} ms</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                The OkHttp logging interceptor only records the total call duration — DNS/TLS/TTFB
                breakdown is not available from logcat.
              </div>
            )}
            <div className="flex items-center justify-between py-1.5 text-xs font-bold">
              <span>Total</span>
              <span className="font-mono">{txn.timing.totalMs} ms</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
