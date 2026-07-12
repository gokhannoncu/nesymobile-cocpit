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
      'PDF encoding düzeltmesi (HR/SI)',
      'Bildirim kanal ayrımı implementasyonu',
      'End of Day rapor iyileştirmesi',
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
      'Çift ödeme guard implementasyonu',
      'D4Me QR düşük ışık iyileştirmesi',
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
      'v4.3.1 staging testi ve validasyonu',
      'Fiskalizasyon async geçiş POC',
      'GPS null-safe location implementasyonu',
      'Locker rezervasyon countdown UI',
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
      'ScanCoordinator tasarımı ve POC',
      'Barkod DB migration planı',
      'POS cihazı USB serial güncellemesi',
      'Teslimat fotoğraf retry mekanizması',
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
      'ScanCoordinator implementasyonu',
      'SharedViewModel decomposition başlangıcı',
      'Android 14+ uyumluluk güncellemesi',
    ],
    ticketIds: [501, 801, 1103],
  },
]

export const calendarEvents: CalendarEvent[] = [
  // Sprint boundaries
  { id: 'ev-s24-start', date: '2026-06-30', type: 'sprint-start', title: 'Sprint 24 Başlangıç' },
  { id: 'ev-s24-end', date: '2026-07-11', type: 'sprint-end', title: 'Sprint 24 Bitiş', description: 'Sprint review + retrospective' },
  { id: 'ev-s25-start', date: '2026-07-14', type: 'sprint-start', title: 'Sprint 25 Başlangıç' },
  { id: 'ev-s25-end', date: '2026-07-25', type: 'sprint-end', title: 'Sprint 25 Bitiş' },
  { id: 'ev-s26-start', date: '2026-07-28', type: 'sprint-start', title: 'Sprint 26 Başlangıç' },
  { id: 'ev-s26-end', date: '2026-08-08', type: 'sprint-end', title: 'Sprint 26 Bitiş' },

  // Releases
  { id: 'ev-rel-430', date: '2026-07-01', type: 'release', title: 'v4.3.0 Release', description: 'HR, RS, SI — Adriatic release' },
  { id: 'ev-rel-431', date: '2026-07-15', type: 'release', title: 'v4.3.1 Staging', description: 'Kritik hotfix — çift ödeme + memory leak' },
  { id: 'ev-rel-440', date: '2026-08-15', type: 'release', title: 'v4.4.0 Planned', description: 'Europa — mimari geçiş Phase 1' },

  // Reviews
  { id: 'ev-review-1', date: '2026-07-04', type: 'review', title: 'v4.3.0 Post-mortem', description: 'Release sonrası değerlendirme toplantısı' },
  { id: 'ev-review-2', date: '2026-07-11', type: 'review', title: 'Sprint 24 Review', description: 'Demo + sprint kapanış' },
  { id: 'ev-review-3', date: '2026-07-18', type: 'review', title: 'Architecture Review', description: 'ScanCoordinator design review' },

  // Critical bugs
  { id: 'ev-bug-1', date: '2026-07-02', type: 'critical-bug', title: 'Çift ödeme bug escalation', description: 'RS müşterisinden kritik escalation' },
  { id: 'ev-bug-2', date: '2026-07-08', type: 'critical-bug', title: 'OOM crash spike', description: 'Crashlytics — 50+ OOM in 24h' },

  // Deploys
  { id: 'ev-deploy-1', date: '2026-07-01', type: 'deploy', title: 'v4.3.0 → HR/RS/SI', description: 'Production deploy — 3 ülke' },
  { id: 'ev-deploy-2', date: '2026-07-07', type: 'deploy', title: 'v4.3.0 → BA/ME', description: 'Phased rollout — 2 ülke' },
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
