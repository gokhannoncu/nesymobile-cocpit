'use client'

// Edge Case Intelligence — Risk Map, Test Coverage, Relationships and
// "What Should We Test Next?" views.

import { Fragment } from 'react'
import { Crosshair, FlaskConical, Layers, ListOrdered } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Callout, PageSection, toneDot, toneText } from '@/components/product'
import { EDGE_CATEGORIES, SEVERITY_META, type Severity } from '@/data/engineering/edge-cases'
import {
  EDGE_FULL,
  ENV_COLUMNS,
  LIKELIHOOD_META,
  TEST_STATUS_META,
  testNextQueue,
  type EdgeCaseFull,
  type Likelihood,
} from '@/data/engineering/edge-case-ops'
import { SeverityCell } from './pool'

type SelectFn = (e: EdgeCaseFull) => void

// ── Risk Map ─────────────────────────────────────────────────────

/** Bubble color = test coverage · dashed border = mitigation missing. */
function RiskChip({ e, onSelect }: { e: EdgeCaseFull; onSelect: SelectFn }) {
  const coverCls =
    e.testStatus === 'passed'
      ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 border-green-300 dark:border-green-800'
      : e.testStatus === 'failed'
        ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-800'
        : 'bg-muted text-foreground/70 border-border'
  return (
    <button
      type="button"
      onClick={() => onSelect(e)}
      title={`${e.id} — ${e.title}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold transition-transform hover:scale-105',
        coverCls,
        e.mitigationStatus === 'no' && 'border-dashed border-orange-500 dark:border-orange-500',
      )}
    >
      {e.id}
      {e.incidents > 0 && <span className="font-normal opacity-70">·{e.incidents}</span>}
    </button>
  )
}

function MatrixLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span><span className="mr-1 inline-block size-2.5 rounded-full bg-green-400" />Test passed</span>
      <span><span className="mr-1 inline-block size-2.5 rounded-full bg-red-400" />Test failed</span>
      <span><span className="mr-1 inline-block size-2.5 rounded-full bg-muted-foreground/40" />Not tested</span>
      <span><span className="mr-1 inline-block size-2.5 rounded-full border border-dashed border-orange-500" />No mitigation</span>
      <span>·n = linked incident count</span>
    </div>
  )
}

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium']
const LIKE_ORDER: Likelihood[] = ['rare', 'likely', 'frequent']

export function RiskMapView({ onSelect }: { onSelect: SelectFn }) {
  return (
    <div className="space-y-8">
      <PageSection
        eyebrow="Likelihood × Impact"
        title="Risk Matrix"
        description="The top-right corner is the most dangerous zone: frequent + critical. Click a chip to open the detail drawer."
        icon={Crosshair}
        tone="red"
      >
        <div className="overflow-x-auto rounded-xl border bg-background p-4">
          <div className="grid min-w-[640px] grid-cols-[90px_repeat(3,1fr)] gap-2">
            <div />
            {LIKE_ORDER.map((l) => (
              <div key={l} className="text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {LIKELIHOOD_META[l].label}
              </div>
            ))}
            {SEV_ORDER.map((sev) => (
              <Fragment key={sev}>
                <div className="flex items-center">
                  <SeverityCell severity={sev} />
                </div>
                {LIKE_ORDER.map((like, li) => {
                  const cell = EDGE_FULL.filter((e) => e.severity === sev && e.likelihood === like)
                  const danger = sev === 'critical' && li >= 1
                  return (
                    <div
                      key={like}
                      className={cn(
                        'min-h-16 rounded-lg border p-2',
                        danger
                          ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
                          : 'border-border bg-muted/20',
                      )}
                    >
                      <div className="flex flex-wrap gap-1">
                        {cell.map((e) => (
                          <RiskChip key={e.id} e={e} onSelect={onSelect} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
          <div className="mt-3"><MatrixLegend /></div>
        </div>
      </PageSection>

      <PageSection
        eyebrow="Detectability × Recoverability"
        title="Silent Corruption Map"
        description="The most dangerous zone is the bottom-left corner: the problem is both hard to detect and irreversible. Data divergences that do not produce crashes reside here."
        icon={Crosshair}
        tone="purple"
      >
        <div className="overflow-x-auto rounded-xl border bg-background p-4">
          <div className="grid min-w-[640px] grid-cols-[110px_repeat(3,1fr)] gap-2">
            <div />
            {(['Hard to recover (1–2)', 'Medium (3)', 'Easy to recover (4–5)'] as const).map((h) => (
              <div key={h} className="text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {h}
              </div>
            ))}
            {([
              { label: 'Easy to detect (4–5)', test: (d: number) => d >= 4 },
              { label: 'Medium (3)', test: (d: number) => d === 3 },
              { label: 'Hard to detect (1–2)', test: (d: number) => d <= 2 },
            ]).map((row, ri) => (
              <Fragment key={row.label}>
                <div className="flex items-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </div>
                {([
                  (r: number) => r <= 2,
                  (r: number) => r === 3,
                  (r: number) => r >= 4,
                ]).map((colTest, ci) => {
                  const cell = EDGE_FULL.filter((e) => row.test(e.detectability) && colTest(e.recoverability))
                  const danger = ri === 2 && ci === 0
                  return (
                    <div
                      key={ci}
                      className={cn(
                        'min-h-16 rounded-lg border p-2',
                        danger
                          ? 'border-purple-300 bg-purple-50/60 dark:border-purple-800 dark:bg-purple-950/30'
                          : 'border-border bg-muted/20',
                      )}
                    >
                      {danger && (
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                          Silent + irreversible
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {cell.map((e) => (
                          <RiskChip key={e.id} e={e} onSelect={onSelect} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
          <div className="mt-3"><MatrixLegend /></div>
        </div>
      </PageSection>
    </div>
  )
}

// ── Test Coverage ────────────────────────────────────────────────

const COV_SYMBOL: Record<'pass' | 'warn' | 'fail' | 'none', { s: string; cls: string; label: string }> = {
  pass: { s: '✓', cls: 'text-green-600 dark:text-green-400', label: 'Passed' },
  warn: { s: '◐', cls: 'text-amber-600 dark:text-amber-400', label: 'Partial / stale' },
  fail: { s: '×', cls: 'text-red-600 dark:text-red-400', label: 'Failed' },
  none: { s: '—', cls: 'text-muted-foreground/50', label: 'Not tested' },
}

export function CoverageView({ onSelect }: { onSelect: SelectFn }) {
  const sorted = [...EDGE_FULL].sort((a, b) => a.automation.length - b.automation.length)
  const covTh = 'px-2.5 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground'
  return (
    <div className="space-y-8">
      <PageSection
        eyebrow="Edge case × test type"
        title="Automation Matrix"
        description="Which record is protected by which test type? '—' cells indicate coverage gaps; records without automation are listed at the top."
        icon={FlaskConical}
        tone="teal"
      >
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Edge Case
                </th>
                <th className={covTh}>Unit</th>
                <th className={covTh}>Integration</th>
                <th className={covTh}>E2E</th>
                <th className={covTh}>Manual / Last Result</th>
                <th className={covTh}>Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const has = (t: string) => e.automation.includes(t as never)
                const cell = (present: boolean) => (
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={cn('text-sm font-bold', present ? COV_SYMBOL.pass.cls : COV_SYMBOL.none.cls)}>
                      {present ? '✓' : '—'}
                    </span>
                  </td>
                )
                const ts = TEST_STATUS_META[e.testStatus]
                return (
                  <tr
                    key={e.id}
                    onClick={() => onSelect(e)}
                    className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-1.5 text-xs">
                      <code className="font-bold">{e.id}</code>
                      <span className="ml-2 text-foreground/85">{e.title}</span>
                    </td>
                    {cell(has('unit'))}
                    {cell(has('integration'))}
                    {cell(has('e2e'))}
                    <td className="px-2.5 py-1.5 text-center">
                      <span className={cn('text-xs font-semibold', ts.cls)}>{ts.symbol} {ts.label}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <span
                        className={cn('text-sm font-bold', {
                          yes: COV_SYMBOL.pass.cls,
                          partial: COV_SYMBOL.warn.cls,
                          no: COV_SYMBOL.fail.cls,
                        }[e.mitigationStatus])}
                      >
                        {{ yes: '✓', partial: '◐', no: '○' }[e.mitigationStatus]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection
        eyebrow="Edge case × environment"
        title="Environment Coverage"
        description="The same scenario behaves differently across environments such as online, offline, restart, and rotation. This table shows which combinations have never been tested (only records with environment data entered)."
        icon={FlaskConical}
        tone="indigo"
      >
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Edge Case
                </th>
                {ENV_COLUMNS.map((c) => (
                  <th key={c.key} className={covTh}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EDGE_FULL.filter((e) => e.envCoverage).map((e) => (
                <tr
                  key={e.id}
                  onClick={() => onSelect(e)}
                  className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-1.5 text-xs">
                    <code className="font-bold">{e.id}</code>
                    <span className="ml-2 text-foreground/85">{e.title}</span>
                  </td>
                  {ENV_COLUMNS.map((c) => {
                    const v = COV_SYMBOL[e.envCoverage?.[c.key] ?? 'none']
                    return (
                      <td key={c.key} className="px-2.5 py-1.5 text-center" title={v.label}>
                        <span className={cn('text-sm font-bold', v.cls)}>{v.s}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {Object.values(COV_SYMBOL).map((v) => (
            <span key={v.label}>
              <span className={cn('mr-1 font-bold', v.cls)}>{v.s}</span>
              {v.label}
            </span>
          ))}
        </div>
      </PageSection>
    </div>
  )
}

// ── Relationships (pool memberships) ──────────────────────────────

export function RelationshipsView({ onPoolClick }: { onPoolClick: (query: string) => void }) {
  const domainPools = Object.entries(EDGE_CATEGORIES).map(([key, meta]) => ({
    label: meta.label,
    query: `domain:${key}`,
    count: EDGE_FULL.filter((e) => e.category === key).length,
  }))
  const flowPools = [...new Set(EDGE_FULL.map((e) => e.flow))].map((f) => ({
    label: f,
    query: `flow:${f.toLowerCase().split(' ')[0] ?? ''}`,
    count: EDGE_FULL.filter((e) => e.flow === f).length,
  }))
  const mechPools = [...new Set(EDGE_FULL.flatMap((e) => e.mechanisms))].map((m) => ({
    label: m,
    query: m.toLowerCase().split(' ')[0] ?? '',
    count: EDGE_FULL.filter((e) => e.mechanisms.includes(m)).length,
  }))
  const envPools = [...new Set(EDGE_FULL.flatMap((e) => e.environments))].map((m) => ({
    label: m,
    query: m.toLowerCase().split(' ')[0] ?? '',
    count: EDGE_FULL.filter((e) => e.environments.includes(m)).length,
  }))

  const groups = [
    { title: 'Domain Pool', desc: 'Technical domain — a record belongs to a single domain.', pools: domainPools, tone: 'blue' as const },
    { title: 'Flow Pool', desc: 'User flow — the first question during incident triage.', pools: flowPools, tone: 'teal' as const },
    { title: 'Failure Mechanism Pool', desc: 'Failure mechanism — the same mechanism recurs across different domains.', pools: mechPools, tone: 'orange' as const },
    { title: 'Environment Pool', desc: 'Triggering environment condition — feeds the columns of the test matrix.', pools: envPools, tone: 'purple' as const },
  ]

  return (
    <div className="space-y-8">
      <Callout icon={Layers} title="Pool logic" tone="blue">
        An edge case belongs to multiple pools simultaneously — E27 is in the <em>Payment &amp; Fiscal</em>,{' '}
        <em>Partial Success</em>, and <em>Process Killed</em> pools. Clicking a pool opens the Pool
        tab with that filter applied; records are not confined to a single category.
      </Callout>
      {groups.map((g) => (
        <PageSection key={g.title} title={g.title} description={g.desc} icon={Layers} tone={g.tone}>
          <div className="flex flex-wrap gap-2">
            {g.pools
              .sort((a, b) => b.count - a.count)
              .map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onPoolClick(p.query)}
                  className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50"
                >
                  <span className={cn('size-1.5 rounded-full', toneDot[g.tone])} />
                  {p.label}
                  <Badge variant="secondary" size="xs">{p.count}</Badge>
                </button>
              ))}
          </div>
        </PageSection>
      ))}
    </div>
  )
}

// ── What Should We Test Next? ────────────────────────────────────

export function TestNextPanel({ onSelect }: { onSelect: SelectFn }) {
  const queue = testNextQueue(5)
  return (
    <PageSection
      eyebrow="Impact × Likelihood × Exposure × Incident × Change Proximity × Coverage Gap"
      title="What Should We Test Next?"
      description="Priority queue — shows rationale, not just scores. Pre-release test planning starts here."
      icon={ListOrdered}
      tone="red"
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {queue.map((item, i) => {
          const sev = SEVERITY_META[item.edge.severity]
          return (
            <button
              key={item.edge.id}
              type="button"
              onClick={() => onSelect(item.edge)}
              className="rounded-xl border bg-background p-4 text-left transition-shadow hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/30"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <code className={cn('text-xs font-bold', toneText[sev.tone])}>{item.edge.id}</code>
                <span className="truncate text-sm font-bold text-foreground">{item.edge.title}</span>
              </div>
              <div className="mt-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Why now?
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-foreground/85">
                  {item.reasons.slice(0, 4).map((r) => (
                    <li key={r} className="flex gap-1.5">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-red-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-2.5 rounded-lg bg-muted/50 p-2 text-xs leading-relaxed text-foreground/80">
                <span className="font-bold text-foreground/70">Suggested test: </span>
                {item.suggestedTest}
              </div>
            </button>
          )
        })}
      </div>
    </PageSection>
  )
}
