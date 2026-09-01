'use client'

import { cn } from '@nesy/metronic/lib/utils'
import {
  testProfileKindTone,
  type TestProfileKind,
} from '@/lib/verdict-runtime/test-profile-registry'
import { toneIconBox, toneText } from '@/components/product/tones'

const profileKindBadgeClass =
  'inline-flex rounded-[4px] border border-current/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide leading-none'

export function TestProfileKindBadge({ kind }: { kind: string }) {
  const tone = testProfileKindTone(kind as TestProfileKind)

  return (
    <span
      className={cn(profileKindBadgeClass, toneIconBox[tone], toneText[tone])}
    >
      {kind}
    </span>
  )
}
