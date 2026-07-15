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
// 0. Fixed incident top bar
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
            <Megaphone className="size-3.5" /> Send operational announcement
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            <Link2 className="size-3.5" /> Link to existing incident
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            <ArrowRightLeft className="size-3.5" /> Devret
          </Button>
        </div>
      </div>

      {/* Status stepper */}
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
        <span>Start <b className="text-foreground">{inc.startedAt}</b></span>
        <span>Elapsed <b className="font-mono text-foreground">{inc.elapsed}</b></span>
        <span>Kapsam <b className="text-foreground">{inc.scope}</b></span>
        <span>IC <b className="text-foreground">{inc.commander}</b></span>
        <span>Last update <b className="text-foreground">{inc.lastUpdate}</b></span>
        <span>Next comms <b className="text-red-600 dark:text-red-400">{inc.nextComms}</b></span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right fixed panel — Live Incident Rail
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
        <div className="text-[11px] text-muted-foreground">elapsed · start {inc.startedAt}</div>
      </div>

      {/* Current objective */}
      <div className={cn('rounded-xl border p-3.5', toneCard.amber)}>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          <Crosshair className="size-3.5" /> Current objective
        </div>
        <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">{inc.objective}</p>
      </div>

      {/* Impact summary */}
      <div className="mt-8">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Impact summary</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {inc.impact.map((m) => (
            <div key={m.label} className="rounded-lg bg-muted/50 px-2 py-1.5">
              <div className="text-sm font-bold tabular-nums text-foreground">{m.value}</div>
              <div className="text-[10px] text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Incident team */}
      <div className="rounded-xl border border-border bg-background p-3.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Users className="size-3.5" /> Incident team
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

      {/* Latest decision + next check */}
      <div className={cn('rounded-xl border p-3.5', toneCard.blue)}>
        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Latest decision</div>
        <p className="mt-1 text-xs leading-relaxed text-foreground">{inc.lastDecision}</p>
        <div className="mt-2.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Next check</div>
        <p className="mt-1 text-xs leading-relaxed text-foreground">{inc.nextCheck}</p>
      </div>

      {/* Live timeline */}
      <div className="mt-8 border-t border-border/60 pt-6">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <History className="size-3.5" /> Live timeline
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
        title: 'Not an incident',
        text: 'Normal Ticket Triage → backlog priority → related team. You can leave this page.',
      }
    }
    if (max >= 3) {
      return {
        tone: 'red' as Tone,
        title: 'Strong incident signal — SEV-1 candidate',
        text: 'Next step: "Has this happened before?" check. If financial/fiscal/data loss risk exists, proceed directly to SEV-1 evaluation.',
      }
    }
    return {
      tone: 'orange' as Tone,
      title: 'Incident possible',
      text: 'Next step: "Has this happened before?" check — if no match, SEV-2/SEV-3 depending on impact scope.',
    }
  }, [answers])

  return (
    <PageSection
      id="triage"
      eyebrow="Step 1 · Detect"
      title="Is this an incident?"
      icon={SearchCode}
      tone="blue"
      description="Four questions to answer before group and file selection: is the impact ongoing, is the flow blocked, what is the scope, is there a risk type?"
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
        <Callout icon={AlertTriangle} title="System decision" tone="gray">
          Answer all four questions — the system will direct you either to <b>normal ticket triage</b> or{' '}
          <b>&quot;has this happened before?&quot;</b> step.
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
      eyebrow="Step 3 · Declare"
      title="Severity calculator"
      icon={AlertOctagon}
      tone="red"
      description="Question-based calculator instead of static card: what you mark is scored, the recommended SEV level appears. If unsure, start with a high level, then lower it."
    >
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Decision questions — mark the valid ones
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
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Recommended level</div>
            {anyAnswered ? (
              <>
                <div className={cn('mt-1 text-3xl font-bold', toneText[suggestedTone])}>{suggested}</div>
                <div className="mt-1 text-xs text-muted-foreground">Score: {score} points</div>
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
                As you mark the questions, the recommendation appears here. In uncertainty, starting with a high severity is safe
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
                  <b className="text-foreground/80">Example:</b> {s.examples}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/85">
                  <b>Intervention:</b> {s.response}
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
      eyebrow="Step 6 · Contain"
      title="First 15 minutes protocol"
      icon={Timer}
      tone="orange"
      description="Executed in order; no steps skipped. The goal is not to fix, but to contain the impact. Owner, start/end time, result and evidence link are added to each item."
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
        Each item is recorded with these fields:
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
        lead="Detect → Declare → Contain → Diagnose → Recover → Learn. When an engineer arrives at this page, they first get answers to 'what should I stop, who should I inform, has this happened before?'; file and code diagnosis (Diagnosis Workspace) comes after these."
        chips={[
          `${INCIDENT_STATS.totalTickets} ticket analysis`,
          `${INCIDENT_STATS.openTickets} open`,
          `Highest risk: ${INCIDENT_STATS.riskiestGroup}`,
        ]}
      />

      <IncidentTopBar />

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Left main area — hierarchical incident flow */}
        <div className="min-w-0 flex-1 space-y-8 xl:max-w-[74%]">
          <TriageSection />

          {/* 2. Has this happened before? */}
          <PageSection
            id="dedup"
            eyebrow="Step 2 · Detect"
            title="Has this happened before?"
            icon={History}
            tone="purple"
            description="The system scans open incidents and the known issue library with fingerprint signals. The search is kept short — does not delay the intervention; if no match, new incident flow continues."
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
                <GitBranch className="size-3.5" /> Critical routing rule
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
            eyebrow="Step 4 · Declare"
            title="Incident declaration and team organization"
            icon={Users}
            tone="purple"
            description="After Severity is determined, an incident record is opened and roles are assigned (Google SRE + PagerDuty role model). In small incidents roles can be merged — but the IC should not do both coordination and intense debugging."
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
                Merged structure in small incident
              </div>
              <pre className="mt-2 font-mono text-[11px] leading-relaxed text-foreground/85">{SMALL_INCIDENT_STRUCTURE}</pre>
            </div>
          </PageSection>

          {/* 5. Impact Snapshot */}
          <PageSection
            id="impact"
            eyebrow="Step 5 · Contain"
            title="Determine the impact area — Impact Snapshot"
            icon={Activity}
            tone="blue"
            description="Mandatory fields are filled, automatic comparisons are opened. Risk Map comes into play here — it's not the main process, but a supporting component for impact classification."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mandatory fields</div>
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
                  Automatic comparisons
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
            eyebrow="Step 7 · Diagnose"
            title="Diagnosis Workspace — group and screen routing"
            icon={Zap}
            tone="red"
            description="Technical diagnosis starts after initial security and containment steps are completed. Group and screen selection; followed by the first files to check, log queries, known race conditions and similar past tickets. Reproduce Lab is the tool under this workspace."
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Select screen:</span>
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
                      <Badge variant="secondary" appearance="outline" size="xs">{g.tickets} tickets</Badge>
                      <Badge variant="secondary" appearance="outline" size="xs">{g.open} open</Badge>
                      <Badge variant="secondary" appearance="outline" size="xs">{g.highRisk} high risk</Badge>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <Code2 className="size-3.5" /> First checks
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
                      <CheckCircle2 className="size-3.5" /> Quick actions
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
            eyebrow="Step 8 · Diagnose"
            title="Protect evidences — Evidence Gate"
            icon={Lock}
            tone="amber"
            description="Evidences are collected before the Reproduce process. In state/race, offline queue and fiscal incidents, evidence loss is irreversible."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <FileSearch className="size-3.5" /> Evidences to collect
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
                  <AlertTriangle className="size-3.5" /> Approval is required before these operations
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
                  &quot;This operation may change evidence or temporary state. Are evidences saved?&quot;
                </div>
              </div>
            </div>
          </PageSection>

          {/* 9. Hypothesis and experiment area */}
          <PageSection
            id="hypotheses"
            eyebrow="Step 9 · Diagnose"
            title="Hypothesis and experiment area"
            icon={FlaskConical}
            tone="teal"
            description="Structured record instead of experiments lost in chat. Owner is mandatory in active tasks — the same experiment is not done twice."
          >
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    {['Time', 'Hypothesis', 'Test', 'Owner', 'Result', 'Status'].map((h) => (
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
              Statuses:
              {(['New', 'Testing', 'Strong signal', 'Verified', 'Eliminated'] as const).map((s) => (
                <Badge key={s} variant="secondary" appearance="outline" size="xs">{s}</Badge>
              ))}
            </div>
          </PageSection>

          {/* 10. Containment / mitigasyon */}
          <PageSection
            id="mitigation"
            eyebrow="Step 10 · Contain"
            title="Containment and mitigation"
            icon={ShieldCheck}
            tone="orange"
            description="The question is not 'what is the root cause?': how do we stop the impact in the safest way? Mitigation stops the impact now; permanent fix eliminates the root cause later."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mitigation options</div>
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
                    In every mitigation card
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
                    <span className="font-normal text-foreground/85">— stops the incident impact now.</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 font-bold text-teal-700 dark:text-teal-300">
                    <Landmark className="size-3.5" /> Permanent fix
                    <span className="font-normal text-foreground/85">— eliminates the root cause, planned later.</span>
                  </div>
                </div>
              </div>
            </div>
          </PageSection>

          {/* 11. Communication center */}
          <PageSection
            id="comms"
            eyebrow="Step 11 · Contain"
            title="Communication center"
            icon={Megaphone}
            tone="blue"
            description="Communication flow independent of technical solution. Unverified root cause is not written; if information is missing, it is stated as 'unknown', no guessing."
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Target groups:</span>
              {COMMS_AUDIENCES.map((a) => (
                <Badge key={a} variant="secondary" appearance="outline" size="sm">{a}</Badge>
              ))}
            </div>
            <div className={cn('rounded-xl border p-4', toneCard.blue)}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Status message format
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
            eyebrow="Step 12 · Recover"
            title="Recovery and validation"
            icon={MonitorCheck}
            tone="green"
            description="After mitigation, the incident is not immediately marked as 'resolved'. It is closed not because the system is working again, but because exit criteria are measured (Google SRE — exit criteria)."
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
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Status transition</div>
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
            eyebrow="Step 13 · Recover"
            title="Incident closing"
            icon={ClipboardCheck}
            tone="teal"
            description="Two mandatory blocks in the closing screen: operational and technical closing. If there is an unanswered question, the incident is not closed."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {[
                { title: 'Operational closing', items: CLOSING_OPERATIONAL, tone: 'teal' as Tone },
                { title: 'Technical closing', items: CLOSING_TECHNICAL, tone: 'indigo' as Tone },
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
            eyebrow="Step 14 · Learn"
            title="Post-incident learning"
            icon={BookOpenCheck}
            tone="purple"
            description="Activates after the incident is resolved. The goal is not to close the issue, but to feed the Detect–Respond–Recover–Improve cycle (NIST SP 800-61r3)."
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Postmortem structure</div>
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
                  Auto-updated systems
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
            <StatCard label="Total Tickets" value={INCIDENT_STATS.totalTickets} tone="gray" hint="HR 21 · RS 12 · General 11 · CEE 4" />
            <StatCard label="Critical" value={INCIDENT_STATS.bySeverity.critical} tone="red" hint="Double TOUR event · scan crash" />
            <StatCard label="High" value={INCIDENT_STATS.bySeverity.high} tone="orange" hint="Majority Finance & Payment" />
            <StatCard label="Most Risky Screens" value="16" tone="amber" hint={INCIDENT_STATS.riskiestScreens} />
          </StatGrid>

          <Callout icon={Siren} title="Layer separation" tone="red">
            Reproduce Lab is a technical diagnosis tool, Risk Map is a classification view, playbook remains as an information
            source. This page — Incident Command Center — is the decision-making,
            coordination, containment, communication and recovery layer above them. At every SEV-1/SEV-2 closure, root
            cause is linked to Edge Case Map, recurrence risk is written to Modernization Plan and first
            checks are updated. Playbook is a living document.
          </Callout>
        </div>

        {/* Right fixed panel */}
        <aside className="shrink-0 xl:w-[290px]">
          <div className="xl:sticky xl:top-[150px]">
            <LiveIncidentRail />
          </div>
        </aside>
      </div>
    </ProductPage>
  )
}
