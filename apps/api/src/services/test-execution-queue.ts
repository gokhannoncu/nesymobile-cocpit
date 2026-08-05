import {
  decideSchedulerRecovery,
  type SchedulerOccurrenceState,
  type TestExecutionDisposition,
  type TestExecutionLifecycle,
} from '@nesy/execution-contract'
import type { ProductVerdict, SchedulerDisposition } from '@nesy/workflow-contract'

export type WorkflowDependencyKind = 'SETUP' | 'DEPENDENT' | 'INDEPENDENT'

export interface QueueExecutionRecord {
  executionId: string
  runId: string
  workflowRef: string
  dependencyKind: WorkflowDependencyKind
  dependsOnExecutionIds: readonly string[]
  lifecycle: TestExecutionLifecycle
  disposition: TestExecutionDisposition
  schedulerDisposition: SchedulerDisposition
  productVerdict: ProductVerdict
  leaseOwner?: string
  leaseExpiresAtMs?: number
  heartbeatAtMs?: number
  occurrenceState: SchedulerOccurrenceState
  blockedReason?: string
}

export interface TestExecutionQueueStore {
  list(): Promise<readonly QueueExecutionRecord[]> | readonly QueueExecutionRecord[]
  upsert(record: QueueExecutionRecord): Promise<void> | void
}

export class InMemoryTestExecutionQueueStore implements TestExecutionQueueStore {
  readonly records = new Map<string, QueueExecutionRecord>()

  list(): readonly QueueExecutionRecord[] {
    return [...this.records.values()]
  }

  upsert(record: QueueExecutionRecord): void {
    this.records.set(record.executionId, { ...record })
  }
}

export class TestExecutionQueue {
  constructor(
    private readonly store: TestExecutionQueueStore = new InMemoryTestExecutionQueueStore(),
    private readonly heartbeatTimeoutMs = 1_000,
  ) {}

  async enqueue(input: {
    executionId: string
    runId: string
    workflowRef: string
    dependencyKind: WorkflowDependencyKind
    dependsOnExecutionIds?: readonly string[]
  }): Promise<QueueExecutionRecord> {
    const record: QueueExecutionRecord = {
      executionId: input.executionId,
      runId: input.runId,
      workflowRef: input.workflowRef,
      dependencyKind: input.dependencyKind,
      dependsOnExecutionIds: input.dependsOnExecutionIds ?? [],
      lifecycle: 'PENDING',
      disposition: 'BLOCKED',
      schedulerDisposition: 'NOT_SCHEDULED',
      productVerdict: 'NOT_EVALUATED',
      occurrenceState: 'NOT_STARTED',
    }
    await this.store.upsert(record)
    return record
  }

  async markReady(executionId: string): Promise<QueueExecutionRecord> {
    const current = await this.require(executionId)
    const next = {
      ...current,
      lifecycle: 'READY' as const,
      disposition: 'RETRYABLE' as const,
      schedulerDisposition: 'SCHEDULED' as const,
    }
    await this.store.upsert(next)
    return next
  }

  async lease(
    executionId: string,
    workerId: string,
    nowMs: number,
    leaseTtlMs: number,
  ): Promise<QueueExecutionRecord> {
    const current = await this.require(executionId)
    if (current.lifecycle !== 'READY' && current.lifecycle !== 'PENDING') {
      throw new Error(`cannot lease execution in lifecycle ${current.lifecycle}`)
    }
    const next: QueueExecutionRecord = {
      ...current,
      lifecycle: 'RUNNING',
      disposition: 'RETRYABLE',
      schedulerDisposition: 'LEASED',
      leaseOwner: workerId,
      leaseExpiresAtMs: nowMs + leaseTtlMs,
      heartbeatAtMs: nowMs,
    }
    await this.store.upsert(next)
    return next
  }

  async heartbeat(executionId: string, workerId: string, nowMs: number): Promise<boolean> {
    const current = await this.require(executionId)
    if (current.leaseOwner !== workerId || current.lifecycle !== 'RUNNING') return false
    await this.store.upsert({
      ...current,
      heartbeatAtMs: nowMs,
      leaseExpiresAtMs: Math.max(current.leaseExpiresAtMs ?? nowMs, nowMs + this.heartbeatTimeoutMs),
    })
    return true
  }

  async complete(
    executionId: string,
    productVerdict: ProductVerdict = 'NOT_EVALUATED',
  ): Promise<QueueExecutionRecord> {
    const current = await this.require(executionId)
    const next: QueueExecutionRecord = {
      ...current,
      lifecycle: 'TERMINAL',
      disposition: 'COMPLETED',
      schedulerDisposition: 'RELEASED',
      productVerdict,
      occurrenceState: 'COMPLETED',
    }
    await this.store.upsert(next)
    await this.propagateDependencyBlocks()
    return next
  }

  async failSetup(executionId: string, blockedReason: string): Promise<QueueExecutionRecord> {
    const current = await this.require(executionId)
    const next: QueueExecutionRecord = {
      ...current,
      lifecycle: 'TERMINAL',
      disposition: 'BLOCKED',
      schedulerDisposition: 'RELEASED',
      productVerdict: 'NOT_EVALUATED',
      blockedReason,
    }
    await this.store.upsert(next)
    await this.propagateDependencyBlocks()
    return next
  }

  async recoverStale(nowMs: number): Promise<readonly QueueExecutionRecord[]> {
    const changed: QueueExecutionRecord[] = []
    for (const record of await this.store.list()) {
      if (record.lifecycle === 'TERMINAL') continue
      const decision = decideSchedulerRecovery({
        lifecycle: record.lifecycle,
        schedulerDisposition: record.schedulerDisposition,
        disposition: record.disposition,
        leaseOwner: record.leaseOwner,
        leaseExpiresAtMs: record.leaseExpiresAtMs,
        heartbeatAtMs: record.heartbeatAtMs,
        heartbeatTimeoutMs: this.heartbeatTimeoutMs,
        nowMs,
        occurrenceState: record.occurrenceState,
      })
      if (decision.action === 'KEEP_LEASE' || decision.action === 'KEEP_TERMINAL') continue
      const next: QueueExecutionRecord = {
        ...record,
        lifecycle: decision.lifecycle,
        schedulerDisposition: decision.schedulerDisposition,
        disposition: decision.disposition,
        ...(decision.action === 'REQUEUE'
          ? { leaseOwner: undefined, leaseExpiresAtMs: undefined, heartbeatAtMs: undefined }
          : {}),
        ...(decision.action === 'SKIP_COMPLETED'
          ? { occurrenceState: 'COMPLETED' as const }
          : {}),
      }
      await this.store.upsert(next)
      changed.push(next)
    }
    return changed
  }

  async list(): Promise<readonly QueueExecutionRecord[]> {
    return this.store.list()
  }

  private async propagateDependencyBlocks(): Promise<void> {
    const all = await this.store.list()
    const byId = new Map(all.map((record) => [record.executionId, record]))
    for (const record of all) {
      if (record.dependencyKind !== 'DEPENDENT' || record.lifecycle === 'TERMINAL') continue
      const blockers = record.dependsOnExecutionIds
        .map((id) => byId.get(id))
        .filter((dep): dep is QueueExecutionRecord => dep !== undefined)
        .filter(
          (dep) =>
            dep.lifecycle === 'TERMINAL' &&
            (dep.disposition === 'BLOCKED' ||
              dep.disposition === 'ORPHANED' ||
              dep.disposition === 'UNKNOWN_EFFECT' ||
              dep.disposition === 'RECONCILIATION_REQUIRED'),
        )
      if (blockers.length === 0) continue
      const next: QueueExecutionRecord = {
        ...record,
        lifecycle: 'TERMINAL',
        disposition: 'BLOCKED',
        schedulerDisposition: 'RELEASED',
        productVerdict: 'NOT_EVALUATED',
        blockedReason: `blocked by ${blockers[0]?.workflowRef ?? 'dependency'}`,
      }
      await this.store.upsert(next)
    }
  }

  private async require(executionId: string): Promise<QueueExecutionRecord> {
    const record = (await this.store.list()).find((item) => item.executionId === executionId)
    if (record === undefined) throw new Error(`unknown execution ${executionId}`)
    return record
  }
}
