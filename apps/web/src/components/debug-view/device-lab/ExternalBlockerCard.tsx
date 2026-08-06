'use client'

import { AlertOctagon, User, CheckCircle2 } from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'

export interface ExternalBlocker {
  id: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
  remediationSteps: string[]
  owner: string | null
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED'
}

interface ExternalBlockerCardProps {
  blocker: ExternalBlocker
}

export function ExternalBlockerCard({ blocker }: ExternalBlockerCardProps) {
  const getSeverityColor = () => {
    switch (blocker.severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200'
      case 'HIGH': return 'bg-amber-100 text-amber-800 border-amber-200'
      default: return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  return (
    <div className="border border-red-200 rounded-lg p-4 bg-red-50/30 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-red-600" />
          <h4 className="font-semibold text-red-900">{blocker.id}</h4>
          <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${getSeverityColor()}`}>
            {blocker.severity}
          </span>
        </div>
        <Badge variant={blocker.status === 'RESOLVED' ? 'primary' : 'outline'}>
          {blocker.status}
        </Badge>
      </div>

      <p className="text-sm text-slate-700">{blocker.description}</p>

      {blocker.remediationSteps.length > 0 && (
        <div className="bg-white p-3 rounded border text-sm">
          <h5 className="font-semibold text-slate-700 mb-2">Remediation Steps:</h5>
          <ol className="list-decimal list-inside space-y-1 text-slate-600">
            {blocker.remediationSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pt-3 border-t border-red-100">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User className="w-4 h-4" />
          {blocker.owner ? `Assigned to: ${blocker.owner}` : 'Unassigned'}
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Mark Resolved
        </Button>
      </div>
    </div>
  )
}
