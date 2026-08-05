import type { DeviceCommandAdmission } from './device-command-admission.js'

export const DEVICE_READINESS_API_VERSION = 'verdict-runtime.v1' as const

export type ReadinessStatus = 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN' | 'BLOCKED'

export interface DeviceLaneHealth {
  lane: string
  status: ReadinessStatus
  detail?: string
  remediation?: string
}

export interface DeviceReadinessSnapshot {
  apiVersion: typeof DEVICE_READINESS_API_VERSION
  deviceId: string
  overall: ReadinessStatus
  lanes: readonly DeviceLaneHealth[]
  commandAdmission: {
    activeMutationOwnerRunId: string | null
    blockedReason: string | null
    activeCounts: Readonly<Record<string, number>>
    queuedCounts: Readonly<Record<string, number>>
  }
  externalBlockers: readonly { id: string; status: string; remediation: string }[]
  partial: boolean
}

export class DeviceReadinessService {
  constructor(
    private readonly admission: DeviceCommandAdmission,
    private readonly probes: {
      adb?: () => ReadinessStatus
      sdkControl?: () => ReadinessStatus
      sdkEventAuth?: () => ReadinessStatus
      durableIngest?: () => ReadinessStatus
      bridge?: () => ReadinessStatus
      backendCredentials?: () => ReadinessStatus
      localDb?: () => ReadinessStatus
      activeRun?: () => ReadinessStatus
      receiptBus?: () => ReadinessStatus
      orderedBus?: () => ReadinessStatus
    } = {},
  ) {}

  get(deviceId: string): DeviceReadinessSnapshot {
    const admission = this.admission.snapshot(deviceId)
    const lanes: DeviceLaneHealth[] = [
      lane('ADB', this.probes.adb),
      lane('SDK_CONTROL', this.probes.sdkControl),
      lane('SDK_EVENT_AUTH', this.probes.sdkEventAuth),
      lane('DURABLE_INGEST', this.probes.durableIngest),
      lane('BRIDGE', this.probes.bridge),
      lane('BACKEND_CREDENTIALS', this.probes.backendCredentials),
      lane('LOCAL_DB', this.probes.localDb),
      lane('ACTIVE_RUN', this.probes.activeRun),
      lane('RECEIPT_BUS', this.probes.receiptBus),
      lane('ORDERED_BUS', this.probes.orderedBus),
    ]
    if (admission.blockedReason) {
      lanes.push({
        lane: 'COMMAND_ADMISSION',
        status: 'BLOCKED',
        detail: admission.blockedReason,
        remediation: 'wait for active mutation owner to release or cancel the run',
      })
    } else {
      lanes.push({ lane: 'COMMAND_ADMISSION', status: 'UP' })
    }

    const externalBlockers = [
      {
        id: 'B-12',
        status: 'OPEN_EXTERNAL',
        remediation: 'stabilize production smoke handshake on approved lab device',
      },
      {
        id: 'CP3-DUT',
        status: 'OPEN_EXTERNAL',
        remediation: 'run real DUT mutation acceptance on userdebug/eng lab device',
      },
    ]

    const overall = lanes.some((item) => item.status === 'BLOCKED')
      ? 'BLOCKED'
      : lanes.some((item) => item.status === 'DOWN')
        ? 'DOWN'
        : lanes.some((item) => item.status === 'DEGRADED' || item.status === 'UNKNOWN')
          ? 'DEGRADED'
          : 'UP'

    return {
      apiVersion: DEVICE_READINESS_API_VERSION,
      deviceId,
      overall,
      lanes,
      commandAdmission: {
        activeMutationOwnerRunId: admission.activeMutationOwnerRunId,
        blockedReason: admission.blockedReason,
        activeCounts: admission.activeCounts,
        queuedCounts: admission.queuedCounts,
      },
      externalBlockers,
      partial: lanes.some((item) => item.status === 'UNKNOWN'),
    }
  }
}

function lane(name: string, probe?: () => ReadinessStatus): DeviceLaneHealth {
  if (probe === undefined) {
    return {
      lane: name,
      status: 'UNKNOWN',
      detail: 'probe not wired',
      remediation: 'wire readiness probe or accept partial state',
    }
  }
  return { lane: name, status: probe() }
}
