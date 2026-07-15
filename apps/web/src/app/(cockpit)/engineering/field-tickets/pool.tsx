'use client'

// Field Ticket Pool — DataGrid + right Detail Drawer.
// Row background is not colored; severity is shown via left dot + badge (same principle as edge-case-map).

import { ReactNode, useState } from 'react'
import {
  AlertTriangle,
  ExternalLink,
  FileSearch,
  History,
  Link2,
  MapPin,
  ShieldAlert,
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
import {
  ACTION_BY_ID,
  ACTION_STATUS_META,
  FIX_TYPE_META,
  RC_BY_ID,
  RC_STATUS_META,
  RISK_META,
  SEVERITY_META,
  primaryTicketsOf,
  type FieldTicket,
} from '@/data/engineering/field-tickets'

export function SeverityCell({ t }: { t: FieldTicket }) {
  const meta = SEVERITY_META[t.severity]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn('size-2 rounded-full', toneDot[meta.tone])} />
      <span className={cn('text-xs font-semibold', toneText[meta.tone])}>{meta.label}</span>
    </span>
  )
}

export function RiskCell({ risk }: { risk: FieldTicket['repeatRisk'] }) {
  const meta = RISK_META[risk]
  return (
    <span className={cn('text-xs font-semibold whitespace-nowrap', toneText[meta.tone])}>
      {risk === 'high' ? '▲' : risk === 'medium' ? '◆' : '▽'} {meta.label}
    </span>
  )
}

export function FixTypeCell({ t }: { t: FieldTicket }) {
  const meta = FIX_TYPE_META[t.fixType]
  return (
    <span className={cn('text-xs font-semibold whitespace-nowrap', toneText[meta.tone])}>
      {meta.label}
    </span>
  )
}

export function ConfidenceCell({ value }: { value: number }) {
  const tone: Tone = value >= 80 ? 'green' : value >= 65 ? 'amber' : 'red'
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <span
          className={cn('block h-full rounded-full', toneDot[tone])}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className={cn('text-[11px] font-semibold tabular-nums', toneText[tone])}>{value}</span>
    </span>
  )
}

// ── Pool table ─────────────────────────────────────────────────

const th =
  'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
const td = 'px-3 py-2.5 align-middle text-xs text-foreground/85'

export function TicketPoolTable({
  items,
  onSelect,
  onSelectRc,
}: {
  items: FieldTicket[]
  onSelect: (t: FieldTicket) => void
  onSelectRc: (rcId: string) => void
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No tickets match the filter. Simplify your search or clear the quick filters.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-[1180px] border-collapse text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className={cn(th, 'sticky left-0 z-10 bg-muted/40 backdrop-blur')}>ID</th>
            <th className={cn(th, 'sticky left-[72px] z-10 min-w-[240px] bg-muted/40 backdrop-blur')}>
              Ticket
            </th>
            <th className={th}>Severity</th>
            <th className={th}>Status</th>
            <th className={th}>Country</th>
            <th className={th}>Screen</th>
            <th className={th}>Root Cause</th>
            <th className={th}>Confidence</th>
            <th className={th}>Recurrence Risk</th>
            <th className={th}>Fix</th>
            <th className={th}>Edge Case</th>
            <th className={th}>Customer Ticket</th>
            <th className={th}>Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const rc = RC_BY_ID.get(t.rootCause)
            return (
              <tr
                key={t.id}
                onClick={() => onSelect(t)}
                className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/30"
              >
                <td className={cn(td, 'sticky left-0 z-10 bg-background')}>
                  <code className="text-xs font-bold text-foreground">{t.id}</code>
                </td>
                <td className={cn(td, 'sticky left-[72px] z-10 bg-background font-semibold text-foreground')}>
                  {t.title}
                </td>
                <td className={td}><SeverityCell t={t} /></td>
                <td className={td}>
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      t.status === 'open'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-muted-foreground',
                    )}
                  >
                    {t.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>{t.country}</td>
                <td className={cn(td, 'whitespace-nowrap')}>{t.screen}</td>
                <td className={cn(td, 'max-w-[220px]')}>
                  {rc ? (
                    <button
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); onSelectRc(rc.id) }}
                      className="group inline-flex items-center gap-1 text-left"
                      title={rc.title}
                    >
                      <code className="text-[11px] font-bold text-indigo-600 group-hover:underline dark:text-indigo-400">
                        {rc.id}
                      </code>
                      <span className="truncate text-xs text-foreground/80 group-hover:text-foreground">
                        {rc.title}
                      </span>
                    </button>
                  ) : '—'}
                </td>
                <td className={td}><ConfidenceCell value={t.confidence} /></td>
                <td className={td}><RiskCell risk={t.repeatRisk} /></td>
                <td className={td}><FixTypeCell t={t} /></td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  {t.edgeCases.length > 0 ? (
                    <span className="flex gap-1">
                      {t.edgeCases.map((e) => (
                        <Badge key={e} variant="secondary" appearance="outline" size="xs">{e}</Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  {t.customerTicket || <span className="text-muted-foreground">—</span>}
                </td>
                <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{t.date}</td>
              </tr>
            )
          })}
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

export function TicketDrawer({
  ticket,
  onClose,
  onSelectRc,
}: {
  ticket: FieldTicket | null
  onClose: () => void
  onSelectRc: (rcId: string) => void
}) {
  const t = ticket
  const rc = t ? RC_BY_ID.get(t.rootCause) : undefined
  const siblings = t && rc ? primaryTicketsOf(rc.id).filter((s) => s.id !== t.id) : []
  return (
    <Sheet open={!!t} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-xl">
        {t && (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="flex items-center gap-2 text-base">
                <code className="text-sm font-bold">{t.id}</code>
                <span>{t.title}</span>
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <SeverityCell t={t} />
                <Badge variant="secondary" appearance="outline" size="xs">{t.group}</Badge>
                <Badge variant="secondary" appearance="outline" size="xs">{t.screen}</Badge>
                <Badge variant="secondary" appearance="outline" size="xs">{t.country}</Badge>
                <Badge
                  variant={t.status === 'open' ? 'primary' : 'secondary'}
                  appearance="outline"
                  size="xs"
                >
                  {t.status === 'open' ? 'Open' : 'Closed'}
                </Badge>
                {t.ghUrl && (
                  <a
                    href={t.ghUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(ev) => ev.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    GitHub <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </SheetHeader>
            <SheetBody className="h-[calc(100vh-96px)] space-y-6 overflow-y-auto px-5 py-5">
              <DrawerSection icon={Target} title="1 · Symptom" tone="blue">
                <p>{t.symptom}</p>
                <div className="mt-2.5 space-y-1.5">
                  <Fact label="Customer ticket">{t.customerTicket || '—'}</Fact>
                  <Fact label="Date">{t.date}</Fact>
                  <Fact label="Type">{t.type}</Fact>
                  {t.detectability && (
                    <Fact label="Detectability">
                      {t.detectability}
                      {t.detectability === 'low' && ' · silent corruption — invisible until reconciliation'}
                    </Fact>
                  )}
                </div>
              </DrawerSection>

              <DrawerSection icon={ShieldAlert} title="2 · Recurrence Risk" tone={RISK_META[t.repeatRisk].tone}>
                <p>
                  <RiskCell risk={t.repeatRisk} />
                  {t.repeatRisk === 'high' &&
                    ' — recurrence is expected under the current architecture; even if the ticket is closed, the risk has not been eliminated.'}
                  {t.repeatRisk === 'medium' &&
                    ' — may reappear in similar flows until the root cause is structurally resolved.'}
                  {t.repeatRisk === 'low' && ' — local fix is sufficient; structural recurrence is not expected.'}
                </p>
              </DrawerSection>

              {t.location && (
                <DrawerSection icon={MapPin} title="3 · Where in the System?" tone="indigo">
                  <p className="rounded-lg border bg-muted/40 p-2.5 font-mono text-xs leading-relaxed">
                    {t.location}
                  </p>
                </DrawerSection>
              )}

              <DrawerSection icon={AlertTriangle} title="4 · Canonical Root Cause" tone="orange">
                {rc && (
                  <button
                    type="button"
                    onClick={() => onSelectRc(rc.id)}
                    className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-2.5 text-left transition-colors hover:bg-indigo-100/60 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50"
                  >
                    <span className="min-w-0">
                      <code className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{rc.id}</code>
                      <span className="ml-2 text-xs font-semibold text-foreground">{rc.title}</span>
                    </span>
                    <Badge variant="secondary" appearance="outline" size="xs">
                      {RC_STATUS_META[rc.status].label}
                    </Badge>
                  </button>
                )}
                <p>{t.rootNote}</p>
                <div className="mt-2 space-y-1.5">
                  <Fact label="Confidence">
                    <ConfidenceCell value={t.confidence} />
                    {t.confidence < 65 && (
                      <span className="ml-2 text-[11px] font-semibold text-red-600 dark:text-red-400">
                        hypothesis — do not use definitive language
                      </span>
                    )}
                  </Fact>
                  {t.contributing.length > 0 && (
                    <Fact label="Contributors">
                      <span className="flex flex-wrap gap-1">
                        {t.contributing.map((cid) => {
                          const c = RC_BY_ID.get(cid)
                          return (
                            <button
                              key={cid}
                              type="button"
                              onClick={() => onSelectRc(cid)}
                              className="rounded border px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                              title={c?.title}
                            >
                              {cid}
                            </button>
                          )
                        })}
                      </span>
                    </Fact>
                  )}
                </div>
              </DrawerSection>

              {t.pastAttempt && (
                <DrawerSection icon={History} title="5 · What Was Tried?" tone="amber">
                  <p>{t.pastAttempt}</p>
                </DrawerSection>
              )}

              {t.whyInsufficient && (
                <DrawerSection icon={FileSearch} title="6 · Why Not Sufficient?" tone="red">
                  <p>{t.whyInsufficient}</p>
                </DrawerSection>
              )}

              {t.fix && (
                <DrawerSection icon={Wrench} title="7 · Proposed Permanent Fix" tone="green">
                  <p>{t.fix}</p>
                  {rc && rc.actions.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {rc.actions.map((aid) => {
                        const act = ACTION_BY_ID.get(aid)
                        if (!act) return null
                        const meta = ACTION_STATUS_META[act.status]
                        return (
                          <div
                            key={aid}
                            className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs"
                          >
                            <span className="min-w-0 truncate">
                              <code className="font-bold">{act.id}</code>
                              <span className="ml-1.5 text-foreground/80">{act.title}</span>
                            </span>
                            <span className={cn('shrink-0 font-semibold', toneText[meta.tone])}>
                              {meta.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </DrawerSection>
              )}

              <DrawerSection icon={Link2} title="8 · Connected Knowledge" tone="purple">
                <div className="space-y-1.5">
                  <Fact label="Edge case">
                    {t.edgeCases.length > 0 ? t.edgeCases.join(' · ') : 'No linked edge case'}
                  </Fact>
                  <Fact label="ADR / Report">{rc?.adrRefs.join(' · ') ?? '—'}</Fact>
                  <Fact label="Closure type"><FixTypeCell t={t} /></Fact>
                </div>
                {siblings.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Other tickets linked to the same root cause
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {siblings.map((s) => (
                        <Badge key={s.id} variant="secondary" appearance="outline" size="xs" title={s.title}>
                          {s.id} · {s.country}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </DrawerSection>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Root Cause Drawer ────────────────────────────────────────────

export function RootCauseDrawer({
  rcId,
  onClose,
  onSelectTicket,
}: {
  rcId: string | null
  onClose: () => void
  onSelectTicket: (t: FieldTicket) => void
}) {
  const rc = rcId ? RC_BY_ID.get(rcId) : undefined
  const tickets = rc ? primaryTicketsOf(rc.id) : []
  const countries = new Set(tickets.map((t) => t.country))
  const screens = new Set(tickets.map((t) => t.screen))
  const wa = tickets.filter((t) => t.fixType === 'workaround').length
  return (
    <Sheet open={!!rc} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-xl">
        {rc && (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="flex items-center gap-2 text-base">
                <code className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{rc.id}</code>
                <span>{rc.title}</span>
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary" appearance="outline" size="xs">{rc.family}</Badge>
                <Badge variant="secondary" appearance="outline" size="xs">{rc.mechanism}</Badge>
                <Badge variant="secondary" appearance="outline" size="xs">
                  {RC_STATUS_META[rc.status].label}
                </Badge>
                <span className={cn('text-xs font-semibold', toneText[RISK_META[rc.repeatRisk].tone])}>
                  Recurrence risk: {RISK_META[rc.repeatRisk].label}
                </span>
              </div>
            </SheetHeader>
            <SheetBody className="h-[calc(100vh-96px)] space-y-6 overflow-y-auto px-5 py-5">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs font-semibold text-foreground/85">
                {tickets.length} occurrence · {countries.size} countries · {screens.size} screens ·{' '}
                {wa} workaround · confidence: {rc.confidence}
              </div>

              <DrawerSection icon={AlertTriangle} title="Canonical Description" tone="orange">
                <p>{rc.summary}</p>
              </DrawerSection>

              <DrawerSection icon={FileSearch} title="Contributing Factors" tone="amber">
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {rc.amplifiedBy.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </DrawerSection>

              <DrawerSection icon={Wrench} title="Permanent Actions" tone="green">
                <div className="space-y-1.5">
                  {rc.actions.map((aid) => {
                    const act = ACTION_BY_ID.get(aid)
                    if (!act) return null
                    const meta = ACTION_STATUS_META[act.status]
                    return (
                      <div key={aid} className="rounded-lg border p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-bold">{act.id}</code>
                          <span className={cn('font-semibold', toneText[meta.tone])}>{meta.label}</span>
                        </div>
                        <p className="mt-1 font-semibold text-foreground">{act.title}</p>
                        <p className="mt-1 text-muted-foreground">Verification: {act.verification}</p>
                      </div>
                    )
                  })}
                </div>
              </DrawerSection>

              <DrawerSection icon={Link2} title="Linked Tickets" tone="blue">
                <div className="space-y-1.5">
                  {tickets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTicket(t)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left text-xs transition-colors hover:bg-muted/40"
                    >
                      <span className="min-w-0 truncate">
                        <code className="font-bold">{t.id}</code>
                        <span className="ml-1.5 text-foreground/80">{t.title}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <SeverityCell t={t} />
                        <span className="text-muted-foreground">{t.country}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </DrawerSection>

              <DrawerSection icon={Link2} title="Connected Knowledge" tone="purple">
                <div className="space-y-1.5">
                  <Fact label="Edge case">{rc.edgeCases.length > 0 ? rc.edgeCases.join(' · ') : '—'}</Fact>
                  <Fact label="ADR / Report">{rc.adrRefs.join(' · ')}</Fact>
                </div>
              </DrawerSection>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
