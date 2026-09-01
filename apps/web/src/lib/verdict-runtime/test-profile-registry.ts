import type { TestProfileCatalogItemApi } from '@/lib/verdict-runtime/types'
import type { Tone } from '@/components/product/tones'
import { cn } from '@nesy/metronic/lib/utils'

export type TestProfileKind = TestProfileCatalogItemApi['kind']
export type TestProfileResult = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'NOT_RUN' | string

export const testProfileBadgeBase =
  'inline-flex rounded-[4px] px-1.5 py-px text-[8px] font-bold uppercase tracking-wide leading-none ring-1 ring-inset'

const kindCoreBadge = cn(
  testProfileBadgeBase,
  'bg-indigo-50 text-indigo-700 ring-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800/50',
)

const kindPreviewBadge = cn(
  testProfileBadgeBase,
  'bg-teal-50 text-teal-700 ring-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-800/50',
)

const kindFaultBadge = cn(
  testProfileBadgeBase,
  'bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/50',
)

const badgeNeutral = cn(
  testProfileBadgeBase,
  'bg-slate-100 text-slate-600 ring-slate-200/80 dark:bg-muted/40 dark:text-muted-foreground dark:ring-border/80',
)

const resultPassBadge = cn(
  testProfileBadgeBase,
  'bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50',
)

const resultFailBadge = cn(
  testProfileBadgeBase,
  'bg-rose-50 text-rose-700 ring-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/50',
)

const resultInconclusiveBadge = cn(
  testProfileBadgeBase,
  'bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/50',
)

const gateBadge = cn(
  testProfileBadgeBase,
  'bg-sky-50 text-sky-700 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/50',
)

/** @deprecated Use semantic kind/result helpers instead. */
export const testProfileBadgePrimary = kindCoreBadge

/** @deprecated Use semantic kind/result helpers instead. */
export const testProfileBadgeSecondary = kindPreviewBadge

/** @deprecated Use semantic kind/result helpers instead. */
export const testProfileBadgeWarning = kindFaultBadge

/** @deprecated Use semantic kind/result helpers instead. */
export const testProfileBadgeNeutral = badgeNeutral

export function testProfileKindBadgeClass(kind: TestProfileKind | string): string {
  switch (kind) {
    case 'CORE':
    case 'RELEASE':
      return kindCoreBadge
    case 'PREVIEW':
      return kindPreviewBadge
    case 'FAULT':
    case 'BAD_DAY':
      return kindFaultBadge
    case 'DIFFERENTIAL':
      return cn(
        testProfileBadgeBase,
        'bg-violet-50 text-violet-700 ring-violet-200/80 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50',
      )
    case 'SOAK':
    case 'DIAGNOSTIC':
      return badgeNeutral
    default:
      return badgeNeutral
  }
}

export function testProfileResultBadgeClass(
  result: TestProfileResult,
  blocked = false,
): string {
  if (blocked) return kindFaultBadge

  switch (result) {
    case 'PASS':
      return resultPassBadge
    case 'FAIL':
      return resultFailBadge
    case 'INCONCLUSIVE':
      return resultInconclusiveBadge
    case 'NOT_RUN':
      return badgeNeutral
    default:
      return badgeNeutral
  }
}

export function testProfileGateBadgeClass(releaseGate: boolean): string | null {
  return releaseGate ? gateBadge : null
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
    case 'RELEASE':
      return 'indigo'
    case 'PREVIEW':
      return 'teal'
    case 'SOAK':
    case 'DIAGNOSTIC':
      return 'gray'
    case 'FAULT':
    case 'BAD_DAY':
      return 'amber'
    case 'DIFFERENTIAL':
      return 'purple'
    default:
      return 'gray'
  }
}

export function testProfileResultTone(result: TestProfileResult): Tone {
  switch (result) {
    case 'PASS':
      return 'green'
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
