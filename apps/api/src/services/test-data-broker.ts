import {
  createResourcePool,
  leaseResource,
  markResourceForReconciliation,
  releaseResource,
  type BrokerResource,
  type ResourceLease,
  type ResourceLeaseResult,
  type ResourcePool,
  type ResourceReleaseAttempt,
} from '@nesy/execution-contract'

export interface DurableResourceLeaseRecord {
  leaseId: string
  runId: string
  resourceId: string
  conflictGroup: string
  exclusive: boolean
  state: BrokerResource['state']
  reconciliationReason?: string
  leasedAtMs: number
  releasedAtMs?: number
}

export interface TestDataBrokerPersistence {
  upsertLease(record: DurableResourceLeaseRecord): Promise<void> | void
  listActiveLeases(): Promise<readonly DurableResourceLeaseRecord[]> | readonly DurableResourceLeaseRecord[]
}

export class InMemoryTestDataBrokerPersistence implements TestDataBrokerPersistence {
  readonly leases = new Map<string, DurableResourceLeaseRecord>()

  upsertLease(record: DurableResourceLeaseRecord): void {
    this.leases.set(record.leaseId, { ...record })
  }

  listActiveLeases(): readonly DurableResourceLeaseRecord[] {
    return [...this.leases.values()].filter((lease) => lease.releasedAtMs === undefined)
  }
}

export class TestDataBroker {
  private readonly pool: ResourcePool

  constructor(
    resources: readonly BrokerResource[],
    private readonly persistence: TestDataBrokerPersistence = new InMemoryTestDataBrokerPersistence(),
  ) {
    this.pool = createResourcePool(resources)
  }

  async acquire(lease: ResourceLease): Promise<ResourceLeaseResult> {
    const result = leaseResource(this.pool, lease)
    if (result.ok) {
      await this.persistence.upsertLease({
        leaseId: lease.leaseId,
        runId: lease.runId,
        resourceId: lease.resourceId,
        conflictGroup: lease.conflictGroup,
        exclusive: lease.exclusive,
        state: 'DIRTY',
        leasedAtMs: lease.leasedAtMs,
      })
    }
    return result
  }

  async markReconciliation(
    resourceId: string,
    reason: 'UNKNOWN_EFFECT' | 'PARTIAL_FAILURE',
  ): Promise<void> {
    markResourceForReconciliation(this.pool, resourceId, reason)
    for (const lease of await this.persistence.listActiveLeases()) {
      if (lease.resourceId === resourceId) {
        await this.persistence.upsertLease({
          ...lease,
          state: 'RECONCILIATION_REQUIRED',
          reconciliationReason: reason,
        })
      }
    }
  }

  async release(leaseId: string, releasedAtMs: number): Promise<ResourceReleaseAttempt> {
    const result = releaseResource(this.pool, leaseId)
    const active = (await this.persistence.listActiveLeases()).find(
      (lease) => lease.leaseId === leaseId,
    )
    if (active !== undefined) {
      await this.persistence.upsertLease({
        ...active,
        state: result.ok ? 'CLEAN' : active.state,
        releasedAtMs: result.ok ? releasedAtMs : active.releasedAtMs,
        reconciliationReason:
          result.ok ? undefined : (active.reconciliationReason ?? 'RECONCILIATION_REQUIRED'),
      })
    }
    return result
  }

  resourceState(resourceId: string): BrokerResource['state'] | undefined {
    return this.pool.resources.get(resourceId)?.state
  }
}
