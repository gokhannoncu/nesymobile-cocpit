import { describe, expect, it } from 'vitest'

import { toJsonSafe, toWorkflowRunApi } from './verdict-runtime-read-model.js'

describe('verdict runtime read model', () => {
  it('populates runtime DTO fields selected with camelCase aliases', () => {
    const result = toWorkflowRunApi({
      id: 'run-1',
      status: 'completed',
      engineType: 'BRIDGEFLOW',
      lifecycle: 'CLOSED',
      productVerdict: 'PASS_ONLINE',
      readinessStatus: 'INTERACTION_READY',
      readinessClass: null,
      readinessTrace: { version: 1, completed: [{ state: 'SDK_READY', monoTs: 42 }] },
      schedulerDisposition: 'RELEASED',
      operationalDisposition: 'OK',
      injectedFault: 'PROCESS_KILL',
      expectedClass: 'PROCESS_DEATH',
      observedClass: null,
      injectedFaultHost: 'A',
    })

    expect(result.partial).toBe(false)
    expect(result.runtime).toMatchObject({
      engineType: 'BRIDGEFLOW',
      lifecycle: 'CLOSED',
      productVerdict: 'PASS_ONLINE',
      readinessStatus: 'INTERACTION_READY',
      readinessTrace: { version: 1, completed: [{ state: 'SDK_READY', monoTs: 42 }] },
      schedulerDisposition: 'RELEASED',
      operationalDisposition: 'OK',
      injectedFault: 'PROCESS_KILL',
      expectedClass: 'PROCESS_DEATH',
      injectedFaultHost: 'A',
    })
    expect(result.runtime).not.toHaveProperty('observedClass')
  })

  it('keeps route correlation on the workflow run id when runtime row id is also selected', () => {
    const result = toWorkflowRunApi({
      id: 'bridgeflow-runtime-row-cuid',
      run_id: 'run-123',
      status: 'blocked',
      engine_type: 'BRIDGEFLOW',
    })

    expect(result.run.id).toBe('run-123')
    expect(result.correlation.runId).toBe('run-123')
  })

  it('serializes nested PostgreSQL bigint values for Fastify JSON responses', () => {
    expect(
      toJsonSafe({
        runEpochMs: 42n,
        transitions: [{ atMs: 99n }],
      }),
    ).toEqual({
      runEpochMs: '42',
      transitions: [{ atMs: '99' }],
    })
  })
})
