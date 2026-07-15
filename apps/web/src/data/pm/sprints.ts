// ─── Project Management — Sprint & Calendar Data ─────────────────────────────

import type { Sprint, CalendarEvent } from './types'

export const sprints: Sprint[] = [
  {
    id: 'sprint-22',
    name: 'Sprint 22',
    startDate: '2026-06-02',
    endDate: '2026-06-13',
    status: 'completed',
    goals: [
      'PDF encoding fix (HR/SI)',
      'Notification channel separation implementation',
      'End of Day report enhancement',
    ],
    ticketIds: [447, 703, 510],
  },
  {
    id: 'sprint-23',
    name: 'Sprint 23',
    startDate: '2026-06-16',
    endDate: '2026-06-27',
    status: 'completed',
    goals: [
      'Memory leak hotfix (observeForever)',
      'Double payment guard implementation',
      'D4Me QR low-light enhancement',
    ],
    ticketIds: [1101, 438, 903],
  },
  {
    id: 'sprint-24',
    name: 'Sprint 24',
    startDate: '2026-06-30',
    endDate: '2026-07-11',
    status: 'active',
    goals: [
      'v4.3.1 staging test and validation',
      'Fiscalization async transition POC',
      'GPS null-safe location implementation',
      'Locker reservation countdown UI',
    ],
    ticketIds: [437, 1001, 901],
  },
  {
    id: 'sprint-25',
    name: 'Sprint 25',
    startDate: '2026-07-14',
    endDate: '2026-07-25',
    status: 'planned',
    goals: [
      'ScanCoordinator design and POC',
      'Barcode DB migration plan',
      'POS device USB serial update',
      'Delivery photo retry mechanism',
    ],
    ticketIds: [501, 442, 602],
  },
  {
    id: 'sprint-26',
    name: 'Sprint 26',
    startDate: '2026-07-28',
    endDate: '2026-08-08',
    status: 'planned',
    goals: [
      'ScanCoordinator implementation',
      'SharedViewModel decomposition kickoff',
      'Android 14+ compatibility update',
    ],
    ticketIds: [501, 801, 1103],
  },
]

export const calendarEvents: CalendarEvent[] = [
  // Sprint boundaries
  { id: 'ev-s24-start', date: '2026-06-30', type: 'sprint-start', title: 'Sprint 24 Start' },
  { id: 'ev-s24-end', date: '2026-07-11', type: 'sprint-end', title: 'Sprint 24 End', description: 'Sprint review + retrospective' },
  { id: 'ev-s25-start', date: '2026-07-14', type: 'sprint-start', title: 'Sprint 25 Start' },
  { id: 'ev-s25-end', date: '2026-07-25', type: 'sprint-end', title: 'Sprint 25 End' },
  { id: 'ev-s26-start', date: '2026-07-28', type: 'sprint-start', title: 'Sprint 26 Start' },
  { id: 'ev-s26-end', date: '2026-08-08', type: 'sprint-end', title: 'Sprint 26 End' },

  // Releases
  { id: 'ev-rel-430', date: '2026-07-01', type: 'release', title: 'v4.3.0 Release', description: 'HR, RS, SI — Adriatic release' },
  { id: 'ev-rel-431', date: '2026-07-15', type: 'release', title: 'v4.3.1 Staging', description: 'Critical hotfix — double payment + memory leak' },
  { id: 'ev-rel-440', date: '2026-08-15', type: 'release', title: 'v4.4.0 Planned', description: 'Europa — architecture transition Phase 1' },

  // Reviews
  { id: 'ev-review-1', date: '2026-07-04', type: 'review', title: 'v4.3.0 Post-mortem', description: 'Post-release evaluation meeting' },
  { id: 'ev-review-2', date: '2026-07-11', type: 'review', title: 'Sprint 24 Review', description: 'Demo + sprint closure' },
  { id: 'ev-review-3', date: '2026-07-18', type: 'review', title: 'Architecture Review', description: 'ScanCoordinator design review' },

  // Critical bugs
  { id: 'ev-bug-1', date: '2026-07-02', type: 'critical-bug', title: 'Double payment bug escalation', description: 'Critical escalation from RS customer' },
  { id: 'ev-bug-2', date: '2026-07-08', type: 'critical-bug', title: 'OOM crash spike', description: 'Crashlytics — 50+ OOM in 24h' },

  // Deploys
  { id: 'ev-deploy-1', date: '2026-07-01', type: 'deploy', title: 'v4.3.0 → HR/RS/SI', description: 'Production deploy — 3 countries' },
  { id: 'ev-deploy-2', date: '2026-07-07', type: 'deploy', title: 'v4.3.0 → BA/ME', description: 'Phased rollout — 2 countries' },
  { id: 'ev-deploy-3', date: '2026-07-15', type: 'deploy', title: 'v4.3.1 → Staging', description: 'Staging environment deploy' },
]

// ═══ Helpers ════════════════════════════════════════════════════════════════

export function getActiveSprint() {
  return sprints.find((s) => s.status === 'active')
}

export function getEventsForDate(date: string) {
  return calendarEvents.filter((e) => e.date === date)
}

export function getEventsForMonth(year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return calendarEvents.filter((e) => e.date.startsWith(prefix))
}

export function getSprintForDate(date: string) {
  return sprints.find((s) => date >= s.startDate && date <= s.endDate)
}
