'use client'

import { Shield, ShieldAlert, GitPullRequest } from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'

interface AdmissionData {
  counts: {
    control: number
    observation: number
    wait: number
    mutation: number
  }
  queueLength: number
  currentMutationOwner: string | null
  blockedReason: string | null
}

interface CommandAdmissionPanelProps {
  admission: AdmissionData
}

export function CommandAdmissionPanel({ admission }: CommandAdmissionPanelProps) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Command Admission
        </h3>
        <Badge variant={admission.blockedReason ? 'destructive' : 'outline'}>
          Queue: {admission.queueLength}
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="bg-slate-50 p-2 rounded">
          <div className="text-slate-500 mb-1">Control</div>
          <div className="font-mono text-lg">{admission.counts.control}</div>
        </div>
        <div className="bg-slate-50 p-2 rounded">
          <div className="text-slate-500 mb-1">Observation</div>
          <div className="font-mono text-lg">{admission.counts.observation}</div>
        </div>
        <div className="bg-slate-50 p-2 rounded">
          <div className="text-slate-500 mb-1">Wait</div>
          <div className="font-mono text-lg">{admission.counts.wait}</div>
        </div>
        <div className="bg-blue-50 p-2 rounded border border-blue-100">
          <div className="text-blue-600 mb-1">Mutation</div>
          <div className="font-mono text-lg text-blue-700">{admission.counts.mutation}</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm bg-slate-50 p-3 rounded-lg border">
        <div className="flex justify-between">
          <span className="text-slate-500 flex items-center gap-1">
            <GitPullRequest className="w-4 h-4" />
            Mutation Owner:
          </span>
          <span className="font-mono">{admission.currentMutationOwner || 'None'}</span>
        </div>
        {admission.blockedReason && (
          <div className="flex justify-between text-red-600 mt-1 pt-2 border-t border-slate-200">
            <span className="flex items-center gap-1">
              <ShieldAlert className="w-4 h-4" />
              Blocked:
            </span>
            <span>{admission.blockedReason}</span>
          </div>
        )}
      </div>
    </div>
  )
}
