'use client'

// Mobile Service Atlas — which backend service does each mobile screen talk to,
// how is the request built, and where does the response land in the app?
// Data source: src/data/engineering/service-atlas.ts (extracted from the real
// NesyMobile Android codebase + NesyMobileArchive backend/gateway projects).

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CloudOff,
  Globe,
  Layers,
  ListTree,
  Network,
  Search,
  ShieldCheck,
  Table2,
  Workflow,
  X,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'
import {
  Callout,
  GuardrailCallout,
  HeroCallout,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
  toneDot,
} from '@/components/product'
import {
  ATLAS_APP_VERSION,
  ATLAS_CONTRACTS,
  ATLAS_QUICK_FILTERS,
  ATLAS_SCAN_DATE,
  ATLAS_SCREENS,
  atlasKpis,
  BACKEND_SERVICES,
  contractsForScreen,
  GATEWAY_FACTS,
  JOURNEY_META,
  OFFLINE_QUEUE_FACTS,
  searchContracts,
  type AtlasContract,
  type AtlasDomain,
  type AtlasJourney,
} from '@/data/engineering/service-atlas'
import { ContractDrawer } from './contract-drawer'
import { ContractTable, FlowView, MatrixView } from './views'

const JOURNEY_ORDER = (Object.keys(JOURNEY_META) as AtlasJourney[]).sort(
  (a, b) => JOURNEY_META[a].order - JOURNEY_META[b].order,
)

export default function MobileServiceAtlasPage() {
  const [tab, setTab] = useState('flow')
  const [search, setSearch] = useState('')
  const [quick, setQuick] = useState<string[]>([])
  const [screenId, setScreenId] = useState<string | null>('delivery')
  const [selected, setSelected] = useState<AtlasContract | null>(null)

  const kpi = atlasKpis()

  const filtered = useMemo(() => {
    let items = ATLAS_CONTRACTS
    for (const qid of quick) {
      const qf = ATLAS_QUICK_FILTERS.find((q) => q.id === qid)
      if (qf) items = items.filter(qf.match)
    }
    return searchContracts(search, items)
  }, [search, quick])

  // Flow view is screen-scoped; the contract list shows everything that matches.
  const flowItems = useMemo(
    () => (screenId ? filtered.filter((c) => c.screen === screenId) : filtered),
    [filtered, screenId],
  )

  const hasFilter = search.trim() !== '' || quick.length > 0

  const handleMatrixCell = (cellScreen: string, domain: AtlasDomain) => {
    setScreenId(cellScreen)
    setSearch(`screen:${cellScreen} domain:${domain}`)
  }

  return (
    <ProductPage path="/engineering/mobile-service-atlas">
      <HeroCallout
        icon={Globe}
        eyebrow="Mobile Knowledge"
        tone="blue"
        title="Mobile Service Atlas"
        lead="Kullanıcı bu ekranda bu işlemi yaptığında mobil hangi endpoint’i çağırıyor, hangi header ve parametreleri gönderiyor, ne cevap bekliyor ve bu cevap uygulamada nereye yazılıyor? Ekran, aksiyon, mobil kod, API sözleşmesi ve veri state’i arasındaki tam zincir tek merkezde."
        chips={[
          `${kpi.screens} ekran`,
          `${kpi.totalDetected} endpoint tespit · ${kpi.documented} mapping`,
          `${kpi.domains} backend domain`,
          `Mobile v${ATLAS_APP_VERSION}`,
          `Son kod taraması: ${ATLAS_SCAN_DATE}`,
        ]}
      >
        <StatGrid cols={2}>
          <StatCard
            label="Verified contract"
            value={kpi.verified}
            tone="green"
            icon={ShieldCheck}
            hint="Kod taraması + akış doğrulaması yapılmış exemplar mapping’ler"
          />
          <StatCard
            label="Contract riski"
            value={kpi.mismatch}
            tone={kpi.mismatch > 0 ? 'red' : 'green'}
            icon={AlertTriangle}
            hint="Mobil path ile backend topic adı arasında doğrulama bekleyen fark"
          />
        </StatGrid>
      </HeroCallout>

      {/* Search + quick filters — sticky work bar */}
      <div className="sticky top-2 z-20 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              placeholder="Ekran, endpoint, request alanı, response modeli, class veya header ara — ör. screen:delivery offline:true method:POST"
              className="h-9 w-full rounded-lg border bg-background pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-blue-500/30"
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
          <div className="flex flex-wrap items-center gap-1.5">
            {ATLAS_QUICK_FILTERS.map((q) => {
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
                      ? 'border-blue-400 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
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
                onClick={() => { setSearch(''); setQuick([]) }}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" /> Temizle · {filtered.length}/{kpi.documented} contract
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Workspace: Screen Navigator + views */}
      <div className="flex flex-col gap-5 lg:flex-row">
        <ScreenNavigator screenId={screenId} onSelect={setScreenId} />

        <div className="min-w-0 flex-1 space-y-5">
          {screenId && <ScreenSummary screenId={screenId} onClear={() => setScreenId(null)} />}

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList variant="button" className="mb-4 flex-wrap justify-start">
              <TabsTrigger value="flow"><Workflow className="size-4" /> Interaction Flow</TabsTrigger>
              <TabsTrigger value="matrix"><Table2 className="size-4" /> Service Matrix</TabsTrigger>
              <TabsTrigger value="contracts"><ListTree className="size-4" /> Contract List</TabsTrigger>
            </TabsList>

            <TabsContent value="flow">
              <FlowView items={flowItems} screenId={screenId} onSelect={setSelected} />
            </TabsContent>

            <TabsContent value="matrix">
              <MatrixView items={filtered} onCell={handleMatrixCell} />
            </TabsContent>

            <TabsContent value="contracts">
              <ContractTable
                items={screenId ? filtered.filter((c) => c.screen === screenId) : filtered}
                onSelect={setSelected}
              />
              {screenId && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Liste seçili ekranla sınırlı — tüm contract’lar için soldaki seçimi kaldırın.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Backend topology */}
      <PageSection
        eyebrow="Gateway & servisler"
        title="İstek backend’e nasıl ulaşır?"
        description="Mobil neredeyse hiçbir servisi doğrudan çağırmaz: KrakenD gateway /{Service}/{topic} path’ini ilgili .NET mikroservisine yönlendirir; topic, Operation sınıfındaki public metod adıdır."
        icon={Network}
        tone="blue"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <div className="rounded-xl border bg-background p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Gateway auth pipeline
            </div>
            <ol className="mt-2 space-y-1.5">
              {GATEWAY_FACTS.authPipeline.map((step, i) => (
                <li key={step} className="flex items-start gap-2 text-xs text-foreground/85">
                  <span className={cn('mt-1 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white', toneDot.blue)}>
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              {GATEWAY_FACTS.stack} · Envelope: <code>{GATEWAY_FACTS.envelope}</code>
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">{GATEWAY_FACTS.tenants}</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Mikroservisler (path prefix → servis)
            </div>
            <div className="mt-2 space-y-1">
              {BACKEND_SERVICES.map((s) => (
                <div key={s.name} className="flex items-baseline gap-2 text-xs">
                  <span className="w-56 shrink-0 font-semibold text-foreground">
                    {s.prefix.map((p) => `/${p}`).join(' ')}
                  </span>
                  <span className="min-w-0 text-foreground/75">
                    {s.name}
                    {s.port ? ` (:${s.port})` : ''} — {s.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageSection>

      {/* Offline queue */}
      <PageSection
        eyebrow="Offline-first yazımlar"
        title="Request kuyruğu — yazma isteklerinin gerçek yolu"
        description="Delivery, pickup, delivery-failed gibi kritik yazımlar doğrudan HTTP’ye gitmez; Room Request tablosuna yazılır ve RequestSenderService tarafından FIFO drain edilir."
        icon={CloudOff}
        tone="amber"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          <Callout icon={Layers} title="Kuyruk mekaniği" tone="amber">
            {OFFLINE_QUEUE_FACTS.drainInterval}. Delivery/failed/image istekleri{' '}
            <strong>{OFFLINE_QUEUE_FACTS.waitingWindow}</strong> ile bekletilir — kuryeye geri alma
            şansı tanır (VPos ödemeli teslimatlar beklemez).
          </Callout>
          <Callout icon={AlertTriangle} title="Retry & dead-letter" tone="red">
            {OFFLINE_QUEUE_FACTS.retryPolicy}
          </Callout>
          <Callout icon={ShieldCheck} title="Dedup" tone="green">
            Her Request satırı hesaplanmış bir <code>uniqueKey</code> taşır (unique index +{' '}
            <code>OnConflictStrategy.IGNORE</code>) — aynı işlem iki kez kuyruklanamaz. Bu mobil
            tarafta duplicate’i engeller; backend idempotency ayrı bir garantidir.
          </Callout>
        </div>
      </PageSection>

      {/* Guardrails */}
      <PageSection
        eyebrow="Teknik guardrail’ler"
        title="Bu sayfayı okurken akılda tutulacaklar"
        icon={ShieldCheck}
        tone="red"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <GuardrailCallout title="HTTP Success ≠ Business Success" tone="red" icon={AlertTriangle}>
            <code>200 OK</code> (hatta <code>ResultCode</code> başarılı), shipment state’inin doğru
            kaydedildiğini tek başına garanti etmez — event zincirinin tamamlandığını doğrulayın.
          </GuardrailCallout>
          <GuardrailCallout title="Response Received ≠ Persisted" tone="amber" icon={AlertTriangle}>
            Cevap mobil tarafından alınmış olabilir; Room veya UI state güncellemesi yine de
            başarısız olabilir. Response mapping tabloları bu yüzden var.
          </GuardrailCallout>
          <GuardrailCallout title="Retry ≠ Idempotency" tone="red" icon={AlertTriangle}>
            Kuyruğun 3 retry hakkı, işlemin duplicate oluşturmayacağını garanti etmez. Timeout
            sonrası backend işlemi tamamlamış olabilir — status sorgusu / reconciliation gerekir.
          </GuardrailCallout>
          <GuardrailCallout title="Device Time ≠ Server Time" tone="amber" icon={AlertTriangle}>
            <code>scanDateTime</code> ve <code>X-Client-Request-Time</code> cihaz saatinden gelir;
            sunucu zamanı olarak kabul edilmemelidir.
          </GuardrailCallout>
          <GuardrailCallout title="Local State ≠ Source of Truth" tone="amber" icon={AlertTriangle}>
            SharedViewModel (~3600 satır), SharedPreferences ve Room kayıtlarının otorite seviyeleri
            farklıdır; nihai otorite backend shipment state’idir.
          </GuardrailCallout>
          <GuardrailCallout title="Request Model ≠ Database Model" tone="amber" icon={AlertTriangle}>
            Mobil request alanları (ör. <code>DeliveryReq</code>) backend’in{' '}
            <code>DeliveryModel</code>/database yapısıyla birebir aynı olmak zorunda değildir —
            contract doğrulaması alan bazında yapılır.
          </GuardrailCallout>
        </div>
      </PageSection>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Callout icon={ListTree} title="Yeni mapping nasıl eklenir?" tone="blue">
          Kaynak: <code>src/data/engineering/service-atlas.ts</code>. Dört adım: endpoint’i{' '}
          <code>APIService.kt</code>’den doğrula → ekran ve aksiyona bağla → çağrı zincirini
          (Fragment → VM → Repository → API → Room) çıkar → status’ü <em>Detected</em>’dan{' '}
          <em>Reviewed/Verified</em>’a taşı. Statüsü <em>Detected</em> kalan {kpi.detectedOnly}{' '}
          contract dokümantasyon pası bekliyor.
        </Callout>
        <Callout icon={Globe} title="İlişkili bilgi merkezleri" tone="gray">
          Backend Handbook (domain sözleşmeleri), Screen Manual (ekran davranışları), Data Locator
          ve MongoDB/Graylog Query Generator araçları bu atlastaki contract’larla aynı kimlikleri
          kullanır — bir endpoint’i doğrularken önce buradaki <em>EvidenceRef</em> durumuna bakın.
        </Callout>
      </div>

      <ContractDrawer contract={selected} onClose={() => setSelected(null)} />
    </ProductPage>
  )
}

// ─── Screen Navigator (left column) ─────────────────────────────────────────

function ScreenNavigator({
  screenId,
  onSelect,
}: {
  screenId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <aside className="shrink-0 lg:w-64">
      <div className="rounded-xl border bg-background p-3 lg:sticky lg:top-36">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Screen Navigator
          </span>
          {screenId && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              Tümü
            </button>
          )}
        </div>
        <div className="mt-2 max-h-[60vh] space-y-3 overflow-y-auto pr-1 lg:max-h-[calc(100vh-220px)]">
          {JOURNEY_ORDER.map((j) => {
            const screens = ATLAS_SCREENS.filter((s) => s.journey === j)
            if (screens.length === 0) return null
            return (
              <div key={j}>
                <div className="px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/80">
                  {JOURNEY_META[j].label}
                </div>
                <div className="mt-1 space-y-0.5">
                  {screens.map((s) => {
                    const contracts = contractsForScreen(s.id)
                    const hasMismatch = contracts.some(
                      (c) => c.status === 'mismatch' || c.status === 'deprecated',
                    )
                    const allDetected = contracts.every((c) => c.status === 'detected')
                    const active = screenId === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onSelect(active ? null : s.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                          active
                            ? 'bg-blue-100 font-bold text-blue-900 dark:bg-blue-950/60 dark:text-blue-200'
                            : 'text-foreground/85 hover:bg-muted/50',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={cn(
                              'size-1.5 shrink-0 rounded-full',
                              hasMismatch
                                ? 'bg-red-500'
                                : allDetected
                                  ? 'bg-muted-foreground/40'
                                  : contracts.some((c) => c.status === 'verified')
                                    ? 'bg-green-500'
                                    : 'bg-amber-500',
                            )}
                          />
                          <span className="truncate">{s.label}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {contracts.length}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t pt-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-green-500" /> Verified var</span>
          <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" /> Kısmen belgeli</span>
          <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-red-500" /> Contract riski</span>
          <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground/40" /> Taranmadı</span>
        </div>
      </div>
    </aside>
  )
}

// ─── Screen summary strip ───────────────────────────────────────────────────

function ScreenSummary({ screenId, onClear }: { screenId: string; onClear: () => void }) {
  const screen = ATLAS_SCREENS.find((s) => s.id === screenId)
  const contracts = contractsForScreen(screenId)
  if (!screen) return null
  const offline = contracts.filter((c) => c.offline).length
  const external = contracts.filter((c) => c.external).length
  const risky = contracts.filter((c) => c.status === 'mismatch' || c.status === 'deprecated').length
  const multipart = contracts.filter((c) => c.method === 'MULTIPART').length
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">{screen.label}</h2>
            <Badge variant="secondary" appearance="outline" size="xs">
              {JOURNEY_META[screen.journey].label}
            </Badge>
            {screen.file && <code className="text-[11px] text-muted-foreground">{screen.file}</code>}
          </div>
          {screen.desc && <p className="mt-1 text-xs text-muted-foreground">{screen.desc}</p>}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" /> Seçimi kaldır
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Badge variant="secondary" appearance="outline" size="sm">{contracts.length} servis çağrısı</Badge>
        {offline > 0 && <Badge variant="secondary" appearance="outline" size="sm">{offline} offline destekli</Badge>}
        {external > 0 && <Badge variant="secondary" appearance="outline" size="sm">{external} external provider</Badge>}
        {multipart > 0 && <Badge variant="secondary" appearance="outline" size="sm">{multipart} multipart</Badge>}
        {risky > 0 && (
          <Badge variant="destructive" appearance="outline" size="sm">{risky} contract riski</Badge>
        )}
      </div>
    </div>
  )
}
