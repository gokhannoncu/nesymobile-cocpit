'use client'

// Debug View — Network Inspector (Fiddler benzeri)
// NesyMobile OkHttp trafiği: giden/gelen istekler, süreler, request/response,
// header'lar, IP adresleri, durum kodları. Sol liste + sağ detay paneli.

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownUp, Lock, Search, ShieldCheck, Wifi, X } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Input } from '@nesy/metronic/components/ui/input'
import { ProductPage, StatCard, StatGrid, EASE, toneText, type Tone } from '@/components/product'
import { DebugHeader, DebugCrossLinks, CodeBlock, InfoRow, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import { MOCK_TRANSACTIONS, CONNECTION_SECURITY } from '@/data/debug-view/mock-network'
import type { NetworkTransaction } from '@/data/debug-view/types'

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

export default function NetworkInspectorPage() {
  const { selectedDevice } = useDebugView()
  const [selectedId, setSelectedId] = useState<string | null>('txn-0005')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MOCK_TRANSACTIONS
    return MOCK_TRANSACTIONS.filter(
      (t) => t.path.toLowerCase().includes(q) || t.host.toLowerCase().includes(q) || t.remoteIp.includes(q),
    )
  }, [query])

  const selected = MOCK_TRANSACTIONS.find((t) => t.id === selectedId) ?? null

  const stats = useMemo(() => {
    const total = MOCK_TRANSACTIONS.length
    const failed = MOCK_TRANSACTIONS.filter((t) => t.status === null || (t.status ?? 0) >= 400).length
    const avg = Math.round(MOCK_TRANSACTIONS.reduce((s, t) => s + t.timing.totalMs, 0) / total)
    const bytes = MOCK_TRANSACTIONS.reduce((s, t) => s + t.responseSizeBytes, 0)
    return { total, failed, avg, kb: Math.round(bytes / 1024) }
  }, [])

  return (
    <ProductPage path="/debug-view/network-inspector">
      <DebugHeader
        icon={Wifi}
        title="Network Inspector"
        lead="NesyMobile'ın OkHttp trafiği canlı yakalanmış hali: giden/gelen istekler, süre dökümü, request/response gövdeleri, header'lar ve uzak IP adresleri — Fiddler gibi."
        tone="teal"
        badges={[{ label: 'OkHttp interceptor' }, { label: 'TLS 1.3 + cert pinning' }, { label: 'HTTP/2' }]}
        actions={<DebugCrossLinks currentPath="/debug-view/network-inspector" />}
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard icon={ArrowDownUp} label="Toplam istek" value={stats.total} tone="blue" />
            <StatCard icon={X} label="Hatalı / timeout" value={stats.failed} tone={stats.failed > 0 ? 'red' : 'green'} />
            <StatCard icon={Wifi} label="Ort. süre" value={stats.avg} suffix="ms" tone="purple" />
            <StatCard icon={ArrowDownUp} label="İndirilen" value={stats.kb} suffix="KB" tone="teal" />
          </StatGrid>

          {/* Güvenlik şeridi */}
          <motion.div
            className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ShieldCheck className="size-4 text-green-600 dark:text-green-400" />
              Bağlantı güvenliği
            </span>
            <Badge variant="secondary" size="sm" className="gap-1">
              <Lock className="size-3" /> {CONNECTION_SECURITY.tlsVersion}
            </Badge>
            <Badge variant="secondary" size="sm">Cert pinning: {CONNECTION_SECURITY.pinnedHost}</Badge>
            <code className="hidden truncate font-mono text-[10px] text-muted-foreground lg:block">{CONNECTION_SECURITY.pinSha256}</code>
            <span className="ms-auto text-[11px] text-muted-foreground">
              Timeout {CONNECTION_SECURITY.connectTimeoutSec}s · Host override: {CONNECTION_SECURITY.hostSelectionOverride ? 'aktif' : 'kapalı'}
            </span>
          </motion.div>

          {/* Liste + detay */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
            {/* Liste */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border p-2.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Path, host veya IP ara…"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 border-b border-border bg-muted/60 backdrop-blur">
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2.5 py-2 font-semibold">Yön</th>
                      <th className="px-2.5 py-2 font-semibold">Endpoint</th>
                      <th className="px-2.5 py-2 font-semibold">Durum</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Süre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filtered.map((t) => (
                      <tr
                        key={t.id}
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
                          {t.retryOf && <div className="text-[9px] text-muted-foreground">retry</div>}
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <span className={cn('font-mono text-[11px]', t.timing.totalMs > 5000 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                            {t.timing.totalMs >= 1000 ? `${(t.timing.totalMs / 1000).toFixed(1)}s` : `${t.timing.totalMs}ms`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="py-10 text-center text-xs text-muted-foreground">Eşleşen istek yok.</div>
                )}
              </div>
            </div>

            {/* Detay */}
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
                    Detay için bir istek seçin.
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

function TransactionDetail({ txn }: { txn: NetworkTransaction }) {
  const [tab, setTab] = useState<'overview' | 'request' | 'response' | 'timing'>('overview')
  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'overview', label: 'Genel' },
    { key: 'request', label: 'İstek' },
    { key: 'response', label: 'Yanıt' },
    { key: 'timing', label: 'Süreler' },
  ]

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
          <span className="ms-auto font-mono text-[10px] text-muted-foreground">{txn.protocol}</span>
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
            <InfoRow label="Uzak IP" value={txn.remoteIp} mono tone="teal" />
            <InfoRow label="Şema" value={txn.scheme.toUpperCase()} />
            <InfoRow label="Başlangıç" value={new Date(txn.startedAt).toLocaleString('tr-TR')} />
            <InfoRow label="Toplam süre" value={`${txn.timing.totalMs} ms`} />
            <InfoRow label="İstek boyutu" value={`${txn.requestSizeBytes} B`} />
            <InfoRow label="Yanıt boyutu" value={`${txn.responseSizeBytes} B`} />
            <InfoRow label="Cache" value={txn.fromCache ? 'Evet' : 'Hayır'} tone={txn.fromCache ? 'amber' : undefined} />
            <InfoRow label="Content-Type" value={txn.contentType} mono />
            <InfoRow label="Correlation ID" value={txn.correlationId} mono />
            <InfoRow label="Başlatan" value={txn.initiator} />
            {txn.retryOf && <InfoRow label="Retry of" value={txn.retryOf} mono tone="amber" />}
          </div>
        )}

        {tab === 'request' && (
          <div className="space-y-3">
            <CodeBlock label="Request Headers" code={Object.entries(txn.requestHeaders).map(([k, v]) => `${k}: ${v}`).join('\n')} />
            {txn.requestBody && <CodeBlock label="Request Body" code={txn.requestBody} />}
          </div>
        )}

        {tab === 'response' && (
          <div className="space-y-3">
            <CodeBlock label="Response Headers" code={Object.entries(txn.responseHeaders).map(([k, v]) => `${k}: ${v}`).join('\n') || '(boş)'} />
            <CodeBlock label="Response Body" code={txn.responseBody ?? '(gövde yok / timeout)'} />
          </div>
        )}

        {tab === 'timing' && (
          <div className="space-y-3">
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
              <div className="flex items-center justify-between py-1.5 text-xs font-bold">
                <span>Toplam</span>
                <span className="font-mono">{txn.timing.totalMs} ms</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
