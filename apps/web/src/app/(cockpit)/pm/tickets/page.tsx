'use client'

import { useEffect, useMemo, useState } from 'react'
import { Filter, KanbanSquare } from 'lucide-react'
import { HeroCallout, PageSection, ProductPage } from '@/components/product'
import { tickets, filterTickets, sortTickets, ticketStats } from '@/data/pm/tickets'
import { emptyFilters, type Filters, type SortColumn } from '@/data/pm/types'
import { OverviewSection } from './overview-section'
import { FiltersBar } from './filters-bar'
import { TicketTable } from './ticket-table'
import { TicketDetail } from './ticket-detail'
import './ticket-dashboard.css'

export default function TicketsPage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortColumn>('severity')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    document.body.style.overflow = selectedId ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [selectedId])

  const stats = useMemo(() => ticketStats(tickets), [])

  const filteredTickets = useMemo(
    () => sortTickets(filterTickets(tickets, filters, search), sortCol, sortDir),
    [filters, search, sortCol, sortDir],
  )

  const selectedTicket = selectedId ? (tickets.find((t) => t.id === selectedId) ?? null) : null

  const toggleFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? null : value,
    }))
  }

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || null }))
  }

  const clearFilters = () => {
    setFilters(emptyFilters)
    setSearch('')
  }

  const toggleStatFilter = (key: 'severity' | 'status' | '', value: string) => {
    if (!key) {
      clearFilters()
      return
    }
    toggleFilter(key, value)
  }

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((dir) => (dir === 1 ? -1 : 1))
    } else {
      setSortCol(col)
      setSortDir(1)
    }
  }

  return (
    <ProductPage path="/pm/tickets" hideToolbar>
      <HeroCallout
        icon={KanbanSquare}
        eyebrow="PM · Tickets"
        title="Ticket Dashboard"
        lead="Mimari kök neden gruplarına göre operasyonel ticket analizi."
        tone="nesy"
        compact
        layout="stack"
      >
        <OverviewSection
          total={stats.total}
          open={stats.open}
          closed={stats.closed}
          critical={stats.Critical}
          high={stats.High}
          medium={stats.Medium}
          low={stats.Low}
          filters={filters}
          onStatClick={toggleStatFilter}
        />
      </HeroCallout>

      <div className="pm-td space-y-5">
        <PageSection
          eyebrow="Liste"
          title="Ticket listesi"
          icon={Filter}
          tone="nesy"
          className="space-y-3"
        >
          <FiltersBar
            tickets={tickets}
            filters={filters}
            search={search}
            resultCount={filteredTickets.length}
            totalCount={tickets.length}
            onSearchChange={setSearch}
            onToggleFilter={toggleFilter}
            onSetFilter={setFilter}
            onClear={clearFilters}
          />

          <TicketTable
            tickets={filteredTickets}
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={handleSort}
            onOpen={setSelectedId}
          />
        </PageSection>

        <TicketDetail
          ticket={selectedTicket}
          onClose={() => setSelectedId(null)}
          onNavigate={setSelectedId}
        />
      </div>
    </ProductPage>
  )
}
