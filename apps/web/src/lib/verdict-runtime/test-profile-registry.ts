import type { TestProfileCatalogItemApi } from '@/lib/verdict-runtime/types'
import type { Tone } from '@/components/product/tones'
import { cn } from '@nesy/metronic/lib/utils'

export type TestProfileKind = TestProfileCatalogItemApi['kind']
export type TestProfileResult = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'NOT_RUN' | string

export const testProfileBadgeBase =
  'inline-flex items-center justify-center rounded-[4px] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide leading-none whitespace-nowrap'

export const testProfileResultBadgeBase =
  'inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide leading-none whitespace-nowrap'

const kindCoreBadge = cn(
  testProfileBadgeBase,
  'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-700/55 dark:bg-indigo-950/45 dark:text-indigo-200',
)

const kindPreviewBadge = cn(
  testProfileBadgeBase,
  'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-700/55 dark:bg-teal-950/45 dark:text-teal-200',
)

const kindFaultBadge = cn(
  testProfileBadgeBase,
  'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700/55 dark:bg-amber-950/45 dark:text-amber-200',
)

const badgeNeutral = cn(
  testProfileBadgeBase,
  'border-slate-200 bg-slate-50 text-slate-700 dark:border-border dark:bg-muted/45 dark:text-muted-foreground',
)

const resultPassBadge = cn(
  testProfileResultBadgeBase,
  'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700/55 dark:bg-emerald-950/45 dark:text-emerald-200',
)

const resultFailBadge = cn(
  testProfileResultBadgeBase,
  'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700/55 dark:bg-rose-950/45 dark:text-rose-200',
)

const resultInconclusiveBadge = cn(
  testProfileResultBadgeBase,
  'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-700/55 dark:bg-orange-950/45 dark:text-orange-200',
)

const resultNeutralBadge = cn(
  testProfileResultBadgeBase,
  'border-slate-200 bg-slate-100 text-slate-700 dark:border-border dark:bg-muted/50 dark:text-muted-foreground',
)

const resultBlockedBadge = cn(
  testProfileResultBadgeBase,
  'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700/55 dark:bg-amber-950/45 dark:text-amber-200',
)

const gateBadge = cn(
  testProfileResultBadgeBase,
  'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700/55 dark:bg-sky-950/45 dark:text-sky-200',
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
        'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-700/55 dark:bg-violet-950/45 dark:text-violet-200',
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
  if (blocked) return resultBlockedBadge

  switch (result) {
    case 'PASS':
      return resultPassBadge
    case 'FAIL':
      return resultFailBadge
    case 'INCONCLUSIVE':
      return resultInconclusiveBadge
    case 'NOT_RUN':
      return resultNeutralBadge
    default:
      return resultNeutralBadge
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
