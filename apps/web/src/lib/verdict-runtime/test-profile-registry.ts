import type { TestProfileCatalogItemApi } from '@/lib/verdict-runtime/types'
import type { Tone } from '@/components/product/tones'
import { cn } from '@nesy/metronic/lib/utils'

export type TestProfileKind = TestProfileCatalogItemApi['kind']
export type TestProfileResult = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'NOT_RUN' | string

export const testProfileBadgeBase =
  'inline-flex rounded-[4px] border px-1.5 py-px text-[8px] font-bold uppercase tracking-wide leading-none'

export const testProfileBadgePrimary = cn(
  testProfileBadgeBase,
  'border-nesy/30 bg-nesy-soft text-nesy-ink dark:border-nesy/35 dark:bg-nesy-soft/20 dark:text-nesy',
)

export const testProfileBadgeSecondary = cn(
  testProfileBadgeBase,
  'border-nesy/25 bg-background text-nesy-ink dark:border-nesy/30 dark:bg-card dark:text-nesy',
)

export const testProfileBadgeWarning = cn(
  testProfileBadgeBase,
  'border-nesy-muted/70 bg-nesy-muted/25 text-nesy-ink dark:border-nesy/25 dark:bg-nesy-soft/10 dark:text-nesy',
)

export const testProfileBadgeNeutral = cn(
  testProfileBadgeBase,
  'border-border bg-muted/35 text-muted-foreground',
)

export function testProfileKindBadgeClass(kind: TestProfileKind | string): string {
  switch (kind) {
    case 'CORE':
      return testProfileBadgePrimary
    case 'PREVIEW':
      return testProfileBadgeSecondary
    case 'FAULT':
      return testProfileBadgeWarning
    case 'SOAK':
      return testProfileBadgeNeutral
    default:
      return testProfileBadgeNeutral
  }
}

export function testProfileResultBadgeClass(
  result: TestProfileResult,
  blocked = false,
): string {
  if (blocked) return testProfileBadgeWarning

  switch (result) {
    case 'PASS':
      return testProfileBadgePrimary
    case 'FAIL':
      return testProfileBadgeWarning
    case 'INCONCLUSIVE':
      return testProfileBadgeSecondary
    case 'NOT_RUN':
      return testProfileBadgeNeutral
    default:
      return testProfileBadgeNeutral
  }
}

export function testProfileGateBadgeClass(releaseGate: boolean): string | null {
  return releaseGate ? testProfileBadgePrimary : null
}

export function testProfileDetailHref(profileKey: string): string {
  return `/automation/test-profiles/${encodeURIComponent(profileKey)}`
}

export function testProfileIsBlocked(item: Pick<TestProfileCatalogItemApi, 'blockedReason'>): boolean {
  return Boolean(item.blockedReason?.trim())
}

export function testProfileKindTone(kind: TestProfileKind | string): Tone {
  switch (kind) {
    case 'CORE':
      return 'nesy'
    case 'PREVIEW':
      return 'teal'
    case 'SOAK':
      return 'gray'
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
      return 'red'
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
