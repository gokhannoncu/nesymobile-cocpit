'use client'

import { cn } from '@nesy/metronic/lib/utils'
import { testProfileKindBadgeClass } from '@/lib/verdict-runtime/test-profile-registry'

export function TestProfileKindBadge({ kind }: { kind: string }) {
  return <span className={cn(testProfileKindBadgeClass(kind), 'max-w-[5.5rem] truncate')}>{kind}</span>
}
