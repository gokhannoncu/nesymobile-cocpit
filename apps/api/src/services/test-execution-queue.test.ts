import { describe, expect, it } from 'vitest'
import {
  InMemoryTestExecutionQueueStore,
  TestExecutionQueue,
} from './test-execution-queue.js'

describe('test execution queue', () => {
  it('blocks dependent workflows when setup fails and leaves independents running', async () => {
    const queue = new TestExecutionQueue()
    await queue.enqueue({
      executionId: 'setup-1',
      runId: 'run-setup',
      workflowRef: 'login',
      dependencyKind: 'SETUP',
    })
    await queue.enqueue({
      executionId: 'dep-1',
      runId: 'run-dep',
      workflowRef: 'process-parcel',
      dependencyKind: 'DEPENDENT',
      dependsOnExecutionIds: ['setup-1'],
    })
    await queue.enqueue({
      executionId: 'ind-1',
      runId: 'run-ind',
      workflowRef: 'tour-approval',
      dependencyKind: 'INDEPENDENT',
    })
    await queue.markReady('ind-1')
    await queue.lease('ind-1', 'worker-1', 1_000, 5_000)
    await queue.failSetup('setup-1', 'login credential pool empty')

    const all = await queue.list()
    expect(all.find((row) => row.executionId === 'dep-1')).toMatchObject({
      lifecycle: 'TERMINAL',
      disposition: 'BLOCKED',
      productVerdict: 'NOT_EVALUATED',
      blockedReason: expect.stringMatching(/login/i),
    })
    expect(all.find((row) => row.executionId === 'ind-1')).toMatchObject({
      lifecycle: 'RUNNING',
      disposition: 'RETRYABLE',
    })
  })

  it('requeues stale leases without physical effect and orphans unknown in-flight effects', async () => {
    const store = new InMemoryTestExecutionQueueStore()
    const queue = new TestExecutionQueue(store, 200)

    await queue.enqueue({
      executionId: 'exec-requeue',
      runId: 'run-requeue',
      workflowRef: 'wf',
      dependencyKind: 'INDEPENDENT',
    })
    await queue.markReady('exec-requeue')
    await queue.lease('exec-requeue', 'worker-1', 1_000, 100)

    await queue.enqueue({
      executionId: 'exec-unknown',
      runId: 'run-unknown',
      workflowRef: 'wf-2',
      dependencyKind: 'INDEPENDENT',
    })
    await queue.markReady('exec-unknown')
    await queue.lease('exec-unknown', 'worker-2', 1_000, 100)
    const unknown = store.records.get('exec-unknown')
    if (unknown) {
      store.upsert({ ...unknown, occurrenceState: 'PHYSICAL_EFFECT_IN_FLIGHT' })
    }

    const recovered = await queue.recoverStale(1_301)
    expect(recovered.find((row) => row.executionId === 'exec-requeue')).toMatchObject({
      lifecycle: 'READY',
      disposition: 'RETRYABLE',
      schedulerDisposition: 'REQUEUED',
    })
    expect(recovered.find((row) => row.executionId === 'exec-unknown')).toMatchObject({
      lifecycle: 'TERMINAL',
      disposition: 'UNKNOWN_EFFECT',
      schedulerDisposition: 'WORKER_LOST',
    })
  })

  it('skips completed occurrences during recovery instead of re-executing them', async () => {
    const store = new InMemoryTestExecutionQueueStore()
    const queue = new TestExecutionQueue(store, 200)
    await queue.enqueue({
      executionId: 'exec-done',
      runId: 'run-done',
      workflowRef: 'wf',
      dependencyKind: 'INDEPENDENT',
    })
    await queue.markReady('exec-done')
    await queue.lease('exec-done', 'worker-1', 1_000, 100)
    const current = store.records.get('exec-done')
    if (current) {
      store.upsert({ ...current, occurrenceState: 'COMPLETED' })
    }

    const recovered = await queue.recoverStale(1_301)
    expect(recovered).toEqual([
      expect.objectContaining({
        executionId: 'exec-done',
        lifecycle: 'TERMINAL',
        disposition: 'COMPLETED',
        schedulerDisposition: 'RELEASED',
        occurrenceState: 'COMPLETED',
      }),
    ])
  })
})
