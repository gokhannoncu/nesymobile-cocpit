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

export interface DeviceReadinessOptions {
  appId?: string
}

export class DeviceReadinessService {
  constructor(
    private readonly admission: DeviceCommandAdmission,
    private readonly probes: DeviceReadinessProbes = {},
  ) {}

  async get(deviceId: string, options: DeviceReadinessOptions = {}): Promise<DeviceReadinessSnapshot> {
    const admission = await this.admission.snapshot(deviceId)
    const context: DeviceReadinessProbeContext = {
      deviceId,
      appId: options.appId?.trim() || undefined,
    }
    const lanes: DeviceLaneHealth[] = [
      await lane('ADB', context, this.probes.adb),
      await lane('SDK_CONTROL', context, this.probes.sdkControl),
      await lane('SDK_EVENT_AUTH', context, this.probes.sdkEventAuth),
      await lane('DURABLE_INGEST', context, this.probes.durableIngest),
      await lane('BRIDGE', context, this.probes.bridge),
      await lane('ACT_MODE_POLICY', context, this.probes.actModePolicy),
      await lane('BACKEND_CREDENTIALS', context, this.probes.backendCredentials),
      await lane('LOCAL_DB', context, this.probes.localDb),
      await lane('ACTIVE_RUN', context, this.probes.activeRun),
      await lane('RECEIPT_BUS', context, this.probes.receiptBus),
      await lane('ORDERED_BUS', context, this.probes.orderedBus),
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
        remediation: 'run real DUT mutation acceptance on an allowlisted device',
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

/**
 * Probes receive the device id. Without it a probe cannot answer "is *this*
 * device healthy" and can only return a constant, which is how the ADB and
 * Bridge lanes previously reported UP for device ids that did not exist.
 */
export type DeviceReadinessProbe = (
  deviceId: string,
  context?: DeviceReadinessProbeContext,
) => ReadinessStatus | DeviceLaneHealth | Promise<ReadinessStatus | DeviceLaneHealth>

export interface DeviceReadinessProbeContext {
  deviceId: string
  appId?: string
}

export interface DeviceReadinessProbes {
  adb?: DeviceReadinessProbe
  sdkControl?: DeviceReadinessProbe
  sdkEventAuth?: DeviceReadinessProbe
  durableIngest?: DeviceReadinessProbe
  bridge?: DeviceReadinessProbe
  actModePolicy?: DeviceReadinessProbe
  backendCredentials?: DeviceReadinessProbe
  localDb?: DeviceReadinessProbe
  activeRun?: DeviceReadinessProbe
  receiptBus?: DeviceReadinessProbe
  orderedBus?: DeviceReadinessProbe
}

async function lane(
  name: string,
  context: DeviceReadinessProbeContext,
  probe?: DeviceReadinessProbe,
): Promise<DeviceLaneHealth> {
  if (probe === undefined) {
    return {
      lane: name,
      status: 'UNKNOWN',
      detail: 'probe not wired',
      remediation: 'wire readiness probe or accept partial state',
    }
  }
  try {
    const result = await probe(context.deviceId, context)
    if (typeof result === 'string') return { lane: name, status: result }
    return { ...result, lane: result.lane || name }
  } catch (error) {
    // A probe that throws is not evidence of health.
    return {
      lane: name,
      status: 'UNKNOWN',
      detail: error instanceof Error ? error.message : String(error),
      remediation: 'probe failed; treat lane state as unknown',
    }
  }
}
