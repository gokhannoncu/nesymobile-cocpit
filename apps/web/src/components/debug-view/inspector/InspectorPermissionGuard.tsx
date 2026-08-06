'use client'

import { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'

interface InspectorPermissionGuardProps {
  mode: 'OBSERVE_ONLY' | 'OBSERVE_AND_ACT'
  isProduction: boolean
  children: ReactNode
  actAction?: () => void
}

export function InspectorPermissionGuard({
  mode,
  isProduction,
  children,
  actAction
}: InspectorPermissionGuardProps) {
  const canAct = mode === 'OBSERVE_AND_ACT' && !isProduction

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between bg-slate-50 border p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Badge variant={mode === 'OBSERVE_AND_ACT' ? 'primary' : 'secondary'}>
            {mode}
          </Badge>
          {isProduction && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Production Mode
            </Badge>
          )}
        </div>
        <div className="text-sm text-slate-500">
          {!canAct ? 'Actions disabled in current mode/environment. API is fail-closed.' : 'Act permissions granted.'}
        </div>
      </div>
      <div className={!canAct ? 'opacity-80 pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  )
}
