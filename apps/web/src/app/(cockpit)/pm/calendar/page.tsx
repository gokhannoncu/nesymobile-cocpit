'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  ProductPage,
  HeroCallout,
  PageSection,
  CardGrid,
  InfoCard,
  StatCard,
  StatGrid,
  Callout,
} from '@/components/product'
import type { CalendarEventType } from '@/data/pm/types'
import {
  sprints,
  calendarEvents,
  getActiveSprint,
  getEventsForDate,
  getSprintForDate,
} from '@/data/pm/sprints'

// ═══ Helpers ════════════════════════════════════════════════════════════════

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const eventTypeColor: Record<CalendarEventType, string> = {
  release: 'bg-green-500',
  'critical-bug': 'bg-red-500',
  'sprint-start': 'bg-blue-500',
  'sprint-end': 'bg-blue-400',
  review: 'bg-amber-500',
  deploy: 'bg-purple-500',
}

const eventTypeLabel: Record<CalendarEventType, string> = {
  release: 'Release',
  'critical-bug': 'Critical Bug',
  'sprint-start': 'Sprint Start',
  'sprint-end': 'Sprint End',
  review: 'Review',
  deploy: 'Deploy',
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDow = (firstDay.getDay() + 6) % 7
  const days: (number | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`
}

// ═══ Component ═══════════════════════════════════════════════════════════════

export default function CalendarPage() {
  const [currentYear, setCurrentYear] = useState(2026)
  const [currentMonth, setCurrentMonth] = useState(7)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const activeSprint = useMemo(() => getActiveSprint(), [])

  const remainingDays = useMemo(() => {
    if (!activeSprint) return 0
    const now = new Date()
    const end = new Date(activeSprint.endDate)
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }, [activeSprint])

  const monthEvents = useMemo(() => {
    const prefix = `${currentYear}-${pad(currentMonth)}`
    return calendarEvents.filter((e) => e.date.startsWith(prefix))
  }, [currentYear, currentMonth])

  const calendarDays = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth],
  )

  const today = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }, [])

  const selectedEvents = useMemo(
    () => (selectedDate ? getEventsForDate(selectedDate) : []),
    [selectedDate],
  )

  const selectedSprint = useMemo(
    () => (selectedDate ? getSprintForDate(selectedDate) : undefined),
    [selectedDate],
  )

  function prevMonth() {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1)
      setCurrentMonth(12)
    } else {
      setCurrentMonth((m) => m - 1)
    }
    setSelectedDate(null)
  }

  function nextMonth() {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1)
      setCurrentMonth(1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
    setSelectedDate(null)
  }

  const sprintStatusTone: Record<string, 'green' | 'blue' | 'gray'> = {
    completed: 'green',
    active: 'blue',
    planned: 'gray',
  }

  const sprintStatusLabel: Record<string, string> = {
    completed: 'Completed',
    active: 'Active',
    planned: 'Planned',
  }

  return (
    <ProductPage path="/pm/calendar" title="Sprint Calendar">
      {/* 1 — Hero */}
      <HeroCallout
        icon={CalendarDays}
        eyebrow="Planning"
        tone="purple"
        title="Sprint Calendar"
        lead="Sprint planning, event calendars, and milestone tracking."
      >
        <StatGrid cols={2}>
          <StatCard
            label="Active Sprint"
            value={activeSprint?.name ?? '—'}
            tone="blue"
          />
          <StatCard
            label="Days Remaining"
            value={remainingDays}
            tone="purple"
          />
          <StatCard
            label="Sprint Goals"
            value={activeSprint?.goals.length ?? 0}
            tone="teal"
          />
          <StatCard
            label="Events This Month"
            value={monthEvents.length}
            tone="amber"
          />
        </StatGrid>
      </HeroCallout>

      {/* 2 — Interactive Calendar */}
      <PageSection title="Calendar">
        {/* Month Header */}
        <div className="flex items-center justify-between rounded-xl border bg-card p-4">
          <button
            onClick={prevMonth}
            className="flex size-9 items-center justify-center rounded-lg border bg-background transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h3 className="text-lg font-bold text-foreground">
            {MONTHS[currentMonth - 1]} {currentYear}
          </h3>
          <button
            onClick={nextMonth}
            className="flex size-9 items-center justify-center rounded-lg border bg-background transition-colors hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`null-${idx}`} className="invisible min-h-[80px]" />
            }

            const ds = dateStr(currentYear, currentMonth, day)
            const dayEvents = calendarEvents.filter((e) => e.date === ds)
            const isToday = ds === today
            const isSelected = ds === selectedDate
            const sprint = getSprintForDate(ds)

            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds === selectedDate ? null : ds)}
                className={cn(
                  'min-h-[80px] rounded-lg border p-1.5 text-sm text-left cursor-pointer transition hover:bg-muted/50',
                  isToday && 'ring-2 ring-purple-500',
                  isSelected &&
                    'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700',
                  sprint && !isSelected && 'border-l-2 border-l-blue-400 dark:border-l-blue-600',
                )}
              >
                <span
                  className={cn(
                    'inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                    isToday &&
                      'bg-purple-600 text-white dark:bg-purple-500',
                  )}
                >
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {dayEvents.map((ev) => (
                      <span
                        key={ev.id}
                        className={cn(
                          'size-2 rounded-full',
                          eventTypeColor[ev.type],
                        )}
                        title={ev.title}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Selected Date Detail Panel */}
        {selectedDate && (selectedEvents.length > 0 || selectedSprint) && (
          <div className="mt-4 rounded-xl border bg-card p-4 space-y-3">
            <h4 className="text-sm font-bold text-foreground">
              {selectedDate}
            </h4>

            {selectedSprint && (
              <div className="flex items-center gap-2 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-3">
                <span className="size-2 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {selectedSprint.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {selectedSprint.startDate} → {selectedSprint.endDate}
                </span>
              </div>
            )}

            {selectedEvents.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 text-sm">
                <span
                  className={cn(
                    'mt-1.5 size-2.5 shrink-0 rounded-full',
                    eventTypeColor[ev.type],
                  )}
                />
                <div>
                  <div className="font-semibold text-foreground">{ev.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {eventTypeLabel[ev.type]}
                  </div>
                  {ev.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {ev.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      {/* 3 — Sprint Summary */}
      <PageSection title="Sprint Summary">
        <CardGrid cols={2}>
          {sprints.map((s) => (
            <InfoCard
              key={s.id}
              icon={CalendarDays}
              title={s.name}
              eyebrow={`${s.startDate} → ${s.endDate}`}
              desc={sprintStatusLabel[s.status] ?? s.status}
              bullets={s.goals}
              badges={[{ label: `${s.ticketIds.length} ticket` }]}
              tone={sprintStatusTone[s.status] ?? 'gray'}
            />
          ))}
        </CardGrid>
      </PageSection>

      {/* 4 — Guardrail */}
      <Callout icon={Info} tone="amber" title="Planning Guide">
        The sprint calendar is a planning tool. The committed sprint scope can only be changed
        with Product Owner approval after the sprint has started. Out-of-calendar changes are
        evaluated in the sprint retrospective.
      </Callout>
    </ProductPage>
  )
}
