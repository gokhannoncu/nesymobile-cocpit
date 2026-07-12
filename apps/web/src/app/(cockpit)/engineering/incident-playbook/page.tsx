'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRightLeft,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Code2,
  Crosshair,
  FileSearch,
  FlaskConical,
  Gauge,
  GitBranch,
  History,
  Landmark,
  Link2,
  Lock,
  MapPin,
  Megaphone,
  MonitorCheck,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
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
  INCIDENT_STATUSES,
  LIVE_INCIDENT,
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
// 0. Sabit incident üst barı
// ---------------------------------------------------------------------------

function IncidentTopBar() {
  const inc = LIVE_INCIDENT
  const statusIdx = INCIDENT_STATUSES.indexOf(inc.status)

  return (
    <div className="sticky top-0 z-40 -mx-2 rounded-xl border border-red-200/80 bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 dark:border-red-900/60">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
          </span>
          <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">{inc.id}</span>
          <Badge variant="destructive" size="xs">{inc.sev}</Badge>
        </div>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{inc.title}</div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="h-7 bg-red-600 text-xs text-white hover:bg-red-700">
            <Megaphone className="size-3.5" /> Operasyonel duyuru gönder
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            <Link2 className="size-3.5" /> Mevcut incidente bağla
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            <ArrowRightLeft className="size-3.5" /> Devret
          </Button>
        </div>
      </div>

      {/* Durum stepper'ı */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        {INCIDENT_STATUSES.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold',
                i < statusIdx && 'bg-muted text-muted-foreground line-through decoration-1',
                i === statusIdx && 'bg-red-600 text-white',
                i > statusIdx && 'bg-muted/50 text-muted-foreground/60',
              )}
            >
              {s}
            </span>
            {i < INCIDENT_STATUSES.length - 1 && (
              <span className="text-[10px] text-muted-foreground/40">›</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Başlangıç <b className="text-foreground">{inc.startedAt}</b></span>
        <span>Geçen süre <b className="font-mono text-foreground">{inc.elapsed}</b></span>
        <span>Kapsam <b className="text-foreground">{inc.scope}</b></span>
        <span>IC <b className="text-foreground">{inc.commander}</b></span>
        <span>Son güncelleme <b className="text-foreground">{inc.lastUpdate}</b></span>
        <span>Sonraki iletişim <b className="text-red-600 dark:text-red-400">{inc.nextComms}</b></span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sağ sabit panel — Live Incident Rail
// ---------------------------------------------------------------------------

function LiveIncidentRail() {
  const inc = LIVE_INCIDENT
  return (
    <div className="space-y-3">
      {/* Durum */}
      <div className={cn('rounded-xl border p-3.5', toneCard.red)}>
        <div className="flex items-center justify-between">
          <Badge variant="destructive" size="sm">{inc.sev}</Badge>
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">{inc.status}</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">{inc.elapsed}</div>
        <div className="text-[11px] text-muted-foreground">elapsed · başlangıç {inc.startedAt}</div>
      </div>

      {/* Current objective */}
      <div className={cn('rounded-xl border p-3.5', toneCard.amber)}>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          <Crosshair className="size-3.5" /> Current objective
        </div>
        <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">{inc.objective}</p>
      </div>

      {/* Etki özeti */}
      <div className="rounded-xl border border-border bg-background p-3.5">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Etki özeti</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {inc.impact.map((m) => (
            <div key={m.label} className="rounded-lg bg-muted/50 px-2 py-1.5">
              <div className="text-sm font-bold tabular-nums text-foreground">{m.value}</div>
              <div className="text-[10px] text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Komuta ekibi */}
      <div className="rounded-xl border border-border bg-background p-3.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Users className="size-3.5" /> Komuta ekibi
        </div>
        <ul className="mt-2 space-y-1.5 text-xs">
          {inc.team.map((t) => (
            <li key={t.role} className="flex items-baseline justify-between gap-2">
              <span className="shrink-0 font-bold text-foreground/70">{t.role}</span>
              <span className="truncate text-right text-foreground">{t.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Son karar + sonraki kontrol */}
      <div className={cn('rounded-xl border p-3.5', toneCard.blue)}>
        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Son karar</div>
        <p className="mt-1 text-xs leading-relaxed text-foreground">{inc.lastDecision}</p>
        <div className="mt-2.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Sonraki kontrol</div>
        <p className="mt-1 text-xs leading-relaxed text-foreground">{inc.nextCheck}</p>
      </div>

      {/* Canlı timeline */}
      <div className="rounded-xl border border-border bg-background p-3.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <History className="size-3.5" /> Canlı timeline
        </div>
        <ol className="mt-2.5 space-y-0">
          {inc.timeline.map((t, i) => (
            <li key={t.time} className="relative flex gap-2.5 pb-2.5 last:pb-0">
              {i < inc.timeline.length - 1 && (
                <span className="absolute left-[3px] top-3 h-full w-px bg-border" />
              )}
              <span
                className={cn(
                  'relative mt-1.5 size-[7px] shrink-0 rounded-full',
                  i === inc.timeline.length - 1 ? 'bg-red-500' : 'bg-muted-foreground/40',
                )}
              />
              <div className="min-w-0 text-xs">
                <span className="font-mono font-semibold text-muted-foreground">{t.time}</span>{' '}
                <span className="text-foreground/90">{t.event}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Bu bir incident mı? — interaktif triage
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
        text: 'Normal Ticket Triage → backlog önceliği → ilgili takım. Bu sayfadan çıkabilirsin.',
      }
    }
    if (max >= 3) {
      return {
        tone: 'red' as Tone,
        title: 'Güçlü incident sinyali — SEV-1 adayı',
        text: 'Sonraki adım: "Daha önce yaşandı mı?" kontrolü. Finansal/fiscal/veri kaybı riski varsa doğrudan SEV-1 değerlendirmesine geç.',
      }
    }
    return {
      tone: 'orange' as Tone,
      title: 'Incident ihtimali var',
      text: 'Sonraki adım: "Daha önce yaşandı mı?" kontrolü — eşleşme yoksa etki kapsamına göre SEV-2/SEV-3.',
    }
  }, [answers])

  return (
    <PageSection
      id="triage"
      eyebrow="Adım 1 · Detect"
      title="Bu bir incident mı?"
      icon={ShieldAlert}
      tone="red"
      description="Grup ve dosya seçiminden önce cevaplanacak dört soru: etki devam ediyor mu, akış engelleniyor mu, kapsam ne, risk türü var mı?"
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
          Dört soruyu da cevapla — sistem seni ya <b>normal ticket triage</b>’a ya da{' '}
          <b>&quot;daha önce yaşandı mı?&quot;</b> adımına yönlendirecek.
        </Callout>
      )}
    </PageSection>
  )
}

// ---------------------------------------------------------------------------
// 3. Severity hesaplayıcı
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
      title="Severity belirle"
      icon={Gauge}
      tone="red"
      description="Statik kart yerine soru tabanlı hesaplayıcı: işaretlediklerin puanlanır, önerilen SEV seviyesi çıkar. Emin değilsen yüksek seviyeyle başla, sonra düşür."
    >
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Karar soruları — geçerli olanları işaretle
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
                <div className="mt-1 text-xs text-muted-foreground">Skor: {score} puan</div>
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
                Soruları işaretledikçe öneri burada belirir. Belirsizlikte yüksek severity ile başlamak güvenlidir
                (PagerDuty severity rehberi).
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
// 6. İlk 15 dakika — fazlı checklist
// ---------------------------------------------------------------------------

function First15Section() {
  const [done, setDone] = useState<Record<string, boolean>>({})

  return (
    <PageSection
      id="first-15"
      eyebrow="Adım 6 · Contain"
      title="İlk 15 dakika protokolü"
      icon={Clock}
      tone="orange"
      description="Sırayla koşulur; hiçbir adım atlanmaz. Amaç düzeltmek değil, etkiyi durdurmaktır. Her maddeye owner, başlangıç/bitiş zamanı, sonuç ve kanıt bağlantısı eklenir."
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
  return (
    <ProductPage path="/engineering/incident-playbook">
      <HeroCallout
        icon={Siren}
        eyebrow="Reliability & Operations"
        tone="red"
        title="Incident Command Center"
        lead="Detect → Declare → Contain → Diagnose → Recover → Learn. Mühendis bu sayfaya geldiğinde önce 'neyi durdurmalıyım, kime haber vermeliyim, bu daha önce yaşandı mı?' sorularının cevabını alır; dosya ve kod teşhisi (Diagnosis Workspace) bunların ardından gelir."
        chips={[
          `${INCIDENT_STATS.totalTickets} ticket analizi`,
          `${INCIDENT_STATS.openTickets} açık`,
          `En riskli: ${INCIDENT_STATS.riskiestGroup}`,
        ]}
      />

      <IncidentTopBar />

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Sol ana alan — hiyerarşik incident akışı */}
        <div className="min-w-0 flex-1 space-y-8 xl:max-w-[74%]">
          <TriageSection />

          {/* 2. Daha önce yaşandı mı? */}
          <PageSection
            id="dedup"
            eyebrow="Adım 2 · Detect"
            title="Daha önce yaşandı mı?"
            icon={Search}
            tone="indigo"
            description="Sistem fingerprint sinyalleriyle açık incident'leri ve known issue kütüphanesini tarar. Arama kısa tutulur — müdahaleyi geciktirmez; eşleşme yoksa yeni incident akışına devam edilir."
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
            description="Severity belirlendikten sonra incident kaydı açılır ve roller atanır (Google SRE + PagerDuty rol modeli). Küçük incident'lerde roller birleştirilebilir — ancak IC hem koordinasyon hem yoğun debug yapmamalıdır."
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
                Küçük incident'te birleştirilmiş yapı
              </div>
              <pre className="mt-2 font-mono text-[11px] leading-relaxed text-foreground/85">{SMALL_INCIDENT_STRUCTURE}</pre>
            </div>
          </PageSection>

          {/* 5. Impact Snapshot */}
          <PageSection
            id="impact"
            eyebrow="Adım 5 · Contain"
            title="Etki alanını belirle — Impact Snapshot"
            icon={Activity}
            tone="blue"
            description="Zorunlu alanlar doldurulur, otomatik karşılaştırmalar açılır. Risk Haritası burada devreye girer — ana süreç değil, impact classification için destekleyici bileşendir."
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
            description="İlk güvenlik ve containment adımları tamamlandıktan sonra teknik teşhis başlar. Grup ve ekran seçimi; ardından ilk bakılacak dosyalar, log sorguları, bilinen race condition'lar ve benzer geçmiş ticket'lar. Reproduce Lab bu çalışma alanının altındaki araçtır."
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ekran seç:</span>
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
            title="Kanıtları koru — Evidence Gate"
            icon={Lock}
            tone="amber"
            description="Reproduce işleminden önce kanıtlar toplanır. State/race, offline queue ve fiscal incident'lerinde kanıt kaybı geri döndürülemez."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <FileSearch className="size-3.5" /> Toplanacak kanıtlar
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
                  <AlertTriangle className="size-3.5" /> Bu işlemlerden önce onay istenir
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
                  &quot;Bu işlem kanıtı veya geçici state&apos;i değiştirebilir. Kanıtlar kaydedildi mi?&quot;
                </div>
              </div>
            </div>
          </PageSection>

          {/* 9. Hipotez ve deney alanı */}
          <PageSection
            id="hypotheses"
            eyebrow="Adım 9 · Diagnose"
            title="Hipotez ve deney alanı"
            icon={FlaskConical}
            tone="teal"
            description="Chat içinde kaybolan denemeler yerine yapılandırılmış kayıt. Aktif görevlerde owner zorunlu — aynı deneme iki kez yapılmaz."
          >
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    {['Saat', 'Hipotez', 'Test', 'Owner', 'Sonuç', 'Durum'].map((h) => (
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
              Statüler:
              {(['Yeni', 'Test ediliyor', 'Güçlü sinyal', 'Doğrulandı', 'Elendi'] as const).map((s) => (
                <Badge key={s} variant="secondary" appearance="outline" size="xs">{s}</Badge>
              ))}
            </div>
          </PageSection>

          {/* 10. Containment / mitigasyon */}
          <PageSection
            id="mitigation"
            eyebrow="Adım 10 · Contain"
            title="Containment ve mitigasyon"
            icon={ShieldCheck}
            tone="orange"
            description="Soru 'sorunun sebebi nedir?' değil: etkiyi en güvenli şekilde nasıl durdururuz? Mitigasyon şimdi etkiyi durdurur; kalıcı çözüm kök nedeni sonra ortadan kaldırır."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mitigasyon seçenekleri</div>
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
                    Her mitigasyon kartında
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
                    <Zap className="size-3.5" /> Mitigasyon
                    <span className="font-normal text-foreground/85">— incident etkisini şimdi durdurur.</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 font-bold text-teal-700 dark:text-teal-300">
                    <Landmark className="size-3.5" /> Kalıcı çözüm
                    <span className="font-normal text-foreground/85">— kök nedeni ortadan kaldırır, sonra planlanır.</span>
                  </div>
                </div>
              </div>
            </div>
          </PageSection>

          {/* 11. İletişim merkezi */}
          <PageSection
            id="comms"
            eyebrow="Adım 11 · Contain"
            title="İletişim merkezi"
            icon={Megaphone}
            tone="blue"
            description="Teknik çözümden bağımsız iletişim akışı. Doğrulanmamış kök neden yazılmaz; bilgi eksikse 'bilinmiyor' denir, tahmin yapılmaz."
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

          {/* 12. Recovery ve doğrulama */}
          <PageSection
            id="recovery"
            eyebrow="Adım 12 · Recover"
            title="Recovery ve doğrulama"
            icon={MonitorCheck}
            tone="green"
            description="Mitigasyon sonrası incident hemen 'çözüldü' yapılmaz. Sistem tekrar çalıştığı için değil, çıkış kriterleri ölçüldüğü için kapatılır (Google SRE — exit criteria)."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.3fr_1fr]">
              <div className={cn('rounded-xl border p-4', toneCard.green)}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-green-700 dark:text-green-300">
                  Çıkış kriterleri
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
            description="Kapatma ekranında iki zorunlu blok: operasyonel ve teknik kapanış. Cevaplanmayan soru varsa incident kapatılmaz."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {[
                { title: 'Operasyonel kapanış', items: CLOSING_OPERATIONAL, tone: 'teal' as Tone },
                { title: 'Teknik kapanış', items: CLOSING_TECHNICAL, tone: 'indigo' as Tone },
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
            description="Incident çözüldükten sonra aktifleşir. Amaç sorunu kapatmak değil, Detect–Respond–Recover–Improve döngüsünü beslemek (NIST SP 800-61r3)."
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
            <StatCard label="Toplam Ticket" value={INCIDENT_STATS.totalTickets} tone="gray" hint="HR 21 · RS 12 · General 11 · CEE 4" />
            <StatCard label="Kritik" value={INCIDENT_STATS.bySeverity.critical} tone="red" hint="Çift TOUR eventi · scan crash" />
            <StatCard label="Yüksek" value={INCIDENT_STATS.bySeverity.high} tone="orange" hint="Çoğunluğu Finans & Ödeme" />
            <StatCard label="En Riskli Ekranlar" value="16" tone="amber" hint={INCIDENT_STATS.riskiestScreens} />
          </StatGrid>

          <Callout icon={Siren} title="Katman ayrımı" tone="red">
            Reproduce Lab teknik teşhis aracı, Risk Haritası sınıflandırma görünümü, playbook bilgi
            kaynağı olarak kalır. Bu sayfa — Incident Command Center — bunların üzerindeki karar verme,
            koordinasyon, containment, iletişim ve recovery katmanıdır. Her SEV-1/SEV-2 kapanışında kök
            neden Edge Case Map&apos;e bağlanır, tekrar riski Modernization Plan&apos;a yazılır ve ilk
            kontroller güncellenir. Playbook yaşayan belgedir.
          </Callout>
        </div>

        {/* Sağ sabit panel */}
        <aside className="shrink-0 xl:w-[290px]">
          <div className="xl:sticky xl:top-[150px]">
            <LiveIncidentRail />
          </div>
        </aside>
      </div>
    </ProductPage>
  )
}
