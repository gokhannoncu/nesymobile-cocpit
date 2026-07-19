'use client'

// Backend Handbook — the mobile engineer's reference for the backend estate:
// gateway routing & auth, per-service topic catalog, key contract models.
// Data source: src/data/engineering/backend-handbook.ts (extracted from the
// real NesyMobileArchive projects). Exemplar-first: Task/Shipment/Auth full,
// the rest stubs.

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  FileJson,
  Globe,
  Layers,
  Network,
  Search,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  Callout,
  GuardrailCallout,
  HeroCallout,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
  toneCard,
  toneDot,
  toneText,
} from '@/components/product'
import {
  HANDBOOK_CONVENTIONS,
  HANDBOOK_GATEWAY,
  HANDBOOK_GATEWAY_ENDPOINTS,
  HANDBOOK_MODELS,
  HANDBOOK_SCAN_DATE,
  HANDBOOK_SERVICES,
  type HandbookService,
  type HandbookTopic,
  type TopicGroup,
} from '@/data/engineering/backend-handbook'

export default function BackendHandbookPage() {
  const [serviceId, setServiceId] = useState('task')
  const [search, setSearch] = useState('')

  const documented = HANDBOOK_SERVICES.filter((s) => s.documented).length
  const service = HANDBOOK_SERVICES.find((s) => s.id === serviceId) ?? HANDBOOK_SERVICES[0]!

  return (
    <ProductPage path="/engineering/backend-handbook">
      <HeroCallout
        icon={BookOpen}
        eyebrow="Mobile Knowledge"
        tone="indigo"
        title="Backend Handbook"
        lead="Mobil mühendisin backend sözlüğü: istek gateway’den hangi servise gider, o serviste hangi topic’ler yaşar, sözleşme modelleri hangi alanları taşır? Endpoint-ekran eşleşmesi için Mobile Service Atlas’a, backend’in kendisini anlamak için buraya bakılır."
        chips={[
          `${HANDBOOK_SERVICES.length} servis grubu`,
          `${HANDBOOK_GATEWAY_ENDPOINTS} gateway endpoint (dev config)`,
          'KrakenD 2.11 + Go plugin',
          `Son kod taraması: ${HANDBOOK_SCAN_DATE}`,
        ]}
      >
        <StatGrid cols={2}>
          <StatCard
            label="Tam belgeli servis"
            value={documented}
            tone="green"
            icon={ShieldCheck}
            hint="Task, Shipment ve Auth/Identity topic katalogları çıkarıldı"
          />
          <StatCard
            label="Stub servis"
            value={HANDBOOK_SERVICES.length - documented}
            tone="amber"
            icon={Layers}
            hint="Özet + yönlendirme hazır; topic katalogu dokümantasyon pası bekliyor"
          />
        </StatGrid>
      </HeroCallout>

      {/* Gateway */}
      <PageSection
        eyebrow="1 · Gateway"
        title="İstek backend’e nasıl girer?"
        description="Tüm mobil trafik KrakenD gateway’den geçer: path’in ilk segmenti servisi, ikincisi topic’i seçer. Auth dört aşamalı bir pipeline’da gateway’de çözülür."
        icon={Network}
        tone="indigo"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <div className="rounded-xl border bg-background p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Routing konvansiyonu
            </div>
            <div className="mt-2 space-y-2">
              {HANDBOOK_GATEWAY.routes.map((r) => (
                <div key={r.pattern} className="text-xs">
                  <code className="font-semibold text-foreground">{r.pattern}</code>
                  <p className="mt-0.5 text-muted-foreground">{r.note}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
              {HANDBOOK_GATEWAY.injected} Envelope:{' '}
              <code>{HANDBOOK_GATEWAY.envelope}</code>
            </p>
          </div>
          <div className="space-y-3.5">
            <div className="rounded-xl border bg-background p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Auth pipeline — {HANDBOOK_GATEWAY.pluginFile}
              </div>
              <ol className="mt-2 space-y-2">
                {HANDBOOK_GATEWAY.authPipeline.map((s, i) => (
                  <li key={s.step} className="flex items-start gap-2 text-xs">
                    <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white', toneDot.indigo)}>
                      {i + 1}
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{s.step}: </span>
                      <span className="text-foreground/75">{s.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className={cn('rounded-xl border p-4', toneCard.indigo)}>
              <div className={cn('text-xs font-bold uppercase tracking-wide', toneText.indigo)}>
                Tenant’lar & bilinen boşluklar
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{HANDBOOK_GATEWAY.tenants}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{HANDBOOK_GATEWAY.gaps}</p>
            </div>
          </div>
        </div>
      </PageSection>

      {/* Service catalog */}
      <PageSection
        eyebrow="2 · Servis katalogu"
        title="Hangi serviste ne yaşar?"
        description="Soldan servis seçin; sağda topic grupları, sözleşme modelleri ve dikkat notları. Topic araması seçili servisin kataloğunu filtreler."
        icon={Layers}
        tone="indigo"
      >
        <div className="flex flex-col gap-4 lg:flex-row">
          <aside className="shrink-0 lg:w-72">
            <div className="rounded-xl border bg-background p-2.5">
              {HANDBOOK_SERVICES.map((s) => {
                const active = s.id === service.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(s.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                      active
                        ? 'bg-indigo-100 font-bold text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200'
                        : 'text-foreground/85 hover:bg-muted/50',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          s.documented ? 'bg-green-500' : 'bg-muted-foreground/40',
                        )}
                      />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {s.port ? `:${s.port}` : ''}
                    </span>
                  </button>
                )
              })}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t px-1 pt-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-green-500" /> Topic katalogu tam</span>
                <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground/40" /> Stub</span>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <ServiceDetail service={service} search={search} onSearch={setSearch} />
          </div>
        </div>
      </PageSection>

      {/* Key models */}
      <PageSection
        eyebrow="3 · Sözleşme modelleri"
        title="Kritik request/response modelleri"
        description="Mobil tarafın map olduğu backend sözleşmeleri — alan bazlı contract review’un referansı. “→” ile başlayan satırlar response alanlarıdır."
        icon={FileJson}
        tone="indigo"
      >
        <div className="space-y-3">
          {HANDBOOK_MODELS.map((m) => (
            <ModelCard key={m.name} model={m} />
          ))}
        </div>
      </PageSection>

      {/* Conventions */}
      <PageSection
        eyebrow="4 · Konvansiyonlar"
        title="Handbook’u okurken akılda tutulacaklar"
        icon={ShieldCheck}
        tone="red"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {HANDBOOK_CONVENTIONS.map((c) => (
            <GuardrailCallout key={c.title} title={c.title} tone={c.tone} icon={AlertTriangle}>
              {c.body}
            </GuardrailCallout>
          ))}
        </div>
      </PageSection>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Callout icon={Globe} title="Mobile Service Atlas ile ilişki" tone="blue">
          Bu handbook backend’in <em>kendi</em> yapısını anlatır; bir mobil ekranın hangi
          endpoint’i, hangi zincirle çağırdığını görmek için{' '}
          <a href="/engineering/mobile-service-atlas" className="font-semibold underline underline-offset-2">
            Mobile Service Atlas
          </a>
          ’a geçin — contract kimlikleri (path/topic) iki sayfada aynıdır.
        </Callout>
        <Callout icon={Zap} title="Yeni servis nasıl belgelenir?" tone="indigo">
          Kaynak: <code>src/data/engineering/backend-handbook.ts</code>. İlgili servisin{' '}
          <code>Operations/*.cs</code> dosyalarındaki public Task metodlarını topic gruplarına
          dök, event-driven olanları işaretle, <code>documented:true</code> yap. Şablon olarak
          TaskWebAPI kaydını kullan.
        </Callout>
      </div>
    </ProductPage>
  )
}

// ─── Service detail ─────────────────────────────────────────────────────────

function matchTopic(t: HandbookTopic, q: string) {
  const hay = `${t.topic} ${t.request ?? ''} ${t.response ?? ''} ${t.note ?? ''}`.toLowerCase()
  return q.split(/\s+/).every((part) => hay.includes(part))
}

function ServiceDetail({
  service: s,
  search,
  onSearch,
}: {
  service: HandbookService
  search: string
  onSearch: (v: string) => void
}) {
  const q = search.trim().toLowerCase()
  const groups = useMemo(() => {
    if (!s.topicGroups) return []
    if (!q) return s.topicGroups
    return s.topicGroups
      .map((g) => ({ ...g, topics: g.topics.filter((t) => matchTopic(t, q)) }))
      .filter((g) => g.topics.length > 0)
  }, [s, q])

  const topicCount = s.topicGroups?.reduce((a, g) => a + g.topics.length, 0) ?? 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('size-2.5 rounded-full', toneDot[s.tone])} />
          <h3 className="text-base font-bold text-foreground">{s.name}</h3>
          {s.port && <Badge variant="secondary" appearance="outline" size="xs">:{s.port}</Badge>}
          {s.prefixes.map((p) => (
            <Badge key={p} variant="secondary" appearance="outline" size="xs">
              <code>{p.startsWith('(') ? p : `/${p}`}</code>
            </Badge>
          ))}
          <Badge
            variant={s.documented ? 'secondary' : 'destructive'}
            appearance="outline"
            size="xs"
          >
            {s.documented ? `${topicCount} topic belgeli` : 'Stub — dokümantasyon bekliyor'}
          </Badge>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/85">{s.summary}</p>
      </div>

      {s.topicGroups ? (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(ev) => onSearch(ev.target.value)}
              placeholder={`${s.name} içinde topic, model veya not ara…`}
              className="h-9 w-full rounded-lg border bg-background pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-indigo-500/30"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {groups.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aramaya uyan topic yok.
            </div>
          )}
          {groups.map((g) => (
            <TopicGroupCard key={g.title} group={g} defaultOpen={!!q || groups.length <= 3} />
          ))}
        </>
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Bu servisin topic katalogu henüz çıkarılmadı. Canlı envanter için{' '}
          <code>GET /{s.prefixes[0]}/Info</code> veya <code>GET /OpenApi/{s.prefixes[0]}</code>{' '}
          kullanılabilir; kalıcı dokümantasyon için <code>backend-handbook.ts</code> içine topic
          grupları eklenmelidir.
        </div>
      )}

      {s.notes && (
        <div className={cn('rounded-xl border p-4', toneCard.amber)}>
          <div className={cn('text-xs font-bold uppercase tracking-wide', toneText.amber)}>
            Dikkat notları
          </div>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-foreground/85">
            {s.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function TopicGroupCard({ group: g, defaultOpen }: { group: TopicGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/30"
      >
        <span className="min-w-0">
          <span className="text-sm font-bold text-foreground">{g.title}</span>
          <span className="ml-2 text-xs text-muted-foreground">{g.topics.length} topic</span>
          {g.source && (
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              <code>{g.source}</code>
            </span>
          )}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {g.topics.map((t) => (
                <tr key={t.topic} className="border-b last:border-b-0">
                  <td className="w-2/5 px-4 py-2 align-top">
                    <code className="font-semibold text-foreground">{t.topic}</code>
                    <span className="ml-1.5 inline-flex gap-1 align-middle">
                      {t.multipart && <Badge variant="secondary" size="xs">multipart</Badge>}
                      {t.eventDriven && (
                        <Badge variant="destructive" appearance="outline" size="xs">event</Badge>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-muted-foreground">
                    {t.request && <code>{t.request}</code>}
                    {t.response && (
                      <>
                        {' '}→ <code>{t.response}</code>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-foreground/75">{t.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Model card ─────────────────────────────────────────────────────────────

function ModelCard({ model: m }: { model: (typeof HANDBOOK_MODELS)[number] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/30"
      >
        <span className="min-w-0">
          <code className="text-sm font-bold text-foreground">{m.name}</code>
          <span className="mt-0.5 block text-xs text-muted-foreground">{m.desc}</span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t">
          <div className="px-4 py-2 text-[11px] text-muted-foreground">
            <code>{m.file}</code>
          </div>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {m.fields.map((f) => (
                <tr key={f.name} className="border-t">
                  <td className="w-1/3 px-4 py-1.5 align-top">
                    <code className={cn('font-semibold', f.name.startsWith('→') ? toneText.green : 'text-foreground')}>
                      {f.name}
                    </code>
                  </td>
                  <td className="w-24 px-3 py-1.5 align-top text-muted-foreground">{f.type ?? ''}</td>
                  <td className="px-3 py-1.5 align-top text-foreground/75">{f.desc ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
