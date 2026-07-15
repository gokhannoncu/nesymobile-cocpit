// ─── Project Management — Release Data ───────────────────────────────────────

import type { Release } from './types'

export const releases: Release[] = [
  {
    id: 'rel-4.3.0',
    version: '4.3.0',
    codename: 'Adriatic',
    date: '2026-07-01',
    status: 'released',
    countries: ['hr', 'rs', 'si'],
    ticketIds: [445, 505, 605, 903, 1002, 1105],
    features: [
      'D4Me low-light QR scanning — automatic flash',
      'Notification channel separation (route/payment/general)',
      'Dark mode WCAG AA contrast improvement',
    ],
    fixes: [
      'Tax calculation rounding difference (SI) — BigDecimal migration',
      'Crash fix when camera permission is denied',
      'Delivery failure reason codes update',
      'Map marker flicker issue resolution',
    ],
    notes: 'Roll-out to first three countries. BA/ME planned for next week.',
  },
  {
    id: 'rel-4.2.1',
    version: '4.2.1',
    codename: 'Balkan Patch',
    date: '2026-06-15',
    status: 'released',
    countries: ['hr', 'rs', 'si', 'ba', 'me'],
    ticketIds: [447, 510, 703],
    features: [],
    fixes: [
      'Invoice PDF encoding issue — UTF-8 font embed',
      'Manual barcode entry character limit 20→40',
      'Notification sound/vibration channel separation',
    ],
    notes: 'Hotfix release — bug fixes only.',
  },
  {
    id: 'rel-4.2.0',
    version: '4.2.0',
    codename: 'Danube',
    date: '2026-05-20',
    status: 'released',
    countries: ['hr', 'rs', 'si', 'ba', 'me', 'sk'],
    ticketIds: [1105],
    features: [
      'New End of Day report screen',
      'Shipment Tracking improvement',
      'Dark mode basic support',
    ],
    fixes: [
      'Dark mode color contrast fixes',
    ],
    notes: 'Deployed to all countries simultaneously.',
  },
  {
    id: 'rel-4.1.2',
    version: '4.1.2',
    date: '2026-04-28',
    status: 'released',
    countries: ['hr', 'rs'],
    ticketIds: [],
    features: [],
    fixes: [
      'HR fiscalization certificate renewal',
      'RS POS device connection stability',
    ],
    notes: 'Country-specific hotfix.',
  },
  {
    id: 'rel-4.1.0',
    version: '4.1.0',
    codename: 'Carpathia',
    date: '2026-03-15',
    status: 'released',
    countries: ['hr', 'rs', 'si', 'ba', 'me', 'sk'],
    ticketIds: [],
    features: [
      'Hub Companion module',
      'Shipment Detail enhanced view',
      'Task List new filter options',
    ],
    fixes: [
      'Route Selection performance improvement',
      'Pick Up flow stabilization',
    ],
  },
  {
    id: 'rel-4.3.1',
    version: '4.3.1',
    date: '2026-07-15',
    status: 'staging',
    countries: ['hr', 'rs', 'si', 'ba', 'me'],
    ticketIds: [438, 1101],
    features: [],
    fixes: [
      'Double payment record — idempotency key + debounce',
      'Memory leak — observeForever → observe(viewLifecycleOwner)',
    ],
    breakingChanges: [
      'PaymentFragment API change — submitPayment() is now async',
    ],
    notes: 'Critical hotfix. Being tested in staging.',
  },
  {
    id: 'rel-4.4.0',
    version: '4.4.0',
    codename: 'Europa',
    date: '2026-08-15',
    status: 'planned',
    countries: ['hr', 'rs', 'si', 'ba', 'me', 'sk'],
    ticketIds: [437, 501, 801, 1001],
    features: [
      'ScanCoordinator — centralized barcode dispatcher',
      'SharedViewModel decomposition (Phase 1)',
      'GPS null-safe location handling',
    ],
    fixes: [
      'Fiscalization async migration',
      'Barcode scanning O(n⁴) → O(1) DB index',
    ],
    breakingChanges: [
      'SharedViewModel → feature-based ViewModels',
      'Barcode JSON blob → normalized table',
    ],
    notes: 'Major architectural migration release. Phase 0+1 deliverables.',
  },
  {
    id: 'rel-5.0.0',
    version: '5.0.0',
    codename: 'Fjord',
    date: '2026-11-01',
    status: 'planned',
    countries: ['core'],
    ticketIds: [803],
    features: [
      'Jetpack Compose UI migration',
      'Clean Architecture module structure',
      'Feature-based navigation',
    ],
    fixes: [],
    breakingChanges: [
      'All Fragments will be migrated to Compose',
      'New module structure — no backward compat',
    ],
    notes: 'Major version. Completion of the new architectural migration.',
  },
]

// ═══ Helpers ════════════════════════════════════════════════════════════════

export function getReleasedVersions() {
  return releases.filter((r) => r.status === 'released')
}

export function getLatestRelease() {
  return releases.filter((r) => r.status === 'released').sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function getReleaseByVersion(version: string) {
  return releases.find((r) => r.version === version)
}
