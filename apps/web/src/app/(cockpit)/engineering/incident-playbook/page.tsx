'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowRightLeft,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  FileSearch,
  FlaskConical,
  GitBranch,
  History,
  Landmark,
  Lock,
  MapPin,
  Megaphone,
  MonitorCheck,
  Radio,
  SearchCode,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Timer,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  IncidentLiveRail,
  IncidentSessionPanel,
  useEngineeringIncidentSession,
} from '@/components/engineering/incident-session'
import {
  Callout,
  CardGrid,
  HeroCallout,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
  type Tone,
  toneCard,
  toneDot,
  toneIcon,
  toneText,
} from '@/components/product'
import {
  INCIDENT_GROUPS,
  INCIDENT_STATS,
  SEVERITY_PROTOCOL,
} from '@/data/engineering/incidents'
import {
  AUTO_UPDATED_SYSTEMS,
  CHECKLIST_COLUMNS,
  CLOSING_OPERATIONAL,
  CLOSING_TECHNICAL,
  COMMS_AUDIENCES,
  COMMS_TEMPLATE,
  DESTRUCTIVE_ACTIONS,
  DIAGNOSIS_SCREENS,
  EVIDENCE_ITEMS,
  EXIT_CRITERIA,
  FINGERPRINT_SIGNALS,
  FIRST_15_PROTOCOL,
  HYPOTHESES,
  HYPOTHESIS_STATUS_TONE,
  IMPACT_COMPARISONS,
  IMPACT_FIELDS,
  INCIDENT_ROLES,
  MATCH_RESULTS,
  MITIGATION_CARD_FIELDS,
  MITIGATION_OPTIONS,
  POSTMORTEM_STRUCTURE,
  ROUTING_TREE,
  SEV1_ACTIONS,
  SEVERITY_QUESTIONS,
  SMALL_INCIDENT_STRUCTURE,
  STATUS_FLOW,
  TRIAGE_QUESTIONS,
} from '@/data/engineering/incident-command'

// ---------------------------------------------------------------------------
// 1. Is this an incident? — interactive triage
// ---------------------------------------------------------------------------

function TriageSection() {
  const [answers, setAnswers] = useState<Record<string, number | null>>({})

  const verdict = useMemo(() => {
    const picked = TRIAGE_QUESTIONS.map((q) => {
      const idx = answers[q.id]
      return idx == null ? null : (q.options[idx]?.weight ?? null)
    })
    if (picked.some((w) => w == null)) return null
    const total = (picked as number[]).reduce((a, b) => a + b, 0)
    const max = Math.max(...(picked as number[]))
    if (total <= 2) {
      return {
        tone: 'gray' as Tone,
        title: 'Incident değil',
        text: 'Normal Ticket Triage → backlog önceliği → ilgili ekip. Bu sayfadan ayrılabilirsiniz.',
      }
    }
    if (max >= 3) {
      return {
        tone: 'red' as Tone,
        title: 'Güçlü incident sinyali — SEV-1 adayı',
        text: 'Sonraki adım: "Bu daha önce yaşandı mı?" kontrolü. Mali/fiscal/veri kaybı riski varsa doğrudan SEV-1 değerlendirmesine geçin.',
      }
    }
    return {
      tone: 'orange' as Tone,
      title: 'Incident olasılığı var',
      text: 'Sonraki adım: "Bu daha önce yaşandı mı?" kontrolü — eşleşme yoksa etki kapsamına göre SEV-2/SEV-3.',
    }
  }, [answers])

  return (
    <PageSection
      id="triage"
      eyebrow="Adım 1 · Detect"
      title="Bu bir incident mı?"
      icon={SearchCode}
      tone="blue"
      description="Grup ve dosya seçiminden önce dört soruyu yanıtlayın: Etki sürüyor mu, akış engellendi mi, kapsam nedir, bir risk türü var mı?"
    >
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {TRIAGE_QUESTIONS.map((q, qi) => (
          <div key={q.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {qi + 1}
              </span>
              {q.question}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {q.options.map((o, oi) => {
                const active = answers[q.id] === oi
                return (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: active ? null : oi }))}
                    className={cn(
                      'rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                      active
                        ? o.weight >= 3
                          ? 'border-red-500 bg-red-500/10 font-semibold text-red-700 dark:text-red-300'
                          : o.weight > 0
                            ? 'border-orange-500 bg-orange-500/10 font-semibold text-orange-700 dark:text-orange-300'
                            : 'border-green-500 bg-green-500/10 font-semibold text-green-700 dark:text-green-300'
                        : 'border-border bg-muted/40 text-foreground/80 hover:bg-muted',
                    )}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {verdict ? (
        <Callout icon={verdict.tone === 'gray' ? CheckCircle2 : Siren} title={verdict.title} tone={verdict.tone}>
          {verdict.text}
        </Callout>
      ) : (
        <Callout icon={AlertTriangle} title="Sistem kararı" tone="gray">
          Dört sorunun tamamını yanıtlayın — sistem sizi ya <b>normal ticket triage</b> akışına ya da{' '}
          <b>&quot;bu daha önce yaşandı mı?&quot;</b> adımına yönlendirecek.
        </Callout>
      )}
    </PageSection>
  )
}

// ---------------------------------------------------------------------------
// 3. Severity calculator
// ---------------------------------------------------------------------------

function SeveritySection() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const score = SEVERITY_QUESTIONS.reduce((sum, q) => sum + (checked[q.id] ? q.points : 0), 0)
  const anyAnswered = Object.values(checked).some(Boolean)
  const suggested = score >= 4 ? 'SEV-1' : score >= 2 ? 'SEV-2' : 'SEV-3'
  const suggestedTone: Tone = score >= 4 ? 'red' : score >= 2 ? 'orange' : 'amber'

  return (
    <PageSection
      id="severity"
      eyebrow="Adım 3 · Declare"
      title="Severity hesaplayıcı"
      icon={AlertOctagon}
      tone="red"
      description="Statik bir kart yerine soru tabanlı hesaplayıcı: İşaretledikleriniz puanlanır ve önerilen SEV seviyesi gösterilir. Emin değilseniz yüksek seviyeden başlayıp daha sonra düşürün."
    >
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Karar soruları — geçerli olanları işaretleyin
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {SEVERITY_QUESTIONS.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setChecked((c) => ({ ...c, [q.id]: !c[q.id] }))}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                    checked[q.id]
                      ? 'border-red-400 bg-red-500/10 font-semibold text-foreground'
                      : 'border-border bg-muted/30 text-foreground/85 hover:bg-muted/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded border',
                      checked[q.id] ? 'border-red-500 bg-red-500 text-white' : 'border-muted-foreground/40',
                    )}
                  >
                    {checked[q.id] && <CheckCircle2 className="size-3" />}
                  </span>
                  <span className="flex-1">{q.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">+{q.points}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <div className={cn('rounded-xl border p-4', toneCard[anyAnswered ? suggestedTone : 'gray'])}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Önerilen seviye</div>
            {anyAnswered ? (
              <>
                <div className={cn('mt-1 text-3xl font-bold', toneText[suggestedTone])}>{suggested}</div>
                <div className="mt-1 text-xs text-muted-foreground">Puan: {score}</div>
                {suggested === 'SEV-1' && (
                  <ul className="mt-3 space-y-1 text-xs text-foreground/90">
                    {SEV1_ACTIONS.map((a) => (
                      <li key={a} className="flex gap-1.5">
                        <span className="mt-[7px] size-1 shrink-0 rounded-full bg-red-500" />
                        <span className="leading-relaxed">{a}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Soruları işaretledikçe öneri burada görünür. Belirsizlik durumunda yüksek severity ile başlamak güvenlidir
                (PagerDuty severity guide).
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {SEVERITY_PROTOCOL.map((s) => (
              <div key={s.level} className={cn('rounded-xl border p-3', toneCard[s.tone])}>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold', toneText[s.tone])}>{s.level}</span>
                  <span className="text-xs font-semibold text-foreground">{s.label}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  <b className="text-foreground/80">Örnek:</b> {s.examples}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/85">
                  <b>Müdahale:</b> {s.response}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageSection>
  )
}

// ---------------------------------------------------------------------------
// 6. First 15 minutes — phased checklist
// ---------------------------------------------------------------------------

function First15Section() {
  const [done, setDone] = useState<Record<string, boolean>>({})

  return (
    <PageSection
      id="first-15"
      eyebrow="Adım 6 · Contain"
      title="İlk 15 dakika protokolü"
      icon={Timer}
      tone="orange"
      description="Sırayla uygulanır; hiçbir adım atlanmaz. Amaç fix yapmak değil, etkiyi sınırlamaktır. Her maddeye Owner, başlangıç/bitiş zamanı, sonuç ve evidence linki eklenir."
    >
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {FIRST_15_PROTOCOL.map((phase) => (
          <div key={phase.window} className={cn('rounded-xl border p-4', toneCard[phase.tone])}>
            <div className="flex items-center gap-2">
              <span className={cn('rounded-md px-2 py-0.5 font-mono text-[11px] font-bold text-white', toneDot[phase.tone])}>
                {phase.window}
              </span>
              <span className="text-sm font-bold text-foreground">{phase.title}</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {phase.steps.map((s, i) => {
                const key = `${phase.window}-${i}`
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setDone((d) => ({ ...d, [key]: !d[key] }))}
                      className="flex w-full items-start gap-2 rounded-lg bg-background/70 p-2 text-left text-xs transition-colors hover:bg-background"
                    >
                      <span
                        className={cn(
                          'mt-px flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold',
                          done[key]
                            ? cn('border-transparent text-white', toneDot[phase.tone])
                            : 'border-muted-foreground/40 text-muted-foreground',
                        )}
                      >
                        {done[key] ? '✓' : i + 1}
                      </span>
                      <span className={cn('leading-relaxed', done[key] ? 'text-muted-foreground line-through' : 'text-foreground/90')}>
                        {s}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {phase.warning && (
              <div className="mt-3 rounded-lg border border-red-300 bg-red-500/10 p-2 text-[11px] font-semibold leading-relaxed text-red-700 dark:border-red-900 dark:text-red-300">
                {phase.warning}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <ClipboardCheck className="size-3.5" />
        Her madde şu alanlarla kaydedilir:
        {CHECKLIST_COLUMNS.map((c) => (
          <Badge key={c} variant="secondary" appearance="outline" size="xs">{c}</Badge>
        ))}
      </div>
    </PageSection>
  )
}

// ---------------------------------------------------------------------------
// Sayfa
// ---------------------------------------------------------------------------

export default function IncidentCommandCenterPage() {
  const incidentSession = useEngineeringIncidentSession()

  return (
    <ProductPage path="/engineering/incident-playbook">
      <HeroCallout
        icon={Siren}
        eyebrow="Güvenilirlik ve Operasyonlar"
        tone="red"
        title="Incident Komuta Merkezi"
        lead="Detect → Declare → Contain → Diagnose → Recover → Learn. Bir mühendis bu sayfaya geldiğinde önce 'neyi durdurmalıyım, kimi bilgilendirmeliyim, bu daha önce yaşandı mı?' sorularının yanıtını alır; dosya ve code diagnosis (Diagnosis Workspace) bunlardan sonra gelir."
        chips={[
          `${INCIDENT_STATS.totalTickets} ticket analizi`,
          `${INCIDENT_STATS.openTickets} açık`,
          `En yüksek risk: ${INCIDENT_STATS.riskiestGroup}`,
        ]}
      />

      <IncidentSessionPanel session={incidentSession} />

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Left main area — hierarchical incident flow */}
        <div className={cn('min-w-0 flex-1 space-y-8', incidentSession.incident && 'xl:max-w-[74%]')}>
          <TriageSection />

          {/* 2. Has this happened before? */}
          <PageSection
            id="dedup"
            eyebrow="Adım 2 · Detect"
            title="Bu daha önce yaşandı mı?"
            icon={History}
            tone="purple"
            description="Sistem, fingerprint sinyalleriyle açık incident’ları ve Known Issue kütüphanesini tarar. Arama kısa tutulur ve müdahaleyi geciktirmez; eşleşme yoksa yeni incident akışı devam eder."
          >
            <div className="flex flex-wrap gap-1.5">
              {FINGERPRINT_SIGNALS.map((s) => (
                <Badge key={s} variant="secondary" appearance="outline" size="sm">
                  <Radio className="size-3 text-indigo-500" /> {s}
                </Badge>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
              {MATCH_RESULTS.map((m) => (
                <div key={m.kind} className={cn('flex h-full flex-col rounded-xl border p-4', toneCard[m.tone])}>
                  <div className={cn('text-sm font-bold', toneText[m.tone])}>{m.title}</div>
                  {m.example && (
                    <div className="mt-2 rounded-lg bg-background/70 p-2 font-mono text-[11px] leading-relaxed text-foreground/90">
                      {m.example}
                    </div>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{m.detail}</p>
                  {m.shows && (
                    <ul className="mt-2 space-y-1 text-xs text-foreground/80">
                      {m.shows.map((s) => (
                        <li key={s} className="flex gap-1.5">
                          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
                          <span className="leading-relaxed">{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto pt-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Aksiyonlar</div>
                    <ul className="mt-1.5 space-y-1 text-xs font-medium text-foreground/90">
                      {m.actions.map((a) => (
                        <li key={a} className="flex items-center gap-1.5">
                          <CheckCircle2 className={cn('size-3.5 shrink-0', toneIcon[m.tone])} />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <GitBranch className="size-3.5" /> Kritik yönlendirme kuralı
              </div>
              <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-foreground/85">
                {ROUTING_TREE}
              </pre>
            </div>
          </PageSection>

          <SeveritySection />

          {/* 4. Roller */}
          <PageSection
            id="roles"
            eyebrow="Adım 4 · Declare"
            title="Incident ilanı ve ekip organizasyonu"
            icon={Users}
            tone="purple"
            description="Severity belirlendikten sonra incident kaydı açılır ve roller atanır (Google SRE + PagerDuty rol modeli). Küçük incident’larda roller birleştirilebilir; ancak IC hem koordinasyonu hem de yoğun debugging’i üstlenmemelidir."
          >
            <CardGrid cols={4}>
              {INCIDENT_ROLES.map((r) => (
                <div key={r.role} className={cn('h-full rounded-xl border p-4', toneCard[r.tone])}>
                  <div className={cn('text-sm font-bold', toneText[r.tone])}>{r.role}</div>
                  <ul className="mt-2.5 space-y-1 text-xs text-foreground/85">
                    {r.duties.map((d) => (
                      <li key={d} className="flex gap-1.5">
                        <span className="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
                        <span className="leading-relaxed">{d}</span>
                      </li>
                    ))}
                  </ul>
                  {r.antiPattern && (
                    <div className="mt-2.5 rounded-lg bg-background/70 p-2 text-[11px] italic leading-relaxed text-red-700 dark:text-red-300">
                      {r.antiPattern}
                    </div>
                  )}
                </div>
              ))}
            </CardGrid>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Küçük incident’ta birleştirilmiş yapı
              </div>
              <pre className="mt-2 font-mono text-[11px] leading-relaxed text-foreground/85">{SMALL_INCIDENT_STRUCTURE}</pre>
            </div>
          </PageSection>

          {/* 5. Impact Snapshot */}
          <PageSection
            id="impact"
            eyebrow="Adım 5 · Contain"
            title="Etki alanını belirleyin — Impact Snapshot"
            icon={Activity}
            tone="blue"
            description="Zorunlu alanlar doldurulur ve otomatik karşılaştırmalar açılır. Risk Map burada devreye girer; ana süreç değil, etki sınıflandırmasını destekleyen bir bileşendir."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Zorunlu alanlar</div>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  {IMPACT_FIELDS.map((f) => (
                    <div key={f} className="rounded-lg bg-muted/40 px-2 py-1.5 text-[11px] leading-snug text-foreground/85">
                      {f}
                    </div>
                  ))}
                </div>
              </div>
              <div className={cn('rounded-xl border p-4', toneCard.blue)}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Otomatik karşılaştırmalar
                </div>
                <ul className="mt-2.5 space-y-1.5 text-xs text-foreground/85">
                  {IMPACT_COMPARISONS.map((c) => (
                    <li key={c} className="flex gap-1.5">
                      <ArrowRightLeft className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
                      <span className="leading-relaxed">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </PageSection>

          <First15Section />

          {/* 7. Diagnosis Workspace */}
          <PageSection
            id="diagnosis"
            eyebrow="Adım 7 · Diagnose"
            title="Diagnosis Workspace — grup ve ekran yönlendirmesi"
            icon={Zap}
            tone="red"
            description="Teknik diagnosis, ilk güvenlik ve containment adımları tamamlandıktan sonra başlar. Grup ve ekran seçimini; ilk kontrol edilecek dosyalar, log query’leri, bilinen race condition’lar ve benzer geçmiş ticket’lar izler. Bu workspace altındaki araç Reproduce Lab’dir."
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ekran seçin:</span>
              {DIAGNOSIS_SCREENS.map((s) => (
                <Badge key={s} variant="secondary" appearance="outline" size="sm">
                  <MapPin className="size-3 text-red-500" /> {s}
                </Badge>
              ))}
            </div>

            <CardGrid cols={2}>
              {INCIDENT_GROUPS.map((g) => (
                <div key={g.id} className={cn('h-full rounded-xl border p-4', toneCard[g.tone])}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={cn('text-sm font-bold', toneText[g.tone])}>{g.name}</div>
                    <div className="flex gap-1">
                      <Badge variant="secondary" appearance="outline" size="xs">{g.tickets} ticket</Badge>
                      <Badge variant="secondary" appearance="outline" size="xs">{g.open} açık</Badge>
                      <Badge variant="secondary" appearance="outline" size="xs">{g.highRisk} yüksek risk</Badge>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <Code2 className="size-3.5" /> İlk kontroller
                    </div>
                    <ul className="mt-1.5 space-y-1.5">
                      {g.firstChecks.map((c) => (
                        <li key={c.location} className="rounded-lg bg-background/70 p-2 text-xs">
                          <code className="font-semibold text-foreground">{c.location}</code>
                          <div className="mt-0.5 leading-relaxed text-muted-foreground">{c.why}</div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <CheckCircle2 className="size-3.5" /> Hızlı aksiyonlar
                    </div>
                    <ul className="mt-1.5 space-y-1 text-xs text-foreground/85">
                      {g.quickActions.map((a) => (
                        <li key={a} className="flex gap-1.5">
                          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
                          <span className="leading-relaxed">{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {g.relatedScreens.map((s) => (
                      <Badge key={s} variant="secondary" appearance="outline" size="xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardGrid>
          </PageSection>

          {/* 8. Evidence Gate */}
          <PageSection
            id="evidence"
            eyebrow="Adım 8 · Diagnose"
            title="Evidence’ları koruyun — Evidence Gate"
            icon={Lock}
            tone="amber"
            description="Evidence’lar Reproduce sürecinden önce toplanır. State/race, offline queue ve fiscal incident’larda evidence kaybı geri döndürülemez."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <FileSearch className="size-3.5" /> Toplanacak evidence’lar
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  {EVIDENCE_ITEMS.map((e) => (
                    <div key={e} className="rounded-lg bg-muted/40 px-2 py-1.5 text-[11px] leading-snug text-foreground/85">
                      {e}
                    </div>
                  ))}
                </div>
              </div>
              <div className={cn('rounded-xl border p-4', toneCard.red)}>
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                  <AlertTriangle className="size-3.5" /> Bu işlemlerden önce onay gerekir
                </div>
                <ul className="mt-2.5 space-y-1.5 text-xs text-foreground/90">
                  {DESTRUCTIVE_ACTIONS.map((a) => (
                    <li key={a} className="flex items-center gap-1.5">
                      <ShieldAlert className="size-3.5 shrink-0 text-red-500" />
                      {a}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 rounded-lg bg-background/70 p-2.5 text-xs font-semibold leading-relaxed text-red-700 dark:text-red-300">
                  &quot;Bu işlem evidence’ı veya geçici state’i değiştirebilir. Evidence’lar kaydedildi mi?&quot;
                </div>
              </div>
            </div>
          </PageSection>

          {/* 9. Hypothesis and experiment area */}
          <PageSection
            id="hypotheses"
            eyebrow="Adım 9 · Diagnose"
            title="Hipotez ve deney alanı"
            icon={FlaskConical}
            tone="teal"
            description="Chat içinde kaybolan deneyler yerine yapılandırılmış kayıt tutulur. Aktif görevlerde Owner zorunludur; aynı deney iki kez yapılmaz."
          >
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    {['Zaman', 'Hipotez', 'Test', 'Owner', 'Sonuç', 'Durum'].map((h) => (
                      <th key={h} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HYPOTHESES.map((h) => (
                    <tr key={h.time} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">{h.time}</td>
                      <td className="px-3 py-2.5 font-semibold text-foreground">{h.hypothesis}</td>
                      <td className="px-3 py-2.5 text-foreground/85">{h.test}</td>
                      <td className="px-3 py-2.5 text-foreground/85">{h.owner}</td>
                      <td className="px-3 py-2.5 text-foreground/85">{h.result}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold',
                            toneCard[HYPOTHESIS_STATUS_TONE[h.status]],
                            toneText[HYPOTHESIS_STATUS_TONE[h.status]],
                          )}
                        >
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              Durumlar:
              {(['Yeni', 'Test ediliyor', 'Güçlü sinyal', 'Doğrulandı', 'Elendi'] as const).map((s) => (
                <Badge key={s} variant="secondary" appearance="outline" size="xs">{s}</Badge>
              ))}
            </div>
          </PageSection>

          {/* 10. Containment / mitigasyon */}
          <PageSection
            id="mitigation"
            eyebrow="Adım 10 · Contain"
            title="Containment ve mitigation"
            icon={ShieldCheck}
            tone="orange"
            description="Soru 'root cause nedir?' değil, etkiyi en güvenli şekilde nasıl durdururuz sorusudur. Mitigation etkiyi şimdi durdurur; permanent fix root cause’u daha sonra ortadan kaldırır."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mitigation seçenekleri</div>
                <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {MITIGATION_OPTIONS.map((m) => (
                    <div key={m} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5 text-[11px] leading-snug text-foreground/85">
                      <Zap className="size-3 shrink-0 text-orange-500" />
                      {m}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className={cn('rounded-xl border p-4', toneCard.orange)}>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                    Her mitigation kartında
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                    {MITIGATION_CARD_FIELDS.map((f) => (
                      <div key={f} className="rounded-lg bg-background/70 px-2 py-1.5 text-[11px] leading-snug text-foreground/85">
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs leading-relaxed">
                  <div className="flex items-center gap-2 font-bold text-orange-700 dark:text-orange-300">
                    <Zap className="size-3.5" /> Mitigation
                    <span className="font-normal text-foreground/85">— incident etkisini şimdi durdurur.</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 font-bold text-teal-700 dark:text-teal-300">
                    <Landmark className="size-3.5" /> Permanent fix
                    <span className="font-normal text-foreground/85">— root cause’u ortadan kaldırır, daha sonra planlanır.</span>
                  </div>
                </div>
              </div>
            </div>
          </PageSection>

          {/* 11. Communication center */}
          <PageSection
            id="comms"
            eyebrow="Adım 11 · Contain"
            title="İletişim merkezi"
            icon={Megaphone}
            tone="blue"
            description="İletişim akışı teknik çözümden bağımsızdır. Doğrulanmamış root cause yazılmaz; bilgi eksikse 'bilinmiyor' denir, tahmin yürütülmez."
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Hedef gruplar:</span>
              {COMMS_AUDIENCES.map((a) => (
                <Badge key={a} variant="secondary" appearance="outline" size="sm">{a}</Badge>
              ))}
            </div>
            <div className={cn('rounded-xl border p-4', toneCard.blue)}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Durum mesajı formatı
              </div>
              <dl className="mt-2.5 space-y-2.5">
                {COMMS_TEMPLATE.map((c) => (
                  <div key={c.label} className="rounded-lg bg-background/70 p-2.5">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">{c.label}</dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-foreground/90">{c.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </PageSection>

          {/* 12. Recovery and validation */}
          <PageSection
            id="recovery"
            eyebrow="Adım 12 · Recover"
            title="Recovery ve doğrulama"
            icon={MonitorCheck}
            tone="green"
            description="Mitigation sonrasında incident hemen 'çözüldü' olarak işaretlenmez. Sistem yeniden çalıştığı için değil, exit criteria ölçülüp karşılandığı için kapatılır (Google SRE — exit criteria)."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.3fr_1fr]">
              <div className={cn('rounded-xl border p-4', toneCard.green)}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-green-700 dark:text-green-300">
                  Exit criteria
                </div>
                <ul className="mt-2.5 space-y-1.5 text-xs text-foreground/90">
                  {EXIT_CRITERIA.map((c) => (
                    <li key={c} className="flex gap-1.5">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green-600 dark:text-green-400" />
                      <span className="leading-relaxed">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Durum geçişi</div>
                <div className="mt-3 flex flex-col items-center gap-1">
                  {STATUS_FLOW.map((s, i) => (
                    <div key={s} className="flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          'rounded-lg border px-4 py-1.5 text-xs font-bold',
                          i === STATUS_FLOW.length - 1
                            ? 'border-green-400 bg-green-500/10 text-green-700 dark:text-green-300'
                            : 'border-border bg-muted/40 text-foreground/85',
                        )}
                      >
                        {s}
                      </span>
                      {i < STATUS_FLOW.length - 1 && <ArrowDown className="size-3.5 text-muted-foreground/50" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PageSection>

          {/* 13. Kapatma */}
          <PageSection
            id="closing"
            eyebrow="Adım 13 · Recover"
            title="Incident kapatma"
            icon={ClipboardCheck}
            tone="teal"
            description="Kapatma ekranında iki zorunlu blok bulunur: operasyonel ve teknik kapatma. Yanıtlanmamış soru varsa incident kapatılmaz."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {[
                { title: 'Operasyonel kapatma', items: CLOSING_OPERATIONAL, tone: 'teal' as Tone },
                { title: 'Teknik kapatma', items: CLOSING_TECHNICAL, tone: 'indigo' as Tone },
              ].map((block) => (
                <div key={block.title} className={cn('rounded-xl border p-4', toneCard[block.tone])}>
                  <div className={cn('text-[11px] font-bold uppercase tracking-wide', toneText[block.tone])}>
                    {block.title}
                  </div>
                  <ul className="mt-2.5 space-y-1.5 text-xs text-foreground/90">
                    {block.items.map((q) => (
                      <li key={q} className="flex gap-1.5 rounded-lg bg-background/60 p-2">
                        <span className={cn('mt-[6px] size-1.5 shrink-0 rounded-full', toneDot[block.tone])} />
                        <span className="leading-relaxed">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </PageSection>

          {/* 14. Postmortem */}
          <PageSection
            id="postmortem"
            eyebrow="Adım 14 · Learn"
            title="Incident sonrası öğrenme"
            icon={BookOpenCheck}
            tone="purple"
            description="Incident çözüldükten sonra etkinleşir. Amaç issue’yu kapatmak değil, Detect–Respond–Recover–Improve döngüsünü beslemektir (NIST SP 800-61r3)."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Postmortem yapısı</div>
                <ol className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {POSTMORTEM_STRUCTURE.map((p, i) => (
                    <li key={p} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5 text-[11px] text-foreground/85">
                      <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-purple-500 text-[9px] font-bold text-white">
                        {i + 1}
                      </span>
                      {p}
                    </li>
                  ))}
                </ol>
              </div>
              <div className={cn('rounded-xl border p-4', toneCard.purple)}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                  Otomatik güncellenen sistemler
                </div>
                <ul className="mt-2.5 space-y-1.5 text-xs text-foreground/90">
                  {AUTO_UPDATED_SYSTEMS.map((s) => (
                    <li key={s} className="flex items-center gap-1.5">
                      <ArrowRightLeft className="size-3.5 shrink-0 text-purple-500" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </PageSection>

          <StatGrid cols={4}>
            <StatCard label="Toplam Ticket" value={INCIDENT_STATS.totalTickets} tone="gray" hint="HR 21 · RS 12 · Genel 11 · CEE 4" />
            <StatCard label="Kritik" value={INCIDENT_STATS.bySeverity.critical} tone="red" hint="Double TOUR event · scan crash" />
            <StatCard label="Yüksek" value={INCIDENT_STATS.bySeverity.high} tone="orange" hint="Çoğunluk Finance & Payment" />
            <StatCard label="En Riskli Ekranlar" value="16" tone="amber" hint={INCIDENT_STATS.riskiestScreens} />
          </StatGrid>

          <Callout icon={Siren} title="Katman ayrımı" tone="red">
            Reproduce Lab teknik bir diagnosis aracı, Risk Map bir sınıflandırma görünümü, playbook ise bilgi
            kaynağıdır. Bu sayfa — Incident Komuta Merkezi — bunların üzerindeki karar verme,
            koordinasyon, containment, iletişim ve recovery katmanıdır. Her SEV-1/SEV-2 kapanışında root
            cause Edge Case Map ile ilişkilendirilir, tekrarlama riski Modernization Plan’a yazılır ve first
            check’ler güncellenir. Playbook yaşayan bir dokümandır.
          </Callout>
        </div>

        {incidentSession.incident && (
          <aside className="shrink-0 xl:w-[290px]">
            <div className="xl:sticky xl:top-[150px]">
              <IncidentLiveRail incident={incidentSession.incident} />
            </div>
          </aside>
        )}
      </div>
    </ProductPage>
  )
}
