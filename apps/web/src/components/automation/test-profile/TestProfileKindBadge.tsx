'use client'

import { cn } from '@nesy/metronic/lib/utils'
import {
  testProfileKindTone,
  type TestProfileKind,
} from '@/lib/verdict-runtime/test-profile-registry'
import { toneIconBox, toneText } from '@/components/product/tones'

export function TestProfileKindBadge({ kind }: { kind: string }) {
  const tone = testProfileKindTone(kind as TestProfileKind)

  return (
    <span
      className={cn(
        'inline-flex rounded-[8px] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide',
        toneIconBox[tone],
        toneText[tone],
      )}
    >
      {kind}
    </span>
  )
}
