'use client'

import { Activity, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'

export interface HealthLaneData {
  id: string
  name: string
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN'
  lastCheck: string
  details?: string
}

interface DeviceHealthLaneProps {
  lane: HealthLaneData
}

export function DeviceHealthLane({ lane }: DeviceHealthLaneProps) {
  const getStatusIcon = () => {
    switch (lane.status) {
      case 'HEALTHY': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'DEGRADED': return <Activity className="w-5 h-5 text-amber-500" />
      case 'UNHEALTHY': return <AlertCircle className="w-5 h-5 text-red-500" />
      default: return <HelpCircle className="w-5 h-5 text-slate-400" />
    }
  }

  const getBadgeVariant = () => {
    switch (lane.status) {
      case 'HEALTHY': return 'primary'
      case 'DEGRADED': return 'secondary'
      case 'UNHEALTHY': return 'destructive'
      default: return 'outline'
    }
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm">
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div>
          <h4 className="font-semibold text-sm">{lane.name}</h4>
          {lane.details && (
            <p className="text-xs text-slate-500">{lane.details}</p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant={getBadgeVariant()} className="text-[10px] uppercase">
          {lane.status}
        </Badge>
        <span className="text-[10px] text-slate-400 font-mono">Last: {lane.lastCheck}</span>
      </div>
    </div>
  )
}
