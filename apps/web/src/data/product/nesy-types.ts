// Nesy Mobile ürün tipi tanımları — circular dependency'yi önlemek için ayrıştırılmıştır.

export type CountryId = 'core' | 'hr' | 'si' | 'rs' | 'ba' | 'me' | 'sk'

export interface Country {
  id: CountryId
  name: string
  subtitle: string
  price: string
  status: 'Küresel' | 'Aktif' | 'Gelişmiş' | 'Kısıtlı'
  isPopular?: boolean
}

/* ═══════════════════════════════════════════════════════
 * Flow Diagram tipleri — görsel akış diyagramı için
 * ═══════════════════════════════════════════════════════ */

export type DiagramNodeVariant =
  | 'start'    // Başlangıç — yeşil/teal, play ikonu
  | 'process'  // İşlem adımı — mavi, dişli ikonu
  | 'decision' // Karar noktası — amber, soru ikonu
  | 'end'      // Son — yeşil, onay ikonu
  | 'error'    // Hata/başarısız — kırmızı, X ikonu
  | 'external' // Harici sistem — mor, bağlantı ikonu

export type DiagramElement =
  | { type: 'node'; label: string; variant: DiagramNodeVariant; desc?: string }
  | { type: 'arrow'; label?: string }
  | {
      type: 'branch'
      yes: { label: string; steps: DiagramElement[] }
      no: { label: string; steps: DiagramElement[] }
    }

/* ═══════════════════════════════════════════════════════ */

export interface FeatureDetail {
  /** Özellik hakkında detaylı açıklama — "Nedir?" */
  whatIs: string
  /** Nasıl çalışır — adım adım akış */
  howItWorks: string[]
  /** Hangi ekranda çalışıyor — mobil uygulama ekran/fragment bilgisi */
  screens: string[]
  /** Hangi parametrelere/config'lere bağlı */
  parameters: { name: string; desc: string; type: string }[]
  /** Görsel akış diyagramı — DiagramElement[] olarak yapılandırılmış */
  diagram?: DiagramElement[]
  /** Bilinmesi gereken trickler, dikkat edilecek noktalar */
  tips: string[]
  /** Bu özellik hakkında açılmış ticket'lar */
  tickets: { id: string; title: string; status: 'open' | 'closed' | 'in-progress'; url?: string }[]
  /** En çok know-how sahibi olan kişiler */
  experts: { name: string; role: string }[]
  /** Özellik skoru — bug proneness, boilerplate, hata riski */
  score: {
    bugProneness: 1 | 2 | 3 | 4 | 5
    boilerplate: 1 | 2 | 3 | 4 | 5
    complexity: 1 | 2 | 3 | 4 | 5
    testCoverage: 1 | 2 | 3 | 4 | 5
  }
  /** Hangi API endpoint'lerini kullanıyor */
  apis?: { method: string; endpoint: string; desc: string }[]
}

export interface Feature {
  id: string
  title: string
  desc: string
  /** Ülke bazlı davranış — '—' henüz yok, 'N/A' kapsam dışı, diğer her şey açıklama. */
  values: Record<CountryId, string>
  /** Detaylı bilgiler — popup'ta gösterilecek */
  detail?: FeatureDetail
}

export interface Module {
  id: string
  title: string
  desc: string
  features: Feature[]
}
