'use client'

// Field Ticket Intelligence — Overview / Patterns / Actions / Knowledge Base views.

import { useMemo } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  GitPullRequestArrow,
  Landmark,
  Scale,
  ShieldAlert,
  Wrench,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Callout, PageSection, toneCard, toneDot, toneText } from '@/components/product'
import {
  ACTIONS,
  ACTION_STATUS_META,
  ACTION_TYPE_LABEL,
  FIELD_TICKETS,
  RC_STATUS_META,
  RISK_META,
  ROOT_CAUSES,
  actionTickets,
  primaryTicketsOf,
  type ActionStatus,
  type FieldTicket,
} from '@/data/engineering/field-tickets'

// ── Common mini bar ───────────────────────────────────────────────

function Bar({ value, max, tone = 'blue' }: { value: number; max: number; tone?: string }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-muted">
      <span
        className={cn('block h-full rounded-full', toneDot[tone as keyof typeof toneDot] ?? 'bg-blue-500')}
        style={{ width: `${Math.max((value / max) * 100, 3)}%` }}
      />
    </span>
  )
}

// ── Overview ─────────────────────────────────────────────────────

export function OverviewView({
  onOpenRc,
  onJumpPool,
}: {
  onOpenRc: (rcId: string) => void
  onJumpPool: (query: string) => void
}) {
  const highRisk = ROOT_CAUSES.filter((rc) => rc.repeatRisk === 'high')
    .map((rc) => ({ rc, n: primaryTicketsOf(rc.id).length }))
    .sort((a, b) => b.n - a.n)
  const waDebt = FIELD_TICKETS.filter((t) => t.status === 'closed' && t.fixType === 'workaround')
  const verifQueue = FIELD_TICKETS.filter((t) => t.pastAttempt && t.repeatRisk !== 'low')

  return (
    <div className="space-y-8">
      <PageSection
        eyebrow={`${highRisk.length} root causes`}
        title="Active high recurrence risk"
        description="These root causes are records expected to generate new tickets under the current architecture. A ticket being closed does not eliminate the risk."
        icon={ShieldAlert}
        tone="red"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {highRisk.map(({ rc, n }) => (
            <button
              key={rc.id}
              type="button"
              onClick={() => onOpenRc(rc.id)}
              className={cn('rounded-xl border p-4 text-left transition-shadow hover:shadow-md', toneCard.red)}
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  <code className="text-xs font-bold text-red-600 dark:text-red-400">{rc.id}</code>
                  <span className="ml-2 text-sm font-bold text-foreground">{rc.title}</span>
                </span>
                <Badge variant="secondary" appearance="outline" size="xs">{n} ticket</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground/80">{rc.summary}</p>
              <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                {rc.family} · {rc.mechanism} · {RC_STATUS_META[rc.status].label}
              </p>
            </button>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow={`${waDebt.length} ticket`}
        title="Closed ≠ Eliminated — workaround borcu"
        description="These tickets are closed but the root cause has not been structurally resolved; tracked as technical debt."
        icon={Scale}
        tone="amber"
      >
        <div className="flex flex-wrap gap-1.5">
          {waDebt.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onJumpPool(t.id)}
              className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              title={t.title}
            >
              {t.id} · {t.rootCause}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onJumpPool('status:closed workaround:true')}
          className="mt-3 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          Open in Pool: status:closed workaround:true →
        </button>
      </PageSection>

      <PageSection
        eyebrow={`${verifQueue.length} records`}
        title="Verification Queue"
        description="Records where intervention was applied but race/regression verification is not yet complete. Fix Implemented ≠ Verified."
        icon={CheckCircle2}
        tone="blue"
      >
        <button
          type="button"
          onClick={() => onJumpPool('')}
          className="hidden"
        />
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-bold text-muted-foreground">Ticket</th>
                <th className="px-3 py-2 font-bold text-muted-foreground">Applied intervention</th>
                <th className="px-3 py-2 font-bold text-muted-foreground">Recurrence risk</th>
              </tr>
            </thead>
            <tbody>
              {verifQueue.slice(0, 10).map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                  onClick={() => onJumpPool(t.id)}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-bold">{t.id}</td>
                  <td className="px-3 py-2 text-foreground/80">
                    <span className="line-clamp-1">{t.pastAttempt}</span>
                  </td>
                  <td className={cn('whitespace-nowrap px-3 py-2 font-semibold', toneText[RISK_META[t.repeatRisk].tone])}>
                    {RISK_META[t.repeatRisk].label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {verifQueue.length > 10 && (
          <p className="mt-2 text-xs text-muted-foreground">
            +{verifQueue.length - 10} more records — Saved View: Verification Queue
          </p>
        )}
      </PageSection>
    </div>
  )
}

// ── Patterns ─────────────────────────────────────────────────────

export function PatternsView({ onOpenRc }: { onOpenRc: (rcId: string) => void }) {
  const pareto = useMemo(
    () =>
      ROOT_CAUSES
        .map((rc) => ({ rc, n: primaryTicketsOf(rc.id).length }))
        .sort((a, b) => b.n - a.n),
    [],
  )
  const max = pareto[0]?.n ?? 1

  const byKey = (key: (t: FieldTicket) => string) => {
    const m = new Map<string, number>()
    for (const t of FIELD_TICKETS) m.set(key(t), (m.get(key(t)) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const groups = byKey((t) => t.group)
  const screens = byKey((t) => t.screen).slice(0, 8)
  const countries = byKey((t) => t.country)

  // Repeat Risk Matrix: occurrence (x) × repeat risk (y)
  const matrix = pareto.map(({ rc, n }) => ({ rc, n }))

  return (
    <div className="space-y-8">
      <PageSection
        eyebrow="Pareto"
        title="Root causes generating the most tickets"
        description="Most tickets originate from a small number of canonical root causes — architectural investment priority is read from this order."
        icon={BarChart3}
        tone="indigo"
      >
        <div className="space-y-2">
          {pareto.filter(({ n }) => n > 0).map(({ rc, n }) => (
            <button
              key={rc.id}
              type="button"
              onClick={() => onOpenRc(rc.id)}
              className="grid w-full grid-cols-[130px_1fr_40px] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
            >
              <span className="truncate text-xs font-semibold text-foreground" title={rc.title}>
                <code className="mr-1 font-bold text-indigo-600 dark:text-indigo-400">{rc.id}</code>
                {rc.family}
              </span>
              <Bar value={n} max={max} tone={RISK_META[rc.repeatRisk].tone} />
              <span className="text-right text-xs font-bold tabular-nums">{n}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Bar color indicates recurrence risk: red high · amber medium · green low.
        </p>
      </PageSection>

      <PageSection
        eyebrow="Risk matrix"
        title="Occurrence × Recurrence Risk"
        description="The top-right corner (many tickets + high recurrence risk) is the most urgent area for architectural investment."
        icon={AlertTriangle}
        tone="red"
      >
        <div className="grid grid-cols-[60px_1fr] gap-2">
          {(['high', 'medium', 'low'] as const).map((risk) => (
            <div key={risk} className="contents">
              <div className={cn('flex items-center text-[11px] font-bold', toneText[RISK_META[risk].tone])}>
                {RISK_META[risk].label}
              </div>
              <div className="flex min-h-14 flex-wrap items-center gap-1.5 rounded-lg border border-dashed p-2">
                {matrix
                  .filter(({ rc, n }) => rc.repeatRisk === risk && n > 0)
                  .map(({ rc, n }) => (
                    <button
                      key={rc.id}
                      type="button"
                      onClick={() => onOpenRc(rc.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:shadow-sm',
                        toneCard[RISK_META[risk].tone],
                      )}
                      title={rc.title}
                    >
                      {rc.id} · {n}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Number inside chip = linked ticket count.</p>
      </PageSection>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[
          { title: 'Engineering Domain', data: groups, tone: 'blue' },
          { title: 'Screen / Flow', data: screens, tone: 'purple' },
          { title: 'Country', data: countries, tone: 'teal' },
        ].map(({ title, data, tone }) => {
          const m = data[0]?.[1] ?? 1
          return (
            <div key={title} className="rounded-xl border bg-background p-4">
              <h3 className="text-sm font-bold text-foreground">{title}</h3>
              <div className="mt-3 space-y-2">
                {data.map(([label, n]) => (
                  <div key={label} className="grid grid-cols-[110px_1fr_28px] items-center gap-2">
                    <span className="truncate text-xs text-foreground/80" title={label}>{label}</span>
                    <Bar value={n} max={m} tone={tone} />
                    <span className="text-right text-xs font-bold tabular-nums">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Actions (Kanban) ─────────────────────────────────────────────

const KANBAN_COLS: ActionStatus[] = ['proposed', 'planned', 'in-progress', 'verification', 'completed']

export function ActionsView({ onOpenRc }: { onOpenRc: (rcId: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {KANBAN_COLS.map((col) => {
            const meta = ACTION_STATUS_META[col]
            const items = ACTIONS.filter((a) => a.status === col)
            return (
              <div key={col} className="rounded-xl border bg-muted/20">
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                  <span className={cn('text-xs font-bold uppercase tracking-wide', toneText[meta.tone])}>
                    {meta.label}
                  </span>
                  <Badge variant="secondary" appearance="outline" size="xs">{items.length}</Badge>
                </div>
                <div className="space-y-2 p-2.5">
                  {items.length === 0 && (
                    <p className="p-2 text-center text-[11px] text-muted-foreground">—</p>
                  )}
                  {items.map((a) => {
                    const n = actionTickets(a.id).length
                    return (
                      <div key={a.id} className="rounded-lg border bg-background p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-[11px] font-bold">{a.id}</code>
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {ACTION_TYPE_LABEL[a.type]}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs font-semibold leading-snug text-foreground">
                          {a.title}
                        </p>
                        <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                          {a.summary}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {a.rootCauses.map((rid) => (
                            <button
                              key={rid}
                              type="button"
                              onClick={() => onOpenRc(rid)}
                              className="rounded border px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                            >
                              {rid}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
                          <Wrench className="mr-1 inline size-3" />
                          {n} linked tickets · Ref: {a.ref}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Callout icon={GitPullRequestArrow} title="Action verification rule" tone="blue">
        An action moves to the <strong>Completed</strong> column only when the <em>verification</em> criteria
        are met with evidence (regression test, production metric, or QA record).
        Merging a code change alone is not sufficient — Fix Implemented ≠ Verified.
      </Callout>
    </div>
  )
}

// ── Knowledge Base ───────────────────────────────────────────────

export function KnowledgeView({ onOpenRc }: { onOpenRc: (rcId: string) => void }) {
  const families = [...new Set(ROOT_CAUSES.map((rc) => rc.family))]
  return (
    <div className="space-y-8">
      {families.map((family) => {
        const items = ROOT_CAUSES.filter((rc) => rc.family === family)
        return (
          <PageSection
            key={family}
            eyebrow={`${items.length} canonical records`}
            title={family}
            icon={Landmark}
            tone="indigo"
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {items.map((rc) => {
                const n = primaryTicketsOf(rc.id).length
                const statusMeta = RC_STATUS_META[rc.status]
                return (
                  <button
                    key={rc.id}
                    type="button"
                    onClick={() => onOpenRc(rc.id)}
                    className="rounded-xl border bg-background p-4 text-left transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        <code className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{rc.id}</code>
                        <span className="ml-2 text-sm font-bold text-foreground">{rc.title}</span>
                      </span>
                      <span className={cn('shrink-0 text-[11px] font-bold', toneText[statusMeta.tone])}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-foreground/80">
                      {rc.summary}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                      <span>{n} occurrence</span>
                      <span>· confidence: {rc.confidence}</span>
                      <span className={toneText[RISK_META[rc.repeatRisk].tone]}>
                        · recurrence risk {RISK_META[rc.repeatRisk].label.toLowerCase()}
                      </span>
                      {rc.edgeCases.length > 0 && <span>· {rc.edgeCases.join(', ')}</span>}
                      <span>· {rc.adrRefs.join(', ')}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </PageSection>
        )
      })}

      <PageSection
        eyebrow="Guardrails"
        title="Interpretation Rules"
        description="Data on this page is read using the following rules; violating them leads to incorrect engineering decisions."
        icon={BookOpen}
        tone="gray"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {[
            ['Symptom ≠ Root Cause', 'The behavior observed by the user is not the technical root cause; the ticket is first recorded as a symptom and linked to the canonical cause through analysis.'],
            ['Hypothesis ≠ Confirmed', "Diagnoses with confidence below 65 are hypotheses; definitive language must not be used without 'Confirmed' status."],
            ['Workaround ≠ Permanent Fix', 'A ticket closure does not indicate the architectural risk is resolved; records closed with workarounds are tracked as debt.'],
            ['Closed Ticket ≠ Eliminated Risk', 'Recurrence risk may persist under the same root cause; risk is assessed at the root cause level.'],
            ['Correlation ≠ Causation', 'Temporal proximity to a release alone is not proof of causality; release linkage requires evidence.'],
            ['Fix Implemented ≠ Verified', 'A code change is not marked as Verified without regression/production validation.'],
          ].map(([title, body]) => (
            <Callout key={title} icon={AlertTriangle} title={title} tone="gray">
              {body}
            </Callout>
          ))}
        </div>
      </PageSection>
    </div>
  )
}
