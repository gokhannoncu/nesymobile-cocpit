'use client'

// Debug View — Database Access
// 1) Release APK üzerinden cihaz Room DB'sine erişim yöntemleri analizi.
// 2) NesyMobile'daki offline request kuyruğu (`request` tablosu) tablo olarak.

import { Fragment, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ban,
  Database,
  Lock,
  Search,
  ShieldAlert,
  Table2,
  Unlock,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Input } from '@nesy/metronic/components/ui/input'
import { ProductPage, PageSection, StatCard, StatGrid, EASE, toneCard, toneIcon, toneText, type Tone } from '@/components/product'
import { DebugHeader, DebugCrossLinks, CodeBlock, InfoRow, TonePill, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import { DB_ACCESS_METHODS, MOCK_REQUEST_ROWS, DB_TABLES, DB_META } from '@/data/debug-view/mock-database'
import type { DbAccessMethod, RequestRow } from '@/data/debug-view/types'

const STATE_META: Record<RequestRow['derivedState'], { label: string; tone: Tone }> = {
  pending: { label: 'Beklemede', tone: 'blue' },
  waiting: { label: 'Gecikmeli', tone: 'amber' },
  'in-flight': { label: 'Gönderiliyor', tone: 'purple' },
  retrying: { label: 'Yeniden deneniyor', tone: 'orange' },
  dead: { label: 'Tükendi (≥3)', tone: 'red' },
}

const DIFFICULTY_META: Record<DbAccessMethod['difficulty'], { label: string; tone: Tone }> = {
  easy: { label: 'Kolay', tone: 'green' },
  moderate: { label: 'Orta', tone: 'amber' },
  hard: { label: 'Zor', tone: 'orange' },
  blocked: { label: 'Engelli', tone: 'red' },
}

export default function DatabaseAccessPage() {
  const { selectedDevice } = useDebugView()
  const [query, setQuery] = useState('')
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MOCK_REQUEST_ROWS
    return MOCK_REQUEST_ROWS.filter(
      (r) => r.requestName.toLowerCase().includes(q) || r.waybillNumbers.some((w) => w.toLowerCase().includes(q)) || r.uniqueKey.toLowerCase().includes(q),
    )
  }, [query])

  const deadCount = MOCK_REQUEST_ROWS.filter((r) => r.derivedState === 'dead').length
  const pendingCount = MOCK_REQUEST_ROWS.filter((r) => r.derivedState === 'pending' || r.derivedState === 'waiting').length

  return (
    <ProductPage path="/debug-view/database">
      <DebugHeader
        icon={Table2}
        title="Database Access"
        lead="Release APK üzerinden cihaz veritabanına erişmenin yöntemleri ve NesyMobile'daki offline request kuyruğu tablosunun (AppDatabase v240) canlı görünümü."
        tone="teal"
        badges={[{ label: 'nesy.db · v240' }, { label: 'Room + WAL' }, { label: 'request tablosu' }]}
        actions={<DebugCrossLinks currentPath="/debug-view/database" />}
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : (
        <>
          {/* ─── 1. Erişim yöntemleri ─── */}
          <PageSection
            eyebrow="Analiz"
            title="Release APK Üzerinden DB Erişim Yöntemleri"
            description="Debuggable olmayan production build'de cihaz sandbox'ı OS tarafından korunur — yöntemler zorluk ve release uyumluluğuna göre sıralanır."
            icon={Database}
            tone="teal"
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {DB_ACCESS_METHODS.map((m) => (
                <AccessMethodCard key={m.id} method={m} />
              ))}
            </div>
          </PageSection>

          {/* ─── 2. DB özeti ─── */}
          <PageSection eyebrow="nesy.db" title="Veritabanı Tabloları" icon={Database} tone="indigo">
            <div className="mb-3 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 text-xs">
              <InfoRowInline label="Dosya" value={DB_META.databaseName} />
              <InfoRowInline label="Sürüm" value={`v${DB_META.version}`} />
              <InfoRowInline label="Journal" value={DB_META.journalMode} />
              <InfoRowInline label="Boyut" value={`${DB_META.sizeMb} MB`} />
              <code className="ms-auto hidden truncate font-mono text-[10px] text-muted-foreground xl:block">{DB_META.path}</code>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[560px] text-left">
                <thead className="border-b border-border bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Tablo</th>
                    <th className="px-3 py-2 font-semibold">Açıklama</th>
                    <th className="px-3 py-2 font-semibold">PK</th>
                    <th className="px-3 py-2 text-right font-semibold">Satır</th>
                    <th className="px-3 py-2 text-right font-semibold">Boyut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {DB_TABLES.map((t) => (
                    <tr key={t.name} className={cn('hover:bg-muted/30', t.name === 'request' && 'bg-teal-500/5')}>
                      <td className="px-3 py-2"><code className="text-[11px] font-semibold text-foreground">{t.name}</code></td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">{t.description}</td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{t.primaryKey}</code></td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-foreground">{t.rowCount}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-muted-foreground">{t.sizeKb} KB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageSection>

          {/* ─── 3. request tablosu ─── */}
          <PageSection
            eyebrow="Offline kuyruk"
            title="request tablosu"
            description="Gönderilmeyi bekleyen istekler. Durum; isProcessing + isWaitingRequest + tryCount kombinasyonundan türetilir (tryCount ≥ 3 = tükendi)."
            icon={Table2}
            tone="teal"
          >
            <StatGrid cols={4}>
              <StatCard icon={Table2} label="Toplam satır" value={MOCK_REQUEST_ROWS.length} tone="blue" />
              <StatCard icon={Unlock} label="Bekleyen" value={pendingCount} tone="amber" />
              <StatCard icon={Ban} label="Tükenen (≥3)" value={deadCount} tone={deadCount > 0 ? 'red' : 'green'} />
              <StatCard icon={Database} label="Arşiv (Completed)" value={128} tone="teal" />
            </StatGrid>

            <div className="relative mt-3 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="requestName, waybill veya uniqueKey ara…" className="h-8 pl-8 text-xs" />
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[820px] text-left">
                <thead className="border-b border-border bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">id</th>
                    <th className="px-3 py-2 font-semibold">requestName</th>
                    <th className="px-3 py-2 font-semibold">waybillNumbers</th>
                    <th className="px-3 py-2 text-center font-semibold">tryCount</th>
                    <th className="px-3 py-2 text-center font-semibold">proc</th>
                    <th className="px-3 py-2 text-center font-semibold">wait</th>
                    <th className="px-3 py-2 font-semibold">durum</th>
                    <th className="px-3 py-2 font-semibold">timeStamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((r) => {
                    const meta = STATE_META[r.derivedState]
                    const expanded = expandedRow === r.id
                    return (
                      <Fragment key={r.id}>
                        <tr
                          onClick={() => setExpandedRow(expanded ? null : r.id)}
                          className={cn('cursor-pointer hover:bg-muted/30', expanded && 'bg-muted/40')}
                        >
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.id}</td>
                          <td className="px-3 py-2"><code className="text-[11px] font-semibold text-foreground">{r.requestName}</code></td>
                          <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.waybillNumbers.join(', ') || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn('font-mono text-[11px]', r.tryCount >= 3 ? 'font-bold text-red-600 dark:text-red-400' : 'text-foreground')}>
                              {r.tryCount}/3
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-[11px]">{r.isProcessing ? '1' : '0'}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{r.isWaitingRequest ? '1' : '0'}</td>
                          <td className="px-3 py-2"><TonePill label={meta.label} tone={meta.tone} /></td>
                          <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                            {new Date(r.timeStamp).toLocaleTimeString('tr-TR')}
                          </td>
                        </tr>
                        <AnimatePresence initial={false}>
                          {expanded && (
                            <tr>
                              <td colSpan={8} className="p-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: EASE }}
                                  className="overflow-hidden bg-muted/20"
                                >
                                  <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
                                    <div className="divide-y divide-border/60">
                                      <InfoRow label="userName" value={r.userName} mono />
                                      <InfoRow label="uniqueKey" value={r.uniqueKey} mono />
                                      <InfoRow label="createdAt" value={new Date(r.createdAt).toLocaleString('tr-TR')} />
                                      <InfoRow label="sendWithoutWaiting" value={r.sendWithoutWaiting ? 'true' : 'false'} />
                                      <InfoRow label="fiscalInvoiceId" value={r.fiscalInvoiceId ?? '—'} mono />
                                    </div>
                                    <CodeBlock label="requestJson" code={r.requestJson} />
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <div className="py-10 text-center text-xs text-muted-foreground">Eşleşen satır yok.</div>}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Satıra tıklayarak <code className="text-foreground">requestJson</code> ve tüm alanları görebilirsiniz. Başarılı
              gönderim sonrası satır <code className="text-foreground">deleteAndArchive()</code> ile{' '}
              <code className="text-foreground">CompletedRequest</code> tablosuna taşınır.
            </p>
          </PageSection>
        </>
      )}
    </ProductPage>
  )
}

function AccessMethodCard({ method: m }: { method: DbAccessMethod }) {
  const diff = DIFFICULTY_META[m.difficulty]
  const Icon = m.difficulty === 'blocked' ? Ban : m.requiresRoot ? ShieldAlert : m.worksOnRelease ? Unlock : Lock
  return (
    <motion.div
      className={cn('rounded-xl border p-4', toneCard[m.tone])}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/60')}>
          <Icon className={cn('size-4.5', toneIcon[m.tone])} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">{m.name}</h3>
            <TonePill label={diff.label} tone={diff.tone} />
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <Badge variant="secondary" appearance="outline" size="xs">{m.tool}</Badge>
            <Badge variant="secondary" appearance="outline" size="xs" className={m.worksOnRelease ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
              {m.worksOnRelease ? 'Release ✓' : 'Release ✕'}
            </Badge>
            {m.requiresRoot && <Badge variant="secondary" appearance="outline" size="xs" className="text-amber-700 dark:text-amber-400">root gerekli</Badge>}
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{m.summary}</p>

      {m.steps.length > 0 && (
        <ol className="mt-2.5 space-y-1 text-[11px] text-foreground/85">
          {m.steps.map((s, i) => (
            <li key={i} className="flex gap-1.5">
              <span className={cn('font-mono font-bold', toneText[m.tone])}>{i + 1}.</span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      )}

      {m.commands.length > 0 && <CodeBlock className="mt-2.5" code={m.commands.join('\n')} />}

      {m.caveats.length > 0 && (
        <ul className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
          {m.caveats.map((c, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-amber-500">⚠</span>
              <span className="leading-relaxed">{c}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}

function InfoRowInline({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <code className="font-mono font-semibold text-foreground">{value}</code>
    </span>
  )
}
