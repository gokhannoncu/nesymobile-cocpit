// ─── Project Management — Ticket Data ────────────────────────────────────────
// Canonical 48-ticket dataset from NesyArchitectureReport (`tickets.json`).

import ticketsData from './tickets.json'
import type { Filters, SortColumn, Ticket } from './types'

export const tickets = ticketsData as Ticket[]

/** Mimari kök-neden grup sırası (Architecture Report ile aynı) */
export const GROUP_ORDER = [
  'Finans & Ödeme',
  'Barcode & Scan',
  'D4Me & Locker',
  'State & Race',
  'Tour & Teslimat',
  'Bildirim',
  'Offline & Sync',
  'Konum & GPS',
  'UI & Crash',
  'Güvenlik',
  'Ülke & Config',
  'Genel',
] as const

export const ALL_GROUPS = (() => {
  const present = new Set(tickets.map((t) => t.group))
  const ordered = GROUP_ORDER.filter((g) => present.has(g))
  const extras = [...present].filter((g) => !GROUP_ORDER.includes(g as (typeof GROUP_ORDER)[number])).sort()
  return [...ordered, ...extras]
})()

export const ALL_SCREENS = [...new Set(tickets.map((t) => t.screen))].sort((a, b) =>
  a.localeCompare(b, 'tr'),
)

const sevOrder: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
}

export function countBy(
  items: Ticket[],
  getKey: (ticket: Ticket) => string | string[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const keys = getKey(item)
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      counts[key] = (counts[key] || 0) + 1
    }
  }
  return counts
}

export function sortedEntries(counts: Record<string, number>): [string, number][] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

export function sortGroupEntries(entries: [string, number][]): [string, number][] {
  const order = Object.fromEntries(GROUP_ORDER.map((g, i) => [g, i]))
  return [...entries].sort((a, b) => {
    const diff = (order[a[0]] ?? 99) - (order[b[0]] ?? 99)
    return diff !== 0 ? diff : b[1] - a[1]
  })
}

export function filterTickets(items: Ticket[], filters: Filters, search: string): Ticket[] {
  const q = search.toLowerCase().trim()

  return items.filter((ticket) => {
    if (filters.severity && ticket.severity !== filters.severity) return false
    if (filters.status && ticket.status !== filters.status) return false
    if (filters.group && ticket.group !== filters.group) return false
    if (filters.type && ticket.type !== filters.type) return false
    if (filters.screen && ticket.screen !== filters.screen) return false
    if (
      q &&
      !ticket.title.toLowerCase().includes(q) &&
      !String(ticket.id).includes(q) &&
      !ticket.summary.toLowerCase().includes(q) &&
      !(ticket.customer_ticket || '').toLowerCase().includes(q) &&
      !ticket.group.toLowerCase().includes(q) &&
      !ticket.screen.toLowerCase().includes(q)
    ) {
      return false
    }
    return true
  })
}

export function sortTickets(items: Ticket[], sortCol: SortColumn, sortDir: 1 | -1): Ticket[] {
  return [...items].sort((a, b) => {
    let va: string | number
    let vb: string | number

    switch (sortCol) {
      case 'severity':
        va = sevOrder[a.severity] ?? 4
        vb = sevOrder[b.severity] ?? 4
        break
      case 'id':
        va = a.id
        vb = b.id
        break
      case 'date':
        va = a.date
        vb = b.date
        break
      case 'status':
        va = a.status
        vb = b.status
        break
      case 'group':
        va = a.group
        vb = b.group
        break
      case 'type':
        va = a.type
        vb = b.type
        break
      case 'customer':
        va = a.customer_ticket
        vb = b.customer_ticket
        break
      default:
        va = a.title
        vb = b.title
    }

    if (va < vb) return -1 * sortDir
    if (va > vb) return 1 * sortDir
    return 0
  })
}

export function ticketStats(items: Ticket[] = tickets) {
  const counts = {
    total: items.length,
    open: 0,
    closed: 0,
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  }
  for (const ticket of items) {
    counts[ticket.status]++
    counts[ticket.severity]++
  }
  return counts
}
