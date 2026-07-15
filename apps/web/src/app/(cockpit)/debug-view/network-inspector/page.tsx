'use client'

// Debug View — Network Inspector (Fiddler-like)
// Live NesyMobile OkHttp traffic streamed from the device via
// /api/adb/network/stream (SSE over `adb logcat`): requests/responses,
// durations, headers and bodies. Left list + right detail panel.

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownUp, KeyRound, Pause, Play, Radio, Search, Trash2, Wifi, X } from 'lucide-react'
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
        tone="teal"
        badges={[{ label: 'OkHttp interceptor' }, { label: 'adb logcat stream' }, { label: 'SSE realtime' }]}
        actions={<DebugCrossLinks currentPath="/debug-view/network-inspector" />}
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard icon={ArrowDownUp} label="Total requests" value={stats.total} tone="blue" />
            <StatCard icon={X} label="Failed / timeout" value={stats.failed} tone={stats.failed > 0 ? 'red' : 'green'} />
            <StatCard icon={Wifi} label="Avg. duration" value={stats.avg} suffix="ms" tone="purple" />
            <StatCard icon={ArrowDownUp} label="Downloaded" value={stats.kb} suffix="KB" tone="teal" />
          </StatGrid>

          {/* Live capture strip */}
          <motion.div
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Radio
                className={cn(
                  'size-4',
                  paused
                    ? 'text-amber-500'
                    : streamState === 'live'
                      ? 'animate-pulse text-green-600 dark:text-green-400'
                      : streamState === 'connecting'
                        ? 'text-muted-foreground'
                        : 'text-red-500',
                )}
              />
              {paused
                ? 'Capture paused'
                : streamState === 'live'
                  ? 'Capturing live'
                  : streamState === 'connecting'
                    ? 'Connecting to device…'
                    : 'Stream lost — reconnecting…'}
            </span>
            <Badge variant="secondary" size="sm" className="font-mono text-[10px]">
              {selectedDevice.serial}
            </Badge>
            <span className="text-[11px] text-muted-foreground">Tag: OkHttpLog · adb logcat</span>
            <div className="ms-auto flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={togglePause} className="h-7 gap-1 text-[11px]">
                {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
                {paused ? 'Resume' : 'Pause'}
              </Button>
              <Button size="sm" variant="ghost" onClick={clear} className="h-7 gap-1 text-[11px]">
                <Trash2 className="size-3" />
                Clear
              </Button>
            </div>
          </motion.div>

          {/* List + detail */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
            {/* List */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border p-2.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search path, host or method…"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 border-b border-border bg-muted/60 backdrop-blur">
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2.5 py-2 font-semibold">Method</th>
                      <th className="px-2.5 py-2 font-semibold">Endpoint</th>
                      <th className="px-2.5 py-2 font-semibold">Status</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <AnimatePresence initial={false}>
                      {filtered.map((t) => (
                        <motion.tr
                          key={t.id}
                          layout="position"
                          initial={{ opacity: 0, backgroundColor: 'rgba(20,184,166,0.12)' }}
                          animate={{ opacity: 1, backgroundColor: 'rgba(20,184,166,0)' }}
                          transition={{ duration: 0.6, ease: EASE }}
                          onClick={() => setSelectedId(t.id)}
                          className={cn('cursor-pointer transition-colors hover:bg-muted/40', selectedId === t.id && 'bg-teal-500/5')}
                        >
                          <td className="px-2.5 py-2">
                            <Badge variant="secondary" appearance="outline" size="xs" className={cn('font-mono', toneText[methodTone(t.method)])}>
                              {t.method}
                            </Badge>
                          </td>
                          <td className="px-2.5 py-2">
                            <div className="max-w-[240px] truncate text-[11px] font-medium text-foreground">/{t.path}</div>
                            <div className="max-w-[240px] truncate font-mono text-[10px] text-muted-foreground">{t.host}</div>
                          </td>
                          <td className="px-2.5 py-2">
                            <span className={cn('text-xs font-bold', toneText[statusTone(t.status)])}>
                              {t.status ?? 'ERR'}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            <span className={cn('font-mono text-[11px]', t.timing.totalMs > 5000 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                              {t.timing.totalMs >= 1000 ? `${(t.timing.totalMs / 1000).toFixed(1)}s` : `${t.timing.totalMs}ms`}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="py-10 text-center text-xs text-muted-foreground">
                    {transactions.length === 0
                      ? 'No traffic captured yet. Use the app on the device — requests appear here instantly.'
                      : 'No matching requests.'}
                  </div>
                )}
              </div>
            </div>

            {/* Detail */}
            <div className="rounded-xl border border-border bg-card">
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                  >
                    <TransactionDetail txn={selected} />
                  </motion.div>
                ) : (
                  <div className="flex h-full items-center justify-center py-20 text-xs text-muted-foreground">
                    Select a request to see details.
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}
    </ProductPage>
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
              tab === t.key ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-h-[440px] overflow-y-auto p-3">
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
