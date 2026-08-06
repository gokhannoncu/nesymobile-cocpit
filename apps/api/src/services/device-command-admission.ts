/**
 * Durable device command admission facade for Phase 5 Device Lab / executor wiring.
 * Wraps run-scoped mutation ownership with explicit blocked reasons for UI/read models.
 */

export type AdmissionLaneKind = 'CONTROL' | 'OBSERVATION' | 'WAIT' | 'MUTATION'

export interface DeviceCommandAdmissionSnapshot {
  deviceId: string
  activeMutationOwnerRunId: string | null
  activeCounts: Readonly<Record<AdmissionLaneKind, number>>
  queuedCounts: Readonly<Record<AdmissionLaneKind, number>>
  blockedReason: string | null
}

export interface AcquireMutationResult {
  acquired: boolean
  ownerRunId: string | null
  blockedReason: string | null
}

export class DeviceCommandAdmission {
  private readonly mutationOwnerByDevice = new Map<string, string>()
  private readonly activeCounts = new Map<string, Record<AdmissionLaneKind, number>>()
  private readonly queuedCounts = new Map<string, Record<AdmissionLaneKind, number>>()

  acquireMutation(deviceId: string, runId: string): AcquireMutationResult {
    const owner = this.mutationOwnerByDevice.get(deviceId)
    if (owner !== undefined && owner !== runId) {
      return {
        acquired: false,
        ownerRunId: owner,
        blockedReason: `mutation lane owned by run ${owner}`,
      }
    }
    // Re-acquire by the current owner is idempotent: a retrying run must not
    // inflate the active lane count that a single releaseMutation can undo.
    if (owner === runId) {
      return { acquired: true, ownerRunId: runId, blockedReason: null }
    }
    this.mutationOwnerByDevice.set(deviceId, runId)
    this.bump(deviceId, 'MUTATION', 'active', 1)
    return { acquired: true, ownerRunId: runId, blockedReason: null }
  }

  releaseMutation(deviceId: string, runId: string): void {
    if (this.mutationOwnerByDevice.get(deviceId) === runId) {
      this.mutationOwnerByDevice.delete(deviceId)
      this.bump(deviceId, 'MUTATION', 'active', -1)
    }
  }

  beginLane(deviceId: string, lane: AdmissionLaneKind): void {
    this.bump(deviceId, lane, 'active', 1)
  }

  endLane(deviceId: string, lane: AdmissionLaneKind): void {
    this.bump(deviceId, lane, 'active', -1)
  }

  enqueue(deviceId: string, lane: AdmissionLaneKind): void {
    this.bump(deviceId, lane, 'queued', 1)
  }

  dequeue(deviceId: string, lane: AdmissionLaneKind): void {
    this.bump(deviceId, lane, 'queued', -1)
  }

  snapshot(deviceId: string): DeviceCommandAdmissionSnapshot {
    const owner = this.mutationOwnerByDevice.get(deviceId) ?? null
    return {
      deviceId,
      activeMutationOwnerRunId: owner,
      activeCounts: { ...this.counts(deviceId, 'active') },
      queuedCounts: { ...this.counts(deviceId, 'queued') },
      blockedReason: owner === null ? null : `mutation lane owned by run ${owner}`,
    }
  }

  private counts(
    deviceId: string,
    kind: 'active' | 'queued',
  ): Record<AdmissionLaneKind, number> {
    const map = kind === 'active' ? this.activeCounts : this.queuedCounts
    const existing = map.get(deviceId)
    if (existing) return existing
    const zero: Record<AdmissionLaneKind, number> = {
      CONTROL: 0,
      OBSERVATION: 0,
      WAIT: 0,
      MUTATION: 0,
    }
    map.set(deviceId, zero)
    return zero
  }

  private bump(
    deviceId: string,
    lane: AdmissionLaneKind,
    kind: 'active' | 'queued',
    delta: number,
  ): void {
    const counts = this.counts(deviceId, kind)
    counts[lane] = Math.max(0, counts[lane] + delta)
  }
}

export function createDeviceCommandAdmission(): DeviceCommandAdmission {
  return new DeviceCommandAdmission()
}
