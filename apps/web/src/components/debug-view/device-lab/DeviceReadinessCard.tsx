'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchVerdictDeviceReadiness } from '@/lib/verdict-runtime/client'
import type { DeviceReadinessApi } from '@/lib/verdict-runtime/types'
import { DeviceHealthLane, type HealthLaneData } from './DeviceHealthLane'
import { BusHealthPanel, type BusStats } from './BusHealthPanel'
import { CommandAdmissionPanel } from './CommandAdmissionPanel'
import { ExternalBlockerCard, type ExternalBlocker } from './ExternalBlockerCard'
import { Loader2, ServerCrash, Smartphone, CheckCircle, AlertTriangle } from 'lucide-react'

interface DeviceReadinessCardProps {
  deviceId: string
}

function mapLaneStatus(
  status: string,
): HealthLaneData['status'] {
  const key = status.toUpperCase()
  if (key === 'UP' || key === 'READY' || key === 'HEALTHY') return 'HEALTHY'
  if (key === 'DEGRADED') return 'DEGRADED'
  if (key === 'DOWN' || key === 'UNHEALTHY' || key === 'BLOCKED') return 'UNHEALTHY'
  return 'UNKNOWN'
}

function busFromLane(
  lanes: readonly { lane?: string; status?: string; detail?: string }[],
  name: string,
): BusStats {
  const hit = lanes.find((l) => String(l.lane).toUpperCase() === name)
  if (!hit) {
    return { lag: -1, cursorPosition: 0, deadLetterCount: 0, status: 'UNKNOWN' }
  }
  const status = mapLaneStatus(String(hit.status ?? 'UNKNOWN'))
  return {
    lag: status === 'HEALTHY' ? 0 : status === 'DEGRADED' ? 250 : -1,
    cursorPosition: 0,
    deadLetterCount: status === 'UNHEALTHY' ? 1 : 0,
    status,
    detail: typeof hit.detail === 'string' ? hit.detail : undefined,
  }
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
        if (mounted) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [deviceId])

  const lanes: HealthLaneData[] = useMemo(() => {
    const raw = (data?.lanes ?? []) as {
      lane?: string
      status?: string
      detail?: string
    }[]
    return raw.map((lane, i) => ({
      id: String(lane.lane ?? i),
      name: String(lane.lane ?? `lane-${i}`),
      status: mapLaneStatus(String(lane.status ?? 'UNKNOWN')),
      lastCheck: 'runtime',
      details: typeof lane.detail === 'string' ? lane.detail : undefined,
    }))
  }, [data])

  const receiptBus = useMemo(
    () => busFromLane((data?.lanes ?? []) as { lane?: string; status?: string; detail?: string }[], 'RECEIPT_BUS'),
    [data],
  )
  const orderedBus = useMemo(
    () => busFromLane((data?.lanes ?? []) as { lane?: string; status?: string; detail?: string }[], 'ORDERED_BUS'),
    [data],
  )

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

  const externalBlockers: ExternalBlocker[] = (data.externalBlockers ?? []).map((raw, i) => {
    const b = raw as Record<string, unknown>
    return {
      id: String(b.id ?? `blocker-${i}`),
      severity: 'HIGH',
      description: String(b.remediation ?? b.status ?? b.id ?? 'External blocker'),
      remediationSteps: [String(b.remediation ?? 'See Device Lab remediation')],
      owner: typeof b.owner === 'string' ? b.owner : null,
      status: String(b.status).includes('RESOLVED') ? 'RESOLVED' : 'OPEN',
    }
  })
  const admission = (data.commandAdmission ?? {}) as Record<string, unknown>
  const activeCounts = (admission.activeCounts ?? {}) as Record<string, unknown>
  const queuedCounts = (admission.queuedCounts ?? {}) as Record<string, unknown>
  const admissionData = {
    counts: {
      control: Number(activeCounts.control ?? 0),
      observation: Number(activeCounts.observation ?? 0),
      wait: Number(activeCounts.wait ?? 0),
      mutation: Number(activeCounts.mutation ?? 0),
    },
    queueLength: Object.values(queuedCounts).reduce((sum: number, value) => sum + Number(value), 0),
    currentMutationOwner:
      typeof admission.activeMutationOwnerRunId === 'string'
        ? admission.activeMutationOwnerRunId
        : null,
    blockedReason:
      typeof admission.blockedReason === 'string' ? admission.blockedReason : null,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <Smartphone className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold">{deviceId}</h2>
            <div className="text-sm text-slate-500 flex items-center gap-1">
              {data.overall === 'UP' || data.overall === 'READY' ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" /> System Ready
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> {data.overall}
                  {data.partial ? ' · partial' : ''}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <h3 className="font-semibold text-slate-700">Health Lanes</h3>
          {lanes.length > 0 ? (
            lanes.map((lane) => <DeviceHealthLane key={lane.id} lane={lane} />)
          ) : (
            <p className="text-sm text-muted-foreground">No readiness lanes returned.</p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-slate-700">Admission Control</h3>
            <CommandAdmissionPanel admission={admissionData} />
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-slate-700">Event Buses</h3>
            <BusHealthPanel receiptBus={receiptBus} orderedBus={orderedBus} />
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
