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
      'D4Me düşük ışık QR okuma — otomatik flaş',
      'Bildirim kanalı ayrımı (tur/ödeme/genel)',
      'Dark mode WCAG AA kontrast iyileştirmesi',
    ],
    fixes: [
      'Vergi hesaplama yuvarlama farkı (SI) — BigDecimal geçişi',
      'Kamera izni reddedildiğinde crash düzeltmesi',
      'Teslimat başarısız neden kodları güncellemesi',
      'Harita marker flicker sorunu çözümü',
    ],
    notes: 'İlk üç ülkeye roll-out. BA/ME sonraki hafta planlanıyor.',
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
      'Fatura PDF encoding sorunu — UTF-8 font embed',
      'Manuel barkod giriş karakter limiti 20→40',
      'Bildirim ses/vibrasyon kanal ayrımı',
    ],
    notes: 'Hotfix release — sadece bug fix\'ler.',
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
      'Yeni End of Day rapor ekranı',
      'Shipment Tracking iyileştirmesi',
      'Dark mode temel destek',
    ],
    fixes: [
      'Dark mode renk kontrastı düzeltmeleri',
    ],
    notes: 'Tüm ülkelere aynı anda deploy.',
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
      'HR fiskalizasyon sertifika yenileme',
      'RS POS cihazı bağlantı stabilitesi',
    ],
    notes: 'Ülke-spesifik hotfix.',
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
      'Hub Companion modülü',
      'Shipment Detail gelişmiş görünüm',
      'Task List yeni filtre seçenekleri',
    ],
    fixes: [
      'Route Selection performans iyileştirmesi',
      'Pick Up akışı stabilizasyonu',
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
      'Çift ödeme kaydı — idempotency key + debounce',
      'Memory leak — observeForever → observe(viewLifecycleOwner)',
    ],
    breakingChanges: [
      'PaymentFragment API değişikliği — submitPayment() async oldu',
    ],
    notes: 'Kritik hotfix. Staging\'de test ediliyor.',
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
      'ScanCoordinator — merkezi barkod dispatcher',
      'SharedViewModel decomposition (Phase 1)',
      'GPS null-safe location handling',
    ],
    fixes: [
      'Fiskalizasyon async geçişi',
      'Barkod tarama O(n⁴) → O(1) DB index',
    ],
    breakingChanges: [
      'SharedViewModel → feature-based ViewModel\'ler',
      'Barcode JSON blob → normalized table',
    ],
    notes: 'Büyük mimari geçiş release\'i. Faz 0+1 deliverable\'ları.',
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
      'Clean Architecture module yapısı',
      'Feature-based navigation',
    ],
    fixes: [],
    breakingChanges: [
      'Tüm Fragment\'lar Compose\'a taşınacak',
      'Yeni modül yapısı — backward compat yok',
    ],
    notes: 'Major version. Yeni mimari geçişin tamamlanması.',
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
