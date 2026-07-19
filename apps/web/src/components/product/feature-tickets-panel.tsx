'use client'

import { Ticket, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { toneCard, toneDot, toneIcon, toneText, type Tone } from './tones'

export type FeatureTicketRow = {
  id: string
  title: string
  status: 'open' | 'closed' | 'in-progress'
  url?: string
}

export type FeatureExpertRow = {
  name: string
  role: string
}

const statusLabels: Record<FeatureTicketRow['status'], string> = {
  open: 'Açık',
  closed: 'Kapalı',
  'in-progress': 'Devam ediyor',
}

const statusTones: Record<FeatureTicketRow['status'], Tone> = {
  open: 'amber',
  closed: 'green',
  'in-progress': 'blue',
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  if (value === 0) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium',
        toneCard[tone],
        toneText[tone],
      )}
    >
      <span className={cn('size-1.5 rounded-full', toneDot[tone])} aria-hidden />
      {label}
      <span className="font-bold tabular-nums text-foreground">{value}</span>
    </span>
  )
}

function PanelHeader({
  icon: Icon,
  title,
  children,
  tone,
}: {
  icon: LucideIcon
  title: string
  children?: React.ReactNode
  tone: Tone
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-muted/20 px-3 py-2 sm:px-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Icon className={cn('size-4', toneIcon[tone])} />
        {title}
      </h3>
      {children && <div className="ms-auto flex flex-wrap items-center gap-1.5">{children}</div>}
    </div>
  )
}

function TicketTableRow({ ticket }: { ticket: FeatureTicketRow }) {
  const tone = statusTones[ticket.status]
  const label = statusLabels[ticket.status]

  return (
    <div
      role="row"
      className="group grid grid-cols-[3.25rem_5rem_minmax(0,1fr)] items-center gap-x-3 border-b border-border/40 px-3 py-1.5 last:border-b-0 hover:bg-muted/15 sm:grid-cols-[3.5rem_5.5rem_minmax(0,1fr)] sm:gap-x-4 sm:px-4"
    >
      {ticket.url ? (
        <a
          role="cell"
          href={ticket.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-bold tabular-nums text-primary hover:underline"
        >
          #{ticket.id}
        </a>
      ) : (
        <span role="cell" className="text-[11px] font-bold tabular-nums text-foreground">
          #{ticket.id}
        </span>
      )}

      <span
        role="cell"
        className={cn(
          'inline-flex w-fit items-center gap-1 text-[10px] font-semibold uppercase tracking-wide',
          toneText[tone],
        )}
      >
        <span className={cn('size-1.5 shrink-0 rounded-full', toneDot[tone])} aria-hidden />
        {label}
      </span>

      <p role="cell" className="min-w-0 truncate text-xs text-foreground/85" title={ticket.title}>
        {ticket.title}
      </p>
    </div>
  )
}

function ExpertTableRow({ expert, tone }: { expert: FeatureExpertRow; tone: Tone }) {
  const initials = expert.name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')

  return (
    <div
      role="row"
      className="grid grid-cols-[2.25rem_minmax(0,8rem)_minmax(0,1fr)] items-center gap-x-3 border-b border-border/40 px-3 py-1.5 last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,9rem)_minmax(0,1fr)] sm:gap-x-4 sm:px-4"
    >
      <span
        role="cell"
        className={cn(
          'inline-flex size-6 items-center justify-center rounded-md text-[9px] font-bold text-white',
          toneDot[tone],
        )}
      >
        {initials}
      </span>
      <span role="cell" className="truncate text-xs font-semibold text-foreground">
        {expert.name}
      </span>
      <span role="cell" className="truncate text-[11px] text-muted-foreground">
        {expert.role}
      </span>
    </div>
  )
}

export function FeatureTicketsPanel({
  tickets,
  experts,
  tone = 'orange',
}: {
  tickets: FeatureTicketRow[]
  experts: FeatureExpertRow[]
  tone?: Tone
}) {
  const counts = tickets.reduce(
    (acc, ticket) => {
      acc[ticket.status] += 1
      return acc
    },
    { open: 0, closed: 0, 'in-progress': 0 } as Record<FeatureTicketRow['status'], number>,
  )

  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <PanelHeader icon={Ticket} title="Ticket'lar" tone={tone}>
        <SummaryChip label="Açık" value={counts.open} tone="amber" />
        <SummaryChip label="Devam ediyor" value={counts['in-progress']} tone="blue" />
        <SummaryChip label="Kapalı" value={counts.closed} tone="green" />
      </PanelHeader>

      {tickets.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[28rem]" role="table">
            <div
              role="row"
              className="grid grid-cols-[3.25rem_5rem_minmax(0,1fr)] gap-x-3 border-b border-border/50 bg-muted/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[3.5rem_5.5rem_minmax(0,1fr)] sm:gap-x-4 sm:px-4"
            >
              <span role="columnheader">#</span>
              <span role="columnheader">Durum</span>
              <span role="columnheader">Konu</span>
            </div>
            {tickets.map((ticket) => (
              <TicketTableRow key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Bu feature için ticket yok.</p>
      )}

      <div className="border-t border-border/50">
        <PanelHeader icon={Users} title="Know-how" tone={tone} />
        {experts.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[24rem]" role="table">
              <div
                role="row"
                className="grid grid-cols-[2.25rem_minmax(0,8rem)_minmax(0,1fr)] gap-x-3 border-b border-border/50 bg-muted/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[2.5rem_minmax(0,9rem)_minmax(0,1fr)] sm:gap-x-4 sm:px-4"
              >
                <span role="columnheader" className="sr-only">
                  Kod
                </span>
                <span role="columnheader">Kişi</span>
                <span role="columnheader">Rol</span>
              </div>
              {experts.map((expert) => (
                <ExpertTableRow key={expert.name} expert={expert} tone={tone} />
              ))}
            </div>
          </div>
        ) : (
          <p className="px-4 py-4 text-xs text-muted-foreground">Know-how sahibi tanımlı değil.</p>
        )}
      </div>
    </div>
  )
}
