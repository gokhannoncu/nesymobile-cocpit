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
      schedulerDisposition: 'RELEASED',
      operationalDisposition: 'OK',
    })

    expect(result.partial).toBe(false)
    expect(result.runtime).toMatchObject({
      engineType: 'BRIDGEFLOW',
      lifecycle: 'CLOSED',
      productVerdict: 'PASS_ONLINE',
      schedulerDisposition: 'RELEASED',
      operationalDisposition: 'OK',
    })
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
