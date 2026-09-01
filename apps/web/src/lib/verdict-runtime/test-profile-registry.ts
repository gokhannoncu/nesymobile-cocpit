import type { TestProfileCatalogItemApi } from '@/lib/verdict-runtime/types'
import type { Tone } from '@/components/product/tones'

export type TestProfileKind = TestProfileCatalogItemApi['kind']
export type TestProfileResult = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'NOT_RUN' | string

export function testProfileDetailHref(profileKey: string): string {
  return `/automation/test-profiles/${encodeURIComponent(profileKey)}`
}

export function testProfileIsBlocked(item: Pick<TestProfileCatalogItemApi, 'blockedReason'>): boolean {
  return Boolean(item.blockedReason?.trim())
}

export function testProfileKindTone(kind: TestProfileKind | string): Tone {
  switch (kind) {
    case 'CORE':
      return 'blue'
    case 'PREVIEW':
      return 'purple'
    case 'SOAK':
      return 'teal'
    case 'FAULT':
      return 'orange'
    default:
      return 'gray'
  }
}

export function testProfileResultTone(result: TestProfileResult): Tone {
  switch (result) {
    case 'PASS':
      return 'teal'
    case 'FAIL':
      return 'orange'
    case 'INCONCLUSIVE':
      return 'amber'
    case 'NOT_RUN':
      return 'gray'
    default:
      return 'gray'
  }
}

export function countProfilesByKind(items: readonly TestProfileCatalogItemApi[]) {
  const counts: Record<TestProfileKind, number> = {
    CORE: 0,
    PREVIEW: 0,
    SOAK: 0,
    FAULT: 0,
  }
  for (const item of items) counts[item.kind] = (counts[item.kind] ?? 0) + 1
  return counts
}

export function formatProfilePackLabel(item: Pick<TestProfileCatalogItemApi, 'packKey' | 'packVersion'>): string {
  return `${item.packKey}@v${item.packVersion}`
}
