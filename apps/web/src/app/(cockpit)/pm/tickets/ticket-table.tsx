'use client'

import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Inbox } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { Severity, SortColumn, Ticket } from '@/data/pm/types'
import './ticket-table.css'

interface TicketTableProps {
  tickets: Ticket[]
  sortCol: SortColumn
  sortDir: 1 | -1
  onSort: (col: SortColumn) => void
  onOpen: (id: number) => void
}

type ColDef = { key: SortColumn; label: string; width: string }

const COLS: ColDef[] = [
  { key: 'severity', label: 'Sev', width: '3.5rem' },
  { key: 'title', label: 'Ticket', width: 'auto' },
  { key: 'status', label: 'Statü', width: '5.5rem' },
  { key: 'group', label: 'Grup', width: '8rem' },
  { key: 'date', label: 'Tarih', width: '5.75rem' },
  { key: 'customer', label: 'Müşteri', width: '9.5rem' },
]

const SEV: Record<Severity, { cls: string; letter: string; title: string }> = {
  Critical: { cls: 'sev-critical', letter: 'C', title: 'Critical' },
  High: { cls: 'sev-high', letter: 'H', title: 'High' },
  Medium: { cls: 'sev-medium', letter: 'M', title: 'Medium' },
  Low: { cls: 'sev-low', letter: 'L', title: 'Low' },
}

function SortBtn({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: 1 | -1
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('ntt-sort', active && 'ntt-sort-active')}
    >
      {label}
      {!active ? (
        <ArrowUpDown className="size-2.5 opacity-30" />
      ) : dir === 1 ? (
        <ArrowUp className="size-2.5" />
      ) : (
        <ArrowDown className="size-2.5" />
      )}
    </button>
  )
}

function SevBadge({ severity }: { severity: Severity }) {
  const { cls, letter, title } = SEV[severity] ?? SEV.High
  return (
    <span title={title} className={cn('ntt-sev', cls)}>
      {letter}
    </span>
  )
}

function StatusPill({ status }: { status: Ticket['status'] }) {
  const open = status === 'open'
  return (
    <span className={cn('ntt-status', open ? 'ntt-status-open' : 'ntt-status-closed')}>
      <span className="ntt-status-dot" />
      {open ? 'Açık' : 'Kapalı'}
    </span>
  )
}

function MetaTag({ children }: { children: ReactNode }) {
  return <span className="ntt-meta">{children}</span>
}

export function TicketTable({
  tickets,
  sortCol,
  sortDir,
  onSort,
  onOpen,
}: TicketTableProps) {
  return (
    <div className="nesy-ticket-table">
      <div className="ntt-scroll">
        <table>
          <colgroup>
            <col style={{ width: '2.25rem' }} />
            {COLS.map((col) => (
              <col key={col.key} style={col.width === 'auto' ? undefined : { width: col.width }} />
            ))}
            <col style={{ width: '2rem' }} />
          </colgroup>

          <thead>
            <tr>
              <th className="ntt-th ntt-th-index">#</th>
              {COLS.map((col) => (
                <th key={col.key} className="ntt-th">
                  <SortBtn
                    label={col.label}
                    active={sortCol === col.key}
                    dir={sortDir}
                    onClick={() => onSort(col.key)}
                  />
                </th>
              ))}
              <th className="ntt-th" aria-hidden />
            </tr>
          </thead>

          <tbody>
            <AnimatePresence mode="popLayout" initial={false}>
              {tickets.length === 0 ? (
                <motion.tr
                  key="empty"
                  className="ntt-row ntt-row-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <td colSpan={COLS.length + 2}>
                    <div className="ntt-empty">
                      <span className="ntt-empty-icon">
                        <Inbox className="size-4" />
                      </span>
                      Filtrelere uygun ticket yok
                    </div>
                  </td>
                </motion.tr>
              ) : (
                tickets.map((ticket, index) => {
                  const customer =
                    ticket.customer_refs[0] != null
                      ? `${ticket.customer_refs[0].repo}#${ticket.customer_refs[0].num}`
                      : null
                  const extraRefs = Math.max(0, ticket.customer_refs.length - 1)
                  const sev = SEV[ticket.severity] ?? SEV.High

                  return (
                    <motion.tr
                      key={ticket.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: Math.min(index * 0.01, 0.12) }}
                      className={cn(
                        'ntt-row',
                        sev.cls,
                        ticket.status === 'open' ? 'ntt-row-open' : 'ntt-row-closed',
                      )}
                      onClick={() => onOpen(ticket.id)}
                    >
                      <td className="ntt-td ntt-td-index">
                        <span className="ntt-index">{index + 1}</span>
                      </td>

                      <td className="ntt-td">
                        <SevBadge severity={ticket.severity} />
                      </td>

                      <td className="ntt-td">
                        <div className="min-w-0 space-y-1.5">
                          <p className="ntt-title">{ticket.title}</p>
                          <div className="flex flex-wrap items-center gap-1">
                            <MetaTag>#{ticket.id}</MetaTag>
                            <MetaTag>{ticket.type}</MetaTag>
                            <MetaTag>{ticket.screen}</MetaTag>
                          </div>
                        </div>
                      </td>

                      <td className="ntt-td">
                        <StatusPill status={ticket.status} />
                      </td>

                      <td className="ntt-td">
                        <span className="ntt-group">{ticket.group}</span>
                      </td>

                      <td className="ntt-td">
                        <span className="ntt-date">{ticket.date}</span>
                      </td>

                      <td className="ntt-td">
                        {customer ? (
                          <span
                            className="ntt-customer"
                            title={ticket.customer_refs.map((r) => `${r.repo}#${r.num}`).join(', ')}
                          >
                            {customer}
                            {extraRefs > 0 ? <em>+{extraRefs}</em> : null}
                          </span>
                        ) : (
                          <span className="ntt-none">—</span>
                        )}
                      </td>

                      <td className="ntt-td ntt-td-go">
                        <span className="ntt-go">
                          <ChevronRight className="size-3.5" />
                        </span>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  )
}
