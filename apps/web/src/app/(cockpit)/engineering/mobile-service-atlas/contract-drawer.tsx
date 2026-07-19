'use client'

// Service Contract Drawer — endpoint detail with Overview / Request / Response /
// Headers / Mobile Mapping / Errors / Offline / Tests tabs.

import { ReactNode } from 'react'
import {
  ArrowDown,
  CheckCircle2,
  CloudOff,
  FileJson,
  FlaskConical,
  ListTree,
  Radio,
  ScrollText,
  Target,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@nesy/metronic/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'
import { toneCard, toneDot, toneText } from '@/components/product'
import {
  backendServiceForPath,
  CHAIN_LAYER_META,
  COMMON_HEADERS,
  DOMAIN_META,
  OFFLINE_QUEUE_FACTS,
  screenById,
  type AtlasContract,
} from '@/data/engineering/service-atlas'
import { MethodBadge, StatusCell } from './views'

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Target
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="mt-2 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="w-32 shrink-0 font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground/85">{children}</span>
    </div>
  )
}

const th =
  'px-2.5 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
const td = 'px-2.5 py-1.5 align-top text-xs text-foreground/85'

function MiniTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-xs">
        <thead className="border-b bg-muted/40">
          <tr>
            {headers.map((h) => (
              <th key={h} className={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b last:border-b-0">
              {cells.map((c, j) => (
                <td key={j} className={td}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground/90">
      <code>{code}</code>
    </pre>
  )
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
      {children}
    </div>
  )
}

export function ContractDrawer({
  contract,
  onClose,
}: {
  contract: AtlasContract | null
  onClose: () => void
}) {
  const c = contract
  const screen = c ? screenById(c.screen) : undefined
  const service = c ? backendServiceForPath(c.path) : undefined
  return (
    <Sheet open={!!c} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden p-0">
        {c && (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="flex flex-wrap items-center gap-2 text-base">
                <MethodBadge contract={c} />
                <code className="text-sm font-bold">{c.path}</code>
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <StatusCell status={c.status} />
                <Badge variant="secondary" appearance="outline" size="xs">
                  {DOMAIN_META[c.domain].label}
                </Badge>
                {screen && (
                  <Badge variant="secondary" appearance="outline" size="xs">
                    {screen.label} · {c.action}
                  </Badge>
                )}
                {c.offline && (
                  <Badge variant="secondary" size="xs">Offline queue</Badge>
                )}
                {c.waiting && <Badge variant="secondary" size="xs">120 sn undo</Badge>}
                {c.protectedKey && <Badge variant="secondary" size="xs">Protected key</Badge>}
                {c.external && <Badge variant="destructive" appearance="outline" size="xs">{c.external}</Badge>}
              </div>
            </SheetHeader>
            <SheetBody className="h-[calc(100vh-108px)] overflow-y-auto px-5 py-4">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList variant="line" size="sm" className="mb-4 flex-wrap justify-start">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="request">Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                  <TabsTrigger value="mapping">Mobile Mapping</TabsTrigger>
                  <TabsTrigger value="errors">Errors</TabsTrigger>
                  {c.offline && <TabsTrigger value="offline">Offline</TabsTrigger>}
                  <TabsTrigger value="tests">Tests</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-5">
                  <Section icon={Target} title="Özet">
                    <p>{c.summary ?? 'Bu contract koddan tespit edildi; henüz dokümantasyon pası yapılmadı.'}</p>
                    <div className="mt-3 space-y-1.5">
                      <Fact label="Domain">{DOMAIN_META[c.domain].label} — {DOMAIN_META[c.domain].desc}</Fact>
                      <Fact label="Backend service">
                        {service ? `${service.name}${service.port ? ` (:${service.port})` : ''} — ${service.desc}` : 'Gateway routing ile belirlenir'}
                      </Fact>
                      <Fact label="Mobile caller">
                        <code>{c.codeRefs?.[0]?.file ?? screen?.file ?? '—'}</code>
                      </Fact>
                      <Fact label="Request / Response">
                        <code>{c.requestModel}</code> → <code>{c.responseModel}</code>
                      </Fact>
                      <Fact label="Auth">{c.auth ? 'Bearer token (AuthInterceptor)' : 'Anonim'}</Fact>
                      <Fact label="Owner">{c.owner ?? 'Atanmamış'}</Fact>
                      <Fact label="Son doğrulama">{c.lastChecked ?? 'Hiç'}</Fact>
                    </div>
                  </Section>
                  {c.trigger && (
                    <Section icon={Radio} title="Ne zaman çağrılır?">
                      <p>{c.trigger}</p>
                    </Section>
                  )}
                  {c.preconditions && (
                    <Section icon={CheckCircle2} title="Çağrı öncesi koşullar">
                      <ul className="list-disc space-y-1 pl-4 text-xs">
                        {c.preconditions.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </Section>
                  )}
                  {c.postEffects && (
                    <Section icon={ArrowDown} title="Çağrı sonrası">
                      <ul className="list-disc space-y-1 pl-4 text-xs">
                        {c.postEffects.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </Section>
                  )}
                  {c.notes && (
                    <div className={cn('rounded-lg border p-3 text-xs leading-relaxed', toneCard.amber)}>
                      <span className={cn('font-bold', toneText.amber)}>Not: </span>
                      {c.notes}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="request" className="space-y-5">
                  <Fact label="Request modeli"><code>{c.requestModel}</code></Fact>
                  {c.requestFields ? (
                    <MiniTable
                      headers={['Field', 'Type', 'Required', 'Source', 'Validation', 'Sensitive']}
                      rows={c.requestFields.map((f) => [
                        <code key="f" className="font-semibold">{f.field}</code>,
                        f.type,
                        f.required === 'yes' ? 'Yes' : f.required === 'no' ? 'No' : 'Conditional',
                        <span key="s" className="font-medium text-foreground">{f.source}</span>,
                        f.validation ?? '—',
                        f.sensitive ? <span key="x" className={toneText.red}>Yes</span> : 'No',
                      ])}
                    />
                  ) : (
                    <EmptyHint>
                      Request şeması henüz çıkarılmadı. Kaynak: mobil model sınıfı{' '}
                      <code>{c.requestModel}</code> — dokümantasyon pası bekleniyor.
                    </EmptyHint>
                  )}
                  {c.requestExample && (
                    <Section icon={FileJson} title="JSON örneği">
                      <CodeBlock code={c.requestExample} />
                    </Section>
                  )}
                  <div className={cn('rounded-lg border p-3 text-xs', toneCard.blue)}>
                    <span className={cn('font-bold', toneText.blue)}>Source kolonu neden önemli? </span>
                    Bir request alanının mobilde nereden geldiği (user input, currentTask, Room,
                    SharedPreferences, device, önceki response) hata ayıklamada ilk bakılacak yerdir.
                  </div>
                </TabsContent>

                <TabsContent value="response" className="space-y-5">
                  <Fact label="Response modeli"><code>{c.responseModel}</code></Fact>
                  <Fact label="Envelope">
                    <code>BaseResponse {'{ ResultCode, ResultMessage, Payload }'}</code> — gateway standardı
                  </Fact>
                  {c.responseExample && (
                    <Section icon={FileJson} title="Success örneği">
                      <CodeBlock code={c.responseExample} />
                    </Section>
                  )}
                  {c.responseMapping ? (
                    <Section icon={ListTree} title="Response mapping — cevap mobilde neye dönüşür?">
                      <MiniTable
                        headers={['Response field', 'Mobile destination', 'Action']}
                        rows={c.responseMapping.map((m) => [
                          <code key="f">{m.field}</code>,
                          <span key="d" className="font-medium text-foreground">{m.destination}</span>,
                          m.action,
                        ])}
                      />
                    </Section>
                  ) : (
                    <EmptyHint>Response mapping henüz dokümante edilmedi.</EmptyHint>
                  )}
                </TabsContent>

                <TabsContent value="headers" className="space-y-5">
                  <Section icon={ScrollText} title="Ortak header’lar (AuthInterceptor — her istekte)">
                    <MiniTable
                      headers={['Header', 'Kaynak', 'Örnek']}
                      rows={COMMON_HEADERS.map((h) => [
                        <code key="h" className="font-semibold">{h.header}</code>,
                        h.source,
                        <code key="e">{h.example}</code>,
                      ])}
                    />
                  </Section>
                  {c.extraHeaders && (
                    <Section icon={ScrollText} title="Endpoint’e özel header’lar">
                      <MiniTable
                        headers={['Header', 'Kullanım']}
                        rows={c.extraHeaders.map((h) => [
                          <code key="h" className="font-semibold">{h.header}</code>,
                          h.usage,
                        ])}
                      />
                    </Section>
                  )}
                  <div className={cn('rounded-lg border-2 border-dashed p-3 text-xs', toneCard.amber)}>
                    <span className={cn('font-bold', toneText.amber)}>Guardrail: </span>
                    Authorization, token ve cihaz kimlikleri doküman örneklerinde her zaman maskelenir.
                  </div>
                </TabsContent>

                <TabsContent value="mapping" className="space-y-5">
                  {c.chain ? (
                    <Section icon={ListTree} title="Çağrı zinciri">
                      <ol className="relative ms-2 space-y-0 border-s border-border/60 ps-4">
                        {c.chain.map((step, i) => {
                          const meta = CHAIN_LAYER_META[step.layer]
                          return (
                            <li key={i} className="relative pb-3 last:pb-0">
                              <span
                                className={cn(
                                  'absolute -start-[1.3rem] top-1 size-2.5 rounded-full ring-2 ring-background',
                                  toneDot[meta.tone],
                                )}
                              />
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={cn('text-[10px] font-bold uppercase tracking-wide', toneText[meta.tone])}>
                                  {meta.label}
                                </span>
                                <span className="text-xs font-semibold text-foreground">{step.label}</span>
                              </div>
                              {step.detail && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{step.detail}</p>
                              )}
                            </li>
                          )
                        })}
                      </ol>
                    </Section>
                  ) : (
                    <EmptyHint>
                      Çağrı zinciri henüz çıkarılmadı. Genel desen: Fragment → SharedViewModel →
                      MainRepository → ApiProvider → APIService{c.offline ? ' (offline yazımlar Request kuyruğu üzerinden)' : ''}.
                    </EmptyHint>
                  )}
                  {c.codeRefs && (
                    <Section icon={ScrollText} title="Kod referansları">
                      <MiniTable
                        headers={['Layer', 'File', 'Method']}
                        rows={c.codeRefs.map((r) => [
                          r.layer,
                          <code key="f">{r.file}</code>,
                          <code key="m">{r.method}</code>,
                        ])}
                      />
                    </Section>
                  )}
                </TabsContent>

                <TabsContent value="errors" className="space-y-5">
                  {c.errors ? (
                    <MiniTable
                      headers={['Durum', 'Backend', 'Mobil davranışı', 'Kullanıcı sonucu']}
                      rows={c.errors.map((e) => [
                        <span key="s" className="font-semibold">{e.status}</span>,
                        e.backend,
                        e.mobile,
                        e.user,
                      ])}
                    />
                  ) : (
                    <EmptyHint>
                      Hata haritası henüz dokümante edilmedi. Global davranış: 401 →
                      ErrorInterceptor logout; 404 → server error dialog; versiyon uyuşmazlığı →
                      zorunlu logout.
                    </EmptyHint>
                  )}
                  <div className={cn('rounded-lg border-2 border-dashed p-3 text-xs leading-relaxed', toneCard.red)}>
                    <span className={cn('font-bold', toneText.red)}>Ambiguous result: </span>
                    Timeout oluştuğunda backend işlemi tamamlamış olabilir. Aynı isteği yeniden
                    göndermeden önce idempotency veya status sorgusu düşünülmelidir — HTTP retry ile
                    business retry aynı şey değildir.
                  </div>
                </TabsContent>

                {c.offline && (
                  <TabsContent value="offline" className="space-y-5">
                    <Section icon={CloudOff} title="Offline davranış">
                      <div className="space-y-1.5">
                        <Fact label="Queue table">{OFFLINE_QUEUE_FACTS.entity}</Fact>
                        <Fact label="Service">{OFFLINE_QUEUE_FACTS.service}</Fact>
                        <Fact label="Drain">{OFFLINE_QUEUE_FACTS.drainInterval}</Fact>
                        {c.waiting && <Fact label="Undo penceresi">{OFFLINE_QUEUE_FACTS.waitingWindow}</Fact>}
                        <Fact label="Max retry">{OFFLINE_QUEUE_FACTS.maxRetry}</Fact>
                        <Fact label="Retry politikası">{OFFLINE_QUEUE_FACTS.retryPolicy}</Fact>
                        <Fact label="Housekeeping">{OFFLINE_QUEUE_FACTS.housekeeping}</Fact>
                      </div>
                    </Section>
                    <div className={cn('rounded-lg border-2 border-dashed p-3 text-xs', toneCard.amber)}>
                      <span className={cn('font-bold', toneText.amber)}>Guardrail: </span>
                      uniqueKey dedup mobil tarafta duplicate insert’i engeller; backend idempotency
                      ayrı bir garanti gerektirir (retry ≠ idempotency).
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="tests" className="space-y-5">
                  {c.tests ? (
                    <MiniTable
                      headers={['Test', 'Durum', 'Ortam']}
                      rows={c.tests.map((t) => [
                        t.name,
                        <span
                          key="s"
                          className={cn(
                            'font-semibold',
                            t.status === 'covered' && toneText.green,
                            t.status === 'partial' && toneText.amber,
                            t.status === 'missing' && toneText.red,
                          )}
                        >
                          {t.status === 'covered' ? '✓ Covered' : t.status === 'partial' ? '◐ Partial' : '○ Missing'}
                        </span>,
                        t.env ?? '—',
                      ])}
                    />
                  ) : (
                    <EmptyHint>Bu contract için test kapsamı henüz çıkarılmadı.</EmptyHint>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FlaskConical className="size-3.5" />
                    Eksik testler Edge Case Intelligence test planına eklenmelidir.
                  </div>
                </TabsContent>
              </Tabs>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
