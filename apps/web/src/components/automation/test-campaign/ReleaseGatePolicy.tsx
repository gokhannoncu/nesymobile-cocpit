'use client'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { ShieldCheck, ShieldAlert } from 'lucide-react'

export function ReleaseGatePolicy({ failedCells }: { failedCells: string[] }) {
  const pass = failedCells.length === 0
  return (
    <div className={`p-4 rounded-md border flex items-center gap-4 ${pass ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {pass ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
      <div>
        <h4 className="font-medium">Release Gate Policy: {pass ? 'APPROVED' : 'BLOCKED'}</h4>
        <p className="text-sm opacity-80">
          {pass ? 'All required criteria met.' : `${failedCells.length} cells are failing required policies.`}
        </p>
      </div>
    </div>
  )
}
