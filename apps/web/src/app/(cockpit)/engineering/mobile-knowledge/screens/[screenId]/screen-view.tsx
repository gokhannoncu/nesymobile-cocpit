'use client'

// Ekran detay görünümü — User Manual / Engineering Details yoğunluk toggle'ı.

import { AlertTriangle, BookOpen, ChevronRight, Cpu } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@nesy/metronic/components/ui/accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nesy/metronic/components/ui/table'
import {
  Callout,
  DoesDontGrid,
  PageSection,
  SegmentTabs,
  toneCard,
  toneText,
} from '@/components/product'
import {
  FlowDiagram,
  MetaBadgeRow,
  ScreenshotHotspots,
  TonePill,
} from '@/components/engineering/mobile-knowledge'
import type { Screen } from '@/data/engineering/mobile-knowledge/types'

function EntryStepper({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span className={`rounded-lg border px-3 py-1.5 text-sm ${toneCard.blue} ${toneText.blue}`}>{s}</span>
          {i < steps.length - 1 && <ChevronRight className="size-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  )
}

function UserManual({ screen }: { screen: Screen }) {
  return (
    <div className="space-y-8">
      <PageSection eyebrow="Amaç" title="Ekranın amacı" tone={screen.tone}>
        <Callout icon={BookOpen} tone={screen.tone}>
          {screen.purpose}
        </Callout>
      </PageSection>

      {screen.entryFlow?.length ? (
        <PageSection eyebrow="Giriş" title="Bu ekrana nasıl gelinir?" tone="blue">
          <EntryStepper steps={screen.entryFlow} />
        </PageSection>
      ) : null}

      {screen.hotspots?.length ? (
        <PageSection eyebrow="Anatomi" title="Arayüz anatomisi" tone="indigo">
          <ScreenshotHotspots hotspots={screen.hotspots} screenTitle={screen.title} />
        </PageSection>
      ) : null}

      {screen.steps?.length ? (
        <PageSection eyebrow="Adımlar" title="Kullanıcı adımları" tone="teal">
          <ol className="space-y-3">
            {screen.steps.map((st, i) => (
              <li key={st.title} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="font-medium">{st.title}</span>
                </div>
                <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs uppercase text-muted-foreground">Kullanıcı</dt><dd>{st.user}</dd></div>
                  <div><dt className="text-xs uppercase text-muted-foreground">Sistem</dt><dd>{st.system}</dd></div>
                  {st.blockedWhen && <div><dt className="text-xs uppercase text-muted-foreground">İlerleyemez</dt><dd>{st.blockedWhen}</dd></div>}
                  {st.error && <div><dt className="text-xs uppercase text-muted-foreground">Hata</dt><dd>{st.error}</dd></div>}
                </dl>
              </li>
            ))}
          </ol>
        </PageSection>
      ) : null}

      {screen.buttons?.length ? (
        <PageSection eyebrow="Rehber" title="Buton ve alan rehberi" tone="blue">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UI öğesi</TableHead>
                  <TableHead>Ne işe yarar?</TableHead>
                  <TableHead>Ne zaman aktif?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {screen.buttons.map((b) => (
                  <TableRow key={b.element}>
                    <TableCell className="font-medium">{b.element}</TableCell>
                    <TableCell>{b.purpose}</TableCell>
                    <TableCell className="text-muted-foreground">{b.activeWhen}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </PageSection>
      ) : null}

      {screen.commonProblems?.length ? (
        <PageSection eyebrow="Durumlar" title="Sık karşılaşılan durumlar" icon={AlertTriangle} tone="amber">
          <Accordion type="single" collapsible className="rounded-xl border">
            {screen.commonProblems.map((p) => (
              <AccordionItem key={p.id} value={p.id}>
                <AccordionTrigger className="px-4">{p.title}</AccordionTrigger>
                <AccordionContent className="px-4">
                  <dl className="space-y-2">
                    {p.rows.map((r) => (
                      <div key={r.label} className="grid gap-1 sm:grid-cols-[180px_1fr]">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{r.label}</dt>
                        <dd className="text-sm">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </PageSection>
      ) : null}

      {screen.does?.length || screen.dont?.length ? (
        <PageSection eyebrow="Sınır" title="Bu ekran ne yapar / ne yapmaz?" tone="green">
          <DoesDontGrid does={screen.does ?? []} dont={screen.dont ?? []} />
        </PageSection>
      ) : null}
    </div>
  )
}

function KeyValueList({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col">
          <dt className="text-xs uppercase text-muted-foreground">{r.label}</dt>
          <dd className="font-mono text-sm">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function EngineeringDetails({ screen }: { screen: Screen }) {
  return (
    <div className="space-y-8">
      {screen.architecture?.length ? (
        <PageSection eyebrow="1" title="Screen architecture" icon={Cpu} tone="indigo">
          <KeyValueList rows={screen.architecture} />
        </PageSection>
      ) : null}

      {screen.entryConditions?.length ? (
        <PageSection eyebrow="2" title="Entry conditions" tone="blue">
          <ul className="grid gap-2 sm:grid-cols-2">
            {screen.entryConditions.map((c) => (
              <li key={c} className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {c}
              </li>
            ))}
          </ul>
        </PageSection>
      ) : null}

      {screen.localState?.length ? (
        <PageSection eyebrow="3" title="Local state" tone="amber">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Kalıcılık</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {screen.localState.map((s) => (
                  <TableRow key={s.state}>
                    <TableCell className="font-mono text-xs">{s.state}</TableCell>
                    <TableCell>{s.source}</TableCell>
                    <TableCell>{s.persistence}</TableCell>
                    <TableCell className="text-muted-foreground">{s.risk}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </PageSection>
      ) : null}

      {screen.backendCalls?.length ? (
        <PageSection eyebrow="4" title="Backend calls" tone="teal">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User action</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Success</TableHead>
                  <TableHead>Failure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {screen.backendCalls.map((b) => (
                  <TableRow key={b.action}>
                    <TableCell className="font-medium">{b.action}</TableCell>
                    <TableCell className="font-mono text-xs">{b.endpoint}</TableCell>
                    <TableCell className="text-green-600">{b.success}</TableCell>
                    <TableCell className="text-red-500">{b.failure}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </PageSection>
      ) : null}

      {screen.eventChain?.length ? (
        <PageSection eyebrow="5" title="Event chain" tone="blue">
          <FlowDiagram steps={screen.eventChain} />
        </PageSection>
      ) : null}

      {screen.validation?.length ? (
        <PageSection eyebrow="6" title="Validation rules" tone="red">
          <ul className="grid gap-2 sm:grid-cols-2">
            {screen.validation.map((v) => (
              <li key={v} className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-400" />
                {v}
              </li>
            ))}
          </ul>
        </PageSection>
      ) : null}

      {screen.analytics?.length ? (
        <PageSection eyebrow="7" title="Analytics events" tone="purple">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Parameters</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {screen.analytics.map((a) => (
                  <TableRow key={a.event}>
                    <TableCell className="font-mono text-xs">{a.event}</TableCell>
                    <TableCell>{a.trigger}</TableCell>
                    <TableCell className="text-muted-foreground">{a.params}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </PageSection>
      ) : null}

      {screen.tests?.length ? (
        <PageSection eyebrow="8" title="Test scenarios" tone="green">
          <div className="flex flex-wrap gap-2">
            {screen.tests.map((t) => (
              <TonePill key={t} tone="green">{t}</TonePill>
            ))}
          </div>
        </PageSection>
      ) : null}
    </div>
  )
}

export function ScreenView({ screen }: { screen: Screen }) {
  return (
    <div className="min-w-0 flex-1 space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{screen.title}</h1>
          <p className="mt-1 text-muted-foreground">{screen.subtitle}</p>
        </div>
        <MetaBadgeRow meta={screen.meta} />
      </header>

      {!screen.documented ? (
        <>
          <Callout icon={BookOpen} tone={screen.tone}>
            {screen.purpose}
          </Callout>
          <Callout icon={AlertTriangle} tone="amber" title="Henüz belgelenmedi">
            Bu ekran için User Manual ve Engineering Details içeriği henüz yazılmadı. Yapı
            hazır; owner tarafından doldurulmayı bekliyor.
          </Callout>
        </>
      ) : (
        <SegmentTabs
          variant="button"
          items={[
            { value: 'user', label: 'User Manual', icon: BookOpen, content: <UserManual screen={screen} /> },
            { value: 'eng', label: 'Engineering Details', icon: Cpu, content: <EngineeringDetails screen={screen} /> },
          ]}
        />
      )}
    </div>
  )
}
