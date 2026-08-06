'use client'
import { Badge } from '@nesy/metronic/components/ui/badge'

export function TestProfileKindBadge({ kind }: { kind: string }) {
  const colors: Record<string, string> = {
    SMOKE: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    REGRESSION: 'bg-purple-100 text-purple-800 border-purple-200',
    ACCEPTANCE: 'bg-blue-100 text-blue-800 border-blue-200',
    PERFORMANCE: 'bg-orange-100 text-orange-800 border-orange-200',
    CUSTOM: 'bg-gray-100 text-gray-800 border-gray-200'
  }
  return (
    <Badge variant="outline" className={`${colors[kind] || colors.CUSTOM}`}>
      {kind}
    </Badge>
  )
}
