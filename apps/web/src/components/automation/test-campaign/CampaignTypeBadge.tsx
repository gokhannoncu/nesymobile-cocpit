'use client'
import { Badge } from '@nesy/metronic/components/ui/badge'

export function CampaignTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    PR: 'bg-blue-100 text-blue-800 border-blue-200',
    NIGHTLY: 'bg-purple-100 text-purple-800 border-purple-200',
    WEEKLY: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    RELEASE: 'bg-green-100 text-green-800 border-green-200'
  }
  return <Badge variant="outline" className={`${colors[type] || ''}`}>{type}</Badge>
}
