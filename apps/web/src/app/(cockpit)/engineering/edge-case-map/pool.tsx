'use client'

// Edge Case Pool — DataGrid table + Detail Drawer.
// Row background is not colored; severity is shown only via left dot + badge (visual fatigue principle).

import { ReactNode } from 'react'
import {
  AlertTriangle,
  Bug,
  ClipboardCheck,
  FlaskConical,
  History,
  LifeBuoy,
  Shield,
  Target,
  Wrench,
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
import { toneDot, toneText, type Tone } from '@/components/product'
import { EDGE_CATEGORIES, SEVERITY_META, type Severity } from '@/data/engineering/edge-cases'
import {
  isStale,
  LIFECYCLE_META,
  LIKELIHOOD_META,
  RELEASE_VERSION,
  TEST_STATUS_META,
  type EdgeCaseFull,
} from '@/data/engineering/edge-case-ops'

// ── Common small indicators ──────────────────────────────────────

export function SeverityCell({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn('size-2 rounded-full', toneDot[meta.tone])} />
      <span className={cn('text-xs font-semibold', toneText[meta.tone])}>{meta.label}</span>
    </span>
  )
}

export function TestStatusCell({ e }: { e: EdgeCaseFull }) {
  const meta = TEST_STATUS_META[e.testStatus]
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap', meta.cls)}>
      <span aria-hidden>{meta.symbol}</span>
      {meta.label}
    </span>
  )
}

function AutomationCell({ e }: { e: EdgeCaseFull }) {
  if (e.automation.length === 0)
    return <span className="text-xs text-muted-foreground">○ None</span>
  return (
    <span className="flex flex-wrap gap-1">
      {e.automation.map((a) => (
        <Badge key={a} variant="secondary" appearance="outline" size="xs">
          {a === 'unit' ? 'Unit' : a === 'integration' ? 'Integr.' : 'E2E'}
        </Badge>
      ))}
    </span>
  )
}

function MitigationCell({ e }: { e: EdgeCaseFull }) {
  const map = {
    yes: { txt: '✓ Yes', cls: 'text-green-600 dark:text-green-400' },
    partial: { txt: '◐ Partial', cls: 'text-amber-600 dark:text-amber-400' },
    no: { txt: '○ None', cls: 'text-red-600 dark:text-red-400' },
  }[e.mitigationStatus]
  return <span className={cn('text-xs font-semibold whitespace-nowrap', map.cls)}>{map.txt}</span>
}

// ── Pool table ─────────────────────────────────────────────────

const th =
  'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
const td = 'px-3 py-2.5 align-middle text-xs text-foreground/85'

export function PoolTable({
  items,
  onSelect,
}: {
  items: EdgeCaseFull[]
  onSelect: (e: EdgeCaseFull) => void
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No records match the filter. Simplify your search or clear the quick filters.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className={cn(th, 'sticky left-0 z-10 bg-muted/40 backdrop-blur')}>ID</th>
            <th className={cn(th, 'sticky left-[52px] z-10 bg-muted/40 backdrop-blur min-w-[220px]')}>
              Edge Case
            </th>
            <th className={th}>Severity</th>
            <th className={th}>Test</th>
            <th className={th}>Domain</th>
            <th className={th}>Flow</th>
            <th className={th}>Likelihood</th>
            <th className={th}>Automation</th>
            <th className={th}>Mitigation</th>
            <th className={th}>Incident</th>
            <th className={th}>Release</th>
            <th className={th}>Last Verified</th>
            <th className={th}>Owner</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr
              key={e.id}
              onClick={() => onSelect(e)}
              className="cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/30"
            >
              <td className={cn(td, 'sticky left-0 z-10 bg-background')}>
                <code className="text-xs font-bold text-foreground">{e.id}</code>
              </td>
              <td className={cn(td, 'sticky left-[52px] z-10 bg-background font-semibold text-foreground')}>
                {e.title}
              </td>
              <td className={td}><SeverityCell severity={e.severity} /></td>
              <td className={td}><TestStatusCell e={e} /></td>
              <td className={cn(td, 'whitespace-nowrap')}>{EDGE_CATEGORIES[e.category].label}</td>
              <td className={cn(td, 'whitespace-nowrap')}>{e.flow}</td>
              <td className={cn(td, 'whitespace-nowrap')}>{LIKELIHOOD_META[e.likelihood].label}</td>
              <td className={td}><AutomationCell e={e} /></td>
              <td className={td}><MitigationCell e={e} /></td>
              <td className={cn(td, 'tabular-nums')}>
                {e.incidents > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-400">
                    <Bug className="size-3" /> {e.incidents}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className={td}>
                {e.releaseRisk ? (
                  <Badge variant="destructive" appearance="outline" size="xs">
                    {RELEASE_VERSION}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className={cn(td, 'whitespace-nowrap tabular-nums')}>
                {e.lastVerified ?? <span className="text-muted-foreground">Never</span>}
                {isStale(e) && (
                  <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                    stale
                  </span>
                )}
              </td>
              <td className={cn(td, 'whitespace-nowrap')}>
                {e.owner ?? (
                  <span className="font-semibold text-red-600 dark:text-red-400">Unassigned</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Detail Drawer ────────────────────────────────────────────────

function DrawerSection({
  icon: Icon,
  title,
  tone = 'gray',
  children,
}: {
  icon: typeof Target
  title: string
  tone?: Tone
  children: ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4', toneText[tone])} />
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
      <span className="w-28 shrink-0 font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground/85">{children}</span>
    </div>
  )
}

export function EdgeCaseDrawer({
  edge,
  onClose,
}: {
  edge: EdgeCaseFull | null
  onClose: () => void
}) {
  const e = edge
  return (
    <Sheet open={!!e} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-hidden p-0">
        {e && (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="flex items-center gap-2 text-base">
                <code className="text-sm font-bold">{e.id}</code>
                <span>{e.title}</span>
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <SeverityCell severity={e.severity} />
                <Badge variant="secondary" appearance="outline" size="xs">
                  {EDGE_CATEGORIES[e.category].label}
                </Badge>
                <Badge variant="secondary" appearance="outline" size="xs">{e.flow}</Badge>
                <Badge variant="secondary" appearance="outline" size="xs">
                  {LIFECYCLE_META[e.status].label}
                </Badge>
                {e.releaseRisk && (
                  <Badge variant="destructive" appearance="outline" size="xs">
                    {RELEASE_VERSION} impact
                  </Badge>
                )}
              </div>
            </SheetHeader>
            <SheetBody className="h-[calc(100vh-96px)] space-y-6 overflow-y-auto px-5 py-5">
              <DrawerSection icon={Target} title="1 · Summary" tone="blue">
                <div className="space-y-1.5">
                  <Fact label="Likelihood">{LIKELIHOOD_META[e.likelihood].label}</Fact>
                  <Fact label="Exposure">{e.exposure}</Fact>
                  <Fact label="Owner">{e.owner ?? 'Unassigned'}</Fact>
                  <Fact label="Last Verified">
                    {e.lastVerified ?? 'Never verified'}
                    {isStale(e) && ' · stale'}
                  </Fact>
                  <Fact label="Detectability">{e.detectability}/5 {e.detectability <= 2 && '· silent corruption risk'}</Fact>
                  <Fact label="Recoverability">{e.recoverability}/5</Fact>
                </div>
              </DrawerSection>

              <DrawerSection icon={AlertTriangle} title="2 · Trigger & Preconditions" tone="orange">
                <p>{e.trigger}</p>
                {(e.mechanisms.length > 0 || e.environments.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {e.mechanisms.map((m) => (
                      <Badge key={m} variant="secondary" appearance="outline" size="xs">{m}</Badge>
                    ))}
                    {e.environments.map((env) => (
                      <Badge key={env} variant="secondary" size="xs">{env}</Badge>
                    ))}
                  </div>
                )}
              </DrawerSection>

              {(e.expected || e.actual) && (
                <DrawerSection icon={ClipboardCheck} title="3 · Expected vs Actual" tone="purple">
                  <div className="space-y-2">
                    {e.expected && (
                      <div className="rounded-lg border border-green-200 bg-green-50/60 p-2.5 text-xs dark:border-green-900/60 dark:bg-green-950/30">
                        <span className="font-bold text-green-700 dark:text-green-300">Expected: </span>
                        {e.expected}
                      </div>
                    )}
                    {e.actual && (
                      <div className="rounded-lg border border-red-200 bg-red-50/60 p-2.5 text-xs dark:border-red-900/60 dark:bg-red-950/30">
                        <span className="font-bold text-red-700 dark:text-red-300">Actual: </span>
                        {e.actual}
                      </div>
                    )}
                  </div>
                </DrawerSection>
              )}

              <DrawerSection icon={AlertTriangle} title="4 · Impact & Risk" tone="red">
                <p>{e.impact}</p>
              </DrawerSection>

              {e.reproduceSteps && (
                <DrawerSection icon={FlaskConical} title="5 · Reproduce" tone="indigo">
                  <ol className="list-decimal space-y-1 pl-4 text-xs">
                    {e.reproduceSteps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  {e.reproduceReliability && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Reproduce reliability: <strong>{e.reproduceReliability}/5</strong>
                      {e.reproduceReliability <= 3 && ' — race/timing condition, may not reproduce on every attempt.'}
                    </p>
                  )}
                </DrawerSection>
              )}

              <DrawerSection icon={FlaskConical} title="6 · Test Coverage" tone="teal">
                <div className="space-y-1.5">
                  <Fact label="Last Result"><TestStatusCell e={e} /></Fact>
                  <Fact label="Automation">
                    {e.automation.length > 0 ? e.automation.join(' · ') : 'None — no regression protection'}
                  </Fact>
                </div>
              </DrawerSection>

              <DrawerSection icon={Shield} title="7 · Mitigation" tone="amber">
                <p>
                  {e.mitigationStatus === 'no' && (
                    <span className="mb-1 block text-xs font-semibold text-red-600 dark:text-red-400">
                      No interim protection — there is no mechanism to halt impact during an incident. Target approach:
                    </span>
                  )}
                  {e.mitigationStatus === 'partial' && (
                    <span className="mb-1 block text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Partial protection in place. Approach:
                    </span>
                  )}
                  {e.mitigation}
                </p>
              </DrawerSection>

              {e.recovery && (
                <DrawerSection icon={LifeBuoy} title="8 · Recovery" tone="green">
                  <p>{e.recovery}</p>
                </DrawerSection>
              )}

              {e.permanentFix && (
                <DrawerSection icon={Wrench} title="9 · Permanent Fix" tone="blue">
                  <p>{e.permanentFix}</p>
                </DrawerSection>
              )}

              <DrawerSection icon={History} title="10 · Incidents & History" tone="gray">
                <div className="space-y-1.5">
                  <Fact label="Linked incidents">{e.incidents > 0 ? `${e.incidents} records` : 'None'}</Fact>
                  <Fact label="Lifecycle">{LIFECYCLE_META[e.status].label}</Fact>
                </div>
              </DrawerSection>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
