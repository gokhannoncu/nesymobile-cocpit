import { describe, expect, it } from 'vitest'

import { resolveWorkflowRunDurationMs, toJsonSafe, toWorkflowRunApi } from './verdict-runtime-read-model.js'

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

  it('falls back to the runtime RS-STAGE target when the run and canvas did not pin one', () => {
    const result = toWorkflowRunApi({
      id: 'run-default-env',
      status: 'completed',
      country: null,
      environment: null,
    })

    expect(result.run).toMatchObject({
      country: 'RS',
      environment: 'STAGE',
    })
  })

  it('fills country and environment from the launch-app node when the run row left them empty', () => {
    const result = toWorkflowRunApi({
      id: 'run-env',
      status: 'completed',
      country: null,
      environment: null,
      launchCountry: 'RS',
      launchEnvironment: 'stage',
      workflowVersion: 1,
    })

    expect(result.run).toMatchObject({
      country: 'RS',
      environment: 'stage',
      workflowVersion: 1,
    })
  })

  it('passes device identity through the history DTO', () => {
    const result = toWorkflowRunApi({
      id: 'run-device',
      status: 'completed',
      deviceId: 'R6CW400BC8N',
      deviceModelName: 'SM-A346E',
      deviceLabel: 'Courier A',
      workflowVersion: 1,
    })

    expect(result.run).toMatchObject({
      deviceId: 'R6CW400BC8N',
      deviceModelName: 'SM-A346E',
      deviceLabel: 'Courier A',
      workflowVersion: 1,
    })
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

  it('fills missing run duration from startedAt and completedAt', () => {
    const result = toWorkflowRunApi({
      id: 'run-duration',
      status: 'completed',
      startedAt: new Date('2026-09-01T20:25:05.114Z'),
      completedAt: new Date('2026-09-01T20:25:41.132Z'),
      createdAt: new Date('2026-09-01T20:25:01.964Z'),
      duration: null,
    })

    expect(result.run.duration).toBe(36_018)
  })

  it('uses createdAt when a blocked run never received startedAt', () => {
    expect(
      resolveWorkflowRunDurationMs({
        status: 'blocked',
        startedAt: null,
        completedAt: '2026-09-01T20:26:49.949Z',
        createdAt: '2026-09-01T20:26:48.167Z',
        duration: null,
      }),
    ).toBe(1_782)
  })

  it('keeps an explicit stored duration instead of recomputing it', () => {
    expect(
      resolveWorkflowRunDurationMs({
        startedAt: '2026-09-01T20:00:00.000Z',
        completedAt: '2026-09-01T20:01:00.000Z',
        duration: 777,
      }),
    ).toBe(777)
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
