// Birleşik arama indeksi — ekranlar + backend domain'leri + bilinen sorunlar +
// araştırma araçları tek listede. Command-palette araması bunun üzerinde çalışır.

import { BACKEND_DOMAINS } from './backend-domains'
import { SCREENS } from './screens'
import type { SearchDoc } from './types'

const KNOWN_ISSUES: SearchDoc[] = [
  { id: 'issue-e28', kind: 'issue', title: 'E28 Orphan fiscal invoice', subtitle: 'Payment var, fiscal yok', href: '/engineering/edge-case-map', keywords: ['fiscal', 'fiş', 'orphan', 'reconciliation'] },
  { id: 'issue-e1', kind: 'issue', title: 'E1 Push refresh çakışması', subtitle: 'Schedule chunk üzerine yazma', href: '/engineering/edge-case-map', keywords: ['schedule', 'chunk', 'shipment kayboldu'] },
  { id: 'issue-401', kind: 'issue', title: '401 Session Expired davranışı', subtitle: 'Token yenileme ve re-auth', href: '/engineering/mobile-knowledge/backend/authentication', keywords: ['401', 'auth', 'oturum', 'token'] },
  { id: 'issue-inc', kind: 'issue', title: 'INC-2026-04 Fiscal fiş basılmıyor', subtitle: 'Printer recovery incident', href: '/engineering/incident-playbook', keywords: ['fiscal', 'printer', 'incident'] },
]

const TOOLS: SearchDoc[] = [
  { id: 'tool-mongo', kind: 'tool', title: 'MongoDB Query Generator', subtitle: 'Kaynak koleksiyonları sorgula', href: '/engineering/tools/mongodb-query-generator', keywords: ['mongo', 'reconciliation', 'query'] },
  { id: 'tool-graylog', kind: 'tool', title: 'Graylog Query Generator', subtitle: 'Log araştırması', href: '/engineering/tools/graylog-query-generator', keywords: ['graylog', 'log', '401', 'fiscal'] },
  { id: 'tool-locator', kind: 'tool', title: 'Data Locator', subtitle: 'Bir alanın kaynağını bul', href: '/engineering/tools/data-locator', keywords: ['data', 'source', 'lineage'] },
]

function backendDocs(): SearchDoc[] {
  return BACKEND_DOMAINS.map((d) => ({
    id: `backend-${d.slug}`,
    kind: 'backend' as const,
    title: d.title,
    subtitle: d.subtitle,
    href: `/engineering/mobile-knowledge/backend/${d.slug}`,
    keywords: [
      d.purpose,
      ...(d.endpoints?.map((e) => `${e.method} ${e.path}`) ?? []),
      ...(d.whenUsed ?? []),
    ],
  }))
}

function screenDocs(): SearchDoc[] {
  return SCREENS.map((s) => ({
    id: `screen-${s.slug}`,
    kind: 'screen' as const,
    title: s.title,
    subtitle: s.subtitle,
    href: `/engineering/mobile-knowledge/screens/${s.slug}`,
    keywords: [s.purpose, ...(s.buttons?.map((b) => b.element) ?? [])],
  }))
}

export const SEARCH_INDEX: SearchDoc[] = [
  ...screenDocs(),
  ...backendDocs(),
  ...KNOWN_ISSUES,
  ...TOOLS,
]

export const SEARCH_KIND_META: Record<SearchDoc['kind'], { label: string; order: number }> = {
  screen: { label: 'Screens', order: 0 },
  backend: { label: 'Backend', order: 1 },
  issue: { label: 'Known Issues', order: 2 },
  tool: { label: 'Investigation Tools', order: 3 },
}

/** Basit büyük/küçük harf duyarsız arama; başlık eşleşmesi önce gelir. */
export function searchDocs(query: string): SearchDoc[] {
  const q = query.trim().toLocaleLowerCase('tr')
  if (!q) return []
  const scored = SEARCH_INDEX.map((doc) => {
    const hay = [doc.title, doc.subtitle ?? '', ...(doc.keywords ?? [])]
      .join(' ')
      .toLocaleLowerCase('tr')
    if (!hay.includes(q)) return null
    const titleHit = doc.title.toLocaleLowerCase('tr').includes(q)
    return { doc, score: titleHit ? 0 : 1 }
  }).filter(Boolean) as { doc: SearchDoc; score: number }[]
  return scored.sort((a, b) => a.score - b.score).map((s) => s.doc)
}
