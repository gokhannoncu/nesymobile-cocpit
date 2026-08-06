/**
 * Device command admission with injectable mutation-ownership lease store.
 *
 * Mutation exclusive ownership is durable across process restarts when a
 * shared/persisted {@link DeviceMutationLeaseStore} is supplied. Lane active /
 * queued counts remain process-local operational gauges (not ownership).
 *
 * Default store is in-memory; production wiring uses the Prisma-backed store
 * over `verdict_resource_lease` (conflictGroup = device-mutation).
 */

export type AdmissionLaneKind = 'CONTROL' | 'OBSERVATION' | 'WAIT' | 'MUTATION'

export const DEVICE_MUTATION_LEASE_TTL_MS = 60_000
export const DEVICE_MUTATION_CONFLICT_GROUP = 'device-mutation' as const

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

export interface DeviceMutationLeaseRecord {
  leaseId: string
  runId: string
  resourceId: string
  conflictGroup: typeof DEVICE_MUTATION_CONFLICT_GROUP
  exclusive: true
  state: 'HELD' | 'RELEASED'
  leasedAtMs: number
  expiresAtMs: number
  releasedAtMs?: number
}

export interface DeviceMutationLeaseStore {
  listActive(nowMs: number): Promise<readonly DeviceMutationLeaseRecord[]>
  upsert(record: DeviceMutationLeaseRecord): Promise<void>
}

export class InMemoryDeviceMutationLeaseStore implements DeviceMutationLeaseStore {
  readonly leases = new Map<string, DeviceMutationLeaseRecord>()

  async listActive(nowMs: number): Promise<readonly DeviceMutationLeaseRecord[]> {
    const active: DeviceMutationLeaseRecord[] = []
    for (const lease of this.leases.values()) {
      if (lease.state !== 'HELD' || lease.releasedAtMs !== undefined) continue
      if (lease.expiresAtMs <= nowMs) continue
      active.push({ ...lease })
    }
    return active
  }

  async upsert(record: DeviceMutationLeaseRecord): Promise<void> {
    this.leases.set(record.leaseId, { ...record })
  }
}

export class DeviceCommandAdmission {
  private readonly activeCounts = new Map<string, Record<AdmissionLaneKind, number>>()
  private readonly queuedCounts = new Map<string, Record<AdmissionLaneKind, number>>()

  constructor(
    private readonly leaseStore: DeviceMutationLeaseStore = new InMemoryDeviceMutationLeaseStore(),
    private readonly ttlMs: number = DEVICE_MUTATION_LEASE_TTL_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async acquireMutation(deviceId: string, runId: string): Promise<AcquireMutationResult> {
    const nowMs = this.now()
    const owner = await this.activeOwner(deviceId, nowMs)
    if (owner !== null && owner !== runId) {
      return {
        acquired: false,
        ownerRunId: owner,
        blockedReason: `mutation lane owned by run ${owner}`,
      }
    }
    // Re-acquire by the current owner renews the lease without inflating the
    // active lane count that a single releaseMutation can undo.
    if (owner === runId) {
      await this.writeLease(deviceId, runId, nowMs)
      return { acquired: true, ownerRunId: runId, blockedReason: null }
    }
    await this.writeLease(deviceId, runId, nowMs)
    this.bump(deviceId, 'MUTATION', 'active', 1)
    return { acquired: true, ownerRunId: runId, blockedReason: null }
  }

  async releaseMutation(deviceId: string, runId: string): Promise<void> {
    const nowMs = this.now()
    const owner = await this.activeOwner(deviceId, nowMs)
    if (owner !== runId) return
    const leaseId = leaseIdFor(deviceId, runId)
    await this.leaseStore.upsert({
      leaseId,
      runId,
      resourceId: deviceId,
      conflictGroup: DEVICE_MUTATION_CONFLICT_GROUP,
      exclusive: true,
      state: 'RELEASED',
      leasedAtMs: nowMs,
      expiresAtMs: nowMs,
      releasedAtMs: nowMs,
    })
    this.bump(deviceId, 'MUTATION', 'active', -1)
  }

  async renewMutation(deviceId: string, runId: string): Promise<boolean> {
    const nowMs = this.now()
    const owner = await this.activeOwner(deviceId, nowMs)
    if (owner !== runId) return false
    await this.writeLease(deviceId, runId, nowMs)
    return true
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

  async snapshot(deviceId: string): Promise<DeviceCommandAdmissionSnapshot> {
    const owner = await this.activeOwner(deviceId, this.now())
    return {
      deviceId,
      activeMutationOwnerRunId: owner,
      activeCounts: { ...this.counts(deviceId, 'active') },
      queuedCounts: { ...this.counts(deviceId, 'queued') },
      blockedReason: owner === null ? null : `mutation lane owned by run ${owner}`,
    }
  }

  private async activeOwner(deviceId: string, nowMs: number): Promise<string | null> {
    const active = await this.leaseStore.listActive(nowMs)
    const held = active.find(
      (lease) =>
        lease.resourceId === deviceId && lease.conflictGroup === DEVICE_MUTATION_CONFLICT_GROUP,
    )
    return held?.runId ?? null
  }

  private async writeLease(deviceId: string, runId: string, nowMs: number): Promise<void> {
    await this.leaseStore.upsert({
      leaseId: leaseIdFor(deviceId, runId),
      runId,
      resourceId: deviceId,
      conflictGroup: DEVICE_MUTATION_CONFLICT_GROUP,
      exclusive: true,
      state: 'HELD',
      leasedAtMs: nowMs,
      expiresAtMs: nowMs + this.ttlMs,
    })
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

export function createDeviceCommandAdmission(
  store: DeviceMutationLeaseStore = new InMemoryDeviceMutationLeaseStore(),
): DeviceCommandAdmission {
  return new DeviceCommandAdmission(store)
}

function leaseIdFor(deviceId: string, runId: string): string {
  return `device-mutation:${deviceId}:${runId}`
}
