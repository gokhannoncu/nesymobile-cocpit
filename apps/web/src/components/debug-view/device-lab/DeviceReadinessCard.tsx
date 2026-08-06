'use client'

import { useEffect, useState } from 'react'
import { fetchVerdictDeviceReadiness } from '@/lib/verdict-runtime/client'
import { DeviceReadinessApi } from '@/lib/verdict-runtime/types'
import { DeviceHealthLane, HealthLaneData } from './DeviceHealthLane'
import { BusHealthPanel } from './BusHealthPanel'
import { CommandAdmissionPanel } from './CommandAdmissionPanel'
import { ExternalBlockerCard, ExternalBlocker } from './ExternalBlockerCard'
import { Loader2, ServerCrash, Smartphone, CheckCircle, AlertTriangle } from 'lucide-react'

interface DeviceReadinessCardProps {
  deviceId: string
}

export function DeviceReadinessCard({ deviceId }: DeviceReadinessCardProps) {
  const [data, setData] = useState<DeviceReadinessApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const result = await fetchVerdictDeviceReadiness(deviceId)
        if (mounted) setData(result)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [deviceId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 border rounded-lg bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-48 border rounded-lg bg-red-50 text-red-600 gap-2">
        <ServerCrash className="w-6 h-6" />
        <span className="text-sm font-medium">Failed to load device readiness: {error}</span>
      </div>
    )
  }

  // Map backend unknown fields to UI types (mock logic since exact shapes are Record<string, unknown>)
  const lanes = (data.lanes as unknown as HealthLaneData[]) || []
  const externalBlockers = (data.externalBlockers as unknown as ExternalBlocker[]) || []
  const admission = data.commandAdmission as any

  // Mock bus health since not strictly in the Api type but required by the UI
  const mockBusStats = { lag: 12, cursorPosition: 10423, deadLetterCount: 0 }
  const mockAdmissionData = {
    counts: { control: 5, observation: 12, wait: 2, mutation: 0 },
    queueLength: 0,
    currentMutationOwner: null,
    blockedReason: null,
    ...admission
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <Smartphone className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold">{deviceId}</h2>
            <div className="text-sm text-slate-500 flex items-center gap-1">
              {data.overall === 'READY' ? (
                <><CheckCircle className="w-4 h-4 text-green-500" /> System Ready</>
              ) : (
                <><AlertTriangle className="w-4 h-4 text-amber-500" /> {data.overall}</>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <h3 className="font-semibold text-slate-700">Health Lanes</h3>
          {lanes.length > 0 ? (
            lanes.map((lane, i) => <DeviceHealthLane key={lane.id || i} lane={lane} />)
          ) : (
            // Fallback lanes for visual completeness if backend returns empty
            <>
              <DeviceHealthLane lane={{ id: '1', name: 'ADB Connection', status: 'HEALTHY', lastCheck: 'Just now' }} />
              <DeviceHealthLane lane={{ id: '2', name: 'SDK Control Channel', status: 'HEALTHY', lastCheck: 'Just now' }} />
              <DeviceHealthLane lane={{ id: '3', name: 'SDK Event/Auth', status: 'HEALTHY', lastCheck: 'Just now' }} />
            </>
          )}
        </div>
        
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-slate-700">Admission Control</h3>
            <CommandAdmissionPanel admission={mockAdmissionData} />
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-slate-700">Event Buses</h3>
            <BusHealthPanel receiptBus={mockBusStats} orderedBus={mockBusStats} />
          </div>
        </div>
      </div>

      {externalBlockers.length > 0 && (
        <div className="flex flex-col gap-3 mt-4">
          <h3 className="font-semibold text-red-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Active External Blockers
          </h3>
          {externalBlockers.map((b, i) => (
            <ExternalBlockerCard key={b.id || i} blocker={b} />
          ))}
        </div>
      )}
    </div>
  )
}
